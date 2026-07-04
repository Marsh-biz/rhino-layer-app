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
  console.log("Postgres connected; presets table ready.");
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
    res.json({ ok: true, name });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to delete preset" });
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
