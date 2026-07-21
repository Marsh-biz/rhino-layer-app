"use strict";
// Derive the object-type catalog from the standards' SC-OBJECTS leaves.
// Reads standards from SRC (live Railway), writes the catalog to TARGET.
// Usage: node seed_object_types.js [targetBase]   (default target = http://localhost:3000)
const SRC = process.env.SRC || "https://layers-structurecraft.up.railway.app";
const TARGET = process.argv[2] || "http://localhost:3000";

// Prefer the dated base-map standards; fall back to the plain ones.
const STANDARDS = [
  ["SC_STANDARD_BLDG_260720", "SC_STANDARD_BLDG"],
  ["SC_STANDARD_BRIDGE_260720", "SC_STANDARD_BRIDGE"],
  ["SC_STANDARD_FREEFORM_260720", "SC_STANDARD_FREEFORM"],
];

const MAP = {
  GLM:"Glulam", STL:"Steel", CLT:"CLT", DLT:"DLT", BLK:"Blocking", TIMBER:"Timber", STEEL:"Steel",
  BEAM:"Beam", COLUMN:"Column", POST:"Post", WALL:"Wall", PANEL:"Panel", BILLET:"Billet",
  PLATE:"Plate", BASE:"Base", BENT:"Bent", HANGER:"Hanger", KNIFE:"Knife", Z:"Z", ROD:"Rod", ANGLE:"Angle",
  TRUSS:"Truss", TOPCHORD:"Top Chord", BOTCHORD:"Bottom Chord", WEB:"Web",
  DAP:"Dap", PEN:"Penetration", CHASE:"Chase", OPENING:"Opening", CUTTING:"Cutting", PRE:"Pre", DRILL:"Drill",
  FAST:"Fasteners", FASTENER:"Fastener", CONN:"Connection", BEARING:"Bearing", STRONG:"Strong", BACK:"Back",
  EMBED:"Embed", RUBBER:"Rubber", SHIM:"Shim", PLUG:"Plug", PREFAB:"Prefab", LEDGER:"Ledger", BRACE:"Brace", SPACER:"Spacer",
  EU:"EU", NA:"NA", SITE:"Site", SHOP:"Shop", WASHER:"Washer", NUT:"Nut",
  DECK:"Deck", GUARDRAIL:"Guardrail", SILL:"Sill", FLASHING:"Flashing", PLYWOOD:"Plywood", EXISTING:"Existing",
  LATH:"Lath", RING:"Ring", SHELL:"Shell", PLINTH:"Plinth", SCREWS:"Screws", RIGGING:"Rigging", CUTTERS:"Cutters", JIG:"Jig",
};
function humanize(layer){
  const raw = layer.replace(/^SC_/, "").replace(/^CE_/, "");
  const toks = raw.split(/[_\-\s]+/).filter(t => t && t.toUpperCase() !== "TOOL");
  return toks.map(t => MAP[t.toUpperCase()] || (t.charAt(0) + t.slice(1).toLowerCase())).join(" ") || layer;
}
function category(layer){
  const n = layer.toUpperCase();
  if (/TOOL|DAP|PEN|CHASE|OPENING|CUTTING|DRILL/.test(n)) return "Machining";
  if (n.startsWith("CE_") || /CONN|FASTENER/.test(n)) return "Connection";
  if (/(^|_)GLM(_|$)/.test(n)) return "Glulam";
  if (/(^|_)STL(_|$)|STEEL/.test(n)) return "Steel";
  if (/(^|_)CLT(_|$)/.test(n)) return "CLT";
  if (/(^|_)DLT(_|$)/.test(n)) return "DLT";
  if (/(^|_)BLK(_|$)/.test(n)) return "Blocking";
  return "Other";
}
const slug = s => "ot_" + s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

(async function(){
  const P = (await (await fetch(`${SRC}/api/presets`)).json()).presets;
  const seen = new Set();      // home_layer names already added (dedupe across standards)
  const types = [];
  function leaves(node){
    for (const c of (node.children || [])) {
      if (c.children && c.children.length) leaves(c);
      else if (!seen.has(c.name)) {
        seen.add(c.name);
        types.push({
          id: slug(c.name),
          name: humanize(c.name),
          category: category(c.name),
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

  types.sort((a,b) => a.home_layer.localeCompare(b.home_layer));
  console.log(`Derived ${types.length} object types from SC-OBJECTS leaves. Sample:`);
  types.slice(0, 12).forEach(t => console.log(`  ${t.home_layer.padEnd(26)} -> ${t.name}  [${t.category}]`));

  const r = await fetch(`${TARGET}/api/object-types/import`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ replace: true, types })
  });
  console.log(`\nPOST ${TARGET}/api/object-types/import -> HTTP ${r.status}`, await r.text());
})();
