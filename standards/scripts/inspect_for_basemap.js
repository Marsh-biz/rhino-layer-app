"use strict";
const API="https://layers-structurecraft.up.railway.app";
(async function(){
  const P=(await (await fetch(`${API}/api/presets`)).json()).presets;
  const names=n=>(n.children||[]).map(c=>c.name);
  for(const t of ["SC_STANDARD_BLDG","SC_STANDARD_BRIDGE","SC_STANDARD_FREEFORM"]){
    const p=P[t]; if(!p){console.log(t,"MISSING");continue;}
    console.log("\n==== "+t+" ====");
    console.log("top-level:", p.map(n=>n.name).join(" | "));
    const so=p.find(n=>n.name==="SC-OBJECTS"); if(so) console.log("SC-OBJECTS >", names(so).join(", "));
    const gl=p.find(n=>/GRIDLINE/i.test(n.name)); if(gl) console.log(gl.name+" >", names(gl).join(", "));
    const lb=p.find(n=>n.name==="LIBRARY"); if(lb) console.log("LIBRARY (top-level) >", names(lb).join(", "));
  }
})();
