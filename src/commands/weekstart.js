const { PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");

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
      await interaction.reply({
        content: "Week-start settings are unavailable in this context.",
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "show") {
      const settings = await eventStore.getGuildSettings({ guildId });
      await interaction.reply(
        `Current week start day is **${weekdayName(settings.weekStartDay)}**.`
      );
      return;
    }

    if (subcommand === "set") {
      const canManageGuild = interaction.memberPermissions?.has(
        PermissionFlagsBits.ManageGuild
      );
      if (!canManageGuild) {
        await interaction.reply({
          content: "You need the Manage Server permission to change week start.",
          ephemeral: true,
        });
        return;
      }

      const day = interaction.options.getInteger("day", true);
      const updated = await eventStore.setWeekStartDay({
        guildId,
        weekStartDay: day,
      });
      await interaction.reply(
        `Week start day set to **${weekdayName(updated.weekStartDay)}**.`
      );
    }
  },
};
