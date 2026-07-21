"use strict";
const API="https://layers-structurecraft.up.railway.app";
(async function(){
  const P=(await (await fetch(`${API}/api/presets`)).json()).presets;
  for(const t of ["SC_STANDARD_BLDG_260720","SC_STANDARD_BRIDGE_260720","SC_STANDARD_FREEFORM_260720"]){
    const p=P[t]; if(!p){console.log(t,"MISSING");continue;}
    const so=p.find(n=>n.name==="SC-OBJECTS");
    const lib=(so.children||[]).find(n=>n.name==="LIBRARY");
    console.log(`\n### ${t}  SC-OBJECTS > [${(so.children||[]).map(c=>c.name).join(", ")}]`);
    if(lib) console.log("  LIBRARY children:", (lib.children||[]).map(c=>c.name).join(", "));
  }
})();
