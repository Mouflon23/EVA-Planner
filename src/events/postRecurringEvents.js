const { buildEventMessagePayload } = require("./eventMessagePayload");

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function addWeeks(date, weeks) {
  return new Date(date.getTime() + weeks * WEEK_MS);
}

async function postDueEvents(client) {
  const eventStore = client.eventStore;
  if (!eventStore) {
    return;
  }

  const now = new Date();
  const dueEvents = await eventStore.listDueEvents({ nowIso: now.toISOString() });
  const timezoneLabel = client.timezoneLabel || "UTC";

  for (const event of dueEvents) {
    try {
      const channel = await client.channels.fetch(event.channelId);
      if (!channel || !channel.isTextBased()) {
        continue;
      }

      const payload = buildEventMessagePayload({
        event,
        timezoneLabel,
        rsvpSummary: {
          accepted: [],
          declined: [],
          tentative: [],
        },
        allowMentionPing: true,
      });
      const message = await channel.send(payload);

      let nextPostAtDate = addWeeks(new Date(event.nextPostAt), 1);
      let nextOccurrenceDate = eventStore.addDaysToDateOnly(
        event.nextOccurrenceDate,
        7
      );

      while (nextPostAtDate <= now) {
        nextPostAtDate = addWeeks(nextPostAtDate, 1);
        nextOccurrenceDate = eventStore.addDaysToDateOnly(nextOccurrenceDate, 7);
      }

      await eventStore.markEventPosted({
        guildId: event.guildId,
        id: event.id,
        nextPostAt: nextPostAtDate.toISOString(),
        nextOccurrenceDate,
        lastPostedAt: now.toISOString(),
        lastMessageId: message.id,
      });
    } catch (error) {
      console.error(`Failed to post recurring event #${event.id}:`, error);
    }
  }
}

function startRecurringEventPosting(client, pollSeconds = 60) {
  const intervalMs = Math.max(15, pollSeconds) * 1000;

  const run = async () => {
    await postDueEvents(client);
  };

  run().catch((error) => {
    console.error("Initial recurring event loop failed:", error);
  });

  const timer = setInterval(() => {
    run().catch((error) => {
      console.error("Recurring event loop failed:", error);
    });
  }, intervalMs);

  return () => clearInterval(timer);
}

module.exports = {
  startRecurringEventPosting,
};
