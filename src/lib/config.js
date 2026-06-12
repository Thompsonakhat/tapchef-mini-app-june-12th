function cleanBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "").replace(/\/app$/i, "");
}

const base = cleanBaseUrl(
  process.env.RENDER_EXTERNAL_URL ||
  process.env.PUBLIC_BASE_URL ||
  process.env.WEBAPP_URL ||
  process.env.WEB_APP_URL ||
  process.env.PUBLIC_URL ||
  ""
);

export const cfg = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  MONGODB_URI: process.env.MONGODB_URI || "",
  PORT: Number(process.env.PORT || 4000),
  PUBLIC_BASE_URL: base,
  MINI_APP_URL: base ? `${base}/app` : "",
  NODE_ENV: process.env.NODE_ENV || "development",
  AI_TIMEOUT_MS: Number(process.env.AI_TIMEOUT_MS || 600000),
  CONCURRENCY: Number(process.env.CONCURRENCY || 20),
  AI_MAX_RETRIES: Number(process.env.AI_MAX_RETRIES || 2)
};
