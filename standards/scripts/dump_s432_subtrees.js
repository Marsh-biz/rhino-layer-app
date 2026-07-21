"use strict";
const API = "https://layers-structurecraft.up.railway.app";
const NAME = "S432-UMT-ARENA_BLDG-MD";
(async function () {
  const presets = (await (await fetch(`${API}/api/presets`)).json()).presets;
  const p = presets[NAME];
  const groups = ["SC-OBJECTS", "SC-EXT MODELS"];
  function tree(n, d, lines) { lines.push("  ".repeat(d) + "- " + n.name); (n.children || []).forEach(c => tree(c, d + 1, lines)); return lines; }
  for (const g of groups) {
    const node = p.find(x => x.name === g);
    console.log("\n==================== " + g + " ====================");
    console.log(node ? tree(node, 0, []).join("\n") : "(not found)");
  }
})();
