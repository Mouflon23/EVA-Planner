const { createMockInteraction } = require("./helpers/mockInteraction");
const { createEventStore } = require("../src/store/eventStore");
const ping = require("../src/commands/ping");
const checkin = require("../src/commands/checkin");
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

describe("checkin command", () => {
  it("has correct command name", () => {
    expect(checkin.data.name).toBe("checkin");
  });

  it("replies with green status embed", async () => {
    const interaction = createMockInteraction({
      optionsData: { status: "green", notes: "All good" },
    });
    await checkin.execute(interaction);
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const embedData = interaction.reply.mock.calls[0][0].embeds[0].data;
    expect(embedData.description).toContain("Green - On Track");
    const notesField = embedData.fields.find((f) => f.name === "Notes");
    expect(notesField.value).toBe("All good");
  });

  it("uses default notes when none provided", async () => {
    const interaction = createMockInteraction({
      optionsData: { status: "red" },
    });
    await checkin.execute(interaction);
    const embedData = interaction.reply.mock.calls[0][0].embeds[0].data;
    const notesField = embedData.fields.find((f) => f.name === "Notes");
    expect(notesField.value).toBe("No additional notes.");
  });

  it("uses correct color for each status", async () => {
    for (const [status, color] of [["green", 0x57f287], ["yellow", 0xfee75c], ["red", 0xed4245]]) {
      const interaction = createMockInteraction({ optionsData: { status } });
      await checkin.execute(interaction);
      expect(interaction.reply.mock.calls[0][0].embeds[0].data.color).toBe(color);
    }
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
