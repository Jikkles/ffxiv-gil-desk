/* Builds the Gathering tab's data (tools/.cache/out/GATHERING.json):
     node tools/build-gathering.js
   Every marketable item a Miner or Botanist gathers from a node, or a Fisher catches with a
   rod, the fish further down. Nodes are read from Teamcraft's
   nodes.json (items per node, node level and type, whether it is timed and when it spawns,
   and where it is), with zone names from the game's Map and PlaceName tables.
   Shards, crystals and clusters are left out: crystal nodes yield far more a swing than any
   other node, so the tab's per-hour estimate would be wrong for them. Spearfishing and the
   Diadem are left out too.
   Each item keeps every node it comes from, best first: a node that always shows it before
   one where it is a hidden item (those only turn up on some visits), a regular node before a
   timed one (you can work it all hour), then the timed node that spawns most often, then the
   lowest level. The tab estimates the hourly yield from the first.
   Fish: Teamcraft's fishing-spots.json says which fish bite at each spot and the spot's level;
   the Carbuncle Plushy fish tracker's data.js (MIT, icykoneko/ff14-fish-tracker-app) gives
   each fish's Eorzean hours, weather and previous weather, whether it is a big fish and which
   Folklore book it needs, plus every zone's weather odds. The tracker only knows the fishing
   spots of the open world, so ocean fishing, the Diadem and Cosmic Exploration drop out. A fish
   the tracker does not list has no conditions. For a fish with conditions the build walks a
   year of weather to find how much of the time it is up (u) and how many windows open a real
   hour (w); the tab forecasts the next window live from the same weather odds. */
const fs = require("fs");
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
const TRACKER = new Function(fs.readFileSync(need("fishtracker-data.js"), "utf8") + ";return DATA")();
const spots = readJSON(need("fishing-spots.json"));

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

/* ===== fish =====
   The weather forecast, as the game works it out (after SaintCoinach, as the fish tracker
   has it): weather changes every 8 Eorzean hours, which is every 1,400 real seconds, and
   period k of those uses a roll of 0-99 against the zone's cumulative odds. The tab carries
   the same few lines. */
const PERIOD_S = 1400;
function weatherRoll(k) {
  const unix = k * PERIOD_S, bell = unix / 175;
  const inc = (bell + 8 - (bell % 8)) % 24;
  const days = ((unix / 4200) << 32) >>> 0;
  const base = days * 100 + inc;
  const s1 = ((base << 11) ^ base) >>> 0, s2 = ((s1 >>> 8) ^ s1) >>> 0;
  return s2 % 100;
}
const weatherName = id => (TRACKER.WEATHER_TYPES[id] || {}).name_en || "?";
/* the Eorzean minutes of a day a fish bites in, as [from, to) pieces */
function hourRanges(sh, eh) {
  const a = Math.round(sh * 60), b = Math.round(eh * 60);
  if (a === b || (a === 0 && b === 1440)) return [[0, 1440]];
  return a < b ? [[a, b]] : [[a, 1440], [0, b]];
}
/* uptime and windows a real hour over a fixed year, so a rebake gives the same numbers */
const SIM_FROM = Math.floor(Date.UTC(2026, 0, 1) / 1000 / PERIOD_S), SIM_PERIODS = Math.round(365 * 86400 / PERIOD_S);
function windowStats(fish, rates) {
  const ranges = hourRanges(fish.startHour, fish.endHour);
  const ws = fish.weatherSet, pws = fish.previousWeatherSet;
  const at = k => { const r = weatherRoll(k); return rates.find(x => r < x[1])[0]; };
  let open = 0, windows = 0, lastEnd = -1;
  for (let k = SIM_FROM; k < SIM_FROM + SIM_PERIODS; k++) {
    if (ws.length && !ws.includes(at(k))) continue;
    if (pws.length && !pws.includes(at(k - 1))) continue;
    const base = k * 480, day0 = ((8 * k) % 24) * 60;
    const bits = ranges.map(([a, b]) => [Math.max(a, day0), Math.min(b, day0 + 480)]).filter(([a, b]) => b > a)
      .map(([a, b]) => [base + a - day0, base + b - day0]).sort((x, y) => x[0] - y[0]);
    for (const [a, b] of bits) { open += b - a; if (a !== lastEnd) windows++; lastEnd = b; }
  }
  const realHours = SIM_PERIODS * PERIOD_S / 3600;
  return { u: +(open / (SIM_PERIODS * 480)).toFixed(4), w: +(windows / realHours).toPrecision(3) };
}

let fishSpots = 0, fishSkipped = 0;
for (const spot of spots) {
  const ts = TRACKER.FISHING_SPOTS[spot.id];
  if (!ts || !spot.coords) { fishSkipped++; continue; }
  const zone = mapZone[spot.mapId];
  if (!zone) { fishSkipped++; continue; }
  const rates = (TRACKER.WEATHER_RATES[ts.territory_id] || {}).weather_rates;
  fishSpots++;
  for (const id of spot.fishes) {
    if (!marketable(I, id)) continue;
    const fish = TRACKER.FISH[id];
    const node = { n: spot.id, c: "FSH", t: "Fishing", lv: spot.level, z: zone, a: ts.name_en, x: spot.coords.x, y: spot.coords.y };
    if (fish && fish.gig) continue;
    if (fish) {
      const timed = !(fish.startHour === 0 && fish.endHour === 24) && fish.startHour !== fish.endHour;
      const weather = fish.weatherSet.length || fish.previousWeatherSet.length;
      if (timed || weather) {
        if (weather && !rates) continue;   // weather it can never see here
        const st = windowStats(fish, rates || [[0, 100]]);
        if (!st.w) continue;
        node.k = "timed";
        node.hr = [fish.startHour, fish.endHour];
        if (fish.weatherSet.length) node.ws = fish.weatherSet.map(weatherName);
        if (fish.previousWeatherSet.length) node.pw = fish.previousWeatherSet.map(weatherName);
        if (weather) node.wr = rates.map(([w, c]) => [weatherName(w), c]);
        node.u = st.u; node.w = st.w;
      }
      if (fish.bigFish) node.b = 1;
      if (fish.folklore) node.fl = 1;
      if (fish.predators.length) node.pr = fish.predators.map(([pid, n]) => `${n}× ${I[pid] ? I[pid].n : pid}`);
    }
    (byItem[id] = byItem[id] || []).push(node);
  }
}

const rank = x => x.k ? 1 : 0;
const out = Object.entries(byItem).map(([id, list]) => {
  list.sort((a, b) => (a.h || 0) - (b.h || 0) || rank(a) - rank(b) || (b.sp ? b.sp.length : 0) - (a.sp ? a.sp.length : 0) || (b.u || 0) - (a.u || 0) || a.lv - b.lv || a.n - b.n);
  return { i: +id, nm: I[id].n, ui: I[id].ui, nodes: list };
}).sort((a, b) => a.nm.localeCompare(b.nm));
writeJSON(path.join(OUT, "GATHERING.json"), out);

const timed = out.filter(x => x.nodes[0].k).length;
const cls = c => out.filter(x => x.nodes.some(n => n.c === c)).length;
console.log(`  Gathering  ${out.length} items (${cls("MIN")} mining, ${cls("BTN")} botany, ${cls("FSH")} fish; ${timed} only from timed nodes or windows), ${skipped} nodes skipped (spearfishing, Diadem, island), ${fishSpots} fishing spots (${fishSkipped} skipped: ocean fishing, Diadem, Cosmic Exploration)`);
