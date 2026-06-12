import { MongoClient } from "mongodb";

function safeErr(err) {
  return (
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    err?.message ||
    String(err)
  );
}

let client = null;
let db = null;

export async function getDb(cfg) {
  if (db) return db;
  if (!cfg.MONGODB_URI) {
    console.warn("[db] MONGODB_URI missing, using in-memory fallback only");
    return null;
  }

  try {
    client = new MongoClient(cfg.MONGODB_URI, { ignoreUndefined: true });
    await client.connect();
    db = client.db();
    console.log("[db] connected", { mongoSet: true });
    await ensureIndexes(db);
    return db;
  } catch (error) {
    console.error("[db] connect failed", { error: safeErr(error) });
    return null;
  }
}

async function ensureIndexes(db) {
  try {
    await db.collection("users").createIndex({ telegramUserId: 1 }, { unique: true });
    await db.collection("users").createIndex({ chefPoints: -1, telegramUserId: 1 });
    await db.collection("userdailyprogress").createIndex({ telegramUserId: 1, dateKey: 1 }, { unique: true });
    await db.collection("memory_messages").createIndex({ userId: 1, chatId: 1, ts: -1 });
  } catch (error) {
    console.error("[db] ensureIndexes failed", { error: safeErr(error) });
  }
}
