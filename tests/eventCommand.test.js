const {
  normalizeHour,
  weekdayName,
  parseTimezoneOffset,
  buildPostingReferenceDate,
  parseIsoDate,
  autocomplete,
} = require("../src/commands/event");
const { createEventStore } = require("../src/store/eventStore");

describe("normalizeHour", () => {
  it("parses HH:MM colon format", () => {
    const result = normalizeHour("14:30");
    expect(result).toEqual({ hour: 14, minute: 30, label: "14:30" });
  });

  it("parses HHhMM format", () => {
    const result = normalizeHour("09h15");
    expect(result).toEqual({ hour: 9, minute: 15, label: "09:15" });
  });

  it("returns null for invalid input", () => {
    expect(normalizeHour("25:00")).toBeNull();
    expect(normalizeHour("abc")).toBeNull();
    expect(normalizeHour("14:60")).toBeNull();
    expect(normalizeHour("")).toBeNull();
  });

  it("handles midnight 00:00", () => {
    expect(normalizeHour("00:00")).toEqual({ hour: 0, minute: 0, label: "00:00" });
  });

  it("handles end of day 23:59", () => {
    expect(normalizeHour("23:59")).toEqual({ hour: 23, minute: 59, label: "23:59" });
  });
});

describe("weekdayName", () => {
  it("returns correct weekday names for 0-6", () => {
    expect(weekdayName(0)).toBe("Sunday");
    expect(weekdayName(1)).toBe("Monday");
    expect(weekdayName(2)).toBe("Tuesday");
    expect(weekdayName(3)).toBe("Wednesday");
    expect(weekdayName(4)).toBe("Thursday");
    expect(weekdayName(5)).toBe("Friday");
    expect(weekdayName(6)).toBe("Saturday");
  });

  it("returns 'Unknown' for out-of-range values", () => {
    expect(weekdayName(7)).toBe("Unknown");
    expect(weekdayName(-1)).toBe("Unknown");
  });
});

describe("parseTimezoneOffset", () => {
  it("returns 0 for UTC", () => {
    expect(parseTimezoneOffset("UTC")).toBe(0);
  });

  it("returns 0 for GMT", () => {
    expect(parseTimezoneOffset("GMT")).toBe(0);
  });

  it("parses positive offset", () => {
    expect(parseTimezoneOffset("UTC+2")).toBe(120);
    expect(parseTimezoneOffset("UTC+05:30")).toBe(330);
  });

  it("parses negative offset", () => {
    expect(parseTimezoneOffset("UTC-5")).toBe(-300);
    expect(parseTimezoneOffset("UTC-05:30")).toBe(-330);
  });

  it("is case-insensitive", () => {
    expect(parseTimezoneOffset("utc+2")).toBe(120);
    expect(parseTimezoneOffset("gmt-3")).toBe(-180);
  });

  it("returns null for invalid timezone", () => {
    expect(parseTimezoneOffset("EST")).toBeNull();
    expect(parseTimezoneOffset("random")).toBeNull();
  });

  it("returns null for hours > 14", () => {
    expect(parseTimezoneOffset("UTC+15")).toBeNull();
  });

  it("accepts hours up to 14", () => {
    expect(parseTimezoneOffset("UTC+14")).toBe(840);
  });
});

describe("buildPostingReferenceDate", () => {
  it("returns a Date offset by the given minutes", () => {
    const before = Date.now();
    const result = buildPostingReferenceDate(120);
    const after = Date.now();
    const expected = before + 120 * 60 * 1000;
    expect(result.getTime()).toBeGreaterThanOrEqual(expected - 50);
    expect(result.getTime()).toBeLessThanOrEqual(after + 120 * 60 * 1000 + 50);
  });

  it("returns current time for 0 offset", () => {
    const before = Date.now();
    const result = buildPostingReferenceDate(0);
    expect(Math.abs(result.getTime() - before)).toBeLessThan(100);
  });
});

describe("parseIsoDate", () => {
  it("parses valid ISO date string", () => {
    const result = parseIsoDate("2025-06-15T18:00:00.000Z");
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe("2025-06-15T18:00:00.000Z");
  });

  it("returns null for invalid date string", () => {
    expect(parseIsoDate("not-a-date")).toBeNull();
    expect(parseIsoDate("")).toBeNull();
  });
});

describe("autocomplete", () => {
  let store;
  const guildId = "guild-test";

  beforeEach(async () => {
    store = await createEventStore();
    await store.createEvent({
      guildId,
      channelId: "c1",
      title: "Weekly Raid",
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
    await store.createEvent({
      guildId,
      channelId: "c1",
      title: "PvP Night",
      description: "D",
      slots: [],
      mentionMode: "none",
      rsvpByUser: {},
      eventDate: "2025-06-16",
      startTime: "21:00",
      endTime: "23:00",
      postWeekday: 2,
      postTime: "19:00",
      nextPostAt: "2025-06-17T19:00:00.000Z",
      nextOccurrenceDate: "2025-06-16",
      createdById: "u1",
      createdByName: "U1",
    });
  });

  afterEach(async () => {
    await store.close();
  });

  function mockAutocompleteInteraction(focusedValue) {
    const responded = [];
    return {
      client: { eventStore: store },
      guildId,
      options: {
        getFocused: (withInfo) =>
          withInfo ? { name: "id", value: focusedValue } : focusedValue,
      },
      respond: jest.fn(async (choices) => responded.push(...choices)),
      _responded: responded,
    };
  }

  it("returns all events when query is empty", async () => {
    const interaction = mockAutocompleteInteraction("");
    await autocomplete(interaction);
    expect(interaction.respond).toHaveBeenCalledTimes(1);
    expect(interaction._responded).toHaveLength(2);
    expect(interaction._responded[0].name).toContain("Weekly Raid");
    expect(interaction._responded[1].name).toContain("PvP Night");
  });

  it("filters by event ID prefix", async () => {
    const interaction = mockAutocompleteInteraction("1");
    await autocomplete(interaction);
    expect(interaction._responded).toHaveLength(1);
    expect(interaction._responded[0].value).toBe(1);
  });

  it("filters by title substring (case-insensitive)", async () => {
    const interaction = mockAutocompleteInteraction("pvp");
    await autocomplete(interaction);
    expect(interaction._responded).toHaveLength(1);
    expect(interaction._responded[0].name).toContain("PvP Night");
  });

  it("returns empty when no events match", async () => {
    const interaction = mockAutocompleteInteraction("zzz");
    await autocomplete(interaction);
    expect(interaction._responded).toHaveLength(0);
  });

  it("responds empty when eventStore is null", async () => {
    const interaction = mockAutocompleteInteraction("");
    interaction.client.eventStore = null;
    await autocomplete(interaction);
    expect(interaction.respond).toHaveBeenCalledWith([]);
  });

  it("responds empty for non-id focused option", async () => {
    const interaction = mockAutocompleteInteraction("");
    interaction.options.getFocused = (withInfo) =>
      withInfo ? { name: "other", value: "" } : "";
    await autocomplete(interaction);
    expect(interaction.respond).toHaveBeenCalledWith([]);
  });

  it("includes event date in choice name", async () => {
    const interaction = mockAutocompleteInteraction("");
    await autocomplete(interaction);
    expect(interaction._responded[0].name).toContain("2025-06-15");
  });

  it("limits results to 25 entries", async () => {
    for (let i = 0; i < 30; i++) {
      await store.createEvent({
        guildId,
        channelId: "c1",
        title: `Event ${i}`,
        description: "D",
        slots: [],
        mentionMode: "none",
        rsvpByUser: {},
        eventDate: "2025-07-01",
        startTime: "20:00",
        endTime: "22:00",
        postWeekday: 1,
        postTime: "18:00",
        nextPostAt: "2025-07-01T18:00:00.000Z",
        nextOccurrenceDate: "2025-07-01",
        createdById: "u1",
        createdByName: "U1",
      });
    }
    const interaction = mockAutocompleteInteraction("");
    await autocomplete(interaction);
    expect(interaction._responded.length).toBeLessThanOrEqual(25);
  });
});
