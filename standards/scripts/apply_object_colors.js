"use strict";
const fs = require("fs");
const API = "https://layers-structurecraft.up.railway.app";

const STEEL="#696969", GLULAM="#F3BA5C", PANEL="#FFD072";
// Decide a material color for a MEMBER layer, or null to leave unassigned.
function materialColor(name){
  const n = String(name).toUpperCase();
  if(/TOOL|DAP|PEN|CHASE|OPENING|CUTTING|PRE_DRILL|DRILL|FAST|CONN|SCREW|RIGGING|CUTTER|JIG/.test(n)) return null; // ops/hardware
  if(/STEEL|(^|_)STL(_|$)|STRONG_BACK/.test(n)) return STEEL;
  if(/(^|_)GLM(_|$)|GLULAM|BILLET|RING_BEAM|(^|_)LATH(_|$)/.test(n)) return GLULAM;
  if(/(^|_)CLT(_|$)|(^|_)DLT(_|$)/.test(n)) return /WALL/.test(n) ? null : PANEL; // wall dark has no hex yet
  return null;
}

(async function(){
  const P = (await (await fetch(`${API}/api/presets`)).json()).presets;
  const report = {};

  function recolor(container, label){
    const changes = [];
    (function walk(nodes){
      for(const c of nodes){
        const cur = (c.color||"#000000").toUpperCase();
        if(cur === "#000000"){                       // only unassigned
          const col = materialColor(c.name);
          if(col){ c.color = col; changes.push(`${c.name} -> ${col}`); }
        }
        if(c.children) walk(c.children);
      }
    })(container.children||[]);
    report[label] = changes;
  }

  const building = P["STANDARD_building"];
  const bridge   = P["STANDARD_bridge"];
  const freeform = P["STANDARD_freeform"];

  recolor(building.find(n=>n.name==="SC-OBJECTS"), "building/SC-OBJECTS");
  recolor(freeform.find(n=>n.name==="SC-OBJECTS"), "freeform/SC-OBJECTS");
  recolor(bridge.find(n=>n.name==="CE_BRIDGE_SEGMENTS"), "bridge/CE_BRIDGE_SEGMENTS");

  const out = { STANDARD_building:building, STANDARD_bridge:bridge, STANDARD_freeform:freeform };
  fs.writeFileSync(__dirname+"/../STANDARD_presets_import.json", JSON.stringify({presets:out},null,2));

  for(const [k,v] of Object.entries(report)){
    console.log(`\n# ${k} — ${v.length} layers colored`);
    v.forEach(x=>console.log("   "+x));
  }
  console.log("\n--- writing to database ---");
  for(const [name,tree] of Object.entries(out)){
    const r = await fetch(`${API}/api/presets/${encodeURIComponent(name)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({tree})});
    console.log(`PUT ${name} -> HTTP ${r.status}`);
  }
})();
