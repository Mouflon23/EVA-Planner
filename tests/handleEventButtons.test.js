const { createMockInteraction } = require("./helpers/mockInteraction");
const { createEventStore } = require("../src/store/eventStore");
const { handleEventButtons, handleEventEditModal } = require("../src/events/handleEventButtons");
const { PermissionFlagsBits } = require("discord.js");

describe("handleEventButtons", () => {
  let store;
  const guildId = "guild-test";

  async function createTestEvent(overrides = {}) {
    return store.createEvent({
      guildId,
      channelId: "channel-test",
      title: "Test Session",
      description: "Test",
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
      createdById: "user-test",
      createdByName: "testuser",
      rsvpByUser: {},
      ...overrides,
    });
  }

  beforeEach(async () => {
    store = await createEventStore();
  });

  afterEach(async () => {
    await store.close();
  });

  it("returns false for non-button interactions", async () => {
    const interaction = createMockInteraction({ isButton: false });
    const result = await handleEventButtons({ interaction, eventStore: store, timezoneLabel: "UTC" });
    expect(result).toBe(false);
  });

  it("returns false for unrecognized custom IDs", async () => {
    const interaction = createMockInteraction({ isButton: true, customId: "unrelated:action" });
    const result = await handleEventButtons({ interaction, eventStore: store, timezoneLabel: "UTC" });
    expect(result).toBe(false);
  });

  it("replies with error when event not found for message", async () => {
    const interaction = createMockInteraction({
      isButton: true,
      customId: "event:accepted",
      messageId: "unknown-msg",
    });
    const result = await handleEventButtons({ interaction, eventStore: store, timezoneLabel: "UTC" });
    expect(result).toBe(true);
    expect(interaction.reply).toHaveBeenCalled();
    expect(interaction.reply.mock.calls[0][0].ephemeral).toBe(true);
  });

  it("handles accept RSVP action", async () => {
    const event = await createTestEvent();
    await store.markEventPosted({
      guildId,
      id: event.id,
      nextPostAt: "2025-06-23T18:00:00.000Z",
      nextOccurrenceDate: "2025-06-22",
      lastPostedAt: "2025-06-16T18:00:00.000Z",
      lastMessageId: "msg-test",
    });

    const interaction = createMockInteraction({
      isButton: true,
      customId: "event:accepted",
      messageId: "msg-test",
      eventStore: store,
    });
    const result = await handleEventButtons({ interaction, eventStore: store, timezoneLabel: "UTC" });
    expect(result).toBe(true);
    expect(interaction.update).toHaveBeenCalled();

    const updated = await store.getEventById({ guildId, id: event.id });
    expect(updated.rsvpByUser["user-test"]).toBe("accepted");
  });

  it("handles decline RSVP action", async () => {
    const event = await createTestEvent();
    await store.markEventPosted({
      guildId,
      id: event.id,
      nextPostAt: "2025-06-23T18:00:00.000Z",
      nextOccurrenceDate: "2025-06-22",
      lastPostedAt: "2025-06-16T18:00:00.000Z",
      lastMessageId: "msg-test",
    });

    const interaction = createMockInteraction({
      isButton: true,
      customId: "event:declined",
      messageId: "msg-test",
      eventStore: store,
    });
    const result = await handleEventButtons({ interaction, eventStore: store, timezoneLabel: "UTC" });
    expect(result).toBe(true);
    expect(interaction.update).toHaveBeenCalled();

    const updated = await store.getEventById({ guildId, id: event.id });
    expect(updated.rsvpByUser["user-test"]).toBe("declined");
  });

  it("handles delete action by event creator", async () => {
    const event = await createTestEvent({ createdById: "user-test" });
    await store.markEventPosted({
      guildId,
      id: event.id,
      nextPostAt: "2025-06-23T18:00:00.000Z",
      nextOccurrenceDate: "2025-06-22",
      lastPostedAt: "2025-06-16T18:00:00.000Z",
      lastMessageId: "msg-test",
    });

    const interaction = createMockInteraction({
      isButton: true,
      customId: "event:delete",
      messageId: "msg-test",
      userId: "user-test",
    });
    const result = await handleEventButtons({ interaction, eventStore: store, timezoneLabel: "UTC" });
    expect(result).toBe(true);
    expect(interaction.deferUpdate).toHaveBeenCalled();
    expect(interaction.message.delete).toHaveBeenCalled();

    const deleted = await store.getEventById({ guildId, id: event.id });
    expect(deleted).toBeNull();
  });

  it("rejects delete from non-creator without ManageGuild", async () => {
    const event = await createTestEvent({ createdById: "owner-user" });
    await store.markEventPosted({
      guildId,
      id: event.id,
      nextPostAt: "2025-06-23T18:00:00.000Z",
      nextOccurrenceDate: "2025-06-22",
      lastPostedAt: "2025-06-16T18:00:00.000Z",
      lastMessageId: "msg-test",
    });

    const interaction = createMockInteraction({
      isButton: true,
      customId: "event:delete",
      messageId: "msg-test",
      userId: "other-user",
      permissions: [],
    });
    const result = await handleEventButtons({ interaction, eventStore: store, timezoneLabel: "UTC" });
    expect(result).toBe(true);
    expect(interaction.reply).toHaveBeenCalled();
    expect(interaction.reply.mock.calls[0][0].ephemeral).toBe(true);
  });

  it("allows delete by ManageGuild permission holder", async () => {
    const event = await createTestEvent({ createdById: "owner-user" });
    await store.markEventPosted({
      guildId,
      id: event.id,
      nextPostAt: "2025-06-23T18:00:00.000Z",
      nextOccurrenceDate: "2025-06-22",
      lastPostedAt: "2025-06-16T18:00:00.000Z",
      lastMessageId: "msg-test",
    });

    const interaction = createMockInteraction({
      isButton: true,
      customId: "event:delete",
      messageId: "msg-test",
      userId: "admin-user",
      permissions: [PermissionFlagsBits.ManageGuild],
    });
    const result = await handleEventButtons({ interaction, eventStore: store, timezoneLabel: "UTC" });
    expect(result).toBe(true);
    expect(interaction.deferUpdate).toHaveBeenCalled();
  });

  it("handles edit action and shows modal", async () => {
    const event = await createTestEvent({ createdById: "user-test" });
    await store.markEventPosted({
      guildId,
      id: event.id,
      nextPostAt: "2025-06-23T18:00:00.000Z",
      nextOccurrenceDate: "2025-06-22",
      lastPostedAt: "2025-06-16T18:00:00.000Z",
      lastMessageId: "msg-test",
    });

    const interaction = createMockInteraction({
      isButton: true,
      customId: "event:edit",
      messageId: "msg-test",
      userId: "user-test",
    });
    const result = await handleEventButtons({ interaction, eventStore: store, timezoneLabel: "UTC" });
    expect(result).toBe(true);
    expect(interaction.showModal).toHaveBeenCalled();
  });

  it("replies with error when eventStore is null", async () => {
    const interaction = createMockInteraction({
      isButton: true,
      customId: "event:accepted",
    });
    const result = await handleEventButtons({ interaction, eventStore: null, timezoneLabel: "UTC" });
    expect(result).toBe(true);
    expect(interaction.reply.mock.calls[0][0].ephemeral).toBe(true);
  });
});

describe("handleEventEditModal", () => {
  let store;
  const guildId = "guild-test";

  beforeEach(async () => {
    store = await createEventStore();
  });

  afterEach(async () => {
    await store.close();
  });

  it("returns false for non-modal-submit interactions", async () => {
    const interaction = createMockInteraction({ isModalSubmit: false });
    const result = await handleEventEditModal({ interaction, eventStore: store, timezoneLabel: "UTC" });
    expect(result).toBe(false);
  });

  it("returns false for unrelated modal custom IDs", async () => {
    const interaction = createMockInteraction({
      isModalSubmit: true,
      customId: "other-modal:1",
    });
    const result = await handleEventEditModal({ interaction, eventStore: store, timezoneLabel: "UTC" });
    expect(result).toBe(false);
  });

  it("successfully updates event via modal", async () => {
    const event = await store.createEvent({
      guildId,
      channelId: "channel-test",
      title: "Original Title",
      description: "Original Desc",
      location: "Old Place",
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
      createdById: "user-test",
      createdByName: "testuser",
      rsvpByUser: {},
    });

    await store.markEventPosted({
      guildId,
      id: event.id,
      nextPostAt: "2025-06-23T18:00:00.000Z",
      nextOccurrenceDate: "2025-06-22",
      lastPostedAt: "2025-06-16T18:00:00.000Z",
      lastMessageId: "msg-test",
    });

    const interaction = createMockInteraction({
      isModalSubmit: true,
      customId: `event-edit:${event.id}`,
      userId: "user-test",
      fieldValues: {
        "event-edit-title": "Updated Title",
        "event-edit-description": "Updated Desc",
        "event-edit-slots": "21h00 HC",
        "event-edit-location": "New Place",
      },
    });

    const result = await handleEventEditModal({ interaction, eventStore: store, timezoneLabel: "UTC" });
    expect(result).toBe(true);
    expect(interaction.reply).toHaveBeenCalled();

    const updated = await store.getEventById({ guildId, id: event.id });
    expect(updated.title).toBe("Updated Title");
    expect(updated.description).toBe("Updated Desc");
    expect(updated.location).toBe("New Place");
    expect(updated.slots[0].period).toBe("HC");
  });

  it("rejects edit from non-creator without permission", async () => {
    const event = await store.createEvent({
      guildId,
      channelId: "channel-test",
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
      createdById: "owner-user",
      createdByName: "owner",
    });

    const interaction = createMockInteraction({
      isModalSubmit: true,
      customId: `event-edit:${event.id}`,
      userId: "other-user",
      permissions: [],
      fieldValues: {
        "event-edit-title": "Hacked",
        "event-edit-description": "Hacked",
        "event-edit-slots": "20:00 HP",
        "event-edit-location": "",
      },
    });

    const result = await handleEventEditModal({ interaction, eventStore: store, timezoneLabel: "UTC" });
    expect(result).toBe(true);
    expect(interaction.reply.mock.calls[0][0].ephemeral).toBe(true);
    expect(interaction.reply.mock.calls[0][0].embeds[0].data.description).toContain("creator");
  });

  it("replies with error for invalid slot input in modal", async () => {
    const event = await store.createEvent({
      guildId,
      channelId: "channel-test",
      title: "T",
      description: "D",
      slots: [{ timeLabel: "20:40", period: "HP", reservationUrl: null }],
      mentionMode: "none",
      rsvpByUser: {},
      eventDate: "2025-06-15",
      startTime: "20:00",
      endTime: "22:00",
      postWeekday: 1,
      postTime: "18:00",
      nextPostAt: "2025-06-16T18:00:00.000Z",
      nextOccurrenceDate: "2025-06-15",
      createdById: "user-test",
      createdByName: "testuser",
    });

    const interaction = createMockInteraction({
      isModalSubmit: true,
      customId: `event-edit:${event.id}`,
      userId: "user-test",
      fieldValues: {
        "event-edit-title": "Title",
        "event-edit-description": "Desc",
        "event-edit-slots": "invalid slots data",
        "event-edit-location": "",
      },
    });

    const result = await handleEventEditModal({ interaction, eventStore: store, timezoneLabel: "UTC" });
    expect(result).toBe(true);
    expect(interaction.reply.mock.calls[0][0].ephemeral).toBe(true);
  });
});
