"use strict";
// Derive the object-type catalog from the standards' SC-OBJECTS leaves.
// Reads standards from SRC (live Railway), writes the catalog to TARGET.
// Names/categories come from the shared acronym glossary (public/layer-humanize.js).
// Usage: node seed_object_types.js [targetBase]   (default target = http://localhost:3000)
const path = require("path");
const { humanizeLayer, guessCategory } = require(path.join(__dirname, "..", "..", "public", "layer-humanize.js"));

const SRC = process.env.SRC || "https://layers-structurecraft.up.railway.app";
const TARGET = process.argv[2] || "http://localhost:3000";

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
        types.push({
          id: slug(c.name),
          name: humanizeLayer(c.name),
          category: guessCategory(c.name),
          description: "",
          home_layer: c.name,
          branch_key: null,
          is_primary: true,
        });
      }
    }
  }
  for (const names of STANDARDS) {
    const key = names.find(n => P[n]);
    if (!key) { console.log("(no standard found for", names.join("/"), ")"); continue; }
    const so = P[key].find(n => n.name === "SC-OBJECTS");
    if (so) leaves(so);
  }

  types.sort((a, b) => a.home_layer.localeCompare(b.home_layer));
  console.log(`Derived ${types.length} object types from SC-OBJECTS leaves. Sample:`);
  types.slice(0, 12).forEach(t => console.log(`  ${t.home_layer.padEnd(26)} -> ${t.name}  [${t.category}]`));

  const r = await fetch(`${TARGET}/api/object-types/import`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ replace: true, types })
  });
  console.log(`\nPOST ${TARGET}/api/object-types/import -> HTTP ${r.status}`, await r.text());
})();
