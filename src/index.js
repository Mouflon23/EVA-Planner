const fs = require("node:fs");
const path = require("node:path");
const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  Events,
} = require("discord.js");
const {
  validateEnv,
  DISCORD_TOKEN,
  MONGODB_URI,
  SCHEDULER_POLL_SECONDS,
  EVENT_TIMEZONE,
} = require("./config");
const { createEventStore } = require("./store/eventStore");
const { startRecurringEventPosting } = require("./events/postRecurringEvents");
const {
  handleEventButtons,
  handleEventEditModal,
} = require("./events/handleEventButtons");

validateEnv();

async function main() {
  const eventStore = await createEventStore(MONGODB_URI);
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessageReactions],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  });

  client.commands = new Collection();
  client.eventStore = eventStore;
  client.timezoneLabel = EVENT_TIMEZONE;

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
    startRecurringEventPosting(readyClient, SCHEDULER_POLL_SECONDS);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    let timezoneLabel = client.timezoneLabel || "UTC";
    if (interaction.guildId && eventStore) {
      try {
        const settings = await eventStore.getGuildSettings({ guildId: interaction.guildId });
        if (settings.timezone) {
          timezoneLabel = settings.timezone;
        }
      } catch {}
    }

    if (interaction.isModalSubmit()) {
      const handled = await handleEventEditModal({
        interaction,
        eventStore,
        timezoneLabel,
      });
      if (handled) {
        return;
      }
    }

    if (interaction.isButton()) {
      const handled = await handleEventButtons({
        interaction,
        eventStore,
        timezoneLabel,
      });
      if (handled) {
        return;
      }
    }

    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (command?.autocomplete) {
        try {
          await command.autocomplete(interaction);
        } catch (error) {
          console.error("Autocomplete error:", error);
        }
      }
      return;
    }

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
      await command.execute(interaction);
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
