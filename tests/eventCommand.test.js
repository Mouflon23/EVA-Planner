const {
  normalizeHour,
  weekdayName,
  parseTimezoneOffset,
  buildPostingReferenceDate,
  parseIsoDate,
} = require("../src/commands/event");

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
