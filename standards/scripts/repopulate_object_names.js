"use strict";
// Re-derive NAME + BRANCH MATCH (branch_key class + branch_prefix) for existing
// catalog rows from their home_layer, using the shared glossary (public/layer-humanize.js).
// Preserves id, home_layer, and description (notes).
//
// Dry-run by default (prints the before/after diff, changes nothing).
// Pass --apply to actually write the updates.
//
// Usage:
//   node repopulate_object_names.js [targetBase] [--apply]
//   (default target = http://localhost:3000)
const path = require("path");
const { humanizeLayer, guessBranchMatch, guessMaterial } = require(path.join(__dirname, "..", "..", "public", "layer-humanize.js"));

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const TARGET = args.find(a => !a.startsWith("--")) || "http://localhost:3000";

const sig = t => `${t.branch_key || ""}${t.branch_prefix ? "/" + t.branch_prefix : ""}`;

(async function () {
  const { types } = await (await fetch(`${TARGET}/api/object-types`)).json();
  if (!Array.isArray(types)) { console.error("Unexpected response from /api/object-types"); process.exit(1); }

  const changes = [];
  for (const t of types) {
    const layer = t.home_layer || "";
    const newName = humanizeLayer(layer) || t.name;
    const bm = guessBranchMatch(layer);
    const newMat = guessMaterial(layer);
    const nameChanged = newName && newName !== t.name;
    const matchChanged = (bm.branch_key || "") !== (t.branch_key || "") ||
                         (bm.branch_prefix || "") !== (t.branch_prefix || "");
    const matChanged = (newMat || "") !== (t.material || "");
    if (nameChanged || matchChanged || matChanged) changes.push({ t, newName, bm, newMat, nameChanged, matchChanged, matChanged });
  }

  console.log(`${types.length} object types; ${changes.length} would change.\n`);
  for (const c of changes) {
    const nm = c.nameChanged ? `"${c.t.name}" -> "${c.newName}"` : `(name "${c.t.name}")`;
    const before = sig(c.t) || "-";
    const after = `${c.bm.branch_key || "?"}${c.bm.branch_prefix ? "/" + c.bm.branch_prefix : ""}`;
    const mt = c.matchChanged ? `match [${before}] -> [${after}]` : "";
    const ml = c.matChanged ? `mat [${c.t.material || "-"}] -> [${c.newMat || "-"}]` : "";
    console.log(`  ${String(c.t.home_layer || "").padEnd(28)} ${nm}  ${mt} ${ml}`.trimEnd());
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
      home_layer: c.t.home_layer,
      branch_key: c.bm.branch_key || "",
      branch_prefix: c.bm.branch_prefix || "",
      material: c.newMat || "",
      description: c.t.description || "",
    };
    const r = await fetch(`${TARGET}/api/object-types/${encodeURIComponent(c.t.id)}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    if (r.ok) ok++; else { fail++; console.error(`  FAILED ${c.t.id}: HTTP ${r.status}`); }
  }
  console.log(`\nApplied: ${ok} updated, ${fail} failed on ${TARGET}.`);
})();
