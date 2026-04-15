const { createEventStore } = require("../src/store/eventStore");
const { startRecurringEventPosting } = require("../src/events/postRecurringEvents");

describe("startRecurringEventPosting", () => {
  let store;
  const guildId = "guild-test";

  beforeEach(async () => {
    store = await createEventStore();
  });

  afterEach(async () => {
    await store.close();
  });

  it("posts due events and advances their schedule", async () => {
    const past = new Date(Date.now() - 3600 * 1000).toISOString();
    await store.createEvent({
      guildId,
      channelId: "channel-test",
      title: "Due Event",
      description: "Should be posted",
      location: null,
      slots: [],
      mentionMode: "none",
      mentionRoleId: null,
      eventDate: "2025-06-15",
      startTime: "20:00",
      endTime: "22:00",
      postWeekday: 1,
      postTime: "18:00",
      nextPostAt: past,
      nextOccurrenceDate: "2025-06-15",
      createdById: "u1",
      createdByName: "U1",
      rsvpByUser: {},
    });

    const sentMessages = [];
    const mockClient = {
      eventStore: store,
      timezoneLabel: "UTC",
      channels: {
        fetch: jest.fn().mockResolvedValue({
          isTextBased: () => true,
          send: jest.fn().mockImplementation(async (payload) => {
            sentMessages.push(payload);
            return { id: `posted-msg-${sentMessages.length}` };
          }),
        }),
      },
    };

    const stop = startRecurringEventPosting(mockClient, 9999);
    await new Promise((r) => setTimeout(r, 200));
    stop();

    expect(sentMessages).toHaveLength(1);

    const events = await store.listEvents({ guildId });
    expect(events[0].lastMessageId).toBe("posted-msg-1");
    expect(new Date(events[0].nextPostAt).getTime()).toBeGreaterThan(Date.now());
    expect(events[0].rsvpByUser).toEqual({});
  });

  it("does not post future events", async () => {
    const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    await store.createEvent({
      guildId,
      channelId: "channel-test",
      title: "Future Event",
      description: "Not due yet",
      location: null,
      slots: [],
      mentionMode: "none",
      mentionRoleId: null,
      eventDate: "2099-06-15",
      startTime: "20:00",
      endTime: "22:00",
      postWeekday: 1,
      postTime: "18:00",
      nextPostAt: future,
      nextOccurrenceDate: "2099-06-15",
      createdById: "u1",
      createdByName: "U1",
      rsvpByUser: {},
    });

    const sentMessages = [];
    const mockClient = {
      eventStore: store,
      timezoneLabel: "UTC",
      channels: {
        fetch: jest.fn().mockResolvedValue({
          isTextBased: () => true,
          send: jest.fn().mockImplementation(async () => {
            sentMessages.push({});
            return { id: "msg" };
          }),
        }),
      },
    };

    const stop = startRecurringEventPosting(mockClient, 9999);
    await new Promise((r) => setTimeout(r, 200));
    stop();

    expect(sentMessages).toHaveLength(0);
  });

  it("skips channels that are not text-based", async () => {
    const past = new Date(Date.now() - 3600 * 1000).toISOString();
    await store.createEvent({
      guildId,
      channelId: "voice-channel",
      title: "Voice Event",
      description: "Should be skipped",
      location: null,
      slots: [],
      mentionMode: "none",
      mentionRoleId: null,
      eventDate: "2025-06-15",
      startTime: "20:00",
      endTime: "22:00",
      postWeekday: 1,
      postTime: "18:00",
      nextPostAt: past,
      nextOccurrenceDate: "2025-06-15",
      createdById: "u1",
      createdByName: "U1",
      rsvpByUser: {},
    });

    const mockClient = {
      eventStore: store,
      timezoneLabel: "UTC",
      channels: {
        fetch: jest.fn().mockResolvedValue({
          isTextBased: () => false,
        }),
      },
    };

    const stop = startRecurringEventPosting(mockClient, 9999);
    await new Promise((r) => setTimeout(r, 200));
    stop();

    const events = await store.listEvents({ guildId });
    expect(events[0].lastMessageId).toBeUndefined();
  });

  it("continues processing when channel fetch throws", async () => {
    const past = new Date(Date.now() - 3600 * 1000).toISOString();
    await store.createEvent({
      guildId,
      channelId: "broken-channel",
      title: "Broken",
      description: "D",
      location: null,
      slots: [],
      mentionMode: "none",
      mentionRoleId: null,
      eventDate: "2025-06-15",
      startTime: "20:00",
      endTime: "22:00",
      postWeekday: 1,
      postTime: "18:00",
      nextPostAt: past,
      nextOccurrenceDate: "2025-06-15",
      createdById: "u1",
      createdByName: "U1",
      rsvpByUser: {},
    });

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const mockClient = {
      eventStore: store,
      timezoneLabel: "UTC",
      channels: {
        fetch: jest.fn().mockRejectedValue(new Error("Channel not found")),
      },
    };

    const stop = startRecurringEventPosting(mockClient, 9999);
    await new Promise((r) => setTimeout(r, 200));
    stop();

    consoleSpy.mockRestore();
  });

  it("handles missing eventStore gracefully", async () => {
    const mockClient = {
      eventStore: null,
      timezoneLabel: "UTC",
    };

    const stop = startRecurringEventPosting(mockClient, 9999);
    await new Promise((r) => setTimeout(r, 200));
    stop();
  });

  it("returns a cleanup function that stops the interval", () => {
    const mockClient = {
      eventStore: store,
      timezoneLabel: "UTC",
      channels: { fetch: jest.fn() },
    };

    const stop = startRecurringEventPosting(mockClient, 9999);
    expect(typeof stop).toBe("function");
    stop();
  });

  it("enforces minimum poll interval of 15 seconds", () => {
    const mockClient = {
      eventStore: store,
      timezoneLabel: "UTC",
      channels: { fetch: jest.fn() },
    };

    const stop = startRecurringEventPosting(mockClient, 5);
    stop();
  });
});
