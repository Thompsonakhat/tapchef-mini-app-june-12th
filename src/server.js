import express from "express";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createGameServices } from "./services/gameService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.join(__dirname, "..", "webapp", "dist");

function safeErr(err) {
  return (
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    err?.message ||
    String(err)
  );
}

function verifyTelegramInitData(initData, botToken) {
  const params = new URLSearchParams(initData || "");
  const hash = params.get("hash") || "";
  if (!hash) return { ok: false, error: "Missing Telegram session hash." };

  params.delete("hash");
  const sorted = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const digest = crypto.createHmac("sha256", secret).update(sorted).digest("hex");

  const valid = Buffer.from(digest, "hex").length === Buffer.from(hash, "hex").length &&
    crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(hash, "hex"));

  if (!valid) return { ok: false, error: "Telegram session check failed." };

  let user = null;
  try {
    user = JSON.parse(params.get("user") || "null");
  } catch {
    user = null;
  }

  return { ok: true, user };
}

export async function startServer(cfg) {
  const app = express();
  const services = await createGameServices(cfg);
  app.locals.services = services;

  app.use(express.json({ limit: "512kb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "tapchef" });
  });

  app.post("/api/auth/bootstrap", async (req, res) => {
    try {
      const initData = String(req.body?.initData || "");
      if (!initData) return res.status(400).json({ ok: false, error: "Missing Telegram init data." });

      const verified = verifyTelegramInitData(initData, cfg.TELEGRAM_BOT_TOKEN);
      if (!verified.ok || !verified.user?.id) {
        return res.status(401).json({ ok: false, error: verified.error || "Telegram auth failed." });
      }

      const state = await services.bootstrapPlayer(verified.user);
      res.json({ ok: true, state });
    } catch (error) {
      console.error("[api] bootstrap failed", { error: safeErr(error) });
      res.status(500).json({ ok: false, error: "Could not load your kitchen." });
    }
  });

  app.post("/api/game/tap", async (req, res) => {
    try {
      const telegramUserId = String(req.body?.telegramUserId || "");
      const taps = Number(req.body?.taps || 1);
      if (!telegramUserId) return res.status(400).json({ ok: false, error: "Missing player." });

      const state = await services.tapIngredient(telegramUserId, taps);
      res.json({ ok: true, state });
    } catch (error) {
      console.error("[api] tap failed", { error: safeErr(error) });
      res.status(400).json({ ok: false, error: safeErr(error) || "Tap failed." });
    }
  });

  app.post("/api/game/cook", async (req, res) => {
    try {
      const telegramUserId = String(req.body?.telegramUserId || "");
      if (!telegramUserId) return res.status(400).json({ ok: false, error: "Missing player." });

      const state = await services.cookMeal(telegramUserId);
      res.json({ ok: true, state });
    } catch (error) {
      console.error("[api] cook failed", { error: safeErr(error) });
      res.status(400).json({ ok: false, error: safeErr(error) || "Could not cook now." });
    }
  });

  app.post("/api/game/recipes/unlock", async (req, res) => {
    try {
      const telegramUserId = String(req.body?.telegramUserId || "");
      const recipeId = String(req.body?.recipeId || "");
      if (!telegramUserId || !recipeId) return res.status(400).json({ ok: false, error: "Missing recipe unlock data." });

      const state = await services.unlockRecipe(telegramUserId, recipeId);
      res.json({ ok: true, state });
    } catch (error) {
      console.error("[api] recipe unlock failed", { error: safeErr(error) });
      res.status(400).json({ ok: false, error: safeErr(error) || "Could not unlock recipe." });
    }
  });

  app.post("/api/game/themes/buy", async (req, res) => {
    try {
      const telegramUserId = String(req.body?.telegramUserId || "");
      const themeId = String(req.body?.themeId || "");
      if (!telegramUserId || !themeId) return res.status(400).json({ ok: false, error: "Missing theme purchase data." });

      const state = await services.buyTheme(telegramUserId, themeId);
      res.json({ ok: true, state });
    } catch (error) {
      console.error("[api] theme buy failed", { error: safeErr(error) });
      res.status(400).json({ ok: false, error: safeErr(error) || "Could not buy theme." });
    }
  });

  app.post("/api/game/themes/select", async (req, res) => {
    try {
      const telegramUserId = String(req.body?.telegramUserId || "");
      const themeId = String(req.body?.themeId || "");
      if (!telegramUserId || !themeId) return res.status(400).json({ ok: false, error: "Missing theme selection data." });

      const state = await services.setActiveTheme(telegramUserId, themeId);
      res.json({ ok: true, state });
    } catch (error) {
      console.error("[api] theme select failed", { error: safeErr(error) });
      res.status(400).json({ ok: false, error: safeErr(error) || "Could not select theme." });
    }
  });

  app.post("/api/game/settings", async (req, res) => {
    try {
      const telegramUserId = String(req.body?.telegramUserId || "");
      if (!telegramUserId) return res.status(400).json({ ok: false, error: "Missing player." });

      const state = await services.updateSettings(telegramUserId, {
        soundEnabled: typeof req.body?.soundEnabled === "boolean" ? req.body.soundEnabled : undefined
      });
      res.json({ ok: true, state });
    } catch (error) {
      console.error("[api] settings failed", { error: safeErr(error) });
      res.status(400).json({ ok: false, error: safeErr(error) || "Could not save settings." });
    }
  });

  app.get("/api/leaderboard", async (req, res) => {
    try {
      const telegramUserId = String(req.query?.telegramUserId || "");
      const data = await services.getLeaderboard(telegramUserId);
      res.json({ ok: true, ...data });
    } catch (error) {
      console.error("[api] leaderboard failed", { error: safeErr(error) });
      res.status(500).json({ ok: false, error: "Could not load leaderboard." });
    }
  });

  app.use("/app", express.static(webDist));
  app.get("/app", (_req, res) => res.sendFile(path.join(webDist, "index.html")));
  app.get("/app/*splat", (_req, res) => res.sendFile(path.join(webDist, "index.html")));
  app.get("/", (_req, res) => res.redirect("/app"));

  await new Promise((resolve) => {
    app.listen(cfg.PORT, () => {
      console.log("[server] listening", { port: cfg.PORT });
      resolve();
    });
  });

  let memTick = 0;
  setInterval(() => {
    memTick += 1;
    const m = process.memoryUsage();
    console.log("[mem]", {
      rssMB: Math.round(m.rss / 1e6),
      heapUsedMB: Math.round(m.heapUsed / 1e6),
      tick: memTick
    });
  }, 60000).unref();

  return app;
}
