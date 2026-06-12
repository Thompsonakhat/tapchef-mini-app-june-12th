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
const ACHIEVEMENTS = [
  { id: "first_tap", label: "First Tap", badge: "Starter Spoon", type: "tap_total", target: 1, description: "Make your very first ingredient tap." },
  { id: "tap_100", label: "100 Taps", badge: "Golden Whisk", type: "tap_total", target: 100, description: "Reach 100 total taps." },
  { id: "meals_10", label: "10 Meals", badge: "Pan Pro", type: "meals_total", target: 10, description: "Cook 10 meals in total." },
  { id: "streak_7", label: "7 Day Streak", badge: "Fire Apron", type: "streak", target: 7, description: "Keep your kitchen streak alive for 7 days." }
];
const RECIPES = [
  { id: "cloud_omelet", name: "Cloud Omelet", cost: 25, rewardText: "A fluffy breakfast favorite from the TapChef test kitchen." },
  { id: "meteor_pasta", name: "Meteor Pasta", cost: 45, rewardText: "A quick cosmic pasta tossed with sparkle sauce." },
  { id: "sunset_stew", name: "Sunset Stew", cost: 70, rewardText: "A slow-simmered stew with glowing garden vegetables." }
];
const KITCHEN_THEMES = [
  { id: "copper_cozy", name: "Copper Cozy", cost: 30, description: "Warm copper counters and soft lantern light." },
  { id: "midnight_diner", name: "Midnight Diner", cost: 55, description: "A sleek late-night kitchen with neon trim." },
  { id: "garden_glow", name: "Garden Glow", cost: 80, description: "A bright greenhouse kitchen with leafy accents." }
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
    unlockedAchievementIds: [],
    unlockedRecipeIds: [],
    ownedThemeIds: [],
    activeThemeId: "classic_kitchen",
    soundEnabled: true,
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

function evaluateAchievements(user) {
  const unlocked = new Set(user.unlockedAchievementIds || []);
  const newlyUnlocked = [];

  for (const achievement of ACHIEVEMENTS) {
    if (unlocked.has(achievement.id)) continue;

    const reached = achievement.type === "tap_total"
      ? Number(user.totalTaps || 0) >= achievement.target
      : achievement.type === "meals_total"
      ? Number(user.mealsCooked || 0) >= achievement.target
      : Number(user.streakCount || 0) >= achievement.target;

    if (reached) {
      unlocked.add(achievement.id);
      newlyUnlocked.push(achievement.id);
    }
  }

  user.unlockedAchievementIds = [...unlocked];
  return newlyUnlocked;
}

function buildAchievements(user) {
  const unlocked = new Set(user.unlockedAchievementIds || []);
  return ACHIEVEMENTS.map((achievement) => ({
    ...achievement,
    unlocked: unlocked.has(achievement.id)
  }));
}

function buildRecipes(user) {
  const unlocked = new Set(user.unlockedRecipeIds || []);
  return RECIPES.map((recipe) => ({
    ...recipe,
    unlocked: unlocked.has(recipe.id)
  }));
}

function buildThemes(user) {
  const owned = new Set(["classic_kitchen", ...(user.ownedThemeIds || [])]);
  return [
    {
      id: "classic_kitchen",
      name: "Classic Kitchen",
      cost: 0,
      description: "The default TapChef kitchen look.",
      owned: true,
      active: (user.activeThemeId || "classic_kitchen") === "classic_kitchen"
    },
    ...KITCHEN_THEMES.map((theme) => ({
      ...theme,
      owned: owned.has(theme.id),
      active: user.activeThemeId === theme.id
    }))
  ];
}

function serializeState(user, daily, extra = {}) {
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
    settings: {
      soundEnabled: user.soundEnabled !== false
    },
    activeThemeId: user.activeThemeId || "classic_kitchen",
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
    })),
    achievements: buildAchievements(user),
    recipes: buildRecipes(user),
    themes: buildThemes(user),
    newlyUnlockedAchievementIds: extra.newlyUnlockedAchievementIds || []
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
            $setOnInsert: { ...insert },
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
              unlockedAchievementIds: insert.unlockedAchievementIds,
              unlockedRecipeIds: insert.unlockedRecipeIds,
              ownedThemeIds: insert.ownedThemeIds,
              activeThemeId: insert.activeThemeId,
              soundEnabled: insert.soundEnabled,
              updatedAt: insert.updatedAt
            }
          },
          { upsert: true }
        );
        user = await db.collection("users").findOne({ telegramUserId });
      }
      if (user) {
        user.unlockedAchievementIds ||= [];
        user.unlockedRecipeIds ||= [];
        user.ownedThemeIds ||= [];
        user.activeThemeId ||= "classic_kitchen";
        if (typeof user.soundEnabled !== "boolean") user.soundEnabled = true;
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
          $setOnInsert: {},
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
          $setOnInsert: {},
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
    const newlyUnlockedAchievementIds = evaluateAchievements(activeUser);

    await saveUser(activeUser);
    await saveDaily(daily);
    return serializeState(activeUser, daily, { newlyUnlockedAchievementIds });
  }

  async function bootstrapPlayer(tgUser) {
    console.log("[game] bootstrap", { telegramUserId: String(tgUser?.id || "") });
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
    const newlyUnlockedAchievementIds = evaluateAchievements(user);

    await saveUser(user);
    await saveDaily(daily);
    return serializeState(user, daily, { newlyUnlockedAchievementIds });
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
    const newlyUnlockedAchievementIds = evaluateAchievements(user);

    await saveUser(user);
    await saveDaily(daily);
    return serializeState(user, daily, { newlyUnlockedAchievementIds });
  }

  async function unlockRecipe(telegramUserId, recipeId) {
    const user = await getUser(telegramUserId);
    if (!user) throw new Error("Player not found.");

    const recipe = RECIPES.find((item) => item.id === recipeId);
    if (!recipe) throw new Error("Recipe not found.");

    user.unlockedRecipeIds ||= [];
    if (user.unlockedRecipeIds.includes(recipe.id)) throw new Error("Recipe already unlocked.");
    if (Number(user.chefPoints || 0) < recipe.cost) throw new Error("Not enough Chef Points for that recipe.");

    user.chefPoints -= recipe.cost;
    user.unlockedRecipeIds = [...new Set([...user.unlockedRecipeIds, recipe.id])];
    user.updatedAt = new Date();

    const dateKey = todayKey();
    const daily = (await getDaily(telegramUserId, dateKey)) || buildDefaultDaily(telegramUserId, dateKey);
    await saveUser(user);
    await saveDaily(daily);
    return serializeState(user, daily);
  }

  async function buyTheme(telegramUserId, themeId) {
    const user = await getUser(telegramUserId);
    if (!user) throw new Error("Player not found.");

    const theme = KITCHEN_THEMES.find((item) => item.id === themeId);
    if (!theme) throw new Error("Theme not found.");

    user.ownedThemeIds ||= [];
    if (user.ownedThemeIds.includes(theme.id)) throw new Error("Theme already owned.");
    if (Number(user.chefPoints || 0) < theme.cost) throw new Error("Not enough Chef Points for that theme.");

    user.chefPoints -= theme.cost;
    user.ownedThemeIds = [...new Set([...user.ownedThemeIds, theme.id])];
    user.updatedAt = new Date();

    const dateKey = todayKey();
    const daily = (await getDaily(telegramUserId, dateKey)) || buildDefaultDaily(telegramUserId, dateKey);
    await saveUser(user);
    await saveDaily(daily);
    return serializeState(user, daily);
  }

  async function setActiveTheme(telegramUserId, themeId) {
    const user = await getUser(telegramUserId);
    if (!user) throw new Error("Player not found.");

    const owned = new Set(["classic_kitchen", ...(user.ownedThemeIds || [])]);
    if (!owned.has(themeId)) throw new Error("Theme not owned yet.");

    user.activeThemeId = themeId;
    user.updatedAt = new Date();

    const dateKey = todayKey();
    const daily = (await getDaily(telegramUserId, dateKey)) || buildDefaultDaily(telegramUserId, dateKey);
    await saveUser(user);
    await saveDaily(daily);
    return serializeState(user, daily);
  }

  async function updateSettings(telegramUserId, patch = {}) {
    const user = await getUser(telegramUserId);
    if (!user) throw new Error("Player not found.");

    if (typeof patch.soundEnabled === "boolean") {
      user.soundEnabled = patch.soundEnabled;
    }
    user.updatedAt = new Date();

    const dateKey = todayKey();
    const daily = (await getDaily(telegramUserId, dateKey)) || buildDefaultDaily(telegramUserId, dateKey);
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
      totalTasks: state.tasks.length,
      unlockedAchievements: state.achievements.filter((achievement) => achievement.unlocked).length,
      totalAchievements: state.achievements.length
    };
  }

  async function getLeaderboard(telegramUserId = "") {
    let topUsers = [];
    let rankPool = [];

    if (!db) {
      rankPool = [...memoryStore.users.values()].sort((a, b) => {
        if ((b.chefPoints || 0) !== (a.chefPoints || 0)) return (b.chefPoints || 0) - (a.chefPoints || 0);
        if ((b.mealsCooked || 0) !== (a.mealsCooked || 0)) return (b.mealsCooked || 0) - (a.mealsCooked || 0);
        return (b.streakCount || 0) - (a.streakCount || 0);
      });
      topUsers = rankPool.slice(0, 10);
    } else {
      try {
        topUsers = await db.collection("users")
          .find({}, { projection: { displayName: 1, chefPoints: 1, mealsCooked: 1, streakCount: 1, telegramUserId: 1 } })
          .sort({ chefPoints: -1, mealsCooked: -1, streakCount: -1 })
          .limit(10)
          .toArray();
      } catch (error) {
        console.error("[db] users leaderboard read failed", { error: safeErr(error), collection: "users" });
      }
    }

    const topPlayers = topUsers.map((user, index) => ({
      rank: index + 1,
      telegramUserId: user.telegramUserId,
      displayName: user.displayName || "Chef",
      chefPoints: Number(user.chefPoints || 0),
      mealsCooked: Number(user.mealsCooked || 0),
      streakCount: Number(user.streakCount || 0)
    }));

    let you = null;
    if (telegramUserId) {
      if (!db) {
        const rank = rankPool.findIndex((user) => user.telegramUserId === telegramUserId) + 1;
        const current = memoryStore.users.get(telegramUserId);
        if (current) {
          you = {
            rank: rank || null,
            chefPoints: current.chefPoints || 0,
            displayName: current.displayName || "Chef",
            inTopTen: rank > 0 && rank <= 10
          };
        }
      } else {
        const current = await getUser(telegramUserId);
        if (current) {
          const higherPoints = await db.collection("users").countDocuments({ chefPoints: { $gt: current.chefPoints || 0 } });
          const samePointsAhead = await db.collection("users").countDocuments({
            chefPoints: current.chefPoints || 0,
            $or: [
              { mealsCooked: { $gt: current.mealsCooked || 0 } },
              {
                mealsCooked: current.mealsCooked || 0,
                streakCount: { $gt: current.streakCount || 0 }
              }
            ]
          });
          const rank = 1 + higherPoints + samePointsAhead;
          you = {
            rank,
            chefPoints: current.chefPoints || 0,
            displayName: current.displayName || "Chef",
            inTopTen: rank <= 10
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
    const lower = lastUser.toLowerCase();
    const answer = lower.includes("leaderboard")
      ? "Use /leaderboard to see the top chefs. The leaderboard also shows your own rank even outside the top 10."
      : lower.includes("profile")
      ? "Use /profile for your quick stats, or open the profile tab in TapChef for the full view."
      : lower.includes("achievement")
      ? "Open TapChef to view badges for your first tap, 100 taps, 10 meals, and a 7 day streak."
      : lower.includes("recipe")
      ? "Open the recipe book tab in TapChef to unlock fictional recipes with Chef Points."
      : lower.includes("shop") || lower.includes("theme")
      ? "Open the shop tab in TapChef to spend fictional Chef Points on cosmetic kitchen themes."
      : `I can help with TapChef. ${botProfile.includes("/play") ? "Use /play to open the kitchen." : "Try /help."}`;
    await saveMemoryTurn({ userId, chatId, role: "assistant", text: answer });
    return answer;
  }

  return {
    bootstrapPlayer,
    tapIngredient,
    cookMeal,
    unlockRecipe,
    buyTheme,
    setActiveTheme,
    updateSettings,
    getLeaderboard,
    getPlayerSummary,
    clearMemory,
    replyWithMemory
  };
}
