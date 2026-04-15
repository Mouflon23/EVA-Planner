const { parseSlotsInput, slotsToInput, slotsSummary } = require("../src/events/slotParser");

describe("parseSlotsInput", () => {
  it("returns error for empty input", () => {
    expect(parseSlotsInput("")).toEqual({ error: "Slots are required." });
    expect(parseSlotsInput(null)).toEqual({ error: "Slots are required." });
    expect(parseSlotsInput(undefined)).toEqual({ error: "Slots are required." });
    expect(parseSlotsInput("   ")).toEqual({ error: "Slots are required." });
  });

  it("parses a single HP slot with colon format", () => {
    const result = parseSlotsInput("20:40 HP");
    expect(result.slots).toEqual([
      { timeLabel: "20:40", period: "HP", reservationUrl: null },
    ]);
  });

  it("parses a single HC slot with h-format", () => {
    const result = parseSlotsInput("21h20 HC");
    expect(result.slots).toEqual([
      { timeLabel: "21:20", period: "HC", reservationUrl: null },
    ]);
  });

  it("is case-insensitive for period", () => {
    const result = parseSlotsInput("09:30 hp");
    expect(result.slots[0].period).toBe("HP");
  });

  it("parses multiple comma-separated slots", () => {
    const result = parseSlotsInput("20h40 HP, 21h20 HP, 22h00 HC");
    expect(result.slots).toHaveLength(3);
    expect(result.slots[0]).toEqual({ timeLabel: "20:40", period: "HP", reservationUrl: null });
    expect(result.slots[1]).toEqual({ timeLabel: "21:20", period: "HP", reservationUrl: null });
    expect(result.slots[2]).toEqual({ timeLabel: "22:00", period: "HC", reservationUrl: null });
  });

  it("applies fallback reservation URL when slot has no URL", () => {
    const result = parseSlotsInput("20:40 HP", "https://example.com/reserve");
    expect(result.slots[0].reservationUrl).toBe("https://example.com/reserve");
  });

  it("uses slot-specific URL over fallback", () => {
    const result = parseSlotsInput("20:40 HP https://specific.com", "https://fallback.com");
    expect(result.slots[0].reservationUrl).toBe("https://specific.com");
  });

  it("returns error for invalid slot format", () => {
    const result = parseSlotsInput("invalid");
    expect(result.error).toBeTruthy();
    expect(result.slots).toBeUndefined();
  });

  it("returns error when one slot in a list is invalid", () => {
    const result = parseSlotsInput("20:40 HP, bad slot");
    expect(result.error).toBeTruthy();
  });

  it("handles leading zeros in hours", () => {
    const result = parseSlotsInput("08:30 HP");
    expect(result.slots[0].timeLabel).toBe("08:30");
  });

  it("rejects hours above 23", () => {
    const result = parseSlotsInput("24:00 HP");
    expect(result.error).toBeTruthy();
  });

  it("rejects minutes above 59", () => {
    const result = parseSlotsInput("20:60 HP");
    expect(result.error).toBeTruthy();
  });

  it("handles midnight (00:00)", () => {
    const result = parseSlotsInput("00:00 HP");
    expect(result.slots[0].timeLabel).toBe("00:00");
  });
});

describe("slotsToInput", () => {
  it("returns empty string for empty/null input", () => {
    expect(slotsToInput([])).toBe("");
    expect(slotsToInput(null)).toBe("");
    expect(slotsToInput(undefined)).toBe("");
  });

  it("converts single slot back to text", () => {
    const result = slotsToInput([{ timeLabel: "20:40", period: "HP", reservationUrl: null }]);
    expect(result).toBe("20:40 HP");
  });

  it("converts multiple slots with comma separation", () => {
    const slots = [
      { timeLabel: "20:40", period: "HP", reservationUrl: null },
      { timeLabel: "21:20", period: "HC", reservationUrl: null },
    ];
    expect(slotsToInput(slots)).toBe("20:40 HP, 21:20 HC");
  });

  it("includes reservation URL in output", () => {
    const slots = [{ timeLabel: "20:40", period: "HP", reservationUrl: "https://example.com" }];
    expect(slotsToInput(slots)).toBe("20:40 HP https://example.com");
  });

  it("respects 900-character max length limit", () => {
    const manySlots = Array.from({ length: 200 }, (_, i) => ({
      timeLabel: `${String(i % 24).padStart(2, "0")}:00`,
      period: "HP",
      reservationUrl: "https://example.com/very-long-reservation-url-here",
    }));
    const result = slotsToInput(manySlots);
    expect(result.length).toBeLessThanOrEqual(900);
  });
});

describe("slotsSummary", () => {
  it("returns dash for empty/null input", () => {
    expect(slotsSummary([])).toBe("-");
    expect(slotsSummary(null)).toBe("-");
    expect(slotsSummary(undefined)).toBe("-");
  });

  it("returns comma-separated summary", () => {
    const slots = [
      { timeLabel: "20:40", period: "HP" },
      { timeLabel: "21:20", period: "HC" },
    ];
    expect(slotsSummary(slots)).toBe("20:40 HP, 21:20 HC");
  });
});
