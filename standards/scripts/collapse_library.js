"use strict";
const fs=require("fs");
const API="https://layers-structurecraft.up.railway.app";

(async function(){
  const P=(await (await fetch(`${API}/api/presets`)).json()).presets;

  // Collapse LIBRARY -> CE_LB for building + freeform (clean 1:1 case only).
  const targets=["SC_STANDARD_BLDG_260720","SC_STANDARD_FREEFORM_260720"];
  const out={};
  for(const t of targets){
    const tree=P[t];
    const so=tree.find(n=>n.name==="SC-OBJECTS");
    const idx=so.children.findIndex(n=>n.name==="LIBRARY");
    const ceLb=so.children[idx].children.find(c=>c.name==="CE_LB");
    so.children.splice(idx,1,ceLb); // replace LIBRARY wrapper with its CE_LB child directly
    out[t]=tree;
  }

  console.log("--- writing to database ---");
  for(const [name,tree] of Object.entries(out)){
    const r=await fetch(`${API}/api/presets/${encodeURIComponent(name)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({tree})});
    const so=tree.find(n=>n.name==="SC-OBJECTS");
    console.log(`PUT ${name} -> HTTP ${r.status}   SC-OBJECTS > [${so.children.map(c=>c.name).join(", ")}]`);
  }

  // refresh the dated bundle file for the two collapsed presets
  const bundlePath = __dirname+"/../STANDARD_presets_260720.json";
  const bundle = JSON.parse(fs.readFileSync(bundlePath,"utf8"));
  for(const [name,tree] of Object.entries(out)) bundle.presets[name]=tree;
  fs.writeFileSync(bundlePath, JSON.stringify(bundle,null,2));
  console.log("\n(bridge left untouched — LIBRARY has 7 children there, needs a decision)");
})();
