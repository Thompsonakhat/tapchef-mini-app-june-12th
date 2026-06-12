import { buildMiniAppKeyboard } from "../bot.js";

export default function register(bot, { cfg }) {
  bot.command("play", async (ctx) => {
    const keyboard = buildMiniAppKeyboard(cfg);
    if (!keyboard) {
      await ctx.reply("The kitchen link is not ready yet. Set PUBLIC_BASE_URL after deploy.");
      return;
    }

    await ctx.reply("Open TapChef and start cooking.", { reply_markup: keyboard });
  });
}
