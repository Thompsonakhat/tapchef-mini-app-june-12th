import React, { useEffect, useMemo, useRef, useState } from "react";

function tg() {
  return window.Telegram?.WebApp;
}

function themeVars() {
  const app = tg();
  const p = app?.themeParams || {};
  return {
    bg: p.bg_color || "#1a1027",
    card: p.secondary_bg_color || "rgba(255,255,255,0.08)",
    text: p.text_color || "#fff7ed",
    hint: p.hint_color || "#d6c7bb",
    accent: p.button_color || "#f97316",
    accentText: p.button_text_color || "#fffaf5"
  };
}

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

const THEME_STYLES = {
  classic_kitchen: {
    hero: "bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.35),_rgba(26,16,39,0.95)_55%)]",
    ingredient: "bg-[radial-gradient(circle_at_30%_30%,_#fdba74,_#ea580c_60%,_#7c2d12)]",
    glow: "shadow-[0_18px_50px_rgba(249,115,22,0.35)]"
  },
  copper_cozy: {
    hero: "bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.45),_rgba(69,26,3,0.92)_58%)]",
    ingredient: "bg-[radial-gradient(circle_at_30%_30%,_#fed7aa,_#c2410c_60%,_#7c2d12)]",
    glow: "shadow-[0_18px_50px_rgba(194,65,12,0.42)]"
  },
  midnight_diner: {
    hero: "bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.38),_rgba(17,24,39,0.96)_58%)]",
    ingredient: "bg-[radial-gradient(circle_at_30%_30%,_#93c5fd,_#2563eb_58%,_#1e1b4b)]",
    glow: "shadow-[0_18px_50px_rgba(37,99,235,0.35)]"
  },
  garden_glow: {
    hero: "bg-[radial-gradient(circle_at_top,_rgba(74,222,128,0.34),_rgba(20,83,45,0.94)_58%)]",
    ingredient: "bg-[radial-gradient(circle_at_30%_30%,_#bbf7d0,_#16a34a_58%,_#14532d)]",
    glow: "shadow-[0_18px_50px_rgba(22,163,74,0.34)]"
  }
};

export default function App() {
  const webApp = useMemo(() => tg(), []);
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("game");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [leaderboard, setLeaderboard] = useState({ topPlayers: [], you: null });
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const audioRef = useRef(null);
  const colors = themeVars();
  const activeTheme = THEME_STYLES[state?.activeThemeId] || THEME_STYLES.classic_kitchen;

  useEffect(() => {
    document.documentElement.style.setProperty("--bg", colors.bg);
    document.documentElement.style.setProperty("--card", colors.card);
    document.documentElement.style.setProperty("--text", colors.text);
    document.documentElement.style.setProperty("--hint", colors.hint);
    document.documentElement.style.setProperty("--accent", colors.accent);
    document.documentElement.style.setProperty("--accentText", colors.accentText);
    document.body.style.background = colors.bg;
    document.body.style.color = colors.text;
  }, [colors.bg, colors.card, colors.text, colors.hint, colors.accent, colors.accentText]);

  useEffect(() => {
    try {
      webApp?.ready();
      webApp?.expand();
      webApp?.disableVerticalSwipes?.();
    } catch {}
  }, [webApp]);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      setLoading(true);
      setError("");
      try {
        const initData = webApp?.initData || "";
        const resp = await fetch("/api/auth/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData })
        });
        const json = await resp.json();
        if (cancelled) return;
        if (!json.ok) throw new Error(json.error || "Could not open your kitchen.");
        setState(json.state);
        showAchievementToast(json.state?.newlyUnlockedAchievementIds || [], json.state);
        await fetchLeaderboard(json.state.telegramUserId);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not open your kitchen.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [webApp]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function playSound(kind = "tap") {
    if (!state?.settings?.soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioRef.current) audioRef.current = new AudioContextClass();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") ctx.resume?.();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = kind === "unlock" ? "triangle" : "sine";
      oscillator.frequency.value = kind === "unlock" ? 660 : 420;
      gain.gain.value = kind === "unlock" ? 0.04 : 0.025;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + (kind === "unlock" ? 0.16 : 0.08));
    } catch {}
  }

  function showToast(message) {
    if (!message) return;
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }

  function showAchievementToast(newIds, nextState) {
    if (!newIds?.length || !nextState?.achievements?.length) return;
    const unlocked = nextState.achievements.filter((item) => newIds.includes(item.id));
    if (unlocked.length) {
      playSound("unlock");
      showToast(`Badge unlocked: ${unlocked.map((item) => item.badge).join(", ")}`);
    }
  }

  async function fetchLeaderboard(telegramUserId) {
    try {
      const resp = await fetch(`/api/leaderboard?telegramUserId=${encodeURIComponent(telegramUserId || "")}`);
      const json = await resp.json();
      if (json.ok) setLeaderboard({ topPlayers: json.topPlayers || [], you: json.you || null });
    } catch {}
  }

  async function postAction(url, body, opts = {}) {
    if (!state?.telegramUserId) return;
    setBusy(true);
    setError("");
    try {
      if (opts.haptic !== false) {
        webApp?.HapticFeedback?.impactOccurred?.("light");
      }
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await resp.json();
      if (!json.ok) throw new Error(json.error || "Action failed.");
      setState(json.state);
      showAchievementToast(json.state?.newlyUnlockedAchievementIds || [], json.state);
      if (opts.toast) showToast(opts.toast);
      if (opts.sound) playSound(opts.sound);
      await fetchLeaderboard(json.state.telegramUserId);
    } catch (err) {
      setError(err.message || "Action failed.");
      webApp?.HapticFeedback?.notificationOccurred?.("error");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleSound() {
    if (!state?.telegramUserId) return;
    const nextSound = !(state?.settings?.soundEnabled !== false);
    await postAction("/api/game/settings", {
      telegramUserId: state.telegramUserId,
      soundEnabled: nextSound
    }, {
      haptic: false,
      toast: nextSound ? "Sound on" : "Sound off"
    });
  }

  const mealsReady = state ? Math.floor((state.daily.tappedToday - state.daily.mealsCookedToday * 20) / 20) : 0;
  const unlockedAchievements = state?.achievements?.filter((item) => item.unlocked) || [];
  const weekendEvent = state?.weekendEvent;

  return (
    <div className="min-h-screen px-4 pt-4 pb-8" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))", paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
      <div className="mx-auto w-full max-w-md space-y-4">
        <header className={cx("rounded-[28px] border border-white/10 p-5 shadow-2xl", activeTheme.hero)}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-orange-200/80">TapChef</p>
              <h1 className="mt-1 text-3xl font-black leading-none">Cook fast. Tap smart.</h1>
              <p className="mt-2 text-sm text-orange-50/80">Earn Chef Points, unlock badges, collect recipes, style your kitchen, and jump into the Weekend Cook-Off.</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2 text-right backdrop-blur">
              <div className="text-[11px] uppercase tracking-wide text-orange-100/70">Streak</div>
              <div className="text-2xl font-bold">{state?.streakCount ?? "-"}</div>
            </div>
          </div>
        </header>

        <nav className="grid grid-cols-3 gap-2 rounded-2xl bg-white/5 p-1 sm:grid-cols-7">
          {[
            ["game", "Game"],
            ["tasks", "Tasks"],
            ["event", "Event"],
            ["achievements", "Badges"],
            ["recipes", "Recipes"],
            ["shop", "Shop"],
            ["leaders", "Leaders"]
          ].map(([key, label]) => (
            <button
              key={key}
              className={cx("min-h-[44px] rounded-xl px-2 text-sm font-semibold transition", tab === key ? "bg-orange-500 text-white shadow-lg" : "text-orange-50/80")}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        {toast ? (
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-50">
            {toast}
          </div>
        ) : null}

        {loading ? (
          <section className="space-y-3 rounded-3xl bg-white/6 p-4">
            <div className="h-5 w-32 animate-pulse rounded bg-white/10" />
            <div className="h-24 animate-pulse rounded-3xl bg-white/10" />
            <div className="h-16 animate-pulse rounded-2xl bg-white/10" />
          </section>
        ) : error && !state ? (
          <section className="rounded-3xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-50">
            {error}
          </section>
        ) : null}

        {state ? (
          <>
            {tab === "game" ? (
              <section className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="Chef Points" value={state.chefPoints} />
                  <StatCard label="Energy" value={`${state.currentEnergy}/${state.maxEnergy}`} />
                  <StatCard label="Meals" value={state.mealsCooked} />
                </div>

                <div className="rounded-[32px] border border-white/10 bg-white/8 p-5 text-center shadow-xl">
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-black/20 px-4 py-3 text-sm text-orange-50/85">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-orange-100/60">Kitchen theme</div>
                      <div className="font-semibold">{state.themes.find((item) => item.active)?.name || "Classic Kitchen"}</div>
                    </div>
                    <button
                      className={cx("min-h-[44px] rounded-xl px-4 text-sm font-bold", state.settings?.soundEnabled !== false ? "bg-emerald-500/25 text-emerald-50" : "bg-white/10 text-orange-50/75")}
                      disabled={busy}
                      onClick={handleToggleSound}
                    >
                      Sound {state.settings?.soundEnabled !== false ? "On" : "Off"}
                    </button>
                  </div>
                  <p className="text-sm text-orange-100/70">Main ingredient</p>
                  <button
                    className={cx("mx-auto mt-4 flex h-48 w-48 items-center justify-center rounded-full border border-orange-200/25 text-7xl transition active:scale-95 disabled:opacity-60", activeTheme.ingredient, activeTheme.glow)}
                    disabled={busy || state.currentEnergy <= 0}
                    onClick={() => postAction("/api/game/tap", { telegramUserId: state.telegramUserId, taps: 1 }, { sound: "tap" })}
                  >
                    🍅
                  </button>
                  <p className="mt-4 text-sm text-orange-50/80">Each tap uses 1 energy and gives 1 fictional Chef Point.</p>
                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3 text-sm text-orange-50/85">
                    <span>Meals ready</span>
                    <span className="font-bold">{Math.max(0, mealsReady)}</span>
                  </div>
                  <button
                    className="mt-4 min-h-[48px] w-full rounded-2xl bg-orange-500 px-4 text-base font-bold text-white shadow-lg transition active:scale-[0.99] disabled:opacity-60"
                    disabled={busy || mealsReady < 1}
                    onClick={() => postAction("/api/game/cook", { telegramUserId: state.telegramUserId }, { sound: "unlock" })}
                  >
                    Cook Meal
                  </button>
                </div>
              </section>
            ) : null}

            {tab === "tasks" ? (
              <section className="space-y-3">
                {state.tasks.map((task) => (
                  <div key={task.id} className="rounded-3xl border border-white/10 bg-white/8 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold">{task.label}</p>
                        <p className="mt-1 text-sm text-orange-50/70">{task.progress}/{task.target}</p>
                      </div>
                      <span className={cx("rounded-full px-3 py-1 text-xs font-bold", task.completed ? "bg-emerald-400/20 text-emerald-100" : "bg-white/10 text-orange-50/70")}>{task.completed ? "Done" : "Cooking"}</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/20">
                      <div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.min(100, Math.round((task.progress / task.target) * 100))}%` }} />
                    </div>
                  </div>
                ))}
              </section>
            ) : null}

            {tab === "event" ? (
              <section className="space-y-3">
                <div className="rounded-3xl border border-orange-300/20 bg-orange-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-orange-100/70">Seasonal event</p>
                  <h2 className="mt-2 text-2xl font-black">{weekendEvent?.name || "Weekend Cook-Off"}</h2>
                  <p className="mt-2 text-sm text-orange-50/80">{weekendEvent?.description}</p>
                  <p className="mt-3 text-xs text-orange-100/70">{weekendEvent?.disclaimer}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Tasks done" value={`${weekendEvent?.completedCount || 0}/${weekendEvent?.tasks?.length || 0}`} />
                  <StatCard label="Reward pool" value={`${weekendEvent?.totalRewardChefPoints || 0} CP`} />
                </div>
                <div className="space-y-3">
                  {(weekendEvent?.tasks || []).map((task) => (
                    <div key={task.id} className="rounded-3xl border border-white/10 bg-white/8 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold">{task.label}</p>
                          <p className="mt-1 text-sm text-orange-50/70">{Math.min(task.progress, task.target)}/{task.target}</p>
                          <p className="mt-2 text-xs uppercase tracking-wide text-orange-100/70">Reward {task.rewardChefPoints} fictional Chef Points</p>
                        </div>
                        <span className={cx("rounded-full px-3 py-1 text-xs font-bold", task.completed ? "bg-emerald-400/20 text-emerald-100" : "bg-white/10 text-orange-50/70")}>{task.completed ? "Complete" : "Active"}</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/20">
                        <div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.min(100, Math.round((task.progress / task.target) * 100))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {tab === "achievements" ? (
              <section className="space-y-3">
                <div className="rounded-3xl border border-white/10 bg-white/8 p-4">
                  <p className="text-sm text-orange-50/70">Unlocked badges</p>
                  <p className="mt-1 text-2xl font-black">{unlockedAchievements.length}/{state.achievements.length}</p>
                </div>
                {state.achievements.map((achievement) => (
                  <div key={achievement.id} className={cx("rounded-3xl border p-4", achievement.unlocked ? "border-amber-300/30 bg-amber-400/10" : "border-white/10 bg-white/8")}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold">{achievement.label}</p>
                        <p className="mt-1 text-sm text-orange-50/70">{achievement.description}</p>
                        <p className="mt-2 text-xs uppercase tracking-wide text-amber-200/80">Badge: {achievement.badge}</p>
                      </div>
                      <span className={cx("rounded-full px-3 py-1 text-xs font-bold", achievement.unlocked ? "bg-emerald-400/20 text-emerald-100" : "bg-white/10 text-orange-50/70")}>{achievement.unlocked ? "Unlocked" : `Goal ${achievement.target}`}</span>
                    </div>
                  </div>
                ))}
              </section>
            ) : null}

            {tab === "recipes" ? (
              <section className="space-y-3">
                {state.recipes.map((recipe) => (
                  <div key={recipe.id} className="rounded-3xl border border-white/10 bg-white/8 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold">{recipe.name}</p>
                        <p className="mt-1 text-sm text-orange-50/70">{recipe.rewardText}</p>
                        <p className="mt-2 text-xs uppercase tracking-wide text-orange-100/70">Cost {recipe.cost} Chef Points</p>
                      </div>
                      <button
                        className={cx("min-h-[44px] rounded-xl px-4 text-sm font-bold", recipe.unlocked ? "bg-emerald-500/20 text-emerald-100" : "bg-orange-500 text-white disabled:opacity-60")}
                        disabled={busy || recipe.unlocked || state.chefPoints < recipe.cost}
                        onClick={() => postAction("/api/game/recipes/unlock", { telegramUserId: state.telegramUserId, recipeId: recipe.id }, { toast: `${recipe.name} unlocked`, sound: "unlock" })}
                      >
                        {recipe.unlocked ? "Unlocked" : "Unlock"}
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            ) : null}

            {tab === "shop" ? (
              <section className="space-y-3">
                <div className="rounded-3xl border border-white/10 bg-white/8 p-4 text-sm text-orange-50/75">
                  Kitchen shop items are cosmetic only. Spend fictional Chef Points to change your look.
                </div>
                {state.themes.map((theme) => (
                  <div key={theme.id} className="rounded-3xl border border-white/10 bg-white/8 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold">{theme.name}</p>
                        <p className="mt-1 text-sm text-orange-50/70">{theme.description}</p>
                        <p className="mt-2 text-xs uppercase tracking-wide text-orange-100/70">{theme.cost === 0 ? "Included" : `Cost ${theme.cost} Chef Points`}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        {!theme.owned ? (
                          <button
                            className="min-h-[44px] rounded-xl bg-orange-500 px-4 text-sm font-bold text-white disabled:opacity-60"
                            disabled={busy || state.chefPoints < theme.cost}
                            onClick={() => postAction("/api/game/themes/buy", { telegramUserId: state.telegramUserId, themeId: theme.id }, { toast: `${theme.name} added to your kitchen`, sound: "unlock" })}
                          >
                            Buy
                          </button>
                        ) : (
                          <button
                            className={cx("min-h-[44px] rounded-xl px-4 text-sm font-bold", theme.active ? "bg-emerald-500/20 text-emerald-100" : "bg-white/10 text-orange-50")}
                            disabled={busy || theme.active}
                            onClick={() => postAction("/api/game/themes/select", { telegramUserId: state.telegramUserId, themeId: theme.id }, { toast: `${theme.name} is now active` })}
                          >
                            {theme.active ? "Active" : "Use"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            ) : null}

            {tab === "leaders" ? (
              <section className="space-y-3">
                <div className="rounded-3xl border border-white/10 bg-white/8 p-4">
                  <p className="text-sm text-orange-50/70">Your rank</p>
                  <p className="mt-1 text-2xl font-black">{leaderboard.you?.rank || "Unranked"}</p>
                  <p className="mt-1 text-xs text-orange-50/70">
                    {leaderboard.you?.inTopTen ? "You are in the top 10." : "Your personal rank still shows here even outside the top 10."}
                  </p>
                </div>
                {leaderboard.topPlayers.length ? leaderboard.topPlayers.map((player) => (
                  <div key={`${player.telegramUserId || player.displayName}-${player.rank}`} className={cx("flex items-center justify-between rounded-3xl border p-4", leaderboard.you?.displayName === player.displayName && leaderboard.you?.rank === player.rank ? "border-orange-300/30 bg-orange-500/10" : "border-white/10 bg-white/8")}>
                    <div>
                      <p className="text-sm text-orange-50/70">#{player.rank}</p>
                      <p className="text-base font-semibold">{player.displayName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black">{player.chefPoints}</p>
                      <p className="text-xs text-orange-50/70">{player.mealsCooked} meals</p>
                    </div>
                  </div>
                )) : <EmptyCard text="No chefs on the board yet. Start tapping to claim the first spot." />}
                {leaderboard.you && !leaderboard.you.inTopTen ? (
                  <div className="rounded-3xl border border-orange-300/20 bg-orange-500/10 p-4">
                    <p className="text-sm text-orange-50/70">Your position</p>
                    <p className="mt-1 text-base font-semibold">#{leaderboard.you.rank} {leaderboard.you.displayName}</p>
                    <p className="mt-1 text-sm text-orange-50/80">{leaderboard.you.chefPoints} Chef Points</p>
                  </div>
                ) : null}
              </section>
            ) : null}

            {tab === "profile" ? (
              <section className="space-y-3 rounded-3xl border border-white/10 bg-white/8 p-4">
                <ProfileRow label="Chef" value={state.displayName} />
                <ProfileRow label="Chef Points" value={state.chefPoints} />
                <ProfileRow label="Energy" value={`${state.currentEnergy}/${state.maxEnergy}`} />
                <ProfileRow label="Total taps" value={state.totalTaps} />
                <ProfileRow label="Meals cooked" value={state.mealsCooked} />
                <ProfileRow label="Daily streak" value={state.streakCount} />
                <ProfileRow label="Badges unlocked" value={`${unlockedAchievements.length}/${state.achievements.length}`} />
                <ProfileRow label="Recipes unlocked" value={`${state.recipes.filter((item) => item.unlocked).length}/${state.recipes.length}`} />
                <ProfileRow label="Weekend event" value={`${weekendEvent?.completedCount || 0}/${weekendEvent?.tasks?.length || 0} tasks`} />
                <ProfileRow label="Sound" value={state.settings?.soundEnabled !== false ? "On" : "Off"} />
                <div className="rounded-2xl bg-black/15 px-4 py-3">
                  <p className="text-sm text-orange-50/70">Event progress</p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/20">
                    <div
                      className="h-full rounded-full bg-orange-400"
                      style={{ width: `${weekendEvent?.tasks?.length ? Math.round(((weekendEvent.completedCount || 0) / weekendEvent.tasks.length) * 100) : 0}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-orange-50/70">{weekendEvent?.disclaimer}</p>
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {error && state ? (
          <div className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-50">{error}</div>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/8 p-4 shadow-lg">
      <p className="text-xs uppercase tracking-wide text-orange-50/65">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function ProfileRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-black/15 px-4 py-3">
      <span className="text-sm text-orange-50/70">{label}</span>
      <span className="text-sm font-semibold text-right">{value}</span>
    </div>
  );
}

function EmptyCard({ text }) {
  return <div className="rounded-3xl border border-white/10 bg-white/8 p-4 text-sm text-orange-50/75">{text}</div>;
}
