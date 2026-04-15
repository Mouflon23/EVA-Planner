const { createEventStore } = require("../src/store/eventStore");

describe("createEventStore", () => {
  it("returns in-memory store when no URI provided", async () => {
    const store = await createEventStore();
    expect(store).toBeDefined();
    expect(typeof store.createEvent).toBe("function");
    expect(typeof store.parseDateOnly).toBe("function");
    await store.close();
  });

  it("falls back to in-memory store on invalid mongo URI", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const store = await createEventStore("mongodb://invalid-host:99999");
    expect(store).toBeDefined();
    expect(typeof store.createEvent).toBe("function");
    await store.close();
    spy.mockRestore();
  });
});

describe("in-memory event store", () => {
  let store;
  const guildId = "test-guild-123";

  beforeEach(async () => {
    store = await createEventStore();
  });

  afterEach(async () => {
    await store.close();
  });

  describe("parseDateOnly", () => {
    it("parses valid YYYY-MM-DD date", () => {
      const result = store.parseDateOnly("2025-06-15");
      expect(result).toBeInstanceOf(Date);
      expect(result.getUTCFullYear()).toBe(2025);
      expect(result.getUTCMonth()).toBe(5);
      expect(result.getUTCDate()).toBe(15);
    });

    it("returns null for invalid format", () => {
      expect(store.parseDateOnly("15-06-2025")).toBeNull();
      expect(store.parseDateOnly("not-a-date")).toBeNull();
      expect(store.parseDateOnly("")).toBeNull();
    });

    it("returns null for invalid date values (e.g. Feb 30)", () => {
      expect(store.parseDateOnly("2025-02-30")).toBeNull();
    });
  });

  describe("formatDateOnly", () => {
    it("formats a Date to YYYY-MM-DD", () => {
      const date = new Date(Date.UTC(2025, 5, 15));
      expect(store.formatDateOnly(date)).toBe("2025-06-15");
    });

    it("zero-pads single-digit month and day", () => {
      const date = new Date(Date.UTC(2025, 0, 5));
      expect(store.formatDateOnly(date)).toBe("2025-01-05");
    });
  });

  describe("addDaysToDateOnly", () => {
    it("adds 7 days to a date string", () => {
      expect(store.addDaysToDateOnly("2025-06-15", 7)).toBe("2025-06-22");
    });

    it("handles month rollover", () => {
      expect(store.addDaysToDateOnly("2025-01-29", 7)).toBe("2025-02-05");
    });

    it("returns original string for invalid input", () => {
      expect(store.addDaysToDateOnly("invalid", 7)).toBe("invalid");
    });
  });

  describe("computeNextPostAt", () => {
    it("computes next post date for a future weekday", () => {
      const from = new Date(Date.UTC(2025, 5, 16, 10, 0)); // Monday
      const result = store.computeNextPostAt({
        postWeekday: 3, // Wednesday
        postHour: 14,
        postMinute: 0,
        fromDate: from,
      });
      expect(result.getUTCDay()).toBe(3);
      expect(result.getUTCHours()).toBe(14);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it("skips to next week if same weekday has already passed", () => {
      const from = new Date(Date.UTC(2025, 5, 16, 15, 0)); // Monday 15:00
      const result = store.computeNextPostAt({
        postWeekday: 1, // Monday
        postHour: 14,
        postMinute: 0,
        fromDate: from,
      });
      expect(result.getUTCDay()).toBe(1);
      expect(result > from).toBe(true);
    });
  });

  describe("CRUD operations", () => {
    const baseEvent = {
      guildId,
      channelId: "channel-1",
      title: "Test Session",
      description: "A test event",
      location: "Online",
      slots: [{ timeLabel: "20:40", period: "HP", reservationUrl: null }],
      mentionMode: "none",
      mentionRoleId: null,
      eventDate: "2025-06-15",
      startTime: "20:00",
      endTime: "22:00",
      postWeekday: 1,
      postTime: "18:00",
      nextPostAt: "2025-06-16T18:00:00.000Z",
      nextOccurrenceDate: "2025-06-15",
      createdById: "user-1",
      createdByName: "TestUser",
      rsvpByUser: {},
    };

    it("creates an event with auto-incremented ID", async () => {
      const event = await store.createEvent(baseEvent);
      expect(event.id).toBe(1);
      expect(event.title).toBe("Test Session");
      expect(event.slots).toHaveLength(1);
    });

    it("assigns sequential IDs", async () => {
      const e1 = await store.createEvent(baseEvent);
      const e2 = await store.createEvent({ ...baseEvent, title: "Second" });
      expect(e1.id).toBe(1);
      expect(e2.id).toBe(2);
    });

    it("normalizes slots on create", async () => {
      const event = await store.createEvent({
        ...baseEvent,
        slots: [{ timeLabel: "20:40", period: "HP", reservationUrl: undefined, extra: "data" }],
      });
      expect(event.slots[0].reservationUrl).toBeNull();
      expect(event.slots[0].extra).toBeUndefined();
    });

    it("normalizes invalid mention mode to 'none'", async () => {
      const event = await store.createEvent({ ...baseEvent, mentionMode: "invalid" });
      expect(event.mentionMode).toBe("none");
    });

    it("lists events sorted by ID", async () => {
      await store.createEvent({ ...baseEvent, title: "B" });
      await store.createEvent({ ...baseEvent, title: "A" });
      const list = await store.listEvents({ guildId });
      expect(list).toHaveLength(2);
      expect(list[0].id).toBeLessThan(list[1].id);
    });

    it("returns empty list for unknown guild", async () => {
      const list = await store.listEvents({ guildId: "unknown" });
      expect(list).toEqual([]);
    });

    it("gets event by ID", async () => {
      const created = await store.createEvent(baseEvent);
      const found = await store.getEventById({ guildId, id: created.id });
      expect(found.title).toBe("Test Session");
    });

    it("returns null for non-existent event ID", async () => {
      const result = await store.getEventById({ guildId, id: 999 });
      expect(result).toBeNull();
    });

    it("gets event by message ID", async () => {
      const created = await store.createEvent(baseEvent);
      await store.markEventPosted({
        guildId,
        id: created.id,
        nextPostAt: "2025-06-23T18:00:00.000Z",
        nextOccurrenceDate: "2025-06-22",
        lastPostedAt: "2025-06-16T18:00:00.000Z",
        lastMessageId: "msg-123",
      });
      const found = await store.getEventByMessage({ guildId, messageId: "msg-123" });
      expect(found).not.toBeNull();
      expect(found.id).toBe(created.id);
    });

    it("returns null when no event matches message ID", async () => {
      const result = await store.getEventByMessage({ guildId, messageId: "unknown" });
      expect(result).toBeNull();
    });

    it("deletes an event and returns the removed data", async () => {
      const created = await store.createEvent(baseEvent);
      const removed = await store.deleteEvent({ guildId, id: created.id });
      expect(removed.id).toBe(created.id);
      const after = await store.listEvents({ guildId });
      expect(after).toHaveLength(0);
    });

    it("returns null when deleting non-existent event", async () => {
      const result = await store.deleteEvent({ guildId, id: 999 });
      expect(result).toBeNull();
    });

    it("updates event basics (title, description)", async () => {
      const created = await store.createEvent(baseEvent);
      const updated = await store.updateEventBasics({
        guildId,
        id: created.id,
        title: "New Title",
        description: "New Description",
      });
      expect(updated.title).toBe("New Title");
      expect(updated.description).toBe("New Description");
    });

    it("updates event details (title, description, slots, location)", async () => {
      const created = await store.createEvent(baseEvent);
      const updated = await store.updateEventDetails({
        guildId,
        id: created.id,
        title: "Updated",
        description: "Updated desc",
        slots: [{ timeLabel: "21:00", period: "HC" }],
        location: "Gym",
      });
      expect(updated.title).toBe("Updated");
      expect(updated.slots[0].period).toBe("HC");
      expect(updated.location).toBe("Gym");
    });

    it("returns null when updating non-existent event", async () => {
      expect(await store.updateEventBasics({ guildId, id: 999, title: "X", description: "Y" })).toBeNull();
      expect(await store.updateEventDetails({ guildId, id: 999, title: "X", description: "Y", slots: [], location: "" })).toBeNull();
    });
  });

  describe("RSVP", () => {
    it("sets and tracks RSVP status per user", async () => {
      const event = await store.createEvent({
        guildId,
        channelId: "c",
        title: "T",
        description: "D",
        slots: [],
        mentionMode: "none",
        rsvpByUser: {},
        eventDate: "2025-06-15",
        startTime: "20:00",
        endTime: "22:00",
        postWeekday: 1,
        postTime: "18:00",
        nextPostAt: "2025-06-16T18:00:00.000Z",
        nextOccurrenceDate: "2025-06-15",
        createdById: "u1",
        createdByName: "U1",
      });

      let updated = await store.setRsvp({ guildId, id: event.id, userId: "user-a", status: "accepted" });
      expect(updated.rsvpByUser["user-a"]).toBe("accepted");

      updated = await store.setRsvp({ guildId, id: event.id, userId: "user-b", status: "declined" });
      expect(updated.rsvpByUser["user-b"]).toBe("declined");
      expect(updated.rsvpByUser["user-a"]).toBe("accepted");
    });

    it("returns null for RSVP on non-existent event", async () => {
      const result = await store.setRsvp({ guildId, id: 999, userId: "u", status: "accepted" });
      expect(result).toBeNull();
    });
  });

  describe("guild settings", () => {
    it("returns default weekStartDay of 1 (Monday)", async () => {
      const settings = await store.getGuildSettings({ guildId });
      expect(settings.weekStartDay).toBe(1);
    });

    it("sets and retrieves weekStartDay", async () => {
      await store.setWeekStartDay({ guildId, weekStartDay: 0 });
      const settings = await store.getGuildSettings({ guildId });
      expect(settings.weekStartDay).toBe(0);
    });
  });

  describe("due events", () => {
    it("lists events whose nextPostAt is at or before now", async () => {
      await store.createEvent({
        guildId,
        channelId: "c",
        title: "Past",
        description: "D",
        slots: [],
        mentionMode: "none",
        rsvpByUser: {},
        eventDate: "2025-06-15",
        startTime: "20:00",
        endTime: "22:00",
        postWeekday: 1,
        postTime: "18:00",
        nextPostAt: "2020-01-01T00:00:00.000Z",
        nextOccurrenceDate: "2020-01-01",
        createdById: "u1",
        createdByName: "U1",
      });

      await store.createEvent({
        guildId,
        channelId: "c",
        title: "Future",
        description: "D",
        slots: [],
        mentionMode: "none",
        rsvpByUser: {},
        eventDate: "2099-06-15",
        startTime: "20:00",
        endTime: "22:00",
        postWeekday: 1,
        postTime: "18:00",
        nextPostAt: "2099-01-01T00:00:00.000Z",
        nextOccurrenceDate: "2099-01-01",
        createdById: "u1",
        createdByName: "U1",
      });

      const due = await store.listDueEvents({ nowIso: "2025-06-16T00:00:00.000Z" });
      expect(due).toHaveLength(1);
      expect(due[0].title).toBe("Past");
    });
  });

  describe("markEventPosted", () => {
    it("advances nextPostAt, nextOccurrenceDate, and resets RSVP", async () => {
      const event = await store.createEvent({
        guildId,
        channelId: "c",
        title: "T",
        description: "D",
        slots: [],
        mentionMode: "none",
        rsvpByUser: { "user-a": "accepted" },
        eventDate: "2025-06-15",
        startTime: "20:00",
        endTime: "22:00",
        postWeekday: 1,
        postTime: "18:00",
        nextPostAt: "2025-06-16T18:00:00.000Z",
        nextOccurrenceDate: "2025-06-15",
        createdById: "u1",
        createdByName: "U1",
      });

      const posted = await store.markEventPosted({
        guildId,
        id: event.id,
        nextPostAt: "2025-06-23T18:00:00.000Z",
        nextOccurrenceDate: "2025-06-22",
        lastPostedAt: "2025-06-16T18:00:05.000Z",
        lastMessageId: "msg-abc",
      });

      expect(posted.nextPostAt).toBe("2025-06-23T18:00:00.000Z");
      expect(posted.nextOccurrenceDate).toBe("2025-06-22");
      expect(posted.lastMessageId).toBe("msg-abc");
      expect(posted.rsvpByUser).toEqual({});
    });

    it("returns null for non-existent event", async () => {
      const result = await store.markEventPosted({
        guildId,
        id: 999,
        nextPostAt: "x",
        nextOccurrenceDate: "x",
        lastPostedAt: "x",
        lastMessageId: "x",
      });
      expect(result).toBeNull();
    });
  });
});
