const { MongoClient } = require("mongodb");

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function normalizeFindOneResult(result) {
  if (
    result &&
    typeof result === "object" &&
    Object.prototype.hasOwnProperty.call(result, "value")
  ) {
    return result.value;
  }
  return result ?? null;
}

function parseDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatDateOnly(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToDateOnly(dateOnly, days) {
  const parsed = parseDateOnly(dateOnly);
  if (!parsed) {
    return dateOnly;
  }
  return formatDateOnly(addDays(parsed, days));
}

function computeNextPostAt({ postWeekday, postHour, postMinute, fromDate = new Date() }) {
  const candidate = new Date(fromDate);
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCHours(postHour, postMinute, 0, 0);

  let daysToAdd = (postWeekday - candidate.getUTCDay() + 7) % 7;
  if (daysToAdd === 0 && candidate <= fromDate) {
    daysToAdd = 7;
  }

  candidate.setUTCDate(candidate.getUTCDate() + daysToAdd);
  return candidate;
}

function createBaseHelpers() {
  return {
    parseDateOnly,
    formatDateOnly,
    addDaysToDateOnly,
    computeNextPostAt,
  };
}

function normalizeRsvpByUser(value) {
  if (!value || typeof value !== "object") {
    return {};
  }
  return value;
}

function normalizeSlots(slots) {
  if (!Array.isArray(slots)) {
    return [];
  }
  return slots
    .filter((slot) => slot && typeof slot === "object")
    .map((slot) => ({
      timeLabel: slot.timeLabel,
      period: slot.period,
      reservationUrl: slot.reservationUrl || null,
    }));
}

function normalizeMentionMode(mentionMode) {
  if (mentionMode === "role" || mentionMode === "everyone" || mentionMode === "here") {
    return mentionMode;
  }
  return "none";
}

function createMemoryEventStore() {
  const eventsByGuild = new Map();
  const settingsByGuild = new Map();
  let nextId = 1;

  return {
    ...createBaseHelpers(),
    async createEvent(eventInput) {
      const event = {
        ...eventInput,
        slots: normalizeSlots(eventInput.slots),
        mentionMode: normalizeMentionMode(eventInput.mentionMode),
        rsvpByUser: normalizeRsvpByUser(eventInput.rsvpByUser),
        id: nextId++,
        createdAt: new Date().toISOString(),
      };
      const guildEvents = eventsByGuild.get(event.guildId) ?? [];
      guildEvents.push(event);
      eventsByGuild.set(event.guildId, guildEvents);
      return event;
    },
    async listEvents({ guildId }) {
      const guildEvents = eventsByGuild.get(guildId) ?? [];
      return [...guildEvents].sort((a, b) => a.id - b.id);
    },
    async getEventById({ guildId, id }) {
      const guildEvents = eventsByGuild.get(guildId) ?? [];
      return guildEvents.find((event) => event.id === id) ?? null;
    },
    async getEventByMessage({ guildId, messageId }) {
      const guildEvents = eventsByGuild.get(guildId) ?? [];
      return guildEvents.find((event) => event.lastMessageId === messageId) ?? null;
    },
    async updateEventBasics({ guildId, id, title, description }) {
      const guildEvents = eventsByGuild.get(guildId) ?? [];
      const event = guildEvents.find((item) => item.id === id);
      if (!event) {
        return null;
      }

      event.title = title;
      event.description = description;
      return event;
    },
    async updateEventDetails({ guildId, id, title, description, slots, location }) {
      const guildEvents = eventsByGuild.get(guildId) ?? [];
      const event = guildEvents.find((item) => item.id === id);
      if (!event) {
        return null;
      }

      event.title = title;
      event.description = description;
      event.slots = normalizeSlots(slots);
      event.location = location || null;
      return event;
    },
    async setRsvp({ guildId, id, userId, status }) {
      const guildEvents = eventsByGuild.get(guildId) ?? [];
      const event = guildEvents.find((item) => item.id === id);
      if (!event) {
        return null;
      }

      const nextRsvp = normalizeRsvpByUser(event.rsvpByUser);
      nextRsvp[userId] = status;
      event.rsvpByUser = nextRsvp;
      return event;
    },
    async getGuildSettings({ guildId }) {
      return settingsByGuild.get(guildId) ?? { weekStartDay: 1 };
    },
    async setWeekStartDay({ guildId, weekStartDay }) {
      const current = settingsByGuild.get(guildId) ?? { weekStartDay: 1 };
      const updated = { ...current, weekStartDay };
      settingsByGuild.set(guildId, updated);
      return updated;
    },
    async deleteEvent({ guildId, id }) {
      const guildEvents = eventsByGuild.get(guildId) ?? [];
      const index = guildEvents.findIndex((event) => event.id === id);
      if (index === -1) {
        return null;
      }

      const [removed] = guildEvents.splice(index, 1);
      eventsByGuild.set(guildId, guildEvents);
      return removed;
    },
    async listDueEvents({ nowIso }) {
      const nowDate = new Date(nowIso);
      const dueEvents = [];

      for (const guildEvents of eventsByGuild.values()) {
        for (const event of guildEvents) {
          if (new Date(event.nextPostAt) <= nowDate) {
            dueEvents.push(event);
          }
        }
      }

      return dueEvents.sort(
        (a, b) => new Date(a.nextPostAt).getTime() - new Date(b.nextPostAt).getTime()
      );
    },
    async markEventPosted({
      guildId,
      id,
      nextPostAt,
      nextOccurrenceDate,
      lastPostedAt,
      lastMessageId,
    }) {
      const guildEvents = eventsByGuild.get(guildId) ?? [];
      const event = guildEvents.find((item) => item.id === id);
      if (!event) {
        return null;
      }

      event.nextPostAt = nextPostAt;
      event.nextOccurrenceDate = nextOccurrenceDate;
      event.lastPostedAt = lastPostedAt;
      event.lastMessageId = lastMessageId;
      event.rsvpByUser = {};
      return event;
    },
    async close() {},
  };
}

async function createMongoEventStore(mongoUri) {
  const client = new MongoClient(mongoUri);
  await client.connect();

  const collection = client.db("eva_planner").collection("events");
  const settingsCollection = client.db("eva_planner").collection("guild_settings");
  await collection.createIndex({ guildId: 1, id: 1 }, { unique: true });
  await collection.createIndex({ nextPostAt: 1 });
  await collection.createIndex({ guildId: 1, lastMessageId: 1 });
  await settingsCollection.createIndex({ guildId: 1 }, { unique: true });

  return {
    ...createBaseHelpers(),
    async createEvent(eventInput) {
      const maxResult = await collection
        .find({ guildId: eventInput.guildId }, { projection: { id: 1 } })
        .sort({ id: -1 })
        .limit(1)
        .toArray();
      const nextId = maxResult.length > 0 ? maxResult[0].id + 1 : 1;

      const event = {
        ...eventInput,
        slots: normalizeSlots(eventInput.slots),
        mentionMode: normalizeMentionMode(eventInput.mentionMode),
        rsvpByUser: normalizeRsvpByUser(eventInput.rsvpByUser),
        id: nextId,
        createdAt: new Date().toISOString(),
      };

      await collection.insertOne(event);
      return event;
    },
    async listEvents({ guildId }) {
      return collection.find({ guildId }).sort({ id: 1 }).toArray();
    },
    async getEventById({ guildId, id }) {
      return collection.findOne({ guildId, id });
    },
    async getEventByMessage({ guildId, messageId }) {
      return collection.findOne({ guildId, lastMessageId: messageId });
    },
    async updateEventBasics({ guildId, id, title, description }) {
      const result = await collection.findOneAndUpdate(
        { guildId, id },
        { $set: { title, description } },
        { returnDocument: "after" }
      );
      return normalizeFindOneResult(result);
    },
    async updateEventDetails({ guildId, id, title, description, slots, location }) {
      const result = await collection.findOneAndUpdate(
        { guildId, id },
        {
          $set: {
            title,
            description,
            slots: normalizeSlots(slots),
            location: location || null,
          },
        },
        { returnDocument: "after" }
      );
      return normalizeFindOneResult(result);
    },
    async setRsvp({ guildId, id, userId, status }) {
      const result = await collection.findOneAndUpdate(
        { guildId, id },
        { $set: { [`rsvpByUser.${userId}`]: status } },
        { returnDocument: "after" }
      );
      return normalizeFindOneResult(result);
    },
    async getGuildSettings({ guildId }) {
      const settings = await settingsCollection.findOne({ guildId });
      if (!settings) {
        return { weekStartDay: 1 };
      }

      return {
        weekStartDay:
          typeof settings.weekStartDay === "number" ? settings.weekStartDay : 1,
      };
    },
    async setWeekStartDay({ guildId, weekStartDay }) {
      await settingsCollection.updateOne(
        { guildId },
        { $set: { guildId, weekStartDay } },
        { upsert: true }
      );

      return { weekStartDay };
    },
    async deleteEvent({ guildId, id }) {
      const result = await collection.findOneAndDelete({ guildId, id });
      return normalizeFindOneResult(result);
    },
    async listDueEvents({ nowIso }) {
      return collection
        .find({ nextPostAt: { $lte: nowIso } })
        .sort({ nextPostAt: 1 })
        .toArray();
    },
    async markEventPosted({
      guildId,
      id,
      nextPostAt,
      nextOccurrenceDate,
      lastPostedAt,
      lastMessageId,
    }) {
      const result = await collection.findOneAndUpdate(
        { guildId, id },
        {
          $set: {
            nextPostAt,
            nextOccurrenceDate,
            lastPostedAt,
            lastMessageId,
            rsvpByUser: {},
          },
        },
        { returnDocument: "after" }
      );
      return normalizeFindOneResult(result);
    },
    async close() {
      await client.close();
    },
  };
}

async function createEventStore(mongoUri) {
  if (!mongoUri) {
    return createMemoryEventStore();
  }

  try {
    return await createMongoEventStore(mongoUri);
  } catch (error) {
    console.error(
      "MongoDB connection for event store failed. Falling back to in-memory store.",
      error
    );
    return createMemoryEventStore();
  }
}

module.exports = {
  createEventStore,
};
