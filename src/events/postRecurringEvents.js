const AVAILABLE_EMOJI = "✅";
const NOT_AVAILABLE_EMOJI = "❌";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function addWeeks(date, weeks) {
  return new Date(date.getTime() + weeks * WEEK_MS);
}

function weekdayName(index) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][index] ?? "Unknown";
}

function buildEventText(event, timezoneLabel) {
  return [
    `📣 **EVA Event #${event.id}**`,
    `**Date:** ${event.nextOccurrenceDate}`,
    `**Time:** ${event.startTime} - ${event.endTime} (${timezoneLabel})`,
    `**Description:** ${event.description}`,
    "",
    `React with ${AVAILABLE_EMOJI} if you are available.`,
    `React with ${NOT_AVAILABLE_EMOJI} if you are not available.`,
    "",
    `Posted every **${weekdayName(event.postWeekday)} ${event.postTime} (${timezoneLabel})**.`,
  ].join("\n");
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

      const message = await channel.send(buildEventText(event, timezoneLabel));
      await message.react(AVAILABLE_EMOJI);
      await message.react(NOT_AVAILABLE_EMOJI);

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
  AVAILABLE_EMOJI,
  NOT_AVAILABLE_EMOJI,
  startRecurringEventPosting,
};
