"use strict";
const fs = require("fs");
const crypto = require("node:crypto");
const API = "https://layers-structurecraft.up.railway.app";
const OUT = __dirname + "/../exports";

const NULL_GUID = "00000000-0000-0000-0000-000000000000";
const REVERSE_LT = { Continuous:-1, Border:1, Center:2, DashDot:3, Dashed:4, Dots:5, Hidden:6 };
function hexToARGB(hex){ return (0xFF000000 | parseInt(String(hex).slice(1),16)) | 0; } // opaque signed int32
function plotWeight(label){
  if(label==="Default"||label==null) return 0;
  if(label==="No Print") return -1;
  if(label==="Hairline") return 0.01;
  const n = parseFloat(label); return isNaN(n)?0:n;
}
const guid = () => crypto.randomUUID();

// app tree -> Rhino Layer_Export.json ({Layers:[...]}), matching the app's exporter
function toRhino(tree){
  const out = [];
  (function walk(nodes, parentId){
    for(const c of nodes){
      const id = guid();
      const colorInt = hexToARGB(c.color||"#000000");
      const ltIdx = REVERSE_LT[c.linetype] !== undefined ? REVERSE_LT[c.linetype] : -1;
      const w = plotWeight(c.printWidth);
      out.push({
        Id:id, Name:c.name, ParentLayerId: parentId||NULL_GUID,
        IsLocked:false, IsExpanded: c.expanded!==false, LinetypeIndex:ltIdx, IsVisible:true,
        Color:colorInt, PlotWeight:w, PlotColor:colorInt,
        LayoutIsVisible:true, LayoutColor:colorInt, LayoutPlotWeight:w, LayoutPlotColor:colorInt
      });
      if(c.children && c.children.length) walk(c.children, id);
    }
  })(tree, null);
  return { Layers: out };
}

function validate(data){
  const ids=new Set(), errs=[];
  data.Layers.forEach(L=>{ if(ids.has(L.Id)) errs.push("dup Id "+L.Id); ids.add(L.Id); });
  data.Layers.forEach(L=>{ if(L.ParentLayerId!==NULL_GUID && !ids.has(L.ParentLayerId)) errs.push("orphan "+L.Name); });
  return errs;
}

(async function(){
  const P = (await (await fetch(`${API}/api/presets`)).json()).presets;
  fs.mkdirSync(OUT, {recursive:true});
  for(const name of ["SC_STANDARD_BLDG","SC_STANDARD_BRIDGE","SC_STANDARD_FREEFORM"]){
    if(!P[name]){ console.log("MISSING", name); continue; }
    const data = toRhino(P[name]);
    const errs = validate(data);
    const file = `${OUT}/${name}.json`;
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log(`${name}.json  —  ${data.Layers.length} layers  —  ${errs.length? "ERRORS: "+errs.join("; ") : "valid ✓"}`);
  }
  console.log("\nWritten to standards/exports/");
})();
