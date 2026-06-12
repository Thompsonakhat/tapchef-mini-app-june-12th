import { getDb } from "../lib/db.js";

const MAX_ENERGY = 30;
const ENERGY_REFILL_MINUTES = 5;
const POINTS_PER_TAP = 1;
const TAPS_PER_MEAL = 20;
const MEAL_REWARD = 15;
const DAILY_TASKS = [
  { id: "open_kitchen", label: "Open the kitchen today", type: "open", target: 1 },
  { id: "tap_50", label: "Tap 50 ingredients", type: "tap", target: 50 },
  { id: "cook_3", label: "Cook 3 meals", type: "meal", target: 3 }
];

function safeErr(err) {
  return (
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    err?.message ||
    String(err)
  );
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function regenEnergy(user) {
  const now = new Date();
  const current = Number(user.currentEnergy ?? MAX_ENERGY);
  const updatedAt = new Date(user.energyUpdatedAt || now);
  const elapsedMinutes = Math.floor((now.getTime() - updatedAt.getTime()) / 60000);
  const restored = Math.floor(elapsedMinutes / ENERGY_REFILL_MINUTES);
  const nextEnergy = Math.min(user.maxEnergy || MAX_ENERGY, current + Math.max(0, restored));
  return {
    currentEnergy: nextEnergy,
    energyUpdatedAt: nextEnergy >= (user.maxEnergy || MAX_ENERGY)
      ? now
      : new Date(updatedAt.getTime() + restored * ENERGY_REFILL_MINUTES * 60000)
  };
}

function buildDefaultUser(tgUser) {
  const now = new Date();
  return {
    telegramUserId: String(tgUser.id),
    username: tgUser.username || "",
    displayName: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ") || tgUser.username || "Chef",
    avatarUrl: tgUser.photo_url || "",
    chefPoints: 0,
    totalTaps: 0,
    mealsCooked: 0,
    currentEnergy: MAX_ENERGY,
    maxEnergy: MAX_ENERGY,
    energyUpdatedAt: now,
    streakCount: 1,
    lastActiveDate: todayKey(),
    lastStreakDate: todayKey(),
    createdAt: now,
    updatedAt: now
  };
}

function buildDefaultDaily(telegramUserId, dateKey) {
  return {
    telegramUserId,
    dateKey,
    tappedToday: 0,
    mealsCookedToday: 0,
    openedKitchenToday: true,
    completedTaskIds: ["open_kitchen"],
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function evaluateTasks(daily) {
  const completed = new Set(daily.completedTaskIds || []);
  for (const task of DAILY_TASKS) {
    if (task.type === "open" && daily.openedKitchenToday) completed.add(task.id);
    if (task.type === "tap" && Number(daily.tappedToday || 0) >= task.target) completed.add(task.id);
    if (task.type === "meal" && Number(daily.mealsCookedToday || 0) >= task.target) completed.add(task.id);
  }
  daily.completedTaskIds = [...completed];
  return daily;
}

function serializeState(user, daily) {
  const hydratedDaily = evaluateTasks({ ...daily });
  return {
    telegramUserId: user.telegramUserId,
    displayName: user.displayName,
    username: user.username,
    avatarUrl: user.avatarUrl,
    chefPoints: user.chefPoints,
    totalTaps: user.totalTaps,
    mealsCooked: user.mealsCooked,
    currentEnergy: user.currentEnergy,
    maxEnergy: user.maxEnergy,
    streakCount: user.streakCount,
    daily: {
      dateKey: hydratedDaily.dateKey,
      tappedToday: hydratedDaily.tappedToday,
      mealsCookedToday: hydratedDaily.mealsCookedToday,
      openedKitchenToday: hydratedDaily.openedKitchenToday,
      completedTaskIds: hydratedDaily.completedTaskIds
    },
    tasks: DAILY_TASKS.map((task) => ({
      ...task,
      progress:
        task.type === "tap" ? hydratedDaily.tappedToday :
        task.type === "meal" ? hydratedDaily.mealsCookedToday :
        hydratedDaily.openedKitchenToday ? 1 : 0,
      completed: hydratedDaily.completedTaskIds.includes(task.id)
    }))
  };
}

class InMemoryStore {
  constructor() {
    this.users = new Map();
    this.daily = new Map();
    this.memory = new Map();
  }
}

export async function createGameServices(cfg) {
  const db = await getDb(cfg);
  const memoryStore = new InMemoryStore();
  const rateMap = new Map();

  function rateLimit(userId) {
    const now = Date.now();
    const state = rateMap.get(userId) || { count: 0, ts: now };
    if (now - state.ts > 1000) {
      state.count = 0;
      state.ts = now;
    }
    state.count += 1;
    rateMap.set(userId, state);
    return state.count <= 8;
  }

  async function getUser(telegramUserId, tgUser) {
    if (!db) {
      let user = memoryStore.users.get(telegramUserId);
      if (!user && tgUser) {
        user = buildDefaultUser(tgUser);
        memoryStore.users.set(telegramUserId, user);
      }
      return user || null;
    }

    try {
      let user = await db.collection("users").findOne({ telegramUserId });
      if (!user && tgUser) {
        const insert = buildDefaultUser(tgUser);
        await db.collection("users").updateOne(
          { telegramUserId },
          {
            $setOnInsert: { ...insert, createdAt: insert.createdAt },
            $set: {
              username: insert.username,
              displayName: insert.displayName,
              avatarUrl: insert.avatarUrl,
              chefPoints: insert.chefPoints,
              totalTaps: insert.totalTaps,
              mealsCooked: insert.mealsCooked,
              currentEnergy: insert.currentEnergy,
              maxEnergy: insert.maxEnergy,
              energyUpdatedAt: insert.energyUpdatedAt,
              streakCount: insert.streakCount,
              lastActiveDate: insert.lastActiveDate,
              lastStreakDate: insert.lastStreakDate,
              updatedAt: insert.updatedAt
            }
          },
          { upsert: true }
        );
        user = await db.collection("users").findOne({ telegramUserId });
      }
      return user;
    } catch (error) {
      console.error("[db] users findOne/updateOne failed", { error: safeErr(error), collection: "users" });
      return null;
    }
  }

  async function saveUser(user) {
    delete user._id;
    delete user.createdAt;

    if (!db) {
      const current = memoryStore.users.get(user.telegramUserId) || {};
      memoryStore.users.set(user.telegramUserId, { ...current, ...user });
      return;
    }

    try {
      await db.collection("users").updateOne(
        { telegramUserId: user.telegramUserId },
        {
          $setOnInsert: { },
          $set: { ...user, updatedAt: new Date() }
        },
        { upsert: true }
      );
    } catch (error) {
      console.error("[db] users updateOne failed", { error: safeErr(error), collection: "users" });
      throw error;
    }
  }

  async function getDaily(telegramUserId, dateKey) {
    const key = `${telegramUserId}:${dateKey}`;
    if (!db) {
      return memoryStore.daily.get(key) || null;
    }
    try {
      return await db.collection("userdailyprogress").findOne({ telegramUserId, dateKey });
    } catch (error) {
      console.error("[db] userdailyprogress findOne failed", { error: safeErr(error), collection: "userdailyprogress" });
      return null;
    }
  }

  async function saveDaily(daily) {
    delete daily._id;
    delete daily.createdAt;
    const key = `${daily.telegramUserId}:${daily.dateKey}`;

    if (!db) {
      const current = memoryStore.daily.get(key) || buildDefaultDaily(daily.telegramUserId, daily.dateKey);
      memoryStore.daily.set(key, { ...current, ...daily, updatedAt: new Date() });
      return;
    }

    try {
      await db.collection("userdailyprogress").updateOne(
        { telegramUserId: daily.telegramUserId, dateKey: daily.dateKey },
        {
          $setOnInsert: { },
          $set: { ...daily, updatedAt: new Date() }
        },
        { upsert: true }
      );
    } catch (error) {
      console.error("[db] userdailyprogress updateOne failed", { error: safeErr(error), collection: "userdailyprogress" });
      throw error;
    }
  }

  async function resolvePlayerState(telegramUserId, tgUser) {
    const user = await getUser(telegramUserId, tgUser);
    const activeUser = user || buildDefaultUser(tgUser || { id: telegramUserId, first_name: "Chef" });
    const regen = regenEnergy(activeUser);
    activeUser.currentEnergy = regen.currentEnergy;
    activeUser.energyUpdatedAt = regen.energyUpdatedAt;

    const dateKey = todayKey();
    let daily = await getDaily(telegramUserId, dateKey);
    if (!daily) {
      daily = buildDefaultDaily(telegramUserId, dateKey);
      const lastStreakDate = activeUser.lastStreakDate || "";
      if (lastStreakDate === yesterdayKey()) {
        activeUser.streakCount = Number(activeUser.streakCount || 0) + 1;
      } else if (lastStreakDate !== dateKey) {
        activeUser.streakCount = 1;
      }
      activeUser.lastStreakDate = dateKey;
    } else {
      daily.openedKitchenToday = true;
    }

    activeUser.lastActiveDate = dateKey;
    activeUser.updatedAt = new Date();
    daily.updatedAt = new Date();
    daily = evaluateTasks(daily);

    await saveUser(activeUser);
    await saveDaily(daily);
    return serializeState(activeUser, daily);
  }

  async function bootstrapPlayer(tgUser) {
    return resolvePlayerState(String(tgUser.id), tgUser);
  }

  async function tapIngredient(telegramUserId, taps = 1) {
    if (!rateLimit(telegramUserId)) throw new Error("Too many taps. Slow down a bit.");
    const normalizedTaps = Math.max(1, Math.min(Number(taps) || 1, 5));
    const user = await getUser(telegramUserId);
    if (!user) throw new Error("Player not found.");

    const dateKey = todayKey();
    const daily = (await getDaily(telegramUserId, dateKey)) || buildDefaultDaily(telegramUserId, dateKey);
    const regen = regenEnergy(user);
    user.currentEnergy = regen.currentEnergy;
    user.energyUpdatedAt = regen.energyUpdatedAt;

    const spendable = Math.min(user.currentEnergy, normalizedTaps);
    if (spendable <= 0) throw new Error("Out of energy. Come back in a few minutes.");

    user.currentEnergy -= spendable;
    user.energyUpdatedAt = new Date();
    user.chefPoints += spendable * POINTS_PER_TAP;
    user.totalTaps += spendable;
    user.updatedAt = new Date();

    daily.tappedToday = Number(daily.tappedToday || 0) + spendable;
    daily.openedKitchenToday = true;
    daily.updatedAt = new Date();
    evaluateTasks(daily);

    await saveUser(user);
    await saveDaily(daily);
    return serializeState(user, daily);
  }

  async function cookMeal(telegramUserId) {
    const user = await getUser(telegramUserId);
    if (!user) throw new Error("Player not found.");

    const dateKey = todayKey();
    const daily = (await getDaily(telegramUserId, dateKey)) || buildDefaultDaily(telegramUserId, dateKey);
    const tapsBanked = Number(daily.tappedToday || 0) - Number(daily.mealsCookedToday || 0) * TAPS_PER_MEAL;
    if (tapsBanked < TAPS_PER_MEAL) throw new Error("You need more ingredient taps before cooking a meal.");

    user.mealsCooked += 1;
    user.chefPoints += MEAL_REWARD;
    user.updatedAt = new Date();

    daily.mealsCookedToday = Number(daily.mealsCookedToday || 0) + 1;
    daily.updatedAt = new Date();
    evaluateTasks(daily);

    await saveUser(user);
    await saveDaily(daily);
    return serializeState(user, daily);
  }

  async function getPlayerSummary(telegramUserId, tgUser = {}) {
    const state = await resolvePlayerState(telegramUserId, tgUser.id ? tgUser : { id: telegramUserId, first_name: tgUser.first_name || "Chef", username: tgUser.username || "" });
    return {
      chefPoints: state.chefPoints,
      currentEnergy: state.currentEnergy,
      maxEnergy: state.maxEnergy,
      streakCount: state.streakCount,
      mealsCooked: state.mealsCooked,
      completedTasks: state.tasks.filter((task) => task.completed).length,
      totalTasks: state.tasks.length
    };
  }

  async function getLeaderboard(telegramUserId = "") {
    let users = [];
    if (!db) {
      users = [...memoryStore.users.values()];
    } else {
      try {
        users = await db.collection("users").find({}, { projection: { displayName: 1, chefPoints: 1, mealsCooked: 1, streakCount: 1, telegramUserId: 1 } }).sort({ chefPoints: -1, mealsCooked: -1, streakCount: -1 }).limit(10).toArray();
      } catch (error) {
        console.error("[db] users leaderboard read failed", { error: safeErr(error), collection: "users" });
      }
    }

    const allUsers = !db ? [...memoryStore.users.values()].sort((a, b) => b.chefPoints - a.chefPoints) : users;
    const topPlayers = users.slice(0, 10).map((user) => ({
      displayName: user.displayName || "Chef",
      chefPoints: Number(user.chefPoints || 0),
      mealsCooked: Number(user.mealsCooked || 0),
      streakCount: Number(user.streakCount || 0)
    }));

    let you = null;
    if (telegramUserId) {
      if (!db) {
        const rank = allUsers.findIndex((user) => user.telegramUserId === telegramUserId) + 1;
        const current = memoryStore.users.get(telegramUserId);
        if (current) {
          you = {
            rank: rank || null,
            chefPoints: current.chefPoints || 0,
            displayName: current.displayName || "Chef"
          };
        }
      } else {
        const current = await getUser(telegramUserId);
        if (current) {
          const rank = 1 + await db.collection("users").countDocuments({ chefPoints: { $gt: current.chefPoints || 0 } });
          you = {
            rank,
            chefPoints: current.chefPoints || 0,
            displayName: current.displayName || "Chef"
          };
        }
      }
    }

    return { topPlayers, you };
  }

  async function saveMemoryTurn({ userId, chatId, role, text }) {
    const cleanText = String(text || "").slice(0, 2000);
    if (!cleanText) return;

    if (!db) {
      const key = `${userId}:${chatId}`;
      const list = memoryStore.memory.get(key) || [];
      list.push({ role, text: cleanText, ts: new Date() });
      memoryStore.memory.set(key, list.slice(-20));
      return;
    }

    try {
      await db.collection("memory_messages").insertOne({
        userId,
        platform: "telegram",
        chatId,
        role,
        text: cleanText,
        ts: new Date()
      });
    } catch (error) {
      console.error("[db] memory_messages insertOne failed", { error: safeErr(error), collection: "memory_messages" });
    }
  }

  async function getMemoryTurns(userId, chatId) {
    if (!db) {
      const key = `${userId}:${chatId}`;
      return (memoryStore.memory.get(key) || []).slice(-10);
    }

    try {
      const docs = await db.collection("memory_messages").find({ userId, chatId, platform: "telegram" }).sort({ ts: -1 }).limit(10).toArray();
      return docs.reverse();
    } catch (error) {
      console.error("[db] memory_messages find failed", { error: safeErr(error), collection: "memory_messages" });
      return [];
    }
  }

  async function clearMemory(userId, chatId) {
    if (!db) {
      memoryStore.memory.delete(`${userId}:${chatId}`);
      return;
    }
    try {
      await db.collection("memory_messages").deleteMany({ userId, chatId, platform: "telegram" });
    } catch (error) {
      console.error("[db] memory_messages deleteMany failed", { error: safeErr(error), collection: "memory_messages" });
    }
  }

  async function replyWithMemory({ userId, chatId, userText, botProfile }) {
    await saveMemoryTurn({ userId, chatId, role: "user", text: userText });
    const turns = await getMemoryTurns(userId, chatId);
    const lastUser = turns.filter((turn) => turn.role === "user").slice(-3).map((turn) => turn.text).join(" ");
    const answer = lastUser.toLowerCase().includes("leaderboard")
      ? "Use /leaderboard to see the top chefs, or open the Mini App leaderboard tab."
      : lastUser.toLowerCase().includes("profile")
      ? "Use /profile for your quick stats, or open the profile tab in TapChef for the full view."
      : `I can help with TapChef. ${botProfile.includes("/play") ? "Use /play to open the kitchen." : "Try /help."}`;
    await saveMemoryTurn({ userId, chatId, role: "assistant", text: answer });
    return answer;
  }

  return {
    bootstrapPlayer,
    tapIngredient,
    cookMeal,
    getLeaderboard,
    getPlayerSummary,
    clearMemory,
    replyWithMemory
  };
}
