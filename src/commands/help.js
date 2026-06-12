export default function register(bot) {
  bot.command("help", async (ctx) => {
    await ctx.reply("Commands: /start, /help, /play, /profile, /leaderboard, /event, /about, /reset. In the Mini App you can earn fictional Chef Points, unlock badges, open the recipe book, buy cosmetic kitchen themes, toggle sound, join seasonal events, and check your own leaderboard rank even if you are outside the top 10.");
  });
}
