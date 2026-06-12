import { buildMiniAppKeyboard } from "../bot.js";

export default function register(bot, { cfg }) {
  bot.command("start", async (ctx) => {
    const keyboard = buildMiniAppKeyboard(cfg);
    const text = cfg.MINI_APP_URL
      ? "Welcome to TapChef. Tap ingredients, cook meals, finish daily tasks, and climb the leaderboard. Open the kitchen to play."
      : "Welcome to TapChef. The bot is ready, but the Mini App URL is not configured yet. Set PUBLIC_BASE_URL after deploy, then open /play.";

    await ctx.reply(text, keyboard ? { reply_markup: keyboard } : undefined);
  });
}
