const fs = require("node:fs");
const path = require("node:path");
const {
  Client,
  Collection,
  GatewayIntentBits,
  Events,
} = require("discord.js");
const {
  validateEnv,
  DISCORD_TOKEN,
  MONGODB_URI,
} = require("./config");
const { createTaskStore } = require("./store/taskStore");

validateEnv();

async function main() {
  const taskStore = await createTaskStore(MONGODB_URI);
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.commands = new Collection();
  client.taskStore = taskStore;

  const commandsPath = path.join(__dirname, "commands");
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const commandPath = path.join(commandsPath, file);
    const command = require(commandPath);
    client.commands.set(command.data.name, command);
  }

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      await interaction.reply({
        content: "Command not found.",
        ephemeral: true,
      });
      return;
    }

    try {
      await command.execute(interaction, { taskStore });
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "Something went wrong while handling that command.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "Something went wrong while handling that command.",
          ephemeral: true,
        });
      }
    }
  });

  await client.login(DISCORD_TOKEN);
}

main().catch((error) => {
  console.error("Failed to start bot:", error);
  process.exit(1);
});
