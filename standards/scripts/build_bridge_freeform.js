"use strict";
const fs = require("fs");
const API = "https://layers-structurecraft.up.railway.app";

function norm(n){
  let s=String(n);
  s=s.replace(/^[\s=_\-]+|[\s=_\-]+$/g,"");        // strip decorative ends
  s=s.replace(/PENN/g,"PEN").replace(/DAPP/g,"DAP");
  s=s.replace(/HIDD-([A-D])/g,"HIDD_$1");
  s=s.replace(/\s+/g,"_").replace(/_+/g,"_");        // spaces -> underscores
  return s;
}
function node(name, children){ return {name, color:"#000000", linetype:"Continuous", printWidth:"Default", expanded:true, guid:null, rhino:null, children:children||[]}; }
function clean(n, drop){
  const kids=(n.children||[]).filter(c=>!(drop&&drop(c))).map(c=>clean(c,drop));
  return {name:norm(n.name), color:n.color||"#000000", linetype:n.linetype||"Continuous", printWidth:n.printWidth||"Default", expanded:n.expanded!==false, guid:null, rhino:null, children:kids};
}
const deep=o=>JSON.parse(JSON.stringify(o));
const countAll=nodes=>nodes.reduce((n,c)=>n+1+(c.children?countAll(c.children):0),0);

(async function(){
  const P=(await (await fetch(`${API}/api/presets`)).json()).presets;
  const current=P["STANDARD_building"];            // canonical BR_LAYERSTACK + LIBRARY/CE_LB
  const canonBR=()=>deep(current.find(x=>x.name==="BR_LAYERSTACK"));
  const sharedLib=()=>deep(current.find(x=>x.name==="LIBRARY"));

  // ---------- BRIDGE (S509B) ----------
  const b=P["S509B-VCT-BRIDGE-DE"];
  const bDrop=c=>/^(DELETE|KEEP)$/i.test(c.name)||/refernce/i.test(c.name)||/LB EXPLODED/i.test(c.name);
  const bridge=[
    clean(b.find(x=>x.name==="---------- CE BRIDGE SEGMENTS ----------"), bDrop),
    clean(b.find(x=>x.name==="---------- CE CONNECTIONS ----------"), bDrop),
    clean(b.find(x=>x.name==="---------- LB ----------"), bDrop),
    clean(b.find(x=>x.name==="SC-LAYOUT")),
    canonBR(),
  ];

  // ---------- FREEFORM (S463) ----------
  const f=P["S463-BAND_SHELL-FREEFORM-SB"];
  const sc=f.find(x=>x.name==="SC");
  const model22=(sc.children||[]).find(x=>/22x16/i.test(x.name));
  const keepCats={"Billet":"BILLET","Lath Main":"LATH","Ring Beam Main":"RING_BEAM","Steel":"STEEL","shell":"SHELL","Final Plinth":"PLINTH","Screws":"SCREWS","Rigging":"RIGGING","CUTTERS":"CUTTERS","Second Jig":"JIG"};
  const ffModel=node("SC-OBJECTS",(model22?model22.children:[]).filter(c=>keepCats[c.name]).map(c=>node(keepCats[c.name])));
  const grid=(sc.children||[]).find(x=>/^Grid$/i.test(x.name));
  const gh=(sc.children||[]).find(x=>/_GH/i.test(x.name));
  const ffGrid=node("SC-GRIDLINES",[...(grid?grid.children.map(c=>clean(c)):[]), ...(gh?gh.children.map(c=>clean(c)):[])]);
  const freeform=[ ffModel, ffGrid, sharedLib(), clean(f.find(x=>x.name==="SC-LAYOUT")), canonBR() ];

  const out={ STANDARD_bridge:bridge, STANDARD_freeform:freeform };
  // update the import bundle without touching building
  const bundlePath=__dirname+"/../STANDARD_presets_import.json";
  const bundle=JSON.parse(fs.readFileSync(bundlePath,"utf8"));
  bundle.presets.STANDARD_bridge=bridge; bundle.presets.STANDARD_freeform=freeform;
  fs.writeFileSync(bundlePath, JSON.stringify(bundle,null,2));

  for(const [name,tree] of Object.entries(out)){
    console.log(`\n# ${name}  (${countAll(tree)} layers)`);
    (function show(ns,d){for(const c of ns){console.log("  ".repeat(d)+"- "+c.name);if(c.children&&c.children.length&&d<1)show(c.children,d+1);}})(tree,0);
  }
  console.log("\n--- writing to database (bridge + freeform only) ---");
  for(const [name,tree] of Object.entries(out)){
    const r=await fetch(`${API}/api/presets/${encodeURIComponent(name)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({tree})});
    console.log(`PUT ${name} -> HTTP ${r.status}`);
  }
})();
