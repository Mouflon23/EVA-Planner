const { createMockInteraction } = require("./helpers/mockInteraction");
const { createEventStore } = require("../src/store/eventStore");
const timezone = require("../src/commands/timezone");
const { PermissionFlagsBits } = require("discord.js");

describe("timezone command", () => {
  let store;

  beforeEach(async () => {
    store = await createEventStore();
  });

  afterEach(async () => {
    await store.close();
  });

  it("has correct command name", () => {
    expect(timezone.data.name).toBe("timezone");
  });

  it("exports TIMEZONE_CHOICES with city examples", () => {
    expect(timezone.TIMEZONE_CHOICES.length).toBeGreaterThan(10);
    const utcPlus1 = timezone.TIMEZONE_CHOICES.find((c) => c.value === "UTC+1");
    expect(utcPlus1).toBeDefined();
    expect(utcPlus1.name).toContain("Paris");
  });

  describe("show subcommand", () => {
    it("shows default timezone (UTC) when none is set", async () => {
      const interaction = createMockInteraction({
        subcommand: "show",
        eventStore: store,
      });
      await timezone.execute(interaction);
      expect(interaction.reply).toHaveBeenCalled();
      const embed = interaction.reply.mock.calls[0][0].embeds[0].data;
      expect(embed.description).toContain("UTC");
    });

    it("shows the guild-configured timezone after set", async () => {
      await store.setTimezone({ guildId: "guild-test", timezone: "UTC+1" });
      const interaction = createMockInteraction({
        subcommand: "show",
        eventStore: store,
      });
      await timezone.execute(interaction);
      const embed = interaction.reply.mock.calls[0][0].embeds[0].data;
      expect(embed.description).toContain("UTC+1");
      expect(embed.description).toContain("Paris");
    });

    it("replies ephemeral when eventStore is null", async () => {
      const interaction = createMockInteraction({
        subcommand: "show",
        eventStore: null,
      });
      await timezone.execute(interaction);
      expect(interaction.reply.mock.calls[0][0].ephemeral).toBe(true);
    });
  });

  describe("set subcommand", () => {
    it("sets timezone with ManageGuild permission", async () => {
      const interaction = createMockInteraction({
        subcommand: "set",
        eventStore: store,
        optionsData: { zone: "UTC+2" },
        permissions: [PermissionFlagsBits.ManageGuild],
      });
      await timezone.execute(interaction);
      expect(interaction.reply).toHaveBeenCalled();
      const embed = interaction.reply.mock.calls[0][0].embeds[0].data;
      expect(embed.description).toContain("UTC+2");
      expect(embed.description).toContain("Athens");

      const settings = await store.getGuildSettings({ guildId: "guild-test" });
      expect(settings.timezone).toBe("UTC+2");
    });

    it("rejects set without ManageGuild permission", async () => {
      const interaction = createMockInteraction({
        subcommand: "set",
        eventStore: store,
        optionsData: { zone: "UTC+2" },
        permissions: [],
      });
      await timezone.execute(interaction);
      const call = interaction.reply.mock.calls[0][0];
      expect(call.ephemeral).toBe(true);
      expect(call.embeds[0].data.description).toContain("Manage Server");
    });

    it("persists timezone in guild settings", async () => {
      const interaction = createMockInteraction({
        subcommand: "set",
        eventStore: store,
        optionsData: { zone: "UTC-5" },
        permissions: [PermissionFlagsBits.ManageGuild],
      });
      await timezone.execute(interaction);

      const settings = await store.getGuildSettings({ guildId: "guild-test" });
      expect(settings.timezone).toBe("UTC-5");
      expect(settings.weekStartDay).toBe(1);
    });

    it("preserves weekStartDay when setting timezone", async () => {
      await store.setWeekStartDay({ guildId: "guild-test", weekStartDay: 0 });

      const interaction = createMockInteraction({
        subcommand: "set",
        eventStore: store,
        optionsData: { zone: "UTC+9" },
        permissions: [PermissionFlagsBits.ManageGuild],
      });
      await timezone.execute(interaction);

      const settings = await store.getGuildSettings({ guildId: "guild-test" });
      expect(settings.timezone).toBe("UTC+9");
      expect(settings.weekStartDay).toBe(0);
    });
  });
});

describe("eventStore timezone methods", () => {
  let store;

  beforeEach(async () => {
    store = await createEventStore();
  });

  afterEach(async () => {
    await store.close();
  });

  it("getGuildSettings returns timezone: null by default", async () => {
    const settings = await store.getGuildSettings({ guildId: "new-guild" });
    expect(settings.timezone).toBeNull();
  });

  it("setTimezone stores and returns the timezone", async () => {
    const result = await store.setTimezone({ guildId: "g1", timezone: "UTC+3" });
    expect(result.timezone).toBe("UTC+3");

    const settings = await store.getGuildSettings({ guildId: "g1" });
    expect(settings.timezone).toBe("UTC+3");
  });

  it("setTimezone preserves existing weekStartDay", async () => {
    await store.setWeekStartDay({ guildId: "g1", weekStartDay: 5 });
    await store.setTimezone({ guildId: "g1", timezone: "UTC+8" });

    const settings = await store.getGuildSettings({ guildId: "g1" });
    expect(settings.weekStartDay).toBe(5);
    expect(settings.timezone).toBe("UTC+8");
  });

  it("setWeekStartDay preserves existing timezone", async () => {
    await store.setTimezone({ guildId: "g1", timezone: "UTC+1" });
    await store.setWeekStartDay({ guildId: "g1", weekStartDay: 3 });

    const settings = await store.getGuildSettings({ guildId: "g1" });
    expect(settings.weekStartDay).toBe(3);
    expect(settings.timezone).toBe("UTC+1");
  });
});
