export default function register(bot, { services }) {
  bot.command("profile", async (ctx) => {
    const telegramUserId = String(ctx.from?.id || "");
    const state = await services.getPlayerSummary(telegramUserId, ctx.from || {});
    await ctx.reply(`Chef Points: ${state.chefPoints} | Energy: ${state.currentEnergy}/${state.maxEnergy} | Streak: ${state.streakCount} | Meals: ${state.mealsCooked} | Tasks: ${state.completedTasks}/${state.totalTasks}`);
  });
}
