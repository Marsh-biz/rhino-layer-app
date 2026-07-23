/*
 * Shared layer-name → human-readable helpers, driven by the StructureCraft
 * acronym glossary (standards/Layer_Naming_Acronyms.md). Used in two places so
 * the naming stays consistent:
 *   - the browser (public/objects.html) — pre-fills an object type's name/category
 *     when you add one for the hovered/selected layer;
 *   - Node (standards/scripts/*.js) — seeds/repopulates the catalog.
 *
 * UMD-ish: exports for CommonJS (require) and attaches to the global otherwise.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LayerHumanize = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // token (UPPERCASE) -> display word. Acronyms that should stay uppercase are in KEEP_UPPER.
  const MAP = {
    // Materials
    GLM: "Glulam", GL: "Glulam", GLULAM: "Glulam", STL: "Steel", STEEL: "Steel",
    BLK: "Blocking", BLOCKING: "Blocking", TIMBER: "Timber",
    // Primary members
    BEAM: "Beam", COLUMN: "Column", POST: "Post", WALL: "Wall", PANEL: "Panel",
    BILLET: "Billet", RING: "Ring", LATH: "Lath", SHELL: "Shell", PLINTH: "Plinth",
    // Truss
    TRUSS: "Truss", TOPCHORD: "Top Chord", BOTCHORD: "Bottom Chord", WEB: "Web",
    // Steel elements / plates
    PLATE: "Plate", BASE: "Base", BENT: "Bent", HANGER: "Hanger", KNIFE: "Knife",
    ROD: "Rod", ANGLE: "Angle",
    // Machining / tooling
    DAP: "Dap", PEN: "Penetration", CHASE: "Chase", CUT: "Cut", CUTTING: "Cut",
    CUTTERS: "Cutters", PRE: "Pre", DRILL: "Drill", OPENING: "Opening", PLANE: "Plane",
    JIG: "Jig", RIGGING: "Rigging",
    // Connections & fasteners / hardware
    CONN: "Connection", BEARING: "Bearing", FAST: "Fasteners", FASTENER: "Fastener",
    FASTENERS: "Fasteners", STRONG: "Strong", BACK: "Back", STRONGBACK: "Strongback",
    PREDRILL: "Pre-Drill", PLUG: "Plug", EMBED: "Embed",
    LEDGER: "Ledger", BRACE: "Brace", SPACER: "Spacer", SHIM: "Shim", NUT: "Nut",
    WASHER: "Washer", WASHERS: "Washers", BOLT: "Bolt", CARRIAGE: "Carriage",
    SCREW: "Screw", SCREWS: "Screws", ANCHOR: "Anchor", NEOPRENE: "Neoprene",
    RUBBER: "Rubber", ASSEMBLY: "Assembly", BLOCK: "Block", COVER: "Cover",
    LAM: "Lam", PREFAB: "Prefab",
    // Regions / sourcing
    SITE: "Site", SHOP: "Shop", HASSLACHER: "Hasslacher", HASSALCHER: "Hasslacher",
    // Containers / references / misc
    OBJECTS: "Objects", BUILDING: "Building", LIBRARY: "Library", REF: "Ref",
    ARCH: "Arch", STRUCT: "Struct", MECH: "Mech", EXISTING: "Existing",
    INSIDE: "Inside", OUTSIDE: "Outside", DECK: "Deck", GUARDRAIL: "Guardrail",
    SILL: "Sill", FLASHING: "Flashing", PLYWOOD: "Plywood", BRIDGE: "Bridge",
    SEGMENT: "Segment", LINEWORK: "Linework", LINE: "Line", LINES: "Lines",
    ELEVATION: "Elevation", TEXT: "Text", GRID: "Grid", GRIDLINES: "Gridlines",
    FLOR: "Floor", FLOOR: "Floor", DETL: "Detail",
  };

  // Tokens kept fully uppercase (acronyms / codes).
  const KEEP_UPPER = new Set(["CLT", "DLT", "EU", "NA", "CE", "BR", "SC", "LB", "SCB", "Z", "LP", "HIDD"]);

  function titleWord(t) {
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  }
  function tokenToWord(t) {
    const up = t.toUpperCase();
    if (MAP[up]) return MAP[up];
    if (KEEP_UPPER.has(up)) return up;
    return titleWord(t);
  }

  // "SC_GLM_BEAM" -> "Glulam Beam", "STEEL_INSIDE_CE" -> "Steel Inside CE",
  // "DAP_GLM" -> "Dap Glulam", "CE_STEEL_EU" -> "Steel EU".
  function humanizeLayer(name) {
    if (!name) return "";
    // Drop a single leading ownership prefix (SC_/BR_/CE_/LB_); a mid-name CE stays.
    let raw = String(name).replace(/^(SC|BR|CE|LB)[_\-]/i, "");
    // Collapse known compound terms so they read as one word.
    raw = raw.replace(/STRONG[_\-]BACK/ig, "STRONGBACK").replace(/PRE[_\-]DRILL/ig, "PREDRILL");
    const toks = raw.split(/[_\-\s]+/).filter(t => t && t.toUpperCase() !== "TOOL");
    if (!toks.length) return titleWord(String(name));
    return toks.map(tokenToWord).join(" ");
  }

  // Best-guess Branch match from the full layer name: { branch_key (class), branch_prefix }.
  // Grounded in a live authoring model — the reliable discriminators are the Branch
  // class (GetType().Name) and the mark TypePrefix (B=beam, C=column). Material is
  // often "Unset", so class carries the material family (timber vs steel) instead.
  // Order matters: machining / fastener / connection tokens win over the member class.
  function guessBranchMatch(name) {
    const n = String(name || "").toUpperCase();
    const m = (branch_key, branch_prefix) => ({ branch_key: branch_key, branch_prefix: branch_prefix || "" });
    // Machining objects (cuts that remove material)
    if (/(^|[_\-])DAP([_\-]|$)|DAPS/.test(n)) return m("Dap2d");
    if (/(^|[_\-])(PEN|OPENING|CUTTING|CHASE|CUT)([_\-]|$)|PLANAR|PRE_DRILL|DRILL/.test(n)) return m("PlanarCut");
    // Fasteners & loose hardware
    if (/FASTENER|(^|[_\-])FAST([_\-]|$)|BOLT|SCREW|WASHER|(^|[_\-])NUT([_\-]|$)|(^|[_\-])ROD([_\-]|$)|ANCHOR/.test(n)) return m("Fastener1d");
    // Connection entities (CE library)
    if (/^CE[_\-\s]|(^|[_\-])CONN([_\-]|$)|CONNECTION|EMBED|LEDGER|SHIM|PLUG|BRACE|SPACER|PREFAB|RUBBER|(^|[_\-])CE([_\-]|$)/.test(n)) return m("ConnectionInstance");
    // Mass-timber panels
    if (/(^|[_\-])DLT([_\-]|$)/.test(n)) return m("DLT");
    if (/(^|[_\-])CLT([_\-]|$)/.test(n)) return m("CLT");
    // Steel members / plates / profiles
    if (/(^|[_\-])STL([_\-]|$)|STEEL|(^|[_\-])PLATE([_\-]|$)|(^|[_\-])ANGLE([_\-]|$)/.test(n)) return m("Part3d");
    // Timber linear members — beam vs column by mark prefix
    if (/COLUMN|(^|[_\-])POST([_\-]|$)/.test(n)) return m("TimberLinearBeam", "C");
    if (/(^|[_\-])GLM([_\-]|$)|(^|[_\-])GL([_\-]|$)|GLULAM|BEAM|GIRDER|PURLIN|TRUSS|BILLET|(^|[_\-])BLK([_\-]|$)|BLOCKING|RING_BEAM|LATH/.test(n)) return m("TimberLinearBeam", "B");
    return m("", "");
  }

  return { humanizeLayer: humanizeLayer, guessBranchMatch: guessBranchMatch, MAP: MAP };
});
