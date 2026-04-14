const { ChannelType, SlashCommandBuilder } = require("discord.js");
const { parseSlotsInput, slotsSummary } = require("../events/slotParser");

const WEEKDAYS = [
  { name: "Sunday", value: 0 },
  { name: "Monday", value: 1 },
  { name: "Tuesday", value: 2 },
  { name: "Wednesday", value: 3 },
  { name: "Thursday", value: 4 },
  { name: "Friday", value: 5 },
  { name: "Saturday", value: 6 },
];

function normalizeHour(value) {
  const match = /^([01]\d|2[0-3])(?::|h)([0-5]\d)$/i.exec(value);
  if (!match) {
    return null;
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
    label: `${match[1]}:${match[2]}`,
  };
}

function weekdayName(index) {
  const entry = WEEKDAYS.find((item) => item.value === index);
  return entry ? entry.name : "Unknown";
}

function parseTimezoneOffset(label) {
  const normalized = label.trim().toUpperCase();
  if (normalized === "UTC" || normalized === "GMT") {
    return 0;
  }

  const match = /^(UTC|GMT)([+-])(\d{1,2})(?::?([0-5]\d))?$/.exec(normalized);
  if (!match) {
    return null;
  }

  const sign = match[2] === "+" ? 1 : -1;
  const hours = Number(match[3]);
  const minutes = Number(match[4] || "0");
  if (hours > 14) {
    return null;
  }
  return sign * (hours * 60 + minutes);
}

function buildPostingReferenceDate(timezoneOffsetMinutes) {
  return new Date(Date.now() + timezoneOffsetMinutes * 60 * 1000);
}

function parseIsoDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("event")
    .setDescription("Manage recurring EVA event announcements")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Create a recurring weekly event announcement")
        .addStringOption((option) =>
          option
            .setName("title")
            .setDescription("Session title")
            .setRequired(true)
            .setMaxLength(120)
        )
        .addStringOption((option) =>
          option
            .setName("date")
            .setDescription("First event date in YYYY-MM-DD")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("start")
            .setDescription("Event start hour in HH:MM (24h)")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("end")
            .setDescription("Event end hour in HH:MM (24h)")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("description")
            .setDescription("Event description")
            .setRequired(true)
            .setMaxLength(500)
        )
        .addStringOption((option) =>
          option
            .setName("slots")
            .setDescription("Comma-separated slots: `20h40 HP, 21h20 HP, 22h00 HC`")
            .setRequired(true)
            .setMaxLength(500)
        )
        .addStringOption((option) =>
          option
            .setName("reservation_url")
            .setDescription("Default EVA reservation URL for all slots")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("mention")
            .setDescription("Mention mode when posting session message")
            .setRequired(false)
            .addChoices(
              { name: "No mention", value: "none" },
              { name: "@everyone", value: "everyone" },
              { name: "@here", value: "here" }
            )
        )
        .addIntegerOption((option) => {
          let configured = option
            .setName("post_day")
            .setDescription("Day of week to post this event")
            .setRequired(false);

          for (const weekday of WEEKDAYS) {
            configured = configured.addChoices({
              name: weekday.name,
              value: weekday.value,
            });
          }
          return configured;
        })
        .addStringOption((option) =>
          option
            .setName("post_time")
            .setDescription("Time to post each week in HH:MM (24h, local timezone)")
            .setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Channel where event announcement is posted")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List configured recurring events")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Remove a configured recurring event")
        .addIntegerOption((option) =>
          option
            .setName("id")
            .setDescription("Event ID from /event list")
            .setRequired(true)
        )
    ),
  async execute(interaction) {
    const eventStore = interaction.client.eventStore;
    const guildId = interaction.guildId;
    const subcommand = interaction.options.getSubcommand();

    if (!eventStore || !guildId) {
      await interaction.reply({
        content: "Event store is unavailable in this context.",
        ephemeral: true,
      });
      return;
    }

    if (subcommand === "create") {
      const title = interaction.options.getString("title", true);
      const firstDateInput = interaction.options.getString("date", true);
      const startInput = interaction.options.getString("start", true);
      const endInput = interaction.options.getString("end", true);
      const description = interaction.options.getString("description", true);
      const slotsInput = interaction.options.getString("slots", true);
      const fallbackReservationUrl =
        interaction.options.getString("reservation_url");
      const mentionMode = interaction.options.getString("mention") || "none";
      const postDayInput = interaction.options.getInteger("post_day");
      const postTimeInput = interaction.options.getString("post_time", true);
      const targetChannel =
        interaction.options.getChannel("channel") ?? interaction.channel;

      const firstDate = eventStore.parseDateOnly(firstDateInput);
      if (!firstDate) {
        await interaction.reply({
          content: "Invalid `date`. Use format YYYY-MM-DD.",
          ephemeral: true,
        });
        return;
      }

      const startParsed = normalizeHour(startInput);
      const endParsed = normalizeHour(endInput);
      const postParsed = normalizeHour(postTimeInput);

      if (!startParsed || !endParsed || !postParsed) {
        await interaction.reply({
          content: "Invalid hour format. Use HH:MM in 24h time.",
          ephemeral: true,
        });
        return;
      }

      const startMinutes = startParsed.hour * 60 + startParsed.minute;
      const endMinutes = endParsed.hour * 60 + endParsed.minute;
      if (endMinutes <= startMinutes) {
        await interaction.reply({
          content: "`end` hour must be after `start` hour.",
          ephemeral: true,
        });
        return;
      }

      const parsedSlots = parseSlotsInput(slotsInput, fallbackReservationUrl);
      if (!parsedSlots.slots) {
        await interaction.reply({
          content: parsedSlots.error || "Invalid slots.",
          ephemeral: true,
        });
        return;
      }

      const timezoneLabel = interaction.client.timezoneLabel || "UTC";
      const timezoneOffset = parseTimezoneOffset(timezoneLabel);
      if (timezoneOffset === null) {
        await interaction.reply({
          content:
            "Configured timezone label is invalid. Use UTC or UTC+/-HH[:MM].",
          ephemeral: true,
        });
        return;
      }

      const guildSettings = await eventStore.getGuildSettings({ guildId });
      const postDay =
        postDayInput ?? (guildSettings?.weekStartDay ?? 1);

      const referenceDate = buildPostingReferenceDate(timezoneOffset);
      const firstPostAtLocal = eventStore.computeNextPostAt({
        postWeekday: postDay,
        postHour: postParsed.hour,
        postMinute: postParsed.minute,
        fromDate: referenceDate,
      });
      const firstPostAt = new Date(
        firstPostAtLocal.getTime() - timezoneOffset * 60 * 1000
      );

      const created = await eventStore.createEvent({
        guildId,
        channelId: targetChannel.id,
        title,
        description,
        slots: parsedSlots.slots,
        mentionMode,
        eventDate: eventStore.formatDateOnly(firstDate),
        startTime: startParsed.label,
        endTime: endParsed.label,
        postWeekday: postDay,
        postTime: postParsed.label,
        nextPostAt: firstPostAt.toISOString(),
        nextOccurrenceDate: eventStore.formatDateOnly(firstDate),
        createdById: interaction.user.id,
        createdByName: interaction.user.username,
        rsvpByUser: {},
      });

      await interaction.reply(
        [
          `Recurring event #${created.id} created.`,
          `Title: **${created.title}**`,
          `First occurrence: **${created.eventDate}**`,
          `Time: **${created.startTime}-${created.endTime} ${timezoneLabel}**`,
          `Posts every **${weekdayName(created.postWeekday)} ${created.postTime} ${timezoneLabel}** in <#${created.channelId}>.`,
          `Slots: ${slotsSummary(created.slots)}`,
          `Description: ${created.description}`,
        ].join("\n")
      );
      return;
    }

    if (subcommand === "list") {
      const events = await eventStore.listEvents({ guildId });

      if (events.length === 0) {
        await interaction.reply("No recurring events configured yet.");
        return;
      }

      const timezoneLabel = interaction.client.timezoneLabel || "UTC";
      const lines = events.map((event) => {
        const nextPostAt = parseIsoDate(event.nextPostAt);
        const nextPostDisplay = nextPostAt
          ? nextPostAt.toISOString().replace(".000Z", "Z")
          : event.nextPostAt;
        return (
          `#${event.id} -> ${event.title || "Session"}\n` +
          `  Description: ${event.description}\n` +
          `  Next event date: ${event.nextOccurrenceDate} (${event.startTime}-${event.endTime} ${timezoneLabel})\n` +
          `  Slots: ${slotsSummary(event.slots)}\n` +
          `  Next post: ${nextPostDisplay} UTC (every ${weekdayName(event.postWeekday)} ${event.postTime} ${timezoneLabel}) in <#${event.channelId}>`
        );
      });
      await interaction.reply(`Configured recurring events:\n${lines.join("\n")}`);
      return;
    }

    if (subcommand === "remove") {
      const id = interaction.options.getInteger("id", true);
      const removed = await eventStore.deleteEvent({ guildId, id });

      if (!removed) {
        await interaction.reply({
          content: `Event #${id} was not found.`,
          ephemeral: true,
        });
        return;
      }

      await interaction.reply(`Removed recurring event #${id}.`);
    }
  },
};
