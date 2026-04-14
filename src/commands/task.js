const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("task")
    .setDescription("Manage EVA team tasks")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Create a new task")
        .addStringOption((option) =>
          option
            .setName("title")
            .setDescription("Short task title")
            .setRequired(true)
            .setMaxLength(120)
        )
        .addStringOption((option) =>
          option
            .setName("details")
            .setDescription("Extra details about the task")
            .setRequired(false)
            .setMaxLength(400)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List active EVA tasks")
        .addBooleanOption((option) =>
          option
            .setName("include_done")
            .setDescription("Include completed tasks")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("done")
        .setDescription("Mark a task as completed")
        .addIntegerOption((option) =>
          option
            .setName("id")
            .setDescription("Task ID from /task list")
            .setRequired(true)
        )
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const taskStore = interaction.client.taskStore;
    const guildId = interaction.guildId;

    if (!taskStore || !guildId) {
      await interaction.reply({
        content: "Task store is unavailable in this context.",
        ephemeral: true,
      });
      return;
    }

    if (subcommand === "add") {
      const title = interaction.options.getString("title", true);
      const details = interaction.options.getString("details") ?? "";
      const createdBy = interaction.user.username;

      const task = await taskStore.addTask({
        guildId,
        title,
        details,
        createdBy,
      });
      await interaction.reply(
        `Task #${task.id} created: **${task.title}**${
          task.details ? `\nDetails: ${task.details}` : ""
        }`
      );
      return;
    }

    if (subcommand === "list") {
      const includeDone = interaction.options.getBoolean("include_done") ?? false;
      const tasks = await taskStore.listTasks({ guildId, includeDone });

      if (tasks.length === 0) {
        await interaction.reply("No tasks found.");
        return;
      }

      const lines = tasks.map((task) => {
        const donePrefix = task.done ? "✅" : "🟡";
        const detailsPart = task.details ? ` — ${task.details}` : "";
        return `${donePrefix} #${task.id} **${task.title}** (${task.createdBy})${detailsPart}`;
      });

      await interaction.reply(`Current EVA tasks:\n${lines.join("\n")}`);
      return;
    }

    if (subcommand === "done") {
      const id = interaction.options.getInteger("id", true);
      const task = await taskStore.markTaskDone({ guildId, id });

      if (!task) {
        await interaction.reply({
          content: `Task #${id} was not found.`,
          ephemeral: true,
        });
        return;
      }

      await interaction.reply(`Marked task #${task.id} as done.`);
    }
  },
};
