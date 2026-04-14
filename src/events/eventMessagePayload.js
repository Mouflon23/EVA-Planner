const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

const RSVP_ACTIONS = {
  ACCEPTED: "accepted",
  DECLINED: "declined",
};

const CONTROL_ACTIONS = {
  EDIT: "edit",
  DELETE: "delete",
};

const BUTTON_PREFIX = "event";

function actionCustomId(action) {
  return `${BUTTON_PREFIX}:${action}`;
}

function parseCustomId(customId) {
  if (!customId || typeof customId !== "string") {
    return null;
  }

  const [prefix, action] = customId.split(":");
  if (prefix !== BUTTON_PREFIX || !action) {
    return null;
  }

  return action;
}

function parseTimezoneOffsetMinutes(label) {
  const normalized = (label || "UTC").trim().toUpperCase();
  if (normalized === "UTC" || normalized === "GMT") {
    return 0;
  }

  const match = /^(UTC|GMT)([+-])(\d{1,2})(?::?([0-5]\d))?$/.exec(normalized);
  if (!match) {
    return 0;
  }

  const sign = match[2] === "+" ? 1 : -1;
  const hours = Number(match[3]);
  const minutes = Number(match[4] || "0");
  return sign * (hours * 60 + minutes);
}

function parseDateOnly(dateOnly) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly || "");
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day));
}

function parseClock(timeLabel) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeLabel || "");
  if (!match) {
    return null;
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  };
}

function formatClockForDisplay(timeLabel) {
  const parsed = parseClock(timeLabel);
  if (!parsed) {
    return timeLabel;
  }
  return `${String(parsed.hour).padStart(2, "0")}h${String(parsed.minute).padStart(
    2,
    "0"
  )}`;
}

function formatOccurrenceLine(dateOnly, startTime, endTime, timezoneLabel) {
  const date = parseDateOnly(dateOnly);
  if (!date) {
    return `${dateOnly} à ${formatClockForDisplay(startTime)} - ${formatClockForDisplay(endTime)} (${timezoneLabel})`;
  }

  const dateText = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return `${dateText} à ${formatClockForDisplay(startTime)} - ${formatClockForDisplay(
    endTime
  )} (${timezoneLabel})`;
}

function toGoogleDateStamp(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  const second = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

function buildGoogleCalendarUrl(event, timezoneLabel) {
  const date = parseDateOnly(event.nextOccurrenceDate);
  const start = parseClock(event.startTime);
  const end = parseClock(event.endTime);
  if (!date || !start || !end) {
    return null;
  }

  const offsetMinutes = parseTimezoneOffsetMinutes(timezoneLabel);
  const startUtc = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      start.hour,
      start.minute
    ) -
      offsetMinutes * 60 * 1000
  );
  const endUtc = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      end.hour,
      end.minute
    ) -
      offsetMinutes * 60 * 1000
  );

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title || "Session EVA",
    details: event.description || "",
    dates: `${toGoogleDateStamp(startUtc)}/${toGoogleDateStamp(endUtc)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function mentionContent(mentionMode) {
  if (mentionMode === "everyone") {
    return "@everyone";
  }
  if (mentionMode === "here") {
    return "@here";
  }
  return "";
}

function mentionAllowed(mentionMode, allowPing) {
  if (!allowPing || mentionMode === "none") {
    return { parse: [] };
  }
  if (mentionMode === "everyone" || mentionMode === "here") {
    return { parse: ["everyone"] };
  }
  return { parse: [] };
}

function creatorDisplay(event) {
  return event.createdByName || `<@${event.createdById}>`;
}

function formatAgenda(slots) {
  if (!Array.isArray(slots) || slots.length === 0) {
    return "-";
  }

  const lines = slots
    .map((slot) => {
      const base = `• ${slot.timeLabel} (${slot.period})`;
      if (!slot.reservationUrl) {
        return base;
      }
      return `${base} [Réserver](${slot.reservationUrl})`;
    });

  if (lines.length <= 20) {
    return lines.join("\n");
  }

  return `${lines.slice(0, 20).join("\n")}\n… et ${lines.length - 20} autre(s) créneau(x)`;
}

function participantList(userIds) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return "-";
  }

  return userIds.slice(0, 10).map((id) => `<@${id}>`).join("\n");
}

function buildEventMessagePayload({
  event,
  rsvpSummary,
  timezoneLabel,
  allowMentionPing = false,
}) {
  const summary = rsvpSummary || {
    accepted: [],
    declined: [],
  };

  const accepted = summary.accepted || [];
  const declined = summary.declined || [];

  const calendarUrl = buildGoogleCalendarUrl(event, timezoneLabel);
  const timeLine = formatOccurrenceLine(
    event.nextOccurrenceDate,
    event.startTime,
    event.endTime,
    timezoneLabel
  );
  const timeWithCalendar = calendarUrl
    ? `${timeLine}\n[Add to Google](${calendarUrl})`
    : timeLine;

  const embed = new EmbedBuilder()
    .setColor(0x6b2d87)
    .setTitle(event.title || `Session #${event.id}`)
    .setDescription(event.description || "Aucune description.")
    .addFields(
      { name: "Créneaux", value: formatAgenda(event.slots), inline: false },
      { name: "Time", value: timeWithCalendar, inline: false },
      {
        name: `✅ Accepted (${accepted.length})`,
        value: participantList(accepted),
        inline: true,
      },
      {
        name: `❌ Declined (${declined.length})`,
        value: participantList(declined),
        inline: true,
      }
    )
    .setFooter({
      text: `Created by ${creatorDisplay(event)} • Repeats weekly`,
    });

  const rsvpRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(actionCustomId(RSVP_ACTIONS.ACCEPTED))
      .setStyle(ButtonStyle.Success)
      .setLabel("Accept"),
    new ButtonBuilder()
      .setCustomId(actionCustomId(RSVP_ACTIONS.DECLINED))
      .setStyle(ButtonStyle.Danger)
      .setLabel("Decline")
  );

  const controlRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(actionCustomId(CONTROL_ACTIONS.EDIT))
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Edit"),
    new ButtonBuilder()
      .setCustomId(actionCustomId(CONTROL_ACTIONS.DELETE))
      .setStyle(ButtonStyle.Danger)
      .setLabel("Delete")
  );

  return {
    content: mentionContent(event.mentionMode),
    allowedMentions: mentionAllowed(event.mentionMode, allowMentionPing),
    embeds: [embed],
    components: [rsvpRow, controlRow],
  };
}

module.exports = {
  RSVP_ACTIONS,
  CONTROL_ACTIONS,
  parseCustomId,
  buildEventMessagePayload,
};
