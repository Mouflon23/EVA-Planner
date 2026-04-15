const {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require("discord.js");

const BRAND_COLOR = 0x6b2d87;

const WEEKDAYS = [
  { name: "Sunday", value: 0 },
  { name: "Monday", value: 1 },
  { name: "Tuesday", value: 2 },
  { name: "Wednesday", value: 3 },
  { name: "Thursday", value: 4 },
  { name: "Friday", value: 5 },
  { name: "Saturday", value: 6 },
];

function weekdayName(index) {
  const match = WEEKDAYS.find((item) => item.value === index);
  return match ? match.name : "Unknown";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("weekstart")
    .setDescription("Manage the server's starting day of week")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("show")
        .setDescription("Show the configured starting day of the week")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setDescription("Set the server's starting day of the week")
        .addIntegerOption((option) => {
          let optionWithChoices = option
            .setName("day")
            .setDescription("Choose the first day of your week")
            .setRequired(true);

          for (const weekday of WEEKDAYS) {
            optionWithChoices = optionWithChoices.addChoices({
              name: weekday.name,
              value: weekday.value,
            });
          }
          return optionWithChoices;
        })
    ),
  async execute(interaction) {
    const eventStore = interaction.client.eventStore;
    const guildId = interaction.guildId;

    if (!eventStore || !guildId) {
      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setDescription("Week-start settings are unavailable in this context.");
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "show") {
      const settings = await eventStore.getGuildSettings({ guildId });
      const dayName = weekdayName(settings.weekStartDay);

      const embed = new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle("\u{1F4C5} Week Start Day")
        .setDescription(`Current week start day is **${dayName}**.`);

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === "set") {
      const canManageGuild = interaction.memberPermissions?.has(
        PermissionFlagsBits.ManageGuild
      );
      if (!canManageGuild) {
        const embed = new EmbedBuilder()
          .setColor(0xed4245)
          .setDescription("You need the **Manage Server** permission to change week start.");
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const day = interaction.options.getInteger("day", true);
      const updated = await eventStore.setWeekStartDay({
        guildId,
        weekStartDay: day,
      });
      const dayName = weekdayName(updated.weekStartDay);

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("\u{2705} Week Start Updated")
        .setDescription(`Week start day set to **${dayName}**.`);

      await interaction.reply({ embeds: [embed] });
    }
  },
};
