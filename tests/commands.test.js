const { createMockInteraction } = require("./helpers/mockInteraction");
const { createEventStore } = require("../src/store/eventStore");
const ping = require("../src/commands/ping");
const weekstart = require("../src/commands/weekstart");
const { PermissionFlagsBits } = require("discord.js");

describe("ping command", () => {
  it("has correct command name", () => {
    expect(ping.data.name).toBe("ping");
  });

  it("replies with Pong embed", async () => {
    const interaction = createMockInteraction();
    await ping.execute(interaction);
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const embedData = interaction.reply.mock.calls[0][0].embeds[0].data;
    expect(embedData.title).toBe("Pong!");
    expect(embedData.description).toContain("online");
  });

  it("includes latency in the response", async () => {
    const interaction = createMockInteraction();
    await ping.execute(interaction);
    const fields = interaction.reply.mock.calls[0][0].embeds[0].data.fields;
    const latencyField = fields.find((f) => f.name === "Latency");
    expect(latencyField).toBeDefined();
    expect(latencyField.value).toMatch(/\d+ms/);
  });
});

describe("weekstart command", () => {
  let store;

  beforeEach(async () => {
    store = await createEventStore();
  });

  afterEach(async () => {
    await store.close();
  });

  it("has correct command name", () => {
    expect(weekstart.data.name).toBe("weekstart");
  });

  it("shows default week start day (Monday)", async () => {
    const interaction = createMockInteraction({
      subcommand: "show",
      eventStore: store,
    });
    await weekstart.execute(interaction);
    expect(interaction.reply).toHaveBeenCalled();
    const embedData = interaction.reply.mock.calls[0][0].embeds[0].data;
    expect(embedData.description).toContain("Monday");
  });

  it("sets week start day with correct permissions", async () => {
    const interaction = createMockInteraction({
      subcommand: "set",
      eventStore: store,
      optionsData: { day: 0 },
      permissions: [PermissionFlagsBits.ManageGuild],
    });
    await weekstart.execute(interaction);
    expect(interaction.reply).toHaveBeenCalled();
    const embedData = interaction.reply.mock.calls[0][0].embeds[0].data;
    expect(embedData.description).toContain("Sunday");
  });

  it("rejects set without ManageGuild permission", async () => {
    const interaction = createMockInteraction({
      subcommand: "set",
      eventStore: store,
      optionsData: { day: 0 },
      permissions: [],
    });
    await weekstart.execute(interaction);
    expect(interaction.reply).toHaveBeenCalled();
    const call = interaction.reply.mock.calls[0][0];
    expect(call.ephemeral).toBe(true);
    expect(call.embeds[0].data.description).toContain("Manage Server");
  });

  it("replies ephemeral when eventStore is null", async () => {
    const interaction = createMockInteraction({
      subcommand: "show",
      eventStore: null,
    });
    await weekstart.execute(interaction);
    expect(interaction.reply.mock.calls[0][0].ephemeral).toBe(true);
  });
});
