"use strict";
const API="https://layers-structurecraft.up.railway.app";
(async function(){
  const presets=(await (await fetch(`${API}/api/presets`)).json()).presets;
  const names=(nodes,out)=>{for(const c of nodes){out.push(c.name);if(c.children)names(c.children,out);}return out;};
  const bld=presets["STANDARD_building"];
  const all=names(bld,[]);

  const badTokens=all.filter(n=>/PENN|DAPP|HIDD-|TRUSS_WE$|PRE-DRILL|STRONG-BACK/.test(n));
  const legacy=all.filter(n=>/^SC_(TIMBER|STEEL|HIDDEN|HATCH|CONCRETE|CONC|SHEATHING|PANEL|ARCH|HARDWARE|BREAKLINE|SCREEN|OBJECT-LINES|CONSTRUCTION-LINE|DSK|TITLE)/i.test(n) || /^(Layer 01|Note|DETAIL|User_Dashed)$/i.test(n));
  const perBuilding=all.filter(n=>/building\s+[a-d]\b|bldg\s+[a-d]\b/i.test(n));
  const junk=all.filter(n=>/ONLY FOR DRAWING|Steel Connections Option|- Copy/i.test(n));

  const userGroup=(function f(nodes){for(const c of nodes){if(c.name==="USER")return c;if(c.children){const r=f(c.children);if(r)return r;}}})(bld);
  const userNames=(userGroup.children||[]).map(c=>c.name);
  const userNonAnn=userNames.filter(n=>!/^SC_ANN_/.test(n) && n!=="SC_TEMPORARY");

  console.log("STANDARD_building top level:", bld.map(n=>n.name).join(" | "));
  console.log("total layers:", all.length);
  console.log("\nCHECKS (all should be empty):");
  console.log("  residual bad naming tokens:", badTokens.join(", ")||"none ✓");
  console.log("  residual legacy 2D drafting:", legacy.join(", ")||"none ✓");
  console.log("  residual per-building REF groups:", perBuilding.join(", ")||"none ✓");
  console.log("  residual junk groups:", junk.join(", ")||"none ✓");
  console.log("  BR_LAYERSTACK>USER non-annotation entries:", userNonAnn.join(", ")||"none ✓");
  console.log("\nUSER layers kept ("+userNames.length+"):", userNames.join(", "));
  console.log("\nStandards present:", ["STANDARD_building","STANDARD_bridge","STANDARD_freeform"].every(t=>presets[t])?"all 3 ✓":"MISSING");
})();
