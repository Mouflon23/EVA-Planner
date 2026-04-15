# .cursor local notes

This project now includes a Discord bot starter for the EVA team.

Use this as a quick checklist in Cursor:

1. Copy `.env.example` to `.env`.
2. Set `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID`.
3. Optional: set `MONGODB_URI` for persistent event storage.
4. Optional: set `EVENT_TIMEZONE` (default `UTC`) and `SCHEDULER_POLL_SECONDS`.
5. Run `npm run deploy:commands` to register slash commands.
6. Run `npm start` to start the bot.
7. Use `/weekstart show` or `/weekstart set day:<weekday>` to configure week start day.
8. Create recurring sessions with `/event create` (title, slots like `20h40 HP, 21h20 HC`, optional mention mode or mention role + reservation URL).
9. Players RSVP directly on the posted embed with buttons: ✅ Accept / ❌ Decline, plus Edit/Delete controls.
