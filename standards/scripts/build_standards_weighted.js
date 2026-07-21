"use strict";
const fs = require("fs");
const API = "https://layers-structurecraft.up.railway.app";

function normalizeName(n){
  let s=String(n);
  s=s.replace(/PENN/g,"PEN").replace(/DAPP/g,"DAP").replace(/TRUSS_WE$/g,"TRUSS_WEB");
  s=s.replace(/HIDD-([A-D])/g,"HIDD_$1").replace(/PRE-DRILL/g,"PRE_DRILL").replace(/STRONG-BACK/g,"STRONG_BACK");
  return s;
}
function node(name, children){ return {name, color:"#000000", linetype:"Continuous", printWidth:"Default", expanded:true, guid:null, rhino:null, children:children||[]}; }
function build(n){ return {name:normalizeName(n.name), color:n.color||"#000000", linetype:n.linetype||"Continuous", printWidth:n.printWidth||"Default", expanded:n.expanded!==false, guid:null, rhino:null, children:(n.children||[]).map(build)}; }
const deep = o => JSON.parse(JSON.stringify(o));
const countAll = nodes => nodes.reduce((n,c)=>n+1+(c.children?countAll(c.children):0),0);

// LIBRARY / CE_LB rebuilt from the real connection-library names (AK's S448/S483),
// organized by object type with region/source variants. DRAFT — review grouping.
function ceLibrary(){
  const grp = (t, subs) => node(t, (subs||[]).map(s=>node(s)));
  return [ node("CE_LB", [
    grp("CE_DAP", ["DAP","DAP_CUT","DAP_DRILL","DAP_PLANE","DAP_PANEL","DAP_GLM","DAP_DLT","DAP_STEEL"]),
    grp("CE_FASTENER", ["SITE","SHOP","NA","EU","TEMP"]),
    grp("CE_NUT_WASHER", ["SITE","SHOP"]),
    grp("CE_STEEL", ["NA","EU","SITE","SHOP","DLT"]),
    grp("CE_PLUG", ["NA","EU","SITE"]),
    grp("CE_PREFAB", ["NA","EU","SITE","SHOP"]),
    grp("CE_BRACE", ["BRACE","SPACER"]),
    grp("CE_ASSEMBLY", ["ASSEMBLY","TAG"]),
    node("CE_EMBED"), node("CE_LEDGER"), node("CE_BLOCK"), node("CE_ROD"),
    node("CE_RUBBER"), node("CE_COVER"), node("CE_SHIM"), node("CE_LAM"),
  ]) ];
}

(async function(){
  const P = (await (await fetch(`${API}/api/presets`)).json()).presets;
  const template = P["SXXX-TEST-BLDG-SC"];
  const current  = P["STANDARD_building"];   // already-cleaned REF / SC-LAYOUT / BR_LAYERSTACK
  const s448     = P["S448_T3FAT-BLDG-AK"];

  // 1) strict material taxonomy from the template's L01 (drop the L0x_ prefix)
  const l01 = template.find(n=>n.name==="BUILDING").children.find(n=>/^L0*1$/.test(n.name));
  const order = ["GLM","CLT","DLT","STL","BLK"];
  const matGroups = l01.children.map(g=>{ const t=build(g); t.name=t.name.replace(/^L0*\d+_/,""); return t; })
                       .sort((a,b)=>order.indexOf(a.name)-order.indexOf(b.name));
  const scObjects = node("SC-OBJECTS", matGroups);

  // 2) SC-GRIDLINES from a real project
  const gridSrc = s448.find(n=>/GRIDLINES/i.test(n.name));
  const gridlines = gridSrc ? build(gridSrc) : node("SC-GRIDLINES", [node("SC_GRID_LINES"),node("SC_GRID_BUBBLES")]);
  gridlines.name = "SC-GRIDLINES";

  // 3) reuse cleaned backbone from current STANDARD_building
  const ref = current.find(n=>n.name==="REF");
  const scLayout = current.find(n=>n.name==="SC-LAYOUT");
  const brLayerstack = current.find(n=>n.name==="BR_LAYERSTACK");

  const assemble = () => [
    deep(scObjects), deep(gridlines), node("LIBRARY", ceLibrary()),
    deep(ref), deep(scLayout), deep(brLayerstack)
  ];

  const out = {
    STANDARD_building: assemble(),
    STANDARD_bridge:   assemble(),   // same materials/backbone; specialize as bridge samples arrive
    STANDARD_freeform: assemble(),
  };

  fs.writeFileSync(__dirname+"/../STANDARD_presets_import.json", JSON.stringify({presets:out},null,2));
  for(const [name,tree] of Object.entries(out)){
    console.log(`\n# ${name}  (${countAll(tree)} layers)`);
    tree.forEach(t=>console.log(`   - ${t.name}${t.children&&t.children.length?" ("+t.children.length+")":""}`));
  }
  console.log("\n--- SC-OBJECTS (all standards) ---");
  scObjects.children.forEach(m=>{ console.log("  - "+m.name); m.children.forEach(l=>console.log("      · "+l.name)); });

  console.log("\n--- writing to database ---");
  for(const [name,tree] of Object.entries(out)){
    const r = await fetch(`${API}/api/presets/${encodeURIComponent(name)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({tree})});
    console.log(`PUT ${name} -> HTTP ${r.status}`);
  }
})();
