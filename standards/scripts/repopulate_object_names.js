"use strict";
// Re-derive object-type NAME + CATEGORY for existing catalog rows from their
// home_layer, using the shared acronym glossary (public/layer-humanize.js).
// Preserves id, home_layer, branch_key, description, and is_primary.
//
// Dry-run by default (prints the before/after diff, changes nothing).
// Pass --apply to actually write the updates.
//
// Usage:
//   node repopulate_object_names.js [targetBase] [--apply]
//   (default target = http://localhost:3000)
const path = require("path");
const { humanizeLayer, guessCategory } = require(path.join(__dirname, "..", "..", "public", "layer-humanize.js"));

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const TARGET = args.find(a => !a.startsWith("--")) || "http://localhost:3000";

(async function () {
  const { types } = await (await fetch(`${TARGET}/api/object-types`)).json();
  if (!Array.isArray(types)) { console.error("Unexpected response from /api/object-types"); process.exit(1); }

  const changes = [];
  for (const t of types) {
    const layer = t.home_layer || "";
    const newName = humanizeLayer(layer) || t.name;
    const newCat = guessCategory(layer);
    const nameChanged = newName && newName !== t.name;
    const catChanged = newCat && newCat !== t.category;
    if (nameChanged || catChanged) {
      changes.push({ t, newName, newCat, nameChanged, catChanged });
    }
  }

  console.log(`${types.length} object types; ${changes.length} would change.\n`);
  for (const c of changes) {
    const nm = c.nameChanged ? `"${c.t.name}" -> "${c.newName}"` : `(name kept "${c.t.name}")`;
    const ct = c.catChanged ? `[${c.t.category || "-"}] -> [${c.newCat}]` : "";
    console.log(`  ${String(c.t.home_layer || "").padEnd(26)} ${nm}  ${ct}`);
  }

  if (!APPLY) {
    console.log(`\nDry run only. Re-run with --apply to write these ${changes.length} update(s) to ${TARGET}.`);
    return;
  }

  let ok = 0, fail = 0;
  for (const c of changes) {
    const body = {
      id: c.t.id,
      name: c.newName,
      category: c.newCat,
      description: c.t.description || "",
      home_layer: c.t.home_layer,
      branch_key: c.t.branch_key || "",
      is_primary: !!c.t.is_primary,
    };
    const r = await fetch(`${TARGET}/api/object-types/${encodeURIComponent(c.t.id)}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    if (r.ok) ok++; else { fail++; console.error(`  FAILED ${c.t.id}: HTTP ${r.status}`); }
  }
  console.log(`\nApplied: ${ok} updated, ${fail} failed on ${TARGET}.`);
})();
