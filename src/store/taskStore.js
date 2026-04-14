const { MongoClient } = require("mongodb");

function createMemoryTaskStore() {
  const tasksByGuild = new Map();
  let nextId = 1;

  return {
    async addTask({ guildId, title, details, createdBy }) {
      const task = {
        id: nextId++,
        guildId,
        title,
        details,
        createdBy,
        done: false,
        createdAt: new Date().toISOString(),
      };

      const guildTasks = tasksByGuild.get(guildId) ?? [];
      guildTasks.push(task);
      tasksByGuild.set(guildId, guildTasks);
      return task;
    },

    async listTasks({ guildId, includeDone = false }) {
      const guildTasks = tasksByGuild.get(guildId) ?? [];
      const filteredTasks = includeDone
        ? guildTasks
        : guildTasks.filter((task) => !task.done);

      return [...filteredTasks].reverse();
    },

    async markTaskDone({ guildId, id }) {
      const guildTasks = tasksByGuild.get(guildId) ?? [];
      const task = guildTasks.find((item) => item.id === id);
      if (!task) {
        return null;
      }

      task.done = true;
      return task;
    },

    async close() {},
  };
}

async function createMongoTaskStore(mongoUri) {
  const client = new MongoClient(mongoUri);
  await client.connect();

  const collection = client.db("eva_planner").collection("tasks");
  await collection.createIndex({ guildId: 1, id: 1 }, { unique: true });
  await collection.createIndex({ guildId: 1, done: 1, createdAt: -1 });

  return {
    async addTask({ guildId, title, details, createdBy }) {
      const existing = await collection
        .find({ guildId }, { projection: { id: 1 } })
        .sort({ id: -1 })
        .limit(1)
        .toArray();
      const nextId = existing.length > 0 ? existing[0].id + 1 : 1;

      const task = {
        id: nextId,
        guildId,
        title,
        details,
        createdBy,
        done: false,
        createdAt: new Date().toISOString(),
      };
      await collection.insertOne(task);
      return task;
    },

    async listTasks({ guildId, includeDone = false }) {
      const query = includeDone ? { guildId } : { guildId, done: false };
      return collection.find(query).sort({ createdAt: -1 }).toArray();
    },

    async markTaskDone({ guildId, id }) {
      const result = await collection.findOneAndUpdate(
        { guildId, id },
        { $set: { done: true } },
        { returnDocument: "after" }
      );
      return result;
    },

    async close() {
      await client.close();
    },
  };
}

async function createTaskStore(mongoUri) {
  if (!mongoUri) {
    return createMemoryTaskStore();
  }

  try {
    return await createMongoTaskStore(mongoUri);
  } catch (error) {
    console.error(
      "MongoDB connection failed. Falling back to in-memory task storage.",
      error
    );
    return createMemoryTaskStore();
  }
}

module.exports = { createTaskStore };
