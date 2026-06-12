import { Bot, InlineKeyboard } from "grammy";
import { run } from "@grammyjs/runner";
import { registerCommands } from "./commands/loader.js";
import { registerAgent } from "./features/agent.js";

function safeErr(err) {
  return (
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    err?.message ||
    String(err)
  );
}

let runner = null;
let restartLock = false;

export async function createTapChefBot(cfg, services) {
  const bot = new Bot(cfg.TELEGRAM_BOT_TOKEN);
  bot.api.config.use(async (prev, method, payload, signal) => prev(method, payload, signal));

  bot.catch((error) => {
    console.error("[telegram] bot.catch", {
      error: safeErr(error?.error || error),
      updateId: error?.ctx?.update?.update_id || null
    });
  });

  await registerCommands(bot, { cfg, services });
  registerAgent(bot, { cfg, services });

  return bot;
}

export async function startPolling(bot, cfg) {
  if (runner) {
    console.log("[polling] runner already active");
    return;
  }

  let backoff = 2000;

  while (true) {
    try {
      console.log("[polling] preparing");
      await bot.api.deleteWebhook({ drop_pending_updates: true });
      console.log("[polling] webhook cleared");

      runner = run(bot, {
        runner: {
          fetch: {
            allowed_updates: ["message", "callback_query"]
          }
        },
        sink: {
          concurrency: 1
        }
      });

      console.log("[polling] started", { concurrency: 1 });
      await runner.task();
      console.log("[polling] stopped cleanly");
      runner = null;
      return;
    } catch (error) {
      const message = safeErr(error);
      console.error("[polling] failure", { error: message, backoff });
      runner = null;

      if (!String(message).includes("409") && !String(message).toLowerCase().includes("conflict")) {
        throw error;
      }

      if (restartLock) {
        await sleep(backoff);
      } else {
        restartLock = true;
        await sleep(backoff);
        restartLock = false;
      }

      backoff = Math.min(backoff === 2000 ? 5000 : backoff * 2, 20000);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildMiniAppKeyboard(cfg) {
  if (!cfg.MINI_APP_URL) return null;
  return new InlineKeyboard().webApp("Open TapChef", cfg.MINI_APP_URL);
}
