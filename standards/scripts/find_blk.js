"use strict";
const API="https://layers-structurecraft.up.railway.app";
(async function(){
  const P=(await (await fetch(`${API}/api/presets`)).json()).presets;
  const skip=/^SC_STANDARD_/;
  for(const name of Object.keys(P).sort()){
    if(skip.test(name)) continue;
    const blk=[], block=[];
    (function walk(ns,path){for(const c of ns){const p=path?path+" > "+c.name:c.name;
      if(/BLK/i.test(c.name)) blk.push(p);                          // the "BLK" abbreviation
      else if(/BLOCK(ING|S)?\b/i.test(c.name) && !/TBLOCK/i.test(c.name)) block.push(p); // spelled out (excl. title block)
      if(c.children) walk(c.children,p);}})(P[name],"");
    if(blk.length||block.length){
      console.log("\n### "+name);
      if(blk.length){ console.log("  BLK abbreviation:"); blk.forEach(h=>console.log("    "+h)); }
      if(block.length){ console.log("  spelled block/blocking:"); block.forEach(h=>console.log("    "+h)); }
    }
  }
})();
