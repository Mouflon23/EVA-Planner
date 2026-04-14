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

function createMemoryEventStore() {
  const eventsByGuild = new Map();
  const settingsByGuild = new Map();
  let nextId = 1;

  return {
    ...createBaseHelpers(),
    async createEvent(eventInput) {
      const event = {
        ...eventInput,
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
        id: nextId,
        createdAt: new Date().toISOString(),
      };

      await collection.insertOne(event);
      return event;
    },
    async listEvents({ guildId }) {
      return collection.find({ guildId }).sort({ id: 1 }).toArray();
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
