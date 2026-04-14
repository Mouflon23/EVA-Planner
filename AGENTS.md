# AGENTS.md

## Cursor Cloud specific instructions

### Overview

EVA-Planner is a Discord bot (Node.js / discord.js v14) for team coordination — slash commands, task management, recurring event scheduling, and reaction-based RSVP. It is a single-service application with no build step (plain CommonJS JavaScript).

### Running the bot

See `README.md` for full setup. Key commands:

- `npm install` — install dependencies
- `npm run deploy:commands` — register slash commands with Discord (one-time, requires valid credentials)
- `npm start` — start the bot (`node src/index.js`)
- `npm test` — placeholder (no automated tests yet)

### Required secrets

The bot **cannot start** without these environment variables (validated at startup in `src/config.js`):

| Secret | Purpose |
|---|---|
| `DISCORD_TOKEN` | Bot token from Discord Developer Portal |
| `CLIENT_ID` | Discord application/client ID |
| `GUILD_ID` | Target Discord server ID for slash command deployment |

These must be added as Cursor Cloud secrets or set in `.env` (copied from `.env.example`).

### Optional configuration

| Variable | Default | Purpose |
|---|---|---|
| `MONGODB_URI` | (empty) | MongoDB connection string; if unset, in-memory storage is used (data lost on restart) |
| `EVENT_TIMEZONE` | `UTC` | Timezone label for event display/parsing (supports `UTC`, `UTC+2`, `UTC-05:30`, etc.) |
| `SCHEDULER_POLL_SECONDS` | `60` | Polling interval for recurring event scheduler |

### Key caveats

- The application code lives on the `cursor/discord-bot-starter-aa5c` branch, not `main`. The `main` branch only has LICENSE and README.
- There is no linter, formatter, or CI configured in this repository.
- The `.env` file is git-ignored. Copy `.env.example` to `.env` and fill in real credentials before running.
- Without valid Discord credentials, both `npm start` and `npm run deploy:commands` will fail with auth errors — this is expected behavior, not a bug.
- MongoDB is optional. The bot gracefully falls back to in-memory storage if `MONGODB_URI` is not set or the connection fails.
