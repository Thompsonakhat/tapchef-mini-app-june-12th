import React, { useEffect, useMemo, useState } from "react";

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

export default function App() {
  const webApp = useMemo(() => tg(), []);
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("game");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [leaderboard, setLeaderboard] = useState({ topPlayers: [], you: null });
  const colors = themeVars();

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

  async function fetchLeaderboard(telegramUserId) {
    try {
      const resp = await fetch(`/api/leaderboard?telegramUserId=${encodeURIComponent(telegramUserId || "")}`);
      const json = await resp.json();
      if (json.ok) setLeaderboard({ topPlayers: json.topPlayers || [], you: json.you || null });
    } catch {}
  }

  async function postAction(url, body) {
    if (!state?.telegramUserId) return;
    setBusy(true);
    setError("");
    try {
      webApp?.HapticFeedback?.impactOccurred?.("light");
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await resp.json();
      if (!json.ok) throw new Error(json.error || "Action failed.");
      setState(json.state);
      await fetchLeaderboard(json.state.telegramUserId);
    } catch (err) {
      setError(err.message || "Action failed.");
      webApp?.HapticFeedback?.notificationOccurred?.("error");
    } finally {
      setBusy(false);
    }
  }

  const mealsReady = state ? Math.floor((state.daily.tappedToday - state.daily.mealsCookedToday * 20) / 20) : 0;

  return (
    <div className="min-h-screen px-4 pt-4 pb-8" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))", paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
      <div className="mx-auto w-full max-w-md space-y-4">
        <header className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.35),_rgba(26,16,39,0.95)_55%)] p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-orange-200/80">TapChef</p>
              <h1 className="mt-1 text-3xl font-black leading-none">Cook fast. Tap smart.</h1>
              <p className="mt-2 text-sm text-orange-50/80">Earn Chef Points, finish daily tasks, and keep your kitchen streak alive.</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2 text-right backdrop-blur">
              <div className="text-[11px] uppercase tracking-wide text-orange-100/70">Streak</div>
              <div className="text-2xl font-bold">{state?.streakCount ?? "-"}</div>
            </div>
          </div>
        </header>

        <nav className="grid grid-cols-4 gap-2 rounded-2xl bg-white/5 p-1">
          {[
            ["game", "Game"],
            ["tasks", "Tasks"],
            ["profile", "Profile"],
            ["leaders", "Leaders"]
          ].map(([key, label]) => (
            <button
              key={key}
              className={cx("min-h-[44px] rounded-xl text-sm font-semibold transition", tab === key ? "bg-orange-500 text-white shadow-lg" : "text-orange-50/80")}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>

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
                  <p className="text-sm text-orange-100/70">Main ingredient</p>
                  <button
                    className="mx-auto mt-4 flex h-48 w-48 items-center justify-center rounded-full border border-orange-200/25 bg-[radial-gradient(circle_at_30%_30%,_#fdba74,_#ea580c_60%,_#7c2d12)] text-7xl shadow-[0_18px_50px_rgba(249,115,22,0.35)] transition active:scale-95 disabled:opacity-60"
                    disabled={busy || state.currentEnergy <= 0}
                    onClick={() => postAction("/api/game/tap", { telegramUserId: state.telegramUserId, taps: 1 })}
                  >
                    🍅
                  </button>
                  <p className="mt-4 text-sm text-orange-50/80">Each tap uses 1 energy and gives 1 Chef Point.</p>
                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3 text-sm text-orange-50/85">
                    <span>Meals ready</span>
                    <span className="font-bold">{Math.max(0, mealsReady)}</span>
                  </div>
                  <button
                    className="mt-4 min-h-[48px] w-full rounded-2xl bg-orange-500 px-4 text-base font-bold text-white shadow-lg transition active:scale-[0.99] disabled:opacity-60"
                    disabled={busy || mealsReady < 1}
                    onClick={() => postAction("/api/game/cook", { telegramUserId: state.telegramUserId })}
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

            {tab === "profile" ? (
              <section className="space-y-3 rounded-3xl border border-white/10 bg-white/8 p-4">
                <ProfileRow label="Chef" value={state.displayName} />
                <ProfileRow label="Chef Points" value={state.chefPoints} />
                <ProfileRow label="Energy" value={`${state.currentEnergy}/${state.maxEnergy}`} />
                <ProfileRow label="Total taps" value={state.totalTaps} />
                <ProfileRow label="Meals cooked" value={state.mealsCooked} />
                <ProfileRow label="Daily streak" value={state.streakCount} />
                <ProfileRow label="Tasks done" value={`${state.tasks.filter((task) => task.completed).length}/${state.tasks.length}`} />
              </section>
            ) : null}

            {tab === "leaders" ? (
              <section className="space-y-3">
                <div className="rounded-3xl border border-white/10 bg-white/8 p-4">
                  <p className="text-sm text-orange-50/70">Your rank</p>
                  <p className="mt-1 text-2xl font-black">{leaderboard.you?.rank || "Unranked"}</p>
                </div>
                {leaderboard.topPlayers.length ? leaderboard.topPlayers.map((player, index) => (
                  <div key={`${player.displayName}-${index}`} className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/8 p-4">
                    <div>
                      <p className="text-sm text-orange-50/70">#{index + 1}</p>
                      <p className="text-base font-semibold">{player.displayName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black">{player.chefPoints}</p>
                      <p className="text-xs text-orange-50/70">{player.mealsCooked} meals</p>
                    </div>
                  </div>
                )) : <EmptyCard text="No chefs on the board yet. Start tapping to claim the first spot." />}
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
