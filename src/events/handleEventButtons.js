const {
  buildEventMessagePayload,
  CONTROL_ACTIONS,
  parseCustomId,
  RSVP_ACTIONS,
} = require("./eventMessagePayload");
const {
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");
const { parseSlotsInput, slotsToInput } = require("./slotParser");

const EDIT_MODAL_PREFIX = "event-edit";
const EDIT_TITLE_INPUT_ID = "event-edit-title";
const EDIT_DESCRIPTION_INPUT_ID = "event-edit-description";
const EDIT_SLOTS_INPUT_ID = "event-edit-slots";

function statusFromAction(action) {
  if (action === RSVP_ACTIONS.ACCEPTED) {
    return "accepted";
  }
  if (action === RSVP_ACTIONS.DECLINED) {
    return "declined";
  }
  if (action === RSVP_ACTIONS.TENTATIVE) {
    return "tentative";
  }
  return null;
}

function summarizeRsvps(rsvpByUser) {
  const summary = {
    accepted: [],
    declined: [],
    tentative: [],
  };

  for (const [userId, status] of Object.entries(rsvpByUser || {})) {
    if (status === "accepted") {
      summary.accepted.push(userId);
    } else if (status === "declined") {
      summary.declined.push(userId);
    } else if (status === "tentative") {
      summary.tentative.push(userId);
    }
  }

  return summary;
}

async function handleRsvpAction(interaction, eventStore, event, status, timezoneLabel) {
  const updated = await eventStore.setRsvp({
    guildId: event.guildId,
    id: event.id,
    userId: interaction.user.id,
    status,
  });

  if (!updated) {
    await interaction.reply({
      content: "This event no longer exists.",
      ephemeral: true,
    });
    return;
  }

  const payload = buildEventMessagePayload({
    event: updated,
    rsvpSummary: summarizeRsvps(updated.rsvpByUser),
    timezoneLabel: timezoneLabel || interaction.client.timezoneLabel || "UTC",
    allowMentionPing: false,
  });

  await interaction.update(payload);
  return true;
}

async function handleDeleteAction(interaction, eventStore, event) {
  const canDelete =
    interaction.user.id === event.createdById ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

  if (!canDelete) {
    await interaction.reply({
      content: "Only the event creator or a server manager can delete this event.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();
  await eventStore.deleteEvent({ guildId: event.guildId, id: event.id });
  await interaction.message.delete();
  return true;
}

async function handleEditAction(interaction, eventStore, event) {
  const canEdit =
    interaction.user.id === event.createdById ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

  if (!canEdit) {
    await interaction.reply({
      content: "Only the event creator or a server manager can edit this event.",
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`${EDIT_MODAL_PREFIX}:${event.id}`)
    .setTitle(`Edit Session #${event.id}`);

  const titleInput = new TextInputBuilder()
    .setCustomId(EDIT_TITLE_INPUT_ID)
    .setLabel("Session title")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(120)
    .setValue(event.title || "");

  const descriptionInput = new TextInputBuilder()
    .setCustomId(EDIT_DESCRIPTION_INPUT_ID)
    .setLabel("Description")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(500)
    .setValue(event.description || "");

  const slotsInput = new TextInputBuilder()
    .setCustomId(EDIT_SLOTS_INPUT_ID)
    .setLabel("Slots (e.g. 20h40 HP, 21h20 HC)")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(900)
    .setValue(slotsToInput(event.slots));

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(descriptionInput),
    new ActionRowBuilder().addComponents(slotsInput)
  );

  await interaction.showModal(modal);
  return true;
}

function parseEditModalCustomId(customId) {
  if (!customId || typeof customId !== "string") {
    return null;
  }
  const [prefix, rawId] = customId.split(":");
  if (prefix !== EDIT_MODAL_PREFIX || !rawId) {
    return null;
  }
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

async function handleEventEditModal({ interaction, eventStore, timezoneLabel }) {
  if (!interaction.isModalSubmit()) {
    return false;
  }

  const eventId = parseEditModalCustomId(interaction.customId);
  if (!eventId) {
    return false;
  }

  const guildId = interaction.guildId;
  if (!eventStore || !guildId) {
    await interaction.reply({
      content: "Event store is unavailable in this context.",
      ephemeral: true,
    });
    return true;
  }

  const event = await eventStore.getEventById({ guildId, id: eventId });
  if (!event) {
    await interaction.reply({
      content: "Event data not found.",
      ephemeral: true,
    });
    return true;
  }

  const canEdit =
    interaction.user.id === event.createdById ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
  if (!canEdit) {
    await interaction.reply({
      content: "Only the event creator or a server manager can edit this event.",
      ephemeral: true,
    });
    return true;
  }

  const title = interaction.fields.getTextInputValue(EDIT_TITLE_INPUT_ID).trim();
  const description = interaction.fields
    .getTextInputValue(EDIT_DESCRIPTION_INPUT_ID)
    .trim();
  const slotsInput = interaction.fields.getTextInputValue(EDIT_SLOTS_INPUT_ID).trim();
  const parsedSlots = parseSlotsInput(slotsInput);

  if (!title || !description || !parsedSlots.slots) {
    await interaction.reply({
      content:
        parsedSlots.error ||
        "Title, description, and slots are required to update this event.",
      ephemeral: true,
    });
    return true;
  }

  const updated = await eventStore.updateEventDetails({
    guildId,
    id: eventId,
    title,
    description,
    slots: parsedSlots.slots,
  });

  if (!updated) {
    await interaction.reply({
      content: "Could not update event.",
      ephemeral: true,
    });
    return true;
  }

  const payload = buildEventMessagePayload({
    event: updated,
    rsvpSummary: summarizeRsvps(updated.rsvpByUser),
    timezoneLabel: timezoneLabel || interaction.client.timezoneLabel || "UTC",
    allowMentionPing: false,
  });

  if (interaction.message) {
    await interaction.message.edit(payload);
  } else if (event.lastMessageId) {
    try {
      const channel = await interaction.client.channels.fetch(event.channelId);
      if (channel && channel.isTextBased()) {
        const message = await channel.messages.fetch(event.lastMessageId);
        if (message) {
          await message.edit(payload);
        }
      }
    } catch (error) {
      console.error("Failed to refresh event message after edit modal:", error);
    }
  }

  await interaction.reply({
    content: `Session #${eventId} updated.`,
    ephemeral: true,
  });
  return true;
}

async function handleEventButtons({ interaction, eventStore, timezoneLabel }) {
  if (!interaction.isButton()) {
    return false;
  }

  const action = parseCustomId(interaction.customId);
  if (!action) {
    return false;
  }

  const guildId = interaction.guildId;
  if (!eventStore || !guildId) {
    await interaction.reply({
      content: "Event store is unavailable in this context.",
      ephemeral: true,
    });
    return true;
  }

  const event = await eventStore.getEventByMessage({
    guildId,
    messageId: interaction.message.id,
  });
  if (!event) {
    await interaction.reply({
      content: "Event data not found for this message.",
      ephemeral: true,
    });
    return true;
  }

  const status = statusFromAction(action);
  if (status) {
    await handleRsvpAction(interaction, eventStore, event, status, timezoneLabel);
    return true;
  }

  if (action === CONTROL_ACTIONS.DELETE) {
    await handleDeleteAction(interaction, eventStore, event);
    return true;
  }

  if (action === CONTROL_ACTIONS.EDIT) {
    await handleEditAction(interaction, eventStore, event);
    return true;
  }

  return false;
}

module.exports = {
  handleEventButtons,
  handleEventEditModal,
};
