# Fireteam Finder

A Discord bot for organizing **Destiny 2** Looking-For-Group (LFG) activities. Players create a listing for a raid, dungeon, or any activity through a guided menu, and the bot spins up a dedicated text + voice channel, a private role, and a live roster that updates as people join, leave, or queue as substitutes — then tears it all down automatically when the activity is over.

Built with [discord.js](https://discord.js.org/) v14 on Node.js.

---

## Features

- **Guided listing creation** — a multi-step wizard (activity type → activity → difficulty → details) walks the host through setup using select menus and a modal form, with natural-language start times like `tomorrow at 8pm EST` or `in 2 hours`.
- **Automatic channel management** — each listing gets its own category, text channel, and voice channel (with a user limit matching the fireteam size), all locked to participants via a per-listing role.
- **Live roster** — an embed shows current members, open slots, and substitutes, and updates in real time as the fireteam changes.
- **Substitute queue** — when a fireteam is full, extra players join a FIFO waitlist. If a spot opens, the next substitute is offered it by DM and auto-passed to the following person if they don't respond in time.
- **Host controls** — inline buttons let the host add/remove players, add/remove slots, transfer host, extend the runtime, or cancel the listing.
- **Moderator overrides** — server admins (or configured admin roles) can manage any listing, with every override written to an audit log.
- **Automatic cleanup** — a scheduled job removes expired listings and deletes their channels and roles, so the server doesn't fill up with dead activities. Listings can also be made indefinite.

## Commands

| Command | Description |
| --- | --- |
| `/lfg` | Start the guided wizard to create a new listing |
| `/listings` | View all active listings |
| `/cancel <id>` | Cancel a listing and clean up its channels |
| `/extend <id> <hours>` | Extend a listing's runtime (or make it indefinite) |
| `/addplayer <id>` · `/removeplayer <id>` | Manage the roster |
| `/addspot <id>` · `/removespot <id>` | Resize the fireteam |
| `/transferhost <id>` | Hand the listing to another member |
| `/tag <add\|remove\|list>` | Manage tags like `sherpa`, `lowman`, `flawless` |
| `/help` | Show usage help |

Most actions are also available as buttons directly on the listing and host-control messages.

## Tech stack

- **Node.js** + **discord.js v14** (slash commands, buttons, select menus, modals)
- **node-cron** for scheduled cleanup
- Plain JavaScript with a service-oriented structure — no database; active state lives in memory

## Architecture

The codebase separates Discord I/O from business logic so each piece stays small and testable:

```
src/
├── index.js              # Client bootstrap, event wiring, graceful shutdown
├── commands/             # One module per slash command (+ registration)
├── interactions/         # Routers for buttons, select menus, and modals
│   ├── buttons/          #   participant, host-control, substitute, flow buttons
│   └── modals/           #   form handlers (details, add/remove player, etc.)
├── services/             # Core logic: listings, channels, messages,
│                         #   sessions, notifications, cleanup
├── models/               # Listing domain model
├── config/               # Env loading + Destiny activity definitions
└── utils/                # Embeds, UI builders, date parsing, logging, permissions
```

A few design notes:

- **Listings** are the central domain model and own their own rules (capacity, expiry, host transfer, substitute promotion), keeping the Discord handlers thin.
- **Sessions** track each user's progress through the creation wizard as a small state machine, with automatic timeout cleanup.
- **Interaction routing** is centralized: a single dispatcher decides whether to defer a reply (and how) based on whether the interaction will open a modal, which avoids Discord's "Unknown Interaction" errors.
- **Resource cleanup** always deletes children before parents and tolerates partial failures, so a missing channel or role never leaves the bot in a broken state.

> **Note on persistence:** active listings are held in memory, so a restart clears them. This keeps the project dependency-free; adding a database (or a JSON snapshot) is the natural next step for production use.

> **Developer note — generalizing beyond Destiny 2:** the bot is currently wired specifically to Destiny 2 (fixed activity lists, difficulties, and fireteam sizes in `config/activities.js`, plus Destiny-flavored wording throughout). The underlying engine — guided listing creation, channel/role provisioning, live rosters, substitute queues, and scheduled cleanup — is game-agnostic. A future direction is to lift the Destiny-specific data into a swappable configuration (or per-guild templates) so the same bot can run LFG for any game or group activity, rather than being hard-wired to one title.

## Getting started

### Prerequisites

- Node.js 16 or newer
- A Discord application + bot token ([Discord Developer Portal](https://discord.com/developers/applications))

### Setup

```bash
git clone https://github.com/N041M/Fireteam-Finder.git
cd Fireteam-Finder
npm install
```

Copy the example environment file and fill in your bot's credentials:

```bash
cp .env.example .env
```

| Variable | Required | Description |
| --- | --- | --- |
| `TOKEN` | ✅ | Bot token from the Developer Portal |
| `CLIENT_ID` | ✅ | Application (client) ID |
| `GUILD_ID` | — | Register commands to one guild for instant updates (omit for global) |
| `LFG_CHANNEL_ID` | — | Channel where listings are posted |
| `SHERPA_ROLE_ID` | — | Role granted extra permissions in created channels |
| `ADMIN_ROLE_IDS` | — | Comma-separated roles allowed to moderate any listing |
| `DEBUG` | — | Set to `true` for verbose logging |

### Bot permissions

The bot needs the **Server Members** and **Message Content** privileged intents enabled in the Developer Portal, plus permission to manage channels, roles, and messages in your server.

### Run

```bash
npm start      # production
npm run dev    # auto-restart on change (nodemon)
```

## License

MIT
