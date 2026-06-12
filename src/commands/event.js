export default function register(bot, { cfg }) {
  bot.command("event", async (ctx) => {
    const eventText = "Weekend Cook-Off is live. Complete the limited-time challenge by cooking 5 meals, tapping 150 ingredients, and keeping a 2 day streak. Rewards are fictional Chef Points for in-game use only. Open the Mini App to join the event progress screen.";

    if (!cfg.MINI_APP_URL) {
      await ctx.reply(`${eventText} The Mini App link is not ready yet. Set PUBLIC_BASE_URL after deploy, then use /play.`);
      return;
    }

    await ctx.reply(`${eventText} Use /play to open TapChef and participate.`);
  });
}
