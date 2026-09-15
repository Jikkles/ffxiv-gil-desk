/* Builds the Gathering tab's data (tools/.cache/out/GATHERING.json):
     node tools/build-gathering.js
   Every marketable item a Miner or Botanist gathers from a node, read from Teamcraft's
   nodes.json (items per node, node level and type, whether it is timed and when it spawns,
   and where it is), with zone names from the game's Map and PlaceName tables.
   Shards, crystals and clusters are left out: crystal nodes yield far more a swing than any
   other node, so the tab's per-hour estimate would be wrong for them. Spearfishing and the
   Diadem are left out too.
   Each item keeps every node it comes from, best first: a node that always shows it before
   one where it is a hidden item (those only turn up on some visits), a regular node before a
   timed one (you can work it all hour), then the timed node that spawns most often, then the
   lowest level. The tab estimates the hourly yield from the first. */
const path = require("path");
const { OUT, need, readJSON, writeJSON, sheet, items, marketable } = require("./lib/common");

/* ================= things a human may need to extend after a big patch =================
   Teamcraft's node type ids, and zones that are not ordinary gathering. */
const TYPES = { 0: ["MIN", "Mining"], 1: ["MIN", "Quarrying"], 2: ["BTN", "Logging"], 3: ["BTN", "Harvesting"] };
const SKIP_ZONES = /^The Diadem$/;
/* ======================================================================================= */

const I = items();
const place = {}; for (const r of sheet("PlaceName")) place[r["#"]] = r.Name;
const mapZone = {}; for (const r of sheet("Map")) mapZone[r["#"]] = place[r.PlaceName];
const nodes = readJSON(need("nodes.json"));

const byItem = {};
let skipped = 0;
for (const [nid, n] of Object.entries(nodes)) {
  const t = TYPES[n.type];
  if (!t || !n.zoneid || !n.map) { skipped++; continue; }
  const zone = mapZone[n.map] || place[n.zoneid];
  if (!zone || SKIP_ZONES.test(zone)) { skipped++; continue; }
  /* a node's hidden items only show with enough Perception or a Folklore book, but they
     are gathered from the same node all the same */
  for (const id of [...(n.items || []), ...(n.hiddenItems || [])]) {
    if (id >= 2 && id <= 19) continue;
    if (!marketable(I, id)) continue;
    const node = { n: +nid, c: t[0], t: t[1], lv: n.level, z: zone, a: place[n.zoneid] || "", x: n.x, y: n.y };
    if (n.limited) { node.sp = n.spawns; node.d = n.duration; node.k = n.ephemeral ? "ephemeral" : "timed"; }
    if ((n.hiddenItems || []).includes(id)) node.h = 1;
    (byItem[id] = byItem[id] || []).push(node);
  }
}

const rank = x => x.k ? 1 : 0;
const out = Object.entries(byItem).map(([id, list]) => {
  list.sort((a, b) => (a.h || 0) - (b.h || 0) || rank(a) - rank(b) || (b.sp ? b.sp.length : 0) - (a.sp ? a.sp.length : 0) || a.lv - b.lv || a.n - b.n);
  return { i: +id, nm: I[id].n, ui: I[id].ui, nodes: list };
}).sort((a, b) => a.nm.localeCompare(b.nm));
writeJSON(path.join(OUT, "GATHERING.json"), out);

const timed = out.filter(x => x.nodes[0].k).length;
const cls = c => out.filter(x => x.nodes.some(n => n.c === c)).length;
console.log(`  Gathering  ${out.length} items (${cls("MIN")} mining, ${cls("BTN")} botany; ${timed} only from timed nodes), ${skipped} nodes skipped (spearfishing, Diadem, island)`);
