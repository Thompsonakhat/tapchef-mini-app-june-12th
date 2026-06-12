export function buildBotProfile(cfg) {
  return [
    "TapChef is a Telegram Mini App cooking game.",
    "Players open the mini app, tap ingredients, spend energy, cook meals, complete daily tasks, unlock badges, unlock fictional recipes, buy cosmetic kitchen themes, manage sound settings, join seasonal events, build streaks, and climb the leaderboard.",
    "Public commands: /start welcomes and explains the game, /help shows commands and gameplay features, /play opens the mini app, /profile shows your stats, /leaderboard shows top players and your personal rank, /event explains the current seasonal event, /about explains TapChef, /reset clears your saved chat memory.",
    "Rules: Chef Points are fictional only. No money, crypto, wallet, or earnings promises. Seasonal rewards are fictional in-game rewards only. Kitchen shop items are cosmetic only. In groups, reply only when mentioned or when a user replies to the bot.",
    `Mini app configured: ${Boolean(cfg.MINI_APP_URL)}`
  ].join(" ");
}
