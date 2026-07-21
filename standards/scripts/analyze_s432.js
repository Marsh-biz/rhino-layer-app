"use strict";
// Inspect the proposed new backbone preset live from the Railway API.
const API = "https://layers-structurecraft.up.railway.app";
const NAME = "S432-UMT-ARENA_BLDG-MD";

(async function () {
  const presets = (await (await fetch(`${API}/api/presets`)).json()).presets;
  const p = presets[NAME];
  if (!p) { console.log("not found:", NAME); return; }
  const countAll = (nodes) => nodes.reduce((n, c) => n + 1 + (c.children ? countAll(c.children) : 0), 0);
  function show(nodes, depth, maxDepth) {
    for (const c of nodes) {
      const kids = c.children || [];
      const tot = countAll(kids);
      console.log("  ".repeat(depth) + "- " + c.name + (kids.length ? `  [${kids.length} direct / ${tot} total]` : ""));
      if (depth < maxDepth && kids.length) show(kids, depth + 1, maxDepth);
    }
  }
  console.log(`${NAME}  —  ${countAll(p)} layers total\n`);
  show(p, 0, 2);
})();
