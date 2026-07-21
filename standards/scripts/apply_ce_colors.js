"use strict";
const fs = require("fs");
const API = "https://layers-structurecraft.up.railway.app";

const C = { BLUE:"#0080FF", GREEN:"#00D084", DKBLUE:"#004080", CYAN:"#80FFFF",
            LTGREEN:"#80FF80", GREY:"#C0C0C0", PURPLE:"#9C27B0", YELLOW:"#FFFF80" };
function node(name, color, children){
  return { name, color:color||"#000000", linetype:"Continuous", printWidth:"Default",
           expanded:true, guid:null, rhino:null, children:children||[] };
}
// The standardized, color-coded connection-entity library (S448 color legend).
function coloredCE_LB(){
  return node("CE_LB", null, [
    node("CE_STEEL", null, [
      node("CE_STEEL_EU",      C.BLUE),   // EU steel, installed by Hasslacher
      node("CE_STEEL_NA_SITE", C.GREEN),  // NA steel, installed on site
      node("CE_STEEL_NA_SHOP", C.DKBLUE), // NA steel, installed in Abby shop
    ]),
    node("CE_FASTENER", null, [
      node("CE_FASTENER_EU",      C.CYAN),    // EU fasteners, installed by Hasslacher
      node("CE_FASTENER_NA_SITE", C.LTGREEN), // NA fastener, installed on site
    ]),
    node("CE_EMBED_NA",  C.GREY),   // NA embeds, installed on site by others
    node("CE_RUBBER_NA", C.PURPLE), // NA rubber, installed on site
    node("CE_SHIM_NA",   C.YELLOW), // NA plastic shim, installed on site
    // uncolored object-type categories retained from the library draft
    node("CE_DAP", null, ["DAP","DAP_CUT","DAP_DRILL","DAP_PLANE","DAP_PANEL","DAP_GLM","DAP_DLT","DAP_STEEL"].map(n=>node(n))),
    node("CE_PLUG"), node("CE_PREFAB"), node("CE_NUT_WASHER"), node("CE_BRACE"),
    node("CE_LEDGER"), node("CE_BLOCK"), node("CE_ROD"), node("CE_COVER"), node("CE_LAM"), node("CE_ASSEMBLY"),
  ]);
}
const countAll = nodes => nodes.reduce((n,c)=>n+1+(c.children?countAll(c.children):0),0);

(async function(){
  const P = (await (await fetch(`${API}/api/presets`)).json()).presets;
  const building = P["STANDARD_building"], bridge = P["STANDARD_bridge"], freeform = P["STANDARD_freeform"];

  // building + freeform: replace LIBRARY > CE_LB with the colored set
  for(const tree of [building, freeform]){
    const lib = tree.find(n=>n.name==="LIBRARY");
    lib.children = [ coloredCE_LB() ];
  }
  // bridge: add the colored CE_LB into its own LB library
  const lb = bridge.find(n=>n.name==="LB");
  lb.children = lb.children.filter(c=>c.name!=="CE_LB");
  lb.children.unshift(coloredCE_LB());

  const out = { STANDARD_building:building, STANDARD_bridge:bridge, STANDARD_freeform:freeform };

  // refresh import bundle
  const bundlePath = __dirname+"/../STANDARD_presets_import.json";
  fs.writeFileSync(bundlePath, JSON.stringify({presets:out}, null, 2));

  console.log("--- writing to database ---");
  for(const [name,tree] of Object.entries(out)){
    const r = await fetch(`${API}/api/presets/${encodeURIComponent(name)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({tree})});
    console.log(`PUT ${name} -> HTTP ${r.status}  (${countAll(tree)} layers)`);
  }
})();
