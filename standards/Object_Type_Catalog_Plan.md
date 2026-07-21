# Object-Type Catalog — Implementation Plan

A companion feature to the layer-standards app: define **which Branch object types belong on
each layer**, and surface them in a synced window as you select layers. This encodes the
object↔layer relationship that future **model-health checking** will enforce.

Related docs: [`Layer_Standards_Context.md`](./Layer_Standards_Context.md),
[`Layer_Naming_Acronyms.md`](./Layer_Naming_Acronyms.md).

---

## 1. Purpose
- Author the *rule*: for each standard layer, the Branch object type(s) that should live there.
- Spec-only to start (no live model). It defines expectations; comparison to real models is a
  later phase.
- Long-term goal: **model health** — flag objects on the wrong layer, empty required layers,
  rogue/non-standard layers, wrong color/type.

## 2. Decisions locked (from the design brainstorm)
- **Data source (now):** specification only — no live model yet.
- **Primary goal:** author the standard (expected object types per layer).
- **Display:** grouped object-type list for the selected layer (name + description; primary first).
  Instance *counts* come later, with model comparison.
- **Belongs rule:** object **type / category** → layer.
- **Cardinality:** one *primary* type per layer, occasionally more.
- **Storage:** a **separate, global type↔layer catalog** (independent of any preset), because
  types are reused across all three standards.
- **Home-layer link is by layer NAME** (`SC_GLM_BEAM`), shared across standards. Naming is
  consistent across standards, so differences between standards surface as layer-name differences.
- **`branch_key`:** the object's type is defined by a **Branch class on the object** (not the
  layer). Exact tech TBD → store as free-text, fill in once verified against a real model.
- **View:** a **separate synced window** (second monitor / popped tab), kept in sync with the
  emulator's current layer selection via `BroadcastChannel` (same-origin — works with the app
  inside Notion's iframe and the companion as a popped Railway tab).
- **Seed scope:** derive types for **object-bearing layers only** — geometry members
  (`SC_<MAT>_<COMP>`), machining objects (`_TOOL_DAP/PEN/CHASE/OPENING/CUTTING/PRE_DRILL`), and
  connection entities (`CE_*`). Skip annotation (`SC_ANN_*`/`BR_ANN_*`), layout (`SC-LAYOUT`),
  containers (`BUILDING`/`LIBRARY`/`REF`/`USER`/`AUTO`), and gridlines.

## 3. Recommended FIRST step when resuming — verify against a real Branch model
Before/at build, connect to a live Branch model (Rhino MCP is available: `list_objects`,
`get_selection`, `run_python`, `run_csharp`, `get_viewport_image`). Goals:
- Dump a few representative objects (a glulam beam, a steel plate, a dap, a connection) and
  inspect **how the Branch class/type is stored** — likely one of: RhinoObject subtype, block/
  instance-definition name, `GetUserString`/`UserDictionary` keys, or Branch plugin object data.
- Record the exact field → that becomes `branch_key`.
- Note **all reliably-present metadata** (class, material, dimensions, GUID, layer, name) — that
  defines what model-health can check later.
This replaces every `branch_key = (tbd)` with real values and validates the schema.

## 4. Data model
Table `object_types` (Postgres; in-memory fallback when no `DATABASE_URL`, same pattern as presets):

| column | type | notes |
|--------|------|-------|
| `id` | TEXT PK | uuid |
| `name` | TEXT | e.g. "Glulam Beam" |
| `category` | TEXT | Glulam / Steel / DLT / CLT / BLK / Machining / Connection / … |
| `description` | TEXT | |
| `home_layer` | TEXT | layer name, e.g. `SC_GLM_BEAM` |
| `branch_key` | TEXT (nullable) | the Branch class id (fill after model verification) |
| `is_primary` | BOOLEAN | primary type for its home layer |
| `updated_at` | TIMESTAMPTZ | |

A layer's expected types = all rows where `home_layer` = that layer (primary first).

## 5. API (server.js)
- `GET /api/object-types` → `{ types: [...] }`
- `GET /api/object-types?home_layer=<name>` → filtered
- `PUT /api/object-types/:id` → upsert
- `DELETE /api/object-types/:id`
- `POST /api/object-types/import` → bulk seed
- Table created on boot via `CREATE TABLE IF NOT EXISTS` (no migration).

## Build status (Phases 1–3 done and deployed — 2026-07-21)
- **Phase 1 ✓** — `object_types` table + CRUD/import API in `server.js`; `scripts/seed_object_types.js`
  derives one type per `SC-OBJECTS` leaf from the live standards (64 seeded).
- **Phase 2 ✓** — `index.html` broadcasts the selected layer on `BroadcastChannel("sc-objects")`
  (+ localStorage fallback); "⧉ Object types" button opens the companion window.
- **Phase 3 ✓** — `public/objects.html` companion window: syncs to the selected layer, lists its
  expected types (primary first), and does inline add/edit/delete (name, category, branch_key, notes, primary).
- **Phase 4** — not started (future model-health).
- **Deployed ✓** — repo pushed to `github.com/Marsh-biz/rhino-layer-app` (grafted onto the real
  project history — the working copy had no local `.git` even though it was already live). Railway
  is connected to this repo for auto-deploy on push to `main`; the push auto-deployed within
  seconds and the catalog was seeded live via
  `node standards/scripts/seed_object_types.js https://layers-structurecraft.up.railway.app`
  (64 types imported, verified via `/api/object-types`). Added `railway.json` (Nixpacks build,
  `/healthz` healthcheck) and gitignored local `.claude/` settings.
  `branch_key` stays blank until verified against a real Branch model (see §3).

## 6. Build phases
**Phase 1 — Catalog data + API + seed**
- Add table DDL to `initDb`, CRUD helpers + routes.
- `standards/scripts/seed_object_types.js`: pull the 3 standards, derive a type per object-bearing
  leaf (name from tokens via the acronym glossary: `GLM`→Glulam, `PLATE_KNIFE`→Knife Plate,
  `TOOL_DAP`→Dap, `TOOL_PEN`→Penetration, `CE_STEEL_EU`→EU Steel Connection…), set `home_layer`,
  `category`, `is_primary=true`, `branch_key=null`; POST via import.

**Phase 2 — Emulator integration + catalog editor**
- On layer select, broadcast `{ type:"select", layer:<name> }` on `BroadcastChannel("sc-objects")`.
- Add an "Objects" button to open the companion window.
- Catalog editor (table): CRUD types; `home_layer` chosen from a dropdown of standard layer names.

**Phase 3 — Separate synced window**
- New page `public/objects.html` (route `/objects`). Subscribes to `BroadcastChannel("sc-objects")`;
  on selection fetches `/api/object-types?home_layer=<name>` and renders the grouped list.
  Doubles as the inline editor. On open, requests current selection from the main window
  (main replies with the active layer). Fallback: `localStorage` + `storage` event if
  `BroadcastChannel` unsupported.

**Phase 4 — (future) Model health**
- Import a model manifest (`[{ id, branch_key, layer, … }]`) or read live via Rhino MCP.
- For each object: expected `home_layer` = catalog row with matching `branch_key`; flag if the
  object's actual layer ≠ `home_layer`. Also report: required layers with no objects, layers with
  objects but no matching type (rogue), and color/type mismatches.

## 7. Files touched
- `server.js` — `object_types` table + CRUD + routes.
- `public/index.html` — BroadcastChannel broadcast on layer select; "Objects" button.
- `public/objects.html` — new companion window app.
- `standards/scripts/seed_object_types.js` — derive + POST the seed catalog.

## 8. Deployment notes
- New table auto-creates on boot (no migration).
- Requires pushing `server.js` + the `public/` changes to Railway.
- Companion window opens via `window.open` (needs popups allowed — confirmed OK in the Notion
  embed from the export work); `BroadcastChannel` is same-origin so it spans the iframe + popped tab.

## 9. Open items to confirm at build
- **`branch_key`** exact field (from the model-verification step in §3).
- Whether to also catalog **annotation** object types (currently out of seed scope).
- Companion-window UX polish (auto-close, second-monitor behavior) inside Notion.
