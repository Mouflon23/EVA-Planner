describe("config validateEnv", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    jest.mock("dotenv", () => ({ config: jest.fn() }));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it("throws when DISCORD_TOKEN is missing", () => {
    delete process.env.DISCORD_TOKEN;
    process.env.CLIENT_ID = "test-client";
    process.env.GUILD_ID = "test-guild";

    const { validateEnv } = require("../src/config");
    expect(() => validateEnv()).toThrow("DISCORD_TOKEN");
  });

  it("throws when CLIENT_ID is missing", () => {
    process.env.DISCORD_TOKEN = "test-token";
    delete process.env.CLIENT_ID;
    process.env.GUILD_ID = "test-guild";

    const { validateEnv } = require("../src/config");
    expect(() => validateEnv()).toThrow("CLIENT_ID");
  });

  it("throws when GUILD_ID is missing", () => {
    process.env.DISCORD_TOKEN = "test-token";
    process.env.CLIENT_ID = "test-client";
    delete process.env.GUILD_ID;

    const { validateEnv } = require("../src/config");
    expect(() => validateEnv()).toThrow("GUILD_ID");
  });

  it("does not throw when all required keys are present", () => {
    process.env.DISCORD_TOKEN = "test-token";
    process.env.CLIENT_ID = "test-client";
    process.env.GUILD_ID = "test-guild";

    const { validateEnv } = require("../src/config");
    expect(() => validateEnv()).not.toThrow();
  });

  it("lists all missing variables in error message", () => {
    delete process.env.DISCORD_TOKEN;
    delete process.env.CLIENT_ID;
    delete process.env.GUILD_ID;

    const { validateEnv } = require("../src/config");
    expect(() => validateEnv()).toThrow("DISCORD_TOKEN, CLIENT_ID, GUILD_ID");
  });

  it("exports SCHEDULER_POLL_SECONDS as number defaulting to 60", () => {
    process.env.DISCORD_TOKEN = "t";
    process.env.CLIENT_ID = "c";
    process.env.GUILD_ID = "g";
    delete process.env.SCHEDULER_POLL_SECONDS;

    const { SCHEDULER_POLL_SECONDS } = require("../src/config");
    expect(typeof SCHEDULER_POLL_SECONDS).toBe("number");
    expect(SCHEDULER_POLL_SECONDS).toBe(60);
  });

  it("exports EVENT_TIMEZONE defaulting to 'UTC'", () => {
    process.env.DISCORD_TOKEN = "t";
    process.env.CLIENT_ID = "c";
    process.env.GUILD_ID = "g";
    delete process.env.EVENT_TIMEZONE;

    const { EVENT_TIMEZONE } = require("../src/config");
    expect(EVENT_TIMEZONE).toBe("UTC");
  });
});
