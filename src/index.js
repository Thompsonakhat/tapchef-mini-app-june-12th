import "dotenv/config";

function safeErr(err) {
  return (
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    err?.message ||
    String(err)
  );
}

process.on("unhandledRejection", (reason) => {
  console.error("[boot] unhandledRejection", { error: safeErr(reason) });
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("[boot] uncaughtException", { error: safeErr(error) });
  process.exit(1);
});

async function boot() {
  try {
    console.log("[boot] start");

    const [{ cfg }, { startServer }, { createTapChefBot, startPolling }] = await Promise.all([
      import("./lib/config.js"),
      import("./server.js"),
      import("./bot.js")
    ]);

    console.log("[boot] config", {
      telegramTokenSet: Boolean(cfg.TELEGRAM_BOT_TOKEN),
      mongoSet: Boolean(cfg.MONGODB_URI),
      publicBaseUrlSet: Boolean(cfg.PUBLIC_BASE_URL),
      port: cfg.PORT
    });

    if (!cfg.TELEGRAM_BOT_TOKEN) {
      console.error("[boot] TELEGRAM_BOT_TOKEN missing. Add it in your environment and redeploy.");
      process.exit(1);
    }

    const app = await startServer(cfg);
    const bot = await createTapChefBot(cfg, app.locals.services);
    await startPolling(bot, cfg);

    console.log("[boot] ready");
  } catch (error) {
    console.error("[boot] failed", { error: safeErr(error) });
    process.exit(1);
  }
}

boot();
