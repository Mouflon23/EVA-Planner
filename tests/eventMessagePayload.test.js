const {
  RSVP_ACTIONS,
  CONTROL_ACTIONS,
  parseCustomId,
  buildEventMessagePayload,
} = require("../src/events/eventMessagePayload");

describe("constants", () => {
  it("exports expected RSVP action values", () => {
    expect(RSVP_ACTIONS.ACCEPTED).toBe("accepted");
    expect(RSVP_ACTIONS.DECLINED).toBe("declined");
  });

  it("exports expected CONTROL action values", () => {
    expect(CONTROL_ACTIONS.EDIT).toBe("edit");
    expect(CONTROL_ACTIONS.DELETE).toBe("delete");
  });
});

describe("parseCustomId", () => {
  it("returns action for valid event custom ID", () => {
    expect(parseCustomId("event:accepted")).toBe("accepted");
    expect(parseCustomId("event:declined")).toBe("declined");
    expect(parseCustomId("event:edit")).toBe("edit");
    expect(parseCustomId("event:delete")).toBe("delete");
  });

  it("returns null for non-event prefix", () => {
    expect(parseCustomId("other:accepted")).toBeNull();
  });

  it("returns null for missing action", () => {
    expect(parseCustomId("event:")).toBeNull();
  });

  it("returns null for null/undefined/non-string", () => {
    expect(parseCustomId(null)).toBeNull();
    expect(parseCustomId(undefined)).toBeNull();
    expect(parseCustomId(123)).toBeNull();
  });
});

describe("buildEventMessagePayload", () => {
  const baseEvent = {
    id: 1,
    title: "Test Session",
    description: "A test description",
    slots: [
      { timeLabel: "20:40", period: "HP", reservationUrl: null },
      { timeLabel: "21:20", period: "HC", reservationUrl: "https://example.com" },
    ],
    location: "EVA HQ",
    nextOccurrenceDate: "2025-06-15",
    startTime: "20:00",
    endTime: "22:00",
    mentionMode: "none",
    mentionRoleId: null,
    createdByName: "TestUser",
    createdById: "user-1",
  };

  it("returns object with content, allowedMentions, embeds, components", () => {
    const payload = buildEventMessagePayload({
      event: baseEvent,
      rsvpSummary: { accepted: [], declined: [] },
      timezoneLabel: "UTC",
    });
    expect(payload).toHaveProperty("content");
    expect(payload).toHaveProperty("allowedMentions");
    expect(payload).toHaveProperty("embeds");
    expect(payload).toHaveProperty("components");
    expect(payload.embeds).toHaveLength(1);
    expect(payload.components).toHaveLength(2);
  });

  it("uses event title in embed", () => {
    const payload = buildEventMessagePayload({
      event: baseEvent,
      rsvpSummary: { accepted: [], declined: [] },
      timezoneLabel: "UTC",
    });
    const embedData = payload.embeds[0].data;
    expect(embedData.title).toBe("Test Session");
  });

  it("falls back to Session #id when title is missing", () => {
    const payload = buildEventMessagePayload({
      event: { ...baseEvent, title: null },
      rsvpSummary: { accepted: [], declined: [] },
      timezoneLabel: "UTC",
    });
    expect(payload.embeds[0].data.title).toBe("Session #1");
  });

  it("includes location field when present", () => {
    const payload = buildEventMessagePayload({
      event: baseEvent,
      rsvpSummary: { accepted: [], declined: [] },
      timezoneLabel: "UTC",
    });
    const fields = payload.embeds[0].data.fields;
    const locationField = fields.find((f) => f.name === "Location");
    expect(locationField).toBeDefined();
    expect(locationField.value).toBe("EVA HQ");
  });

  it("omits location field when not present", () => {
    const payload = buildEventMessagePayload({
      event: { ...baseEvent, location: null },
      rsvpSummary: { accepted: [], declined: [] },
      timezoneLabel: "UTC",
    });
    const fields = payload.embeds[0].data.fields;
    const locationField = fields.find((f) => f.name === "Location");
    expect(locationField).toBeUndefined();
  });

  it("shows accepted and declined counts in field names", () => {
    const payload = buildEventMessagePayload({
      event: baseEvent,
      rsvpSummary: { accepted: ["u1", "u2"], declined: ["u3"] },
      timezoneLabel: "UTC",
    });
    const fields = payload.embeds[0].data.fields;
    const acceptedField = fields.find((f) => f.name.includes("Accepted"));
    const declinedField = fields.find((f) => f.name.includes("Declined"));
    expect(acceptedField.name).toContain("(2)");
    expect(declinedField.name).toContain("(1)");
  });

  describe("mention modes", () => {
    it("returns empty content for 'none' mention mode", () => {
      const payload = buildEventMessagePayload({
        event: { ...baseEvent, mentionMode: "none" },
        timezoneLabel: "UTC",
        allowMentionPing: true,
      });
      expect(payload.content).toBe("");
    });

    it("returns @everyone for 'everyone' mention mode", () => {
      const payload = buildEventMessagePayload({
        event: { ...baseEvent, mentionMode: "everyone" },
        timezoneLabel: "UTC",
        allowMentionPing: true,
      });
      expect(payload.content).toBe("@everyone");
      expect(payload.allowedMentions.parse).toContain("everyone");
    });

    it("returns @here for 'here' mention mode", () => {
      const payload = buildEventMessagePayload({
        event: { ...baseEvent, mentionMode: "here" },
        timezoneLabel: "UTC",
        allowMentionPing: true,
      });
      expect(payload.content).toBe("@here");
    });

    it("returns role mention for 'role' mention mode", () => {
      const payload = buildEventMessagePayload({
        event: { ...baseEvent, mentionMode: "role", mentionRoleId: "role-123" },
        timezoneLabel: "UTC",
        allowMentionPing: true,
      });
      expect(payload.content).toBe("<@&role-123>");
      expect(payload.allowedMentions.roles).toContain("role-123");
    });

    it("suppresses mention pings when allowMentionPing is false", () => {
      const payload = buildEventMessagePayload({
        event: { ...baseEvent, mentionMode: "everyone" },
        timezoneLabel: "UTC",
        allowMentionPing: false,
      });
      expect(payload.allowedMentions.parse).toEqual([]);
    });
  });

  describe("Google Calendar URL", () => {
    it("includes a Google Calendar link when event data is valid", () => {
      const payload = buildEventMessagePayload({
        event: baseEvent,
        rsvpSummary: { accepted: [], declined: [] },
        timezoneLabel: "UTC",
      });
      const timeField = payload.embeds[0].data.fields.find((f) => f.name === "Time");
      expect(timeField.value).toContain("calendar.google.com");
    });

    it("handles timezone offset in calendar URL", () => {
      const payload = buildEventMessagePayload({
        event: baseEvent,
        rsvpSummary: { accepted: [], declined: [] },
        timezoneLabel: "UTC+2",
      });
      const timeField = payload.embeds[0].data.fields.find((f) => f.name === "Time");
      expect(timeField.value).toContain("calendar.google.com");
    });
  });

  describe("buttons", () => {
    it("includes Accept and Decline RSVP buttons", () => {
      const payload = buildEventMessagePayload({
        event: baseEvent,
        rsvpSummary: { accepted: [], declined: [] },
        timezoneLabel: "UTC",
      });
      const rsvpRow = payload.components[0];
      const buttonLabels = rsvpRow.components.map((b) => b.data.label);
      expect(buttonLabels).toContain("Accept");
      expect(buttonLabels).toContain("Decline");
    });

    it("includes Edit and Delete control buttons", () => {
      const payload = buildEventMessagePayload({
        event: baseEvent,
        rsvpSummary: { accepted: [], declined: [] },
        timezoneLabel: "UTC",
      });
      const controlRow = payload.components[1];
      const buttonLabels = controlRow.components.map((b) => b.data.label);
      expect(buttonLabels).toContain("Edit");
      expect(buttonLabels).toContain("Delete");
    });

    it("includes Add to Google link button when calendar URL is valid", () => {
      const payload = buildEventMessagePayload({
        event: baseEvent,
        rsvpSummary: { accepted: [], declined: [] },
        timezoneLabel: "UTC",
      });
      const controlRow = payload.components[1];
      const googleBtn = controlRow.components.find((b) => b.data.label === "Add to Google");
      expect(googleBtn).toBeDefined();
      expect(googleBtn.data.url).toContain("calendar.google.com");
    });
  });
});
