export default function register(bot) {
  bot.command("help", async (ctx) => {
    await ctx.reply("Commands: /start, /help, /play, /profile, /leaderboard, /about, /reset. Tap ingredients in the Mini App to earn Chef Points.");
  });
}
