"use strict";
const API = "https://layers-structurecraft.up.railway.app";
(async function () {
  const P = (await (await fetch(`${API}/api/presets`)).json()).presets;
  const countAll = nodes => nodes.reduce((n,c)=>n+1+(c.children?countAll(c.children):0),0);
  function show(nodes, d, maxD){
    for(const c of nodes){
      const k=c.children||[];
      console.log("  ".repeat(d)+"- "+c.name+(k.length?`  [${k.length}/${countAll(k)}]`:""));
      if(d<maxD && k.length) show(k,d+1,maxD);
    }
  }
  for(const name of ["S509B-VCT-BRIDGE-DE","S463-BAND_SHELL-FREEFORM-SB"]){
    const p=P[name];
    console.log(`\n==================== ${name}  (${countAll(p)} layers) ====================`);
    show(p,0,2);
  }
})();
