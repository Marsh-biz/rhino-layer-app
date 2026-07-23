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

## 4. Data model (v2 — verified against a live authoring Branch model 2026-07-23)
Table `object_types` (Postgres; in-memory fallback when no `DATABASE_URL`, same pattern as presets):

| column | type | notes |
|--------|------|-------|
| `id` | TEXT PK | uuid / slug |
| `name` | TEXT | human label, e.g. "Glulam Beam" |
| `home_layer` | TEXT | layer name, e.g. `SC_GLM_BEAM` |
| `branch_key` | TEXT (nullable) | **Branch object type = class name** (`GetType().Name`): `TimberLinearBeam`, `DLT`, `CLT`, `Part3d`, `Dap2d`, `PlanarCut`, `Fastener1d`, `ConnectionInstance` |
| `branch_prefix` | TEXT (nullable) | optional Branch mark **TypePrefix** refiner — needed to split same-class layers (beam `B` vs column `C`) |
| `description` | TEXT | notes |
| `updated_at` | TIMESTAMPTZ | |

Dropped in v2: `category` (redundant/derivable) and `is_primary` (not needed — a layer's
expected types are just the **set** of rows with that `home_layer`).

**Why class + prefix (not material):** a live model (S… authoring, 1,010 objects) showed
`Material.Species` is usually `"Unset"`, so it can't tell glulam from steel — but the **class**
does (`TimberLinearBeam` = timber member, `Part3d` = steel, `DLT`/`CLT` = panels), and the mark
**TypePrefix** splits beam (`B`) from column (`C`) within `TimberLinearBeam`. Probe:
`standards/scripts/inspect_branch_types.py`. Guess logic: `guessBranchMatch()` in
`public/layer-humanize.js` (shared by the browser add-form and the seed/repopulate scripts).

Correctness check (goal): for each live Branch object derive `(class, TypePrefix)` → look up the
catalog row(s) with matching `branch_key` (+ `branch_prefix` if set) → expected `home_layer`;
flag actual-layer ≠ expected (wrong layer), object on a layer with no matching catalog row (rogue),
and required layer with no objects (empty). Overlaps with the `rhino-health-check` project.

## 5. API (server.js)
- `GET /api/object-types` → `{ types: [...] }`
- `GET /api/object-types?home_layer=<name>` → filtered
- `PUT /api/object-types/:id` → upsert
- `DELETE /api/object-types/:id`
- `POST /api/object-types/import` → bulk seed
- Table created on boot via `CREATE TABLE IF NOT EXISTS` (no migration).

## Build status (Phases 1–3 done and deployed — 2026-07-21)
- **Phase 1 ✓** — `object_types` table + CRUD/import API in `server.js`.
- **Phase 2 ✓** — `index.html` drives the companion via `BroadcastChannel("sc-objects")` on **hover**
  (mouseenter) and selection, reverting to the selected layer on `mouseleave`; broadcasts `isLeaf`
  and (for cross-window fallback) stores `{name,isLeaf}` JSON in `localStorage`. Light/dark theme is
  synced both ways (`{type:"theme"}` + shared `sc-theme` key). "⧉ Object types" button opens it.
- **Phase 3 ✓** — `public/objects.html` companion: floating rounded drop-shadow panel + titlebar/
  palette matching the emulator; hover-preview; inline add/edit/**delete via in-app modal** (native
  `confirm()` is blocked in the Notion iframe/popup); trash icon. **Parent layers are blocked** —
  only final child (leaf) layers hold objects. "+ Add" pre-fills name + category from the layer name.
- **Naming glossary ✓** — `public/layer-humanize.js` (UMD, from `Layer_Naming_Acronyms.md`) is the
  single source of truth for `humanizeLayer()` + `guessCategory()`, used by the browser and the
  Node scripts (`GLM`→Glulam, `DLT`/`CE`/`EU`/`NA` stay uppercase, `TOOL` dropped, `STRONG_BACK`→
  Strongback, `PRE_DRILL`→Pre-Drill, …).
- **Phase 4** — not started (future model-health).
- **Deployed ✓** — repo `github.com/Marsh-biz/rhino-layer-app`; Railway auto-deploys on push to
  `main`. Catalog seeded live from **every `SC[_-]OBJECTS` leaf across all three standards**
  (`node standards/scripts/seed_object_types.js https://layers-structurecraft.up.railway.app`) —
  **133 object types**, keyed to the full layer names the emulator broadcasts (e.g. `SC_GLM_BEAM`
  → "Glulam Beam"). The building standard uses full names (`SC_GLM_BEAM`, `LIB_*`); bridge/freeform
  still use shorter ones (`GLM`, `CE_STEEL_EU`) — the catalog is a global union keyed by layer name,
  so each standard's layers match their own rows. `repopulate_object_names.js` re-derives name/
  category for existing rows without wiping `branch_key`/notes/primary. `branch_key` stays blank
  until verified against a real Branch model (see §3). Added `railway.json` + gitignored `.claude/`.

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
