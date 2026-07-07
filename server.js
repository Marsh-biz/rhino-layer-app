"use strict";

const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "5mb" }));

// ---------- Storage backend ----------
// Uses Railway Postgres when DATABASE_URL is present; otherwise an in-memory
// map so the app still runs locally (presets won't survive a restart).
let db = null;
const memory = new Map();
const settingsMemory = new Map();

async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not set — presets stored in memory only.");
    return;
  }
  const { Pool } = require("pg");
  db = new Pool({ connectionString: process.env.DATABASE_URL });
  await db.query(`
    CREATE TABLE IF NOT EXISTS presets (
      name        TEXT PRIMARY KEY,
      tree        JSONB NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  console.log("Postgres connected; presets + settings tables ready.");
}

// ---------- App-wide settings (shared across all users) ----------
async function getSetting(key) {
  if (db) {
    const r = await db.query("SELECT value FROM settings WHERE key = $1", [key]);
    return r.rows.length ? r.rows[0].value : null;
  }
  return settingsMemory.has(key) ? settingsMemory.get(key) : null;
}

async function setSetting(key, value) {
  const empty = value === null || value === undefined || value === "";
  if (db) {
    if (empty) {
      await db.query("DELETE FROM settings WHERE key = $1", [key]);
    } else {
      await db.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value]
      );
    }
    return;
  }
  if (empty) settingsMemory.delete(key);
  else settingsMemory.set(key, value);
}

async function listPresets() {
  if (db) {
    const r = await db.query("SELECT name, tree FROM presets ORDER BY name");
    const out = {};
    for (const row of r.rows) out[row.name] = row.tree;
    return out;
  }
  return Object.fromEntries(memory);
}

async function upsertPreset(name, tree) {
  if (db) {
    await db.query(
      `INSERT INTO presets (name, tree, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (name) DO UPDATE SET tree = EXCLUDED.tree, updated_at = now()`,
      [name, JSON.stringify(tree)]
    );
    return;
  }
  memory.set(name, tree);
}

async function deletePreset(name) {
  if (db) {
    await db.query("DELETE FROM presets WHERE name = $1", [name]);
    return;
  }
  memory.delete(name);
}

// ---------- API ----------
const MAX_NAME = 200;
const DEFAULT_PRESET_KEY = "default_preset";

app.get("/api/presets", async (_req, res) => {
  try {
    res.json({ presets: await listPresets() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to list presets" });
  }
});

app.put("/api/presets/:name", async (req, res) => {
  const name = String(req.params.name || "").trim();
  const tree = req.body && req.body.tree;
  if (!name || name.length > MAX_NAME) return res.status(400).json({ error: "invalid preset name" });
  if (!Array.isArray(tree)) return res.status(400).json({ error: "body must be { tree: [...] }" });
  try {
    await upsertPreset(name, tree);
    res.json({ ok: true, name });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to save preset" });
  }
});

app.delete("/api/presets/:name", async (req, res) => {
  const name = String(req.params.name || "").trim();
  if (!name) return res.status(400).json({ error: "invalid preset name" });
  try {
    await deletePreset(name);
    // If the deleted preset was the shared startup default, clear it.
    const def = await getSetting(DEFAULT_PRESET_KEY);
    if (def === name) await setSetting(DEFAULT_PRESET_KEY, null);
    res.json({ ok: true, name });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to delete preset" });
  }
});

// ---------- Shared startup default preset ----------
app.get("/api/default-preset", async (_req, res) => {
  try {
    const name = await getSetting(DEFAULT_PRESET_KEY);
    res.json({ name: name || null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to read default preset" });
  }
});

app.put("/api/default-preset", async (req, res) => {
  const raw = req.body && typeof req.body.name === "string" ? req.body.name.trim() : null;
  if (raw && raw.length > MAX_NAME) return res.status(400).json({ error: "invalid preset name" });
  try {
    await setSetting(DEFAULT_PRESET_KEY, raw || null);
    res.json({ ok: true, name: raw || null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to set default preset" });
  }
});

app.get("/healthz", (_req, res) => res.json({ ok: true, db: !!db }));

// ---------- Static app ----------
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
initDb()
  .catch((e) => { console.error("DB init failed:", e.message); })
  .finally(() => {
    app.listen(PORT, () => console.log("Rhino layer emulator listening on :" + PORT));
  });
