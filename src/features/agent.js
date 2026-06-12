import { buildBotProfile } from "../lib/botProfile.js";

const chatLocks = new Map();
let globalInFlight = 0;
const GLOBAL_CAP = 1;

function safeErr(err) {
  return (
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    err?.message ||
    String(err)
  );
}

function shouldHandleGroupMessage(ctx) {
  const type = ctx.chat?.type || "private";
  if (type === "private") return true;

  const text = ctx.message?.text || "";
  const username = ctx.me?.username || ctx.botInfo?.username || "";
  const replyToBot = Boolean(ctx.message?.reply_to_message?.from?.is_bot);
  const mentioned = username ? text.toLowerCase().includes(`@${username.toLowerCase()}`) : false;
  return replyToBot || mentioned;
}

export function registerAgent(bot, { cfg, services }) {
  const botProfile = buildBotProfile(cfg);

  bot.on("message:text", async (ctx, next) => {
    if (ctx.message?.text?.startsWith("/")) return next();
    if (!shouldHandleGroupMessage(ctx)) return next();

    const chatId = String(ctx.chat?.id || ctx.from?.id || "unknown");
    if (chatLocks.has(chatId)) {
      await ctx.reply("I’m working on your last request…");
      return;
    }
    if (globalInFlight >= GLOBAL_CAP) {
      await ctx.reply("Busy, try again in a moment.");
      return;
    }

    chatLocks.set(chatId, true);
    globalInFlight += 1;

    try {
      const text = (ctx.message?.text || "").replace(new RegExp(`@${ctx.me?.username || ""}`, "ig"), "").trim();
      const response = await services.replyWithMemory({
        userId: String(ctx.from?.id || ""),
        chatId,
        userText: text,
        botProfile,
        timeoutMs: cfg.AI_TIMEOUT_MS
      });
      await ctx.reply(response);
    } catch (error) {
      console.error("[agent] failure", { error: safeErr(error) });
      await ctx.reply("I can help with TapChef commands and gameplay. Try /help.");
    } finally {
      chatLocks.delete(chatId);
      globalInFlight = Math.max(0, globalInFlight - 1);
    }
  });
}
