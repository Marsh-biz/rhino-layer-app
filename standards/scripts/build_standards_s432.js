"use strict";
const fs = require("fs");
const API = "https://layers-structurecraft.up.railway.app";
const BACKBONE = "S432-UMT-ARENA_BLDG-MD";

function normalizeName(n){
  let s = String(n);
  s = s.replace(/PENN/g,"PEN").replace(/DAPP/g,"DAP").replace(/TRUSS_WE$/g,"TRUSS_WEB");
  s = s.replace(/HIDD-([A-D])/g,"HIDD_$1").replace(/PRE-DRILL/g,"PRE_DRILL").replace(/STRONG-BACK/g,"STRONG_BACK");
  return s;
}
function node(name, children){
  return { name, color:"#000000", linetype:"Continuous", printWidth:"Default", expanded:true, guid:null, rhino:null, children:children||[] };
}
// clone + normalize + strip GUIDs, dropping children that match `drop(child)`
function build(n, drop){
  const kids = (n.children||[]).filter(c => !(drop && drop(c))).map(c => build(c, drop));
  return { name:normalizeName(n.name), color:n.color||"#000000", linetype:n.linetype||"Continuous",
           printWidth:n.printWidth||"Default", expanded:n.expanded!==false, guid:null, rhino:null, children:kids };
}
const deep = o => JSON.parse(JSON.stringify(o));
function ceLibrary(){
  const items=["CE_DAP","CE_FASTENERS","CE_PLUG","CE_STEEL","CE_PREFAB","CE_EMBED","CE_LEDGER","CE_BRACE","CE_ROD","CE_NUT_WASHER","CE_SHIM"];
  return [ node("CE_LB", items.map(x=>node(x))) ];
}
const countAll = nodes => nodes.reduce((n,c)=>n+1+(c.children?countAll(c.children):0),0);

(async function(){
  const presets = (await (await fetch(`${API}/api/presets`)).json()).presets;
  const src = presets[BACKBONE];
  if(!src){ console.error("backbone not found"); process.exit(1); }
  const find = name => src.find(n=>n.name===name);

  // SC-OBJECTS: drop annotation copies + project-option
  const scObjects = build(find("SC-OBJECTS"),
    c => /^ONLY FOR DRAWING$/i.test(c.name) || /Steel Connections Option/i.test(c.name));

  // SC-EXT MODELS -> REF: drop per-building reference groups
  const refNode = build(find("SC-EXT MODELS"),
    c => /building\s+[a-d]\b|bldg\s+[a-d]\b/i.test(c.name));
  refNode.name = "REF";

  // SC-LAYOUT: as-is
  const scLayout = build(find("SC-LAYOUT"));

  // BR_LAYERSTACK: USER = SC_ANN_* + SC_TEMPORARY only; AUTO whole
  const br = find("BR_LAYERSTACK");
  const userSrc = br.children.find(x=>x.name==="USER");
  const autoSrc = br.children.find(x=>x.name==="AUTO");
  const userKids = (userSrc.children||[])
    .filter(c => { const nn=normalizeName(c.name); return /^SC_ANN_/.test(nn) || nn==="SC_TEMPORARY"; })
    .map(c => build(c));
  const brClean = node("BR_LAYERSTACK", [ node("USER", userKids), build(autoSrc) ]);

  const library = () => node("LIBRARY", ceLibrary());

  const building = [ scObjects, library(), deep(refNode), deep(scLayout), deep(brClean) ];

  // bridge / freeform: shared backbone + empty model frame (category headers)
  const modelFrame = type => node(type, ["TIMBERS","STEEL","DAP","FASTENERS","CONNECTIONS","ASSEMBLIES"].map(n=>node(n)));
  const bridge   = [ modelFrame("BRIDGE"),   library(), deep(refNode), deep(scLayout), deep(brClean) ];
  const freeform = [ modelFrame("FREEFORM"), library(), deep(refNode), deep(scLayout), deep(brClean) ];

  const out = { STANDARD_building:building, STANDARD_bridge:bridge, STANDARD_freeform:freeform };

  fs.writeFileSync(__dirname + "/../STANDARD_presets_import.json", JSON.stringify({presets:out}, null, 2));

  for(const [name,tree] of Object.entries(out)){
    console.log(`\n# ${name}  (${countAll(tree)} layers)`);
    tree.forEach(t=>console.log(`   - ${t.name}${t.children&&t.children.length?" ("+t.children.length+")":""}`));
  }
  console.log("\n--- writing to database ---");
  for(const [name,tree] of Object.entries(out)){
    const r = await fetch(`${API}/api/presets/${encodeURIComponent(name)}`,{
      method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({tree})});
    console.log(`PUT ${name} -> HTTP ${r.status}`);
  }
})();
