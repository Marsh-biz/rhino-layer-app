"use strict";
// Derive the object-type catalog from the standards' SC-OBJECTS leaves.
// Reads standards from SRC (live Railway), writes the catalog to TARGET.
// Name + Branch match (class + prefix) come from the shared glossary (public/layer-humanize.js).
// Usage: node seed_object_types.js [targetBase] [--dry]   (default target = http://localhost:3000)
const path = require("path");
const { humanizeLayer, guessBranchMatch, guessMaterial, guessOrigin } = require(path.join(__dirname, "..", "..", "public", "layer-humanize.js"));

const SRC = process.env.SRC || "https://layers-structurecraft.up.railway.app";
const argv = process.argv.slice(2);
// SAFETY: writing is destructive (import replace:true wipes the whole catalog,
// including any hand-edited / hand-added object types). It now requires an explicit
// --replace flag. Without it this is a dry run that changes nothing.
const REPLACE = argv.includes("--replace");
const TARGET = argv.find(a => !a.startsWith("--")) || "http://localhost:3000";

// Prefer the dated base-map standards; fall back to the plain ones.
const STANDARDS = [
  ["SC_STANDARD_BLDG_260720", "SC_STANDARD_BLDG"],
  ["SC_STANDARD_BRIDGE_260720", "SC_STANDARD_BRIDGE"],
  ["SC_STANDARD_FREEFORM_260720", "SC_STANDARD_FREEFORM"],
];

const slug = s => "ot_" + s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

(async function () {
  const P = (await (await fetch(`${SRC}/api/presets`)).json()).presets;
  const seen = new Set();      // home_layer names already added (dedupe across standards)
  const types = [];
  function leaves(node) {
    for (const c of (node.children || [])) {
      if (c.children && c.children.length) leaves(c);
      else if (!seen.has(c.name)) {
        seen.add(c.name);
        const bm = guessBranchMatch(c.name);
        types.push({
          id: slug(c.name),
          name: humanizeLayer(c.name),
          home_layer: c.name,
          branch_key: bm.branch_key,
          branch_prefix: bm.branch_prefix,
          material: guessMaterial(c.name),
          origin: guessOrigin(c.name),
          description: "",
        });
      }
    }
  }
  for (const names of STANDARDS) {
    const key = names.find(n => P[n]);
    if (!key) { console.log("(no standard found for", names.join("/"), ")"); continue; }
    // The object branch is "SC_OBJECTS" (building) or "SC-OBJECTS" (bridge/freeform).
    const so = P[key].find(n => /^SC[_\-]OBJECTS$/i.test(n.name));
    if (so) leaves(so); else console.log("  (no SC[_-]OBJECTS branch in", key, ")");
  }

  types.sort((a, b) => a.home_layer.localeCompare(b.home_layer));
  console.log(`Derived ${types.length} object types from every SC-OBJECTS leaf layer (all 3 standards, deduped by name):\n`);
  types.forEach(t => console.log(`  ${t.home_layer.padEnd(28)} -> ${(t.name || "").padEnd(24)} [${t.branch_key || "?"}${t.branch_prefix ? "/" + t.branch_prefix : ""}]${t.material ? " {" + t.material + "}" : ""}`));

  if (!REPLACE) {
    console.log(`\nDRY RUN (default) — nothing written.`);
    console.log(`This would REPLACE (delete + reinsert) all rows at ${TARGET}, destroying any`);
    console.log(`hand-edited or hand-added object types. Only run with --replace on a fresh/empty`);
    console.log(`catalog you intend to overwrite:  node seed_object_types.js ${TARGET} --replace`);
    return;
  }
  const r = await fetch(`${TARGET}/api/object-types/import`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ replace: true, types })
  });
  console.log(`\nPOST ${TARGET}/api/object-types/import -> HTTP ${r.status}`, await r.text());
})();
