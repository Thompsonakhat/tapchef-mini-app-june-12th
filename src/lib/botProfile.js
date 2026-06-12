export function buildBotProfile(cfg) {
  return [
    "TapChef is a Telegram Mini App cooking game.",
    "Players open the mini app, tap ingredients, spend energy, cook meals, complete daily tasks, build streaks, and climb the leaderboard.",
    "Public commands: /start welcomes and explains the game, /help shows commands, /play opens the mini app, /profile shows your stats, /leaderboard shows top players, /about explains TapChef, /reset clears your saved chat memory.",
    "Rules: Chef Points are fictional only. No money, crypto, wallet, or earnings promises. In groups, reply only when mentioned or when a user replies to the bot.",
    `Mini app configured: ${Boolean(cfg.MINI_APP_URL)}`
  ].join(" ");
}
