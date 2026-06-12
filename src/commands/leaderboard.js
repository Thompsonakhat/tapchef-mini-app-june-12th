export default function register(bot, { services }) {
  bot.command("leaderboard", async (ctx) => {
    const telegramUserId = String(ctx.from?.id || "");
    const data = await services.getLeaderboard(telegramUserId);
    const top = data.topPlayers.length
      ? data.topPlayers.map((player, index) => `${index + 1}. ${player.displayName} ${player.chefPoints}`).join(" | ")
      : "No chefs yet.";
    const rankPart = data.you?.rank ? ` Your rank: ${data.you.rank}.` : "";
    await ctx.reply(`Top chefs: ${top}.${rankPart}`);
  });
}
