"use strict";

const express = require("express");
const path = require("path");
const crypto = require("node:crypto");

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false, limit: "8mb" })); // for the form-based export

// ---------- Storage backend ----------
// Uses Railway Postgres when DATABASE_URL is present; otherwise an in-memory
// map so the app still runs locally (presets won't survive a restart).
let db = null;
const memory = new Map();
const settingsMemory = new Map();
const objectTypesMemory = new Map(); // id -> object-type row (in-memory fallback)

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
  await db.query(`
    CREATE TABLE IF NOT EXISTS object_types (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      home_layer    TEXT,
      branch_key    TEXT,   -- Branch object type = class name (e.g. TimberLinearBeam)
      branch_prefix TEXT,   -- optional Branch mark TypePrefix refiner (e.g. B=beam, C=column)
      description   TEXT,   -- notes
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.query("CREATE INDEX IF NOT EXISTS object_types_home_layer_idx ON object_types (home_layer)");
  // Migrate older schemas: add branch_prefix; drop the now-unused category / is_primary.
  await db.query("ALTER TABLE object_types ADD COLUMN IF NOT EXISTS branch_prefix TEXT");
  await db.query("ALTER TABLE object_types DROP COLUMN IF EXISTS category");
  await db.query("ALTER TABLE object_types DROP COLUMN IF EXISTS is_primary");
  console.log("Postgres connected; presets + settings + object_types tables ready.");
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

// ---------- Object-type catalog (global type↔layer map, independent of presets) ----------
function sortTypes(rows) {
  return rows.sort((a, b) =>
    (a.home_layer || "").localeCompare(b.home_layer || "") ||
    (a.name || "").localeCompare(b.name || ""));
}
async function listObjectTypes(homeLayer) {
  if (db) {
    const r = homeLayer
      ? await db.query("SELECT * FROM object_types WHERE home_layer = $1 ORDER BY name", [homeLayer])
      : await db.query("SELECT * FROM object_types ORDER BY home_layer, name");
    return r.rows;
  }
  let rows = [...objectTypesMemory.values()];
  if (homeLayer) rows = rows.filter(t => t.home_layer === homeLayer);
  return sortTypes(rows);
}
async function upsertObjectType(row) {
  const t = {
    id: (row.id && String(row.id)) || crypto.randomUUID(),
    name: String(row.name || "").trim(),
    home_layer: row.home_layer ? String(row.home_layer) : null,
    branch_key: row.branch_key ? String(row.branch_key) : null,
    branch_prefix: row.branch_prefix ? String(row.branch_prefix) : null,
    description: row.description ? String(row.description) : null,
  };
  if (db) {
    await db.query(
      `INSERT INTO object_types (id, name, home_layer, branch_key, branch_prefix, description, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6, now())
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, home_layer=EXCLUDED.home_layer,
         branch_key=EXCLUDED.branch_key, branch_prefix=EXCLUDED.branch_prefix,
         description=EXCLUDED.description, updated_at=now()`,
      [t.id, t.name, t.home_layer, t.branch_key, t.branch_prefix, t.description]
    );
    return t;
  }
  const stored = { ...t, updated_at: new Date().toISOString() };
  objectTypesMemory.set(t.id, stored);
  return stored;
}
async function deleteObjectType(id) {
  if (db) { await db.query("DELETE FROM object_types WHERE id = $1", [id]); return; }
  objectTypesMemory.delete(id);
}
async function clearObjectTypes() {
  if (db) { await db.query("DELETE FROM object_types"); return; }
  objectTypesMemory.clear();
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

// ---------- Object-type catalog API ----------
app.get("/api/object-types", async (req, res) => {
  try {
    const homeLayer = req.query.home_layer ? String(req.query.home_layer) : null;
    res.json({ types: await listObjectTypes(homeLayer) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to list object types" });
  }
});

app.put("/api/object-types/:id", async (req, res) => {
  const id = String(req.params.id || "").trim();
  const b = req.body || {};
  if (!id) return res.status(400).json({ error: "missing id" });
  if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: "name is required" });
  try {
    const type = await upsertObjectType({ ...b, id });
    res.json({ ok: true, type });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to save object type" });
  }
});

app.delete("/api/object-types/:id", async (req, res) => {
  try {
    await deleteObjectType(String(req.params.id || ""));
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to delete object type" });
  }
});

app.post("/api/object-types/import", async (req, res) => {
  const types = req.body && Array.isArray(req.body.types) ? req.body.types : null;
  if (!types) return res.status(400).json({ error: "body must be { types: [...] }" });
  try {
    if (req.body.replace) await clearObjectTypes();
    let n = 0;
    for (const t of types) { if (t && t.name) { await upsertObjectType(t); n++; } }
    res.json({ ok: true, imported: n });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to import object types" });
  }
});

// Two-step file export so it works from inside a sandboxed iframe (e.g. Notion),
// where the file picker and in-frame downloads are blocked:
//   1) client POSTs the JSON (a normal same-origin fetch) -> we stash it, return a token
//   2) client window.open()s GET /api/export/:token in a new top-level tab -> real download
const exportStash = new Map(); // token -> { filename, json, t }
function pruneStash() {
  const now = Date.now();
  for (const [k, v] of exportStash) if (now - v.t > 5 * 60 * 1000) exportStash.delete(k);
}
app.post("/api/export", (req, res) => {
  const json = req.body && req.body.json;
  if (!json || typeof json !== "string") return res.status(400).json({ error: "missing json" });
  let filename = String((req.body && req.body.filename) || "Layer_Export.json").replace(/[^\w.\-]+/g, "_");
  if (!/\.json$/i.test(filename)) filename += ".json";
  pruneStash();
  const token = crypto.randomUUID();
  exportStash.set(token, { filename, json, t: Date.now() });
  res.json({ token });
});
app.get("/api/export/:token", (req, res) => {
  const item = exportStash.get(req.params.token);
  if (!item) return res.status(404).send("export link expired — please export again");
  exportStash.delete(req.params.token); // one-time use
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${item.filename}"`);
  res.send(item.json);
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
