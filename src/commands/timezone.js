const {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require("discord.js");

const BRAND_COLOR = 0x6b2d87;
const SUCCESS_COLOR = 0x57f287;
const ERROR_COLOR = 0xed4245;

const TIMEZONE_CHOICES = [
  { name: "UTC — London (winter), Reykjavik", value: "UTC" },
  { name: "UTC+1 — Paris, Berlin, Brussels, Madrid", value: "UTC+1" },
  { name: "UTC+2 — Athens, Cairo, Helsinki, Bucharest", value: "UTC+2" },
  { name: "UTC+3 — Moscow, Istanbul, Riyadh", value: "UTC+3" },
  { name: "UTC+4 — Dubai, Baku, Tbilisi", value: "UTC+4" },
  { name: "UTC+5 — Karachi, Tashkent", value: "UTC+5" },
  { name: "UTC+5:30 — Mumbai, Delhi, Colombo", value: "UTC+5:30" },
  { name: "UTC+6 — Dhaka, Almaty", value: "UTC+6" },
  { name: "UTC+7 — Bangkok, Jakarta, Hanoi", value: "UTC+7" },
  { name: "UTC+8 — Singapore, Hong Kong, Perth", value: "UTC+8" },
  { name: "UTC+9 — Tokyo, Seoul", value: "UTC+9" },
  { name: "UTC+10 — Sydney, Melbourne, Brisbane", value: "UTC+10" },
  { name: "UTC+12 — Auckland, Fiji", value: "UTC+12" },
  { name: "UTC-3 — São Paulo, Buenos Aires", value: "UTC-3" },
  { name: "UTC-4 — New York, Toronto (summer EDT)", value: "UTC-4" },
  { name: "UTC-5 — New York, Toronto (winter EST)", value: "UTC-5" },
  { name: "UTC-6 — Chicago, Mexico City (winter CST)", value: "UTC-6" },
  { name: "UTC-7 — Denver, Phoenix (winter MST)", value: "UTC-7" },
  { name: "UTC-8 — Los Angeles, Vancouver (winter PST)", value: "UTC-8" },
  { name: "UTC-10 — Honolulu, Hawaii", value: "UTC-10" },
];

module.exports = {
  TIMEZONE_CHOICES,
  data: new SlashCommandBuilder()
    .setName("timezone")
    .setDescription("Manage the server timezone for event scheduling")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("show")
        .setDescription("Show the current server timezone")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setDescription("Set the server timezone")
        .addStringOption((option) => {
          let configured = option
            .setName("zone")
            .setDescription("Timezone to use for event times")
            .setRequired(true);

          for (const tz of TIMEZONE_CHOICES) {
            configured = configured.addChoices({ name: tz.name, value: tz.value });
          }
          return configured;
        })
    ),
  async execute(interaction) {
    const eventStore = interaction.client.eventStore;
    const guildId = interaction.guildId;

    if (!eventStore || !guildId) {
      const embed = new EmbedBuilder()
        .setColor(ERROR_COLOR)
        .setDescription("Timezone settings are unavailable in this context.");
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "show") {
      const settings = await eventStore.getGuildSettings({ guildId });
      const tz = settings.timezone || interaction.client.timezoneLabel || "UTC";
      const match = TIMEZONE_CHOICES.find((c) => c.value === tz);
      const displayName = match ? match.name : tz;

      const embed = new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle("\u{1F30D} Server Timezone")
        .setDescription(`Current timezone is **${displayName}**.`);

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === "set") {
      const canManage = interaction.memberPermissions?.has(
        PermissionFlagsBits.ManageGuild
      );
      if (!canManage) {
        const embed = new EmbedBuilder()
          .setColor(ERROR_COLOR)
          .setDescription("You need the **Manage Server** permission to change the timezone.");
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const zone = interaction.options.getString("zone", true);
      await eventStore.setTimezone({ guildId, timezone: zone });

      const match = TIMEZONE_CHOICES.find((c) => c.value === zone);
      const displayName = match ? match.name : zone;

      const embed = new EmbedBuilder()
        .setColor(SUCCESS_COLOR)
        .setTitle("\u{2705} Timezone Updated")
        .setDescription(`Server timezone set to **${displayName}**.`);

      await interaction.reply({ embeds: [embed] });
    }
  },
};
