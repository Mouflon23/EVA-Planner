const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("checkin")
    .setDescription("Post a quick EVA team status update")
    .addStringOption((option) =>
      option
        .setName("status")
        .setDescription("Your current status")
        .setRequired(true)
        .addChoices(
          { name: "Green - On Track", value: "green" },
          { name: "Yellow - Needs Support", value: "yellow" },
          { name: "Red - Blocked", value: "red" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("notes")
        .setDescription("Optional details for the team")
        .setRequired(false)
    ),
  async execute(interaction) {
    const status = interaction.options.getString("status");
    const notes =
      interaction.options.getString("notes") || "No additional notes.";

    const labelByStatus = {
      green: "Green - On Track",
      yellow: "Yellow - Needs Support",
      red: "Red - Blocked",
    };

    await interaction.reply({
      content: [
        `**EVA Check-In from ${interaction.user}**`,
        `Status: **${labelByStatus[status]}**`,
        `Notes: ${notes}`,
      ].join("\n"),
    });
  },
};
