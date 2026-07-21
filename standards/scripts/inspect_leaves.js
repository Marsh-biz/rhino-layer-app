"use strict";
// Quick inspection: list leaf-layer names + paths under a branch of a standard.
const SRC = process.env.SRC || "https://layers-structurecraft.up.railway.app";
const KEY = process.argv[2] || "SC_STANDARD_BLDG_260720";
const BRANCH = process.argv[3] || "SC_OBJECTS";

function walkLeaves(nodes, cb, path) {
  for (const n of (nodes || [])) {
    const p = (path ? path + "/" : "") + n.name;
    const leaf = !(n.children && n.children.length);
    if (leaf) cb(n, p); else walkLeaves(n.children, cb, p);
  }
}

(async function () {
  const P = (await (await fetch(`${SRC}/api/presets`)).json()).presets;
  const branch = (P[KEY] || []).find(n => n.name === BRANCH);
  if (!branch) { console.log(`branch ${BRANCH} not found in ${KEY}`); return; }
  const rows = [];
  walkLeaves([branch], (n, p) => rows.push({ name: n.name, path: p }));
  console.log(`${KEY} / ${BRANCH}: ${rows.length} leaves`);
  rows.forEach(r => console.log(`  name="${r.name}"   path=${r.path}`));
})();
