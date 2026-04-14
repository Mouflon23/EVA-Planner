# .cursor local notes

This project now includes a Discord bot starter for the EVA team.

Use this as a quick checklist in Cursor:

1. Copy `.env.example` to `.env`.
2. Set `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID`.
3. Optional: set `MONGODB_URI` for persistent task/event storage.
4. Optional: set `TIMEZONE_LABEL` (default `UTC`) and `SCHEDULER_POLL_SECONDS`.
5. Run `npm run deploy:commands` to register slash commands.
6. Run `npm start` to start the bot.
7. Create recurring events with `/event create`, then users react with ✅ or ❌.
