TapChef is a Telegram Mini App cooking game. Players tap ingredients, spend energy, cook meals, complete daily tasks, build streaks, and climb the leaderboard.

Commands:
1) /start — Welcome and quick intro.
2) /help — Command list and gameplay help.
3) /play — Open the TapChef Mini App.
4) /profile — Show your Chef Points, energy, streak, meals, and task progress.
5) /leaderboard — Show the top players.
6) /about — Explain TapChef.
7) /reset — Clear your saved chat memory.

Environment variables:
1) TELEGRAM_BOT_TOKEN — Required for the Telegram bot.
2) MONGODB_URI — Recommended for persistent game data and long-term memory.
3) PORT — HTTP server port.
4) PUBLIC_BASE_URL — Base deployed URL used to build the Mini App link.
5) AI_TIMEOUT_MS — Optional timeout setting.
6) AI_MAX_RETRIES — Optional retry setting.
7) CONCURRENCY — Optional process setting.

Setup:
1) Run npm run build.
2) Set your environment variables.
3) Start with npm start.
