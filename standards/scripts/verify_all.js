"use strict";
const API="https://layers-structurecraft.up.railway.app";
(async function(){
  const P=(await (await fetch(`${API}/api/presets`)).json()).presets;
  const names=(ns,o)=>{for(const c of ns){o.push(c.name);if(c.children)names(c.children,o);}return o;};
  const countAll=ns=>ns.reduce((n,c)=>n+1+(c.children?countAll(c.children):0),0);
  const junk=/APPLIED|^X$|^Z$|POINT|DELETE|KEEP|REFERNCE|LB EXPLODED|WALL_?OPTIONS|XNURBS|GROUT|BILLETS_\d|CIVIL|TEMP_BEAM|IMPORTED|3DM/i;
  for(const t of ["STANDARD_building","STANDARD_bridge","STANDARD_freeform"]){
    const p=P[t]; if(!p){console.log(t,"MISSING");continue;}
    const all=names(p,[]);
    const j=all.filter(n=>junk.test(n));
    const user=(function f(ns){for(const c of ns){if(c.name==="USER")return c;if(c.children){const r=f(c.children);if(r)return r;}}})(p);
    const userBad=user?(user.children||[]).map(c=>c.name).filter(n=>!/^SC_ANN_/.test(n)&&n!=="SC_TEMPORARY"):[];
    console.log(`\n${t}: ${countAll(p)} layers | top: ${p.map(n=>n.name).join(" | ")}`);
    console.log("  junk residue:", j.length?j.join(", "):"none ✓");
    console.log("  BR USER non-annotation:", userBad.length?userBad.join(", "):"none ✓");
  }
})();
