# EVA Planner Discord Bot

Discord bot starter for the EVA team with:
- Slash commands (`/ping`, `/checkin`, `/weekstart`, `/event ...`)
- Weekly recurring EVA session announcements
- Embed-based session messages (slots, calendar link, RSVP columns)
- Interactive RSVP + edit + delete buttons
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
- `MONGODB_URI` - if set, events/settings are persisted in MongoDB. If not set, data is in-memory only.
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
- `/weekstart show` -> show the configured first day of week
- `/weekstart set day:<weekday>` -> set the first day of week (Manage Server required)
- `/event create` -> create a recurring weekly EVA session announcement
- `/event list` -> list configured recurring events
- `/event remove id:<number>` -> remove a recurring event

### `/event create` fields

- `date` -> first event date (`YYYY-MM-DD`)
- `title` -> session title (example: `Session Mercredi`)
- `start` -> event start time (`HH:MM` or `HHhMM`)
- `end` -> event end time (`HH:MM` or `HHhMM`)
- `description` -> text shown in the session embed
- `slots` -> comma-separated reservation slots (`20h40 HP, 21h20 HP, 22h00 HC`)
- `reservation_url` (optional) -> default EVA reservation URL for all slots
- `mention` (optional) -> `none`, `@everyone`, `@here`, or `role`
- `mention_role` (optional) -> role to mention when `mention=role`
- `location` (optional) -> location text shown in session embed
- `post_day` -> weekday when the bot should post each weekly event (optional: defaults to `/weekstart` setting)
- `post_time` -> time when the bot should post each week
- `channel` (optional) -> channel where event announcements are posted

When the bot posts the session message, it includes:
- rich embed layout (title, slots with HP/HC, time range, Google calendar link)
- optional location field (if set)
- RSVP columns:
  - `✅ Accepted`
  - `❌ Declined`
- dedicated `Add to Google` link button
- action buttons:
  - `Accept`, `Decline`
  - `Edit` (creator/admin)
  - `Delete` (creator/admin)

Button clicks update counts and participant lists in-place.

## MongoDB notes

The bot can run without MongoDB. To persist recurring sessions and week-start settings, set `MONGODB_URI` in `.env`.

Collection used:
- Database: `eva_planner`
- Collections: `events`, `guild_settings`
