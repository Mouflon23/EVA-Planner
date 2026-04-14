# EVA Planner Discord Bot

Discord bot starter for the EVA team with:
- Slash commands (`/ping`, `/checkin`, `/task add`, `/task list`, `/event ...`)
- Weekly recurring event announcements
- Reaction-based RSVP on posted event messages
- Optional MongoDB-backed storage
- Fast local setup and command deployment

## 1) Create your Discord application

1. Go to <https://discord.com/developers/applications>
2. Create a **New Application**
3. Open **Bot** tab, then create a bot and copy the token
4. Under **OAuth2 > URL Generator**, select scopes:
   - `bot`
   - `applications.commands`
5. Select bot permissions:
   - Send Messages
   - Read Message History
6. Open the generated URL and add the bot to your server

## 2) Configure environment variables

Copy the example env file and fill values:

```bash
cp .env.example .env
```

Required variables:
- `DISCORD_TOKEN` - bot token from Discord developer portal
- `CLIENT_ID` - application ID
- `GUILD_ID` - target server ID where slash commands are deployed

Optional variable:
- `MONGODB_URI` - if set, tasks are persisted in MongoDB. If not set, tasks are in-memory only.
- `EVENT_TIMEZONE` - timezone label for event schedule display and parsing (default: `UTC`, also supports `UTC+2`, `UTC-05:30`, etc.)
- `SCHEDULER_POLL_SECONDS` - how often the recurring event scheduler checks for due posts (default: `60`)

## 3) Install and run

```bash
npm install
npm run deploy:commands
npm start
```

## 4) Available commands

- `/ping` -> health check
- `/checkin status:<text>` -> share EVA team check-in update
- `/task add title:<text>` -> add a task
- `/task list` -> show open tasks for your server
- `/task done id:<number>` -> mark a task as done
- `/event create` -> create a recurring weekly event announcement
- `/event list` -> list configured recurring events
- `/event remove id:<number>` -> remove a recurring event

### `/event create` fields

- `date` -> first event date (`YYYY-MM-DD`)
- `start` -> event start time (`HH:MM`, 24h)
- `end` -> event end time (`HH:MM`, 24h)
- `description` -> event text shown in the announcement message
- `post_day` -> weekday when the bot should post each weekly event
- `post_time` -> time when the bot should post each week
- `channel` (optional) -> channel where event announcements are posted

When the bot posts the event message, it automatically adds:
- `✅` = available
- `❌` = not available

Players can react directly to RSVP.

## MongoDB notes

The bot can run without MongoDB. To persist tasks and recurring events, set `MONGODB_URI` in `.env`.

Collection used:
- Database: `eva_planner`
- Collections: `tasks`, `events`

Each task stores:
- guild ID
- creator user ID
- title
- creation timestamp
