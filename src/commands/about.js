export default function register(bot) {
  bot.command("about", async (ctx) => {
    await ctx.reply("TapChef is a playful cooking game for Telegram. Earn fictional Chef Points, manage energy, complete daily tasks, and keep your streak going.");
  });
}
