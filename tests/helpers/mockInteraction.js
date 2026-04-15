const { createEventStore } = require("../../src/store/eventStore");

function createMockInteraction(overrides = {}) {
  const repliedData = { calls: [] };
  const followUpData = { calls: [] };
  const updateData = { calls: [] };
  const deferUpdateData = { calls: [] };
  const showModalData = { calls: [] };

  const interaction = {
    replied: false,
    deferred: false,
    createdTimestamp: Date.now() - 50,
    guildId: overrides.guildId ?? "guild-test",
    channel: overrides.channel ?? { id: "channel-test" },
    user: {
      id: overrides.userId ?? "user-test",
      username: overrides.username ?? "testuser",
      displayName: overrides.displayName ?? "TestUser",
      displayAvatarURL: () => "https://cdn.example.com/avatar.png",
    },
    memberPermissions: {
      has: (perm) => overrides.permissions?.includes(perm) ?? false,
    },
    client: {
      eventStore: overrides.eventStore ?? null,
      timezoneLabel: overrides.timezoneLabel ?? "UTC",
      commands: new Map(),
      channels: {
        fetch: jest.fn().mockResolvedValue({
          id: "channel-test",
          isTextBased: () => true,
          send: jest.fn().mockResolvedValue({ id: "sent-msg-id" }),
          messages: { fetch: jest.fn().mockResolvedValue({ edit: jest.fn() }) },
        }),
      },
    },
    message: overrides.message ?? {
      id: overrides.messageId ?? "msg-test",
      delete: jest.fn(),
      edit: jest.fn(),
    },
    customId: overrides.customId ?? null,
    options: {
      _data: overrides.optionsData ?? {},
      getSubcommand: () => overrides.subcommand ?? "show",
      getString: (name, required) => {
        const val = (overrides.optionsData ?? {})[name];
        if (required && val === undefined) throw new Error(`Missing option: ${name}`);
        return val ?? null;
      },
      getInteger: (name, required) => {
        const val = (overrides.optionsData ?? {})[name];
        if (required && val === undefined) throw new Error(`Missing option: ${name}`);
        return val ?? null;
      },
      getChannel: (name) => (overrides.optionsData ?? {})[name] ?? null,
      getRole: (name) => (overrides.optionsData ?? {})[name] ?? null,
    },
    fields: {
      getTextInputValue: (id) => (overrides.fieldValues ?? {})[id] ?? "",
    },
    isButton: () => overrides.isButton ?? false,
    isModalSubmit: () => overrides.isModalSubmit ?? false,
    isChatInputCommand: () => overrides.isChatInputCommand ?? true,
    reply: jest.fn(async (data) => {
      interaction.replied = true;
      repliedData.calls.push(data);
    }),
    followUp: jest.fn(async (data) => {
      followUpData.calls.push(data);
    }),
    update: jest.fn(async (data) => {
      updateData.calls.push(data);
    }),
    deferUpdate: jest.fn(async () => {
      interaction.deferred = true;
      deferUpdateData.calls.push({});
    }),
    showModal: jest.fn(async (modal) => {
      showModalData.calls.push(modal);
    }),
    commandName: overrides.commandName ?? "ping",

    _repliedData: repliedData,
    _followUpData: followUpData,
    _updateData: updateData,
    _deferUpdateData: deferUpdateData,
    _showModalData: showModalData,
  };

  return interaction;
}

module.exports = { createMockInteraction };
