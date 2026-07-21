"use strict";
const API = "https://layers-structurecraft.up.railway.app";
const BUILDINGS = ["S432-UMT-ARENA_BLDG-MD","S448_T3FAT-BLDG-AK","S456-PEEL-BLDG-DE",
                   "S483-RABENSTAINER-BLDG-AK","S494-POWDER-BLDG-AK"]; // real buildings only
const SKELETON = "STANDARD_building";

// canonicalize a layer name so it can be matched across inconsistent projects
function key(n){
  let s = String(n).toUpperCase();
  s = s.replace(/^[\s=\-_]+|[\s=\-_]+$/g, "");     // strip decorative ends (=====, ----)
  s = s.replace(/PENN/g,"PEN").replace(/DAPP/g,"DAP");
  s = s.replace(/[\s\-\/]+/g,"_").replace(/_+/g,"_");
  return s;
}
const NOISE = /^(\d+|L\d+|POINT.*|NOTE|DETAIL|CLIP|REVIEW|QUESTIONS?|TEMP.*|DEL|KEEP|XXXX|Q|QWE|0)$/;
const LEGACY = /^SC_(TIMBER|STEEL|HIDDEN|HATCH|CONC|CONCRETE|HARDWARE|PANEL|SHEATHING|ARCH|BREAKLINE|SCREEN|OBJECT|CONSTRUCTION|DSK|TITLE)/;

function keysOf(nodes, set){ for(const c of nodes){ const k=key(c.name); if(k) set.add(k); if(c.children) keysOf(c.children,set); } return set; }
function walk(nodes, cb){ for(const c of nodes){ cb(c); if(c.children) walk(c.children, cb); } }

(async function(){
  const presets = (await (await fetch(`${API}/api/presets`)).json()).presets;
  const buildingKeys = BUILDINGS.map(b => keysOf(presets[b]||[], new Set()));
  const support = (k) => buildingKeys.reduce((n,set)=>n+(set.has(k)?1:0),0);

  // A) confidence for every skeleton layer
  const tiers = {5:[],4:[],3:[],2:[],1:[],0:[]};
  walk(presets[SKELETON], c => { const k=key(c.name); tiers[support(k)].push(c.name); });
  console.log(`Weighting "${SKELETON}" against ${BUILDINGS.length} real buildings:\n  ${BUILDINGS.join("\n  ")}\n`);
  console.log("SKELETON LAYER SUPPORT (shared by N of 5 projects):");
  for(const t of [5,4,3,2,1,0]){
    const list=tiers[t];
    console.log(`\n  ${t}/5  — ${list.length} layers`);
    console.log("    " + (list.slice(0,18).join(", ") + (list.length>18?` …(+${list.length-18})`:"")));
  }

  // B) high-support layers MISSING from the skeleton
  const skelKeys = keysOf(presets[SKELETON], new Set());
  const freq = {};
  buildingKeys.forEach(set => set.forEach(k => freq[k]=(freq[k]||0)+1));
  const missing = Object.entries(freq)
    .filter(([k,c]) => c>=3 && !skelKeys.has(k) && !NOISE.test(k) && !LEGACY.test(k) && k.length>1)
    .sort((a,b)=>b[1]-a[1]);
  console.log("\n\nTOP MISSING CANDIDATES (in >=3/5 projects, not in skeleton, legacy/noise excluded):");
  missing.forEach(([k,c])=>console.log(`  ${c}/5  ${k}`));
})();
