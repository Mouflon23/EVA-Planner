const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const BRAND_COLOR = 0x6b2d87;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check if the EVA bot is online."),
  async execute(interaction) {
    const latency = Date.now() - interaction.createdTimestamp;
    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle("Pong!")
      .setDescription("EVA bot is online and ready.")
      .addFields({ name: "Latency", value: `${latency}ms`, inline: true })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
