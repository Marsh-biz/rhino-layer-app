# Layer Standards Development — Context & Decision Log

Living record for developing StructureCraft's standard layer structures from the
project layer presets stored in the Branch layer app. Read this first when
resuming or extending the standards work.

Companion file: [`Layer_Naming_Acronyms.md`](./Layer_Naming_Acronyms.md) — the token glossary.

---

## 1. Goal
Compare the project layer presets, grouped by **building type**, and synthesize
**standard layer structures** — one per type — that new projects start from.

**Method: weighted-on-a-skeleton.** Use S432's organization for the *hierarchy*
(`SC-OBJECTS` / `LIBRARY` / `REF` / `SC-LAYOUT` / `BR_LAYERSTACK`), but decide
*inclusion* by weighting layers across the real projects (frequency = how many of
the 5 real buildings share a layer). Backbone layers with high support = core;
low-support (arena-specific) detail is dropped or generalized; high-support layers
missing from the skeleton are added. Everything normalized to the strict convention.
Weighting script: `scripts/weight_building.js`.

## 2. Data source
- Live preset library (Postgres-backed): `GET https://layers-structurecraft.up.railway.app/api/presets`
- **Always pull live from the API** before analyzing — do not trust local copies.
- Write a standard back with `PUT /api/presets/:name` body `{ "tree": [...] }`.
- Regeneration scripts live in [`standards/scripts/`](./scripts/).

## 3. Preset naming convention
`project#-projectname-TYPE-initials` (delimiter varies; dashes or underscores in practice).
- **project#** e.g. `S432`, `S509B`
- **TYPE** — `BLDG` (building), `BRIDGE`/`BR##` (bridge), `FREEFORM`/`COED` (freeform)
- **initials** — creator (e.g. `MD`, `AK`, `DE`, `SB`)

## 4. Building types (→ 3 standards)
- **building** → `SC_STANDARD_BLDG`
- **bridge** → `SC_STANDARD_BRIDGE`
- **freeform** (a.k.a. COED = Computational Design) → `SC_STANDARD_FREEFORM`

Naming convention: `SC_STANDARD_<TYPE>` — `SC_` prefix + `STANDARD` marker + the project type
token (`BLDG`/`BRIDGE`/`FREEFORM`), matching the strict layer convention and distinguishing these
master standards from project presets (`S###-NAME-TYPE-INIT`).

## 5. Locked decisions

### Naming (strict convention)
- Pattern: `SC_<MATERIAL>_<COMPONENT>_<SUBTYPE>`, **underscore-delimited**.
- `TRUSS_WEB` (not truncated `TRUSS_WE`)
- `DAP` (one P — not `DAPP`)
- `PEN` (one N — not `PENN`)
- Hyphens → underscores to match `BR_LAYERSTACK`: `PRE_DRILL`, `STRONG_BACK`, `HIDD_A…D`
- Note: established group names like `SC-LAYOUT` keep their hyphen (not renamed).

### Backbone (present on every Branch project)
- `SC-LAYOUT` (sheet/layout) and `BR_LAYERSTACK` (annotation: `USER` + `AUTO`) are constant.
- **Backbone source preset: `S432-UMT-ARENA_BLDG-MD`** (a real project) — replaced the
  earlier `SXXX-TEST-BLDG-SC` template.
- **Decision: adopt S432's real organization** (not the strict `BUILDING→L01–L05` template).
  Building top level = `SC-OBJECTS` (TIMBERS / STEEL / DAP / FASTENERS / CONNECTIONS /
  ASSEMBLIES) · `LIBRARY` · `REF` · `SC-LAYOUT` · `BR_LAYERSTACK`.

**S432 cleanup rules applied** (see `scripts/build_standards_s432.js`):
- Drop top-level `SC-REVIEW` (project review).
- `SC-OBJECTS`: drop `ONLY FOR DRAWING` (annotation copies) + `Steel Connections Option 1`.
- `SC-EXT MODELS` → renamed `REF`; drop per-building groups (`…Building/BLDG A–D`).
- `BR_LAYERSTACK › USER`: keep only `SC_ANN_*` + `SC_TEMPORARY` (removes legacy 2D drafting + junk).
- Normalize names; strip GUIDs; seed `LIBRARY → CE_LB`.
- **Bridge / Freeform**: same backbone + an empty `BRIDGE`/`FREEFORM` model frame (category
  headers) to populate as real samples arrive.

### Exclusions
- Legacy **2D drafting layers** are **excluded** from the standard — they are covered by
  `BR_LAYERSTACK`'s shop-drawing linetypes. Examples: `SC_HIDDEN`, `SC_HATCH`, `SC_TIMBER`,
  `SC_STEEL`, `SC_CONCRETE`, `SC_HARDWARE`, `SC-DRAFTING`, `SC_SCREEN`, `SC_PANEL`,
  `SC_SHEATHING`, `SC_BREAKLINE`, `SC_OBJECT-LINES`, `SC_CONSTRUCTION-LINE`, `SC_DSK_TAG`.
- Project working/junk layers excluded (dates, `Point:N`, separators like `=====GLM=====`,
  `SC-REVIEW`, temp/review layers, `Layer 01`, `Note`, etc.).

### Connection library (`LIBRARY` / CE·LB)
- `CE` = Connection Entities, `LB` = Library. Seed the standard's `LIBRARY` from a real
  project's `CE·LB` (AK's `S448`/`S483` are richest; `S432` also has one).
- Real libraries cross **region/supplier tags** (`NA`, `EU`, `SITE`, `SHOP`, `HASSLACHER`)
  with **object types** (`DAP` variants, `PLUG`, `STEEL`, `PREFAB`, `EMBED`, `LEDGER`,
  `BRACE`, `ROD`, `NUT/WASHER`, `SHIM`). Current seed is a FIRST DRAFT to curate.

### Delivery
- Standards written to the DB as `SC_STANDARD_BLDG` / `SC_STANDARD_BRIDGE` / `SC_STANDARD_FREEFORM`
  (additive; existing project presets untouched).
- Backup bundle: [`standards/STANDARD_presets_import.json`](./STANDARD_presets_import.json)
  (import via the app's ⤒ Import).

## 6. Data inventory (as reviewed)
8 usable presets:
| Type | Presets |
|---|---|
| building | S432-UMT-ARENA_BLDG-MD, S448_T3FAT-BLDG-AK, S456-PEEL-BLDG-DE, S483-RABENSTAINER-BLDG-AK, S494-POWDER-BLDG-AK, SXXX-TEST-BLDG-SC (template) |
| bridge | S509B-VCT-BRIDGE-DE |
| freeform | S463-BAND_SHELL-FREEFORM-SB |

⚠️ **Data imbalance:** many buildings, but only **1 bridge** and **1 freeform** — those two
standards are single-sample starting points until more projects exist.

## 7. Clarification Q&A log

**Acronyms**
- `BR` = **Branch** (in-house software). `BR_LAYERSTACK` = auto annotation stack, on all projects.
  *(Note: `BR16` in a project name means Bridge — different use of "BR".)*
- `CE` = **Connection Entities** — the connection library; model sample connection nodes then
  apply across models. Formerly "block"/"collection" library.
- `LB` = **Library** (the connection library above).
- `DAP` = a dap/notch — Branch cutting object that removes material.
- `PEN` = **penetration** — a dap that passes through the timber (e.g. holes in DLT decking).
- `BLK` = **blocking**.
- `LP` = lifting points · `NA` = North America · `EU` = Europe · `SCB` = StructureCraft Builders.
- `DETL` = detail · `FLOR` = floor (assumed) · `SH` = shop (assumed).
- `SC` = StructureCraft.

**Decisions**
- #1 Backbone `BR_LAYERSTACK` + `SC-LAYOUT` are identical on all Branch projects. ✔
- #2/#3 Naming: `DAP` (1 P), `PEN` (1 N). ✔
- #4 Use underscores matching `BR_LAYERSTACK`. ✔
- 2D drafting layers → excluded (covered by `BR_LAYERSTACK`). ✔
- LIBRARY seeded from MD/AK connection library. ✔
- Bridge & freeform use a typical building preset as their backbone. ✔
- Arena (`S432`) counts as a **building**. ✔
- Backbone changed from `SXXX-TEST-BLDG-SC` → `S432-UMT-ARENA_BLDG-MD`. ✔ *(scope TBD)*

## 8. Open items / TODO
- Curate `LIBRARY / CE_LB` into the real region/supplier × object-type structure (from AK's `CE·LB`).
- `SC-OBJECTS` still carries some arena-specific detail (e.g. specific `DAP_TIMBER` locations like
  `GABLE COLUMN`, `WIND GIRTS`) — generalize into standard categories over time.
- Populate the `BRIDGE` / `FREEFORM` model frames as real bridge/freeform samples arrive.
- Confirm assumed acronyms: `SH` (shop?), `FLOR` (floor?); fix `HASSALCHER` → `HASSLACHER`.

## 8b. Base-map principles (team feedback)
- The standard is a **lean base map** everyone follows *to some extent* — not an exhaustive system.
  Always-present top level: `SC-OBJECTS · SC-GRIDLINES · SC-REVIEW · REF · SC-LAYOUT · BR_LAYERSTACK`.
- **Less is more** — few, clear, foldable groups; sized to TYP SC projects (multi-story mass-timber / DLT).
- **Material-first** under `SC-OBJECTS`: `TIMBER` umbrella → `GLM`/`CLT`/`DLT`/`BLK` (BLK = timber block); `STEEL` umbrella.
- **`SC_` prefix only on leaf layers**; group folders read plainly (`TIMBER`, `STEEL`, `GLM`…). Top-level backbone keeps `SC-` (hyphen).
- **`LIBRARY` (CE connection library) lives inside `SC-OBJECTS`**, not top level; no duplicating steel members.
- **No `LIBRARY` wrapper around `CE_LB`** — collapsed to just `CE_LB` sitting alongside `TIMBER`/`STEEL`
  (redundant: "Library" + "…Library" said twice; `CE_LB` is self-explanatory and matches the acronym glossary).
- **`BR_LAYERSTACK` kept** in the template (Branch-generated, but adds context).
- **`SC-REVIEW`** added for 3D model review markup.
- `TIMBER` preferred over `GLM` as the umbrella (generic), with product subgroups beneath.
- No render materials in the layer spec (handle via a template `.3dm` if ever needed).
- Export notes: AutoCAD flattens nesting as `Layer$Sub$Sub…` (never use `$` in names; keep depth purposeful);
  Revit only uses layers as Rhino.Inside import filters.
- Still TODO: give `SC-LAYOUT` layers full drafting props (linetype + print width + print color, not just display color).
- `SC-GRIDLINES`: `NS`/`EW` = North–South / East–West gridlines; base map keeps a single `GL-PLAN`.

## 8c. Follow-up items from feedback discussion
- **Traced `BLK` origin:** only appears in `SXXX-TEST-BLDG-SC` (the assumed template, mirroring the
  Notion `BR_LAYERSTACK::Model` fab standard) — no real project preset uses the `BLK` abbreviation.
  Real projects treat blocking as **timber**: MD/S432 `TIMBERS > GL_BLOCK`, AK/S483
  `GLULAM > BLOCKING` — confirms nesting `BLK` under `TIMBER`. Caution: "block/blocks" is
  **overloaded** in the source data — it also means the old name for the connection library
  (`---BLOCKS---(NOW KNOWN AS CONNECTIONS)`, `INFILL BLOCKS`, `CE BLOCKS`). Keep `BLK` strictly for
  timber blocking; don't reuse "block" for connections in the standard.
- **`REF` naming — open:** considered `XREF` (external reference, CAD-standard term, sorts to
  bottom) vs `OTHER-REF` vs keeping `REF`. Leaning `XREF` if renamed; not yet applied — pending decision.
- **Collapsed `LIBRARY` wrapper → just `CE_LB`** (see §8b) for **building** and **freeform**
  (`scripts/collapse_library.js`): `LIBRARY` only ever wrapped a single child (`CE_LB`), so the
  wrapper added a click with no information. **Bridge is NOT collapsed** — its `LIBRARY` holds 7
  children (`CE_LB`, `CE_BRIDGE_SEGMENT` (singular — collides with the top-level plural
  `CE_BRIDGE_SEGMENTS`), `CE_CONNECTIONS` (literal name collision with the top-level
  `CE_CONNECTIONS`), `GRID`, `LINEWORK`, `REF_OBJECTS`, `TEXT` — leftover reference/drafting-support
  layers from S509B's own `LB` group, not connection-entity content). Needs a decision on where
  `GRID`/`LINEWORK`/`REF_OBJECTS`/`TEXT` go (candidates: `GRID`→`SC-GRIDLINES`,
  rest→`REF`/dropped) and to de-dupe the two `CE_BRIDGE_SEGMENT(S)`/`CE_CONNECTIONS` pairs before
  bridge's `LIBRARY` can be collapsed the same way.

## 9. Changelog
- v1 — Reviewed 8 presets; built acronym glossary; generated `STANDARD_building/bridge/freeform`
  from the `SXXX` template (normalized).
- v2 — Switched backbone to `S432-UMT-ARENA_BLDG-MD` and adopted its real organization; rebuilt
  all three standards with the cleanup rules above and wrote them to the DB
  (`scripts/build_standards_s432.js`, verified by `scripts/verify_standards.js`).
- v3 — Weighted the S432 skeleton across the 5 real buildings (`scripts/weight_building.js`):
  found ~100/176 layers were arena-specific (1/5) and the CE_LB seed matched nothing real.
  Applied **option C**: rebuilt `SC-OBJECTS` to the strict `GLM/CLT/DLT/STL/BLK` fab taxonomy,
  rebuilt `LIBRARY → CE_LB` from real library names (by object type w/ region variants), folded
  in `SC-GRIDLINES`. `STANDARD_building` = 198 layers (`scripts/build_standards_weighted.js`).
- v4 — Rebuilt **bridge** and **freeform** from their own supplied presets (same clean+normalize
  process; n=1 so no weighting). `scripts/build_bridge_freeform.js`:
  - **Bridge** (from `S509B-VCT-BRIDGE-DE`, 95 layers): kept its real org `CE_BRIDGE_SEGMENTS` /
    `CE_CONNECTIONS` / `LB` (own library) / `SC-LAYOUT` / `BR_LAYERSTACK`; dropped `--- APPLIED ---`,
    `X ---`, `Z -`, grout-tube dwgs, glulam-billets, grid-file refs, and `DELETE`/`KEEP`/`refernce` junk.
  - **Freeform** (from `S463-BAND_SHELL-FREEFORM-SB`, 115 layers): dropped `IMPORTED` (57 `Point:*`
    + Revit refs); distilled the bespoke band-shell model to category headers (BILLET/LATH/RING_BEAM/
    STEEL/SHELL/PLINTH/SCREWS/RIGGING/CUTTERS/JIG); kept grid + shared `LIBRARY/CE_LB` + `SC-LAYOUT` +
    canonical `BR_LAYERSTACK`.
  - Building left untouched (198). Bridge uses its own `LB` library; building/freeform use `LIBRARY/CE_LB`.
- v5 — Integrated the **S448 connection-library color legend** into all three standards
  (`scripts/apply_ce_colors.js`): rebuilt `CE_LB` with 8 color-coded connection-entity layers
  (`CE_STEEL_EU`/`NA_SITE`/`NA_SHOP`, `CE_FASTENER_EU`/`NA_SITE`, `CE_EMBED_NA`, `CE_RUBBER_NA`,
  `CE_SHIM_NA`) — see the color table in `Layer_Naming_Acronyms.md`. Bridge's colored `CE_LB`
  was added inside its own `LB` group. Colors verified on the live API (`scripts/verify_colors.js`).
  Colors currently cover the connection library only — model layers keep their existing colors.
- v6 — Applied the **SC Colour Palette** (material/object colors) to model member layers that had
  no color assigned (`scripts/apply_object_colors.js`): Glulam `#F3BA5C`, Steel `#696969`,
  DLT/CLT panels `#FFD072`. Building +24 layers, freeform +4. Bridge's model layers already carried
  colors from S509B (not unassigned) so they were left untouched. The S448 connection-library
  colors were preserved (verified `scripts/verify_colors.js`). Rule: only recolor layers whose
  color was `#000000`, scoped to `SC-OBJECTS` / `CE_BRIDGE_SEGMENTS` (never `CE_LB`).
- v9 — Traced `BLK` origin (template-only, mirrors real projects' timber blocking) and collapsed
  the redundant `LIBRARY` wrapper to just `CE_LB` for building/freeform in the `_260720` stacks
  (see §8c). Bridge's `LIBRARY` left as-is pending a decision on its extra reference layers.
- v8 — Base-map revision from team feedback (see §8b). Built dated standards
  `SC_STANDARD_{BLDG,BRIDGE,FREEFORM}_260720` (`scripts/build_basemap_260720.js`): material-first
  `SC-OBJECTS` (`TIMBER`→GLM/CLT/DLT/BLK, `STEEL`, `LIBRARY` moved in), `SC-REVIEW` added,
  gridlines reduced to `GL-PLAN` (NS/EW removed), `SC_` only on leaf layers, colors preserved,
  `BR_LAYERSTACK` kept. Undated `SC_STANDARD_*` left in place. Bridge/freeform conform to the
  base-map top level with their model content preserved (their internal material grouping is a later pass).
- v7 — Renamed the three standards to the `SC_STANDARD_<TYPE>` convention
  (`STANDARD_building/bridge/freeform` → `SC_STANDARD_BLDG/BRIDGE/FREEFORM`) via
  `scripts/rename_standards.js`; repointed the startup default (`SC_STANDARD_BLDG`) and deleted
  the old names. Trees/colors preserved.
