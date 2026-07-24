"use strict";
// Fill ONLY the object types whose object type (branch_key) is currently blank,
// deriving a guess from the layer name (Branch class OR native Rhino type) via the
// shared glossary. Rows that already have a type are left completely untouched, so
// hand-curated entries are safe. Also fills blank material/origin for the same rows.
//
// Dry-run by default; pass --apply to write.
// Usage: node fill_blank_types.js [targetBase] [--apply]   (default http://localhost:3000)
const path = require("path");
const { guessBranchMatch, guessMaterial, guessOrigin } =
  require(path.join(__dirname, "..", "..", "public", "layer-humanize.js"));

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const TARGET = args.find(a => !a.startsWith("--")) || "http://localhost:3000";

(async function () {
  const { types } = await (await fetch(`${TARGET}/api/object-types`)).json();
  if (!Array.isArray(types)) { console.error("Unexpected /api/object-types response"); process.exit(1); }

  const blanks = types.filter(t => !t.branch_key);
  const changes = [];
  for (const t of blanks) {
    const bm = guessBranchMatch(t.home_layer || "");
    if (!bm.branch_key) continue; // still no confident guess -> leave blank
    changes.push({
      t,
      branch_key: bm.branch_key,
      branch_prefix: bm.branch_prefix || "",
      material: t.material || guessMaterial(t.home_layer || ""),   // only fill if blank
      origin: t.origin || guessOrigin(t.home_layer || ""),
    });
  }

  console.log(`${types.length} rows; ${blanks.length} blank; ${changes.length} can be filled:\n`);
  for (const c of changes) {
    const native = ["Text", "Text Dot", "Curve", "Point", "Hatch", "Dimension", "Leader", "Block"].includes(c.branch_key);
    console.log(`  ${String(c.t.home_layer || "").padEnd(24)} -> ${c.branch_key}${c.branch_prefix ? "/" + c.branch_prefix : ""}${native ? "  (native)" : ""}`);
  }
  console.log(`\n(${blanks.length - changes.length} blank rows have no confident guess and stay blank.)`);

  if (!APPLY) { console.log(`\nDry run. Re-run with --apply to write these ${changes.length} update(s) to ${TARGET}.`); return; }

  let ok = 0, fail = 0;
  for (const c of changes) {
    const body = {
      id: c.t.id, name: c.t.name, home_layer: c.t.home_layer,
      branch_key: c.branch_key, branch_prefix: c.branch_prefix,
      material: c.material || "", origin: c.origin || "",
      description: c.t.description || "",
    };
    const r = await fetch(`${TARGET}/api/object-types/${encodeURIComponent(c.t.id)}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (r.ok) ok++; else { fail++; console.error(`  FAILED ${c.t.id}: HTTP ${r.status}`); }
  }
  console.log(`\nApplied: ${ok} filled, ${fail} failed on ${TARGET}.`);
})();
