"use strict";
const fs = require("fs");
const API = "https://layers-structurecraft.up.railway.app";
const MAP = {
  "STANDARD_building": "SC_STANDARD_BLDG",
  "STANDARD_bridge":   "SC_STANDARD_BRIDGE",
  "STANDARD_freeform": "SC_STANDARD_FREEFORM",
};

async function put(name, tree){
  const r = await fetch(`${API}/api/presets/${encodeURIComponent(name)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({tree})});
  return r.status;
}
async function del(name){ const r = await fetch(`${API}/api/presets/${encodeURIComponent(name)}`,{method:"DELETE"}); return r.status; }

(async function(){
  const P = (await (await fetch(`${API}/api/presets`)).json()).presets;
  const def = (await (await fetch(`${API}/api/default-preset`)).json()).name;

  // 1) create new names with the existing trees
  for(const [oldN,newN] of Object.entries(MAP)){
    if(!P[oldN]){ console.log(`skip ${oldN} (not found)`); continue; }
    console.log(`PUT ${newN} <- ${oldN}: HTTP ${await put(newN, P[oldN])}`);
  }
  // 2) repoint default BEFORE deleting old (server clears default on matching delete)
  if(def && MAP[def]){
    const r = await fetch(`${API}/api/default-preset`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:MAP[def]})});
    console.log(`default-preset ${def} -> ${MAP[def]}: HTTP ${r.status}`);
  } else {
    console.log(`default-preset unchanged (currently: ${def||"none"})`);
  }
  // 3) delete old names
  for(const oldN of Object.keys(MAP)){ if(P[oldN]) console.log(`DELETE ${oldN}: HTTP ${await del(oldN)}`); }

  // 4) refresh the import bundle with new keys
  const bundlePath = __dirname+"/../STANDARD_presets_import.json";
  const bundle = JSON.parse(fs.readFileSync(bundlePath,"utf8"));
  const np = {};
  for(const [oldN,newN] of Object.entries(MAP)){ if(bundle.presets[oldN]) np[newN]=bundle.presets[oldN]; }
  bundle.presets = np;
  fs.writeFileSync(bundlePath, JSON.stringify(bundle,null,2));

  // 5) verify
  const after = Object.keys((await (await fetch(`${API}/api/presets`)).json()).presets);
  console.log("\nPresets now on server:", after.join(", "));
})();
