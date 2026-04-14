const { REST, Routes } = require("discord.js");
const { CLIENT_ID, DISCORD_TOKEN, GUILD_ID, validateEnv } = require("./config");
const ping = require("./commands/ping");
const checkin = require("./commands/checkin");
const task = require("./commands/task");
const event = require("./commands/event");

validateEnv();

const commands = [
  ping.data.toJSON(),
  checkin.data.toJSON(),
  task.data.toJSON(),
  event.data.toJSON(),
];

async function deploy() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands,
  });
  console.log(`Deployed ${commands.length} commands to guild ${GUILD_ID}.`);
}

deploy().catch((error) => {
  console.error("Failed to deploy commands:", error);
  process.exit(1);
});
