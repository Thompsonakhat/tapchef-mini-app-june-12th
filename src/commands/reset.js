export default function register(bot, { services }) {
  bot.command("reset", async (ctx) => {
    const userId = String(ctx.from?.id || "");
    await services.clearMemory(userId, String(ctx.chat?.id || userId));
    await ctx.reply("Your chat memory is cleared.");
  });
}
