"use strict";
const API="https://layers-structurecraft.up.railway.app";
const EXPECT={
  CE_STEEL_EU:"#0080FF", CE_STEEL_NA_SITE:"#00D084", CE_STEEL_NA_SHOP:"#004080",
  CE_FASTENER_EU:"#80FFFF", CE_FASTENER_NA_SITE:"#80FF80",
  CE_EMBED_NA:"#C0C0C0", CE_RUBBER_NA:"#9C27B0", CE_SHIM_NA:"#FFFF80",
};
(async function(){
  const P=(await (await fetch(`${API}/api/presets`)).json()).presets;
  for(const t of ["STANDARD_building","STANDARD_bridge","STANDARD_freeform"]){
    const found={};
    (function walk(ns){for(const c of ns){ if(EXPECT[c.name]) found[c.name]=c.color; if(c.children) walk(c.children);}})(P[t]);
    const rows=Object.keys(EXPECT).map(k=>{
      const got=found[k];
      const ok = got && got.toUpperCase()===EXPECT[k];
      return `    ${ok?"✓":"✗"} ${k} = ${got||"MISSING"}${ok?"":" (want "+EXPECT[k]+")"}`;
    });
    console.log(`\n${t}:`);
    console.log(rows.join("\n"));
  }
})();
