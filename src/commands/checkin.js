const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const BRAND_COLOR = 0x6b2d87;

const STATUS_CONFIG = {
  green: { label: "Green - On Track", emoji: "\u{1F7E2}", color: 0x57f287 },
  yellow: { label: "Yellow - Needs Support", emoji: "\u{1F7E1}", color: 0xfee75c },
  red: { label: "Red - Blocked", emoji: "\u{1F534}", color: 0xed4245 },
};

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
    const config = STATUS_CONFIG[status];

    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setTitle(`${config.emoji} EVA Check-In`)
      .setDescription(`**${config.label}**`)
      .addFields({ name: "Notes", value: notes, inline: false })
      .setFooter({
        text: `Check-in by ${interaction.user.displayName || interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
