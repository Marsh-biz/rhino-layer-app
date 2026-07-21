"use strict";
const fs=require("fs");
const API="https://layers-structurecraft.up.railway.app";
const DATE="260720"; // 2026-07-20, YYMMDD (matches SC date convention)

const node=(name,color,children)=>({name,color:color||"#000000",linetype:"Continuous",printWidth:"Default",expanded:true,guid:null,rhino:null,children:children||[]});
const deep=o=>JSON.parse(JSON.stringify(o));
const find=(arr,name)=>arr.find(n=>n.name===name);
const isNSEW=c=>/(^|[-_ ])(NS|EW)([-_ ]|$)/i.test(c.name);
const reviewGroup=()=>node("SC-REVIEW",null,[node("SC_REVIEW_MARKUP","#FF0000"),node("SC_REVIEW_NOTES")]);
const genericRef=()=>node("REF",null,[node("REF_ARCH"),node("REF_STRUCT"),node("REF_MECH")]);
const genericGrid=()=>node("SC-GRIDLINES",null,[node("GL-PLAN")]);
const countAll=ns=>ns.reduce((n,c)=>n+1+(c.children?countAll(c.children):0),0);

(async function(){
  const P=(await (await fetch(`${API}/api/presets`)).json()).presets;

  // ---------- BUILDING: full base map ----------
  const b=deep(P["SC_STANDARD_BLDG"]);
  const so=find(b,"SC-OBJECTS").children;
  const timber=node("TIMBER",null,[find(so,"GLM"),find(so,"CLT"),find(so,"DLT"),find(so,"BLK")].filter(Boolean));
  const steel=find(so,"STL"); if(steel) steel.name="STEEL";
  const lib=find(b,"LIBRARY");
  const scObjects=node("SC-OBJECTS",null,[timber,steel,lib].filter(Boolean));
  const grids=deep(find(b,"SC-GRIDLINES")); grids.children=(grids.children||[]).filter(c=>!isNSEW(c));
  const building=[scObjects,grids,reviewGroup(),find(b,"REF"),find(b,"SC-LAYOUT"),find(b,"BR_LAYERSTACK")].filter(Boolean);

  // ---------- BRIDGE: base-map top level, model+library under SC-OBJECTS ----------
  const br=deep(P["SC_STANDARD_BRIDGE"]);
  const bSO=node("SC-OBJECTS",null,[find(br,"CE_BRIDGE_SEGMENTS"),find(br,"CE_CONNECTIONS"),find(br,"LIBRARY")].filter(Boolean));
  const bridge=[bSO,genericGrid(),reviewGroup(),genericRef(),find(br,"SC-LAYOUT"),find(br,"BR_LAYERSTACK")].filter(Boolean);

  // ---------- FREEFORM: keep model, move LIBRARY into SC-OBJECTS ----------
  const ff=deep(P["SC_STANDARD_FREEFORM"]);
  const ffSO=deep(find(ff,"SC-OBJECTS"));
  const ffLib=find(ff,"LIBRARY"); if(ffLib) ffSO.children.push(ffLib);
  const ffGrids=deep(find(ff,"SC-GRIDLINES")); ffGrids.children=(ffGrids.children||[]).filter(c=>!isNSEW(c));
  const freeform=[ffSO,ffGrids,reviewGroup(),genericRef(),find(ff,"SC-LAYOUT"),find(ff,"BR_LAYERSTACK")].filter(Boolean);

  const out={
    [`SC_STANDARD_BLDG_${DATE}`]:building,
    [`SC_STANDARD_BRIDGE_${DATE}`]:bridge,
    [`SC_STANDARD_FREEFORM_${DATE}`]:freeform,
  };
  fs.writeFileSync(__dirname+`/../STANDARD_presets_${DATE}.json`, JSON.stringify({presets:out},null,2));

  for(const [name,tree] of Object.entries(out)){
    console.log(`\n# ${name}  (${countAll(tree)} layers)`);
    (function show(ns,d){for(const c of ns){console.log("  ".repeat(d)+"- "+c.name);if(c.children&&c.children.length&&d<1)show(c.children,d+1);}})(tree,0);
  }
  console.log("\n--- writing to database (new dated presets; existing untouched) ---");
  for(const [name,tree] of Object.entries(out)){
    const r=await fetch(`${API}/api/presets/${encodeURIComponent(name)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({tree})});
    console.log(`PUT ${name} -> HTTP ${r.status}`);
  }
})();
