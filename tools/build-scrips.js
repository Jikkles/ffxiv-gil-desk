/* Builds the Scrips tab's data (tools/.cache/out/SCRIPS.json):
     node tools/build-scrips.js      (after build-currencies.js, whose scrip shops it reads)
   - collectibles: every crafted collectable the Collectable Appraiser takes for purple or
     orange crafters' scrips, with the scrips it pays at top collectability and its whole
     recipe tree, shards and crystals included
   - exchanges: for each of the two scrips, every crafter materia it buys and what it costs
   - materia: every grade of the three crafter materia, the ones the tab prices
   Read from the game's CollectablesShop, CollectablesShopItem and CollectablesShopRewardScrip
   tables, Teamcraft's recipes, and build-currencies.js's scrip shops. */
const path = require("path");
const { OUT, need, readJSON, writeJSON, sheet, items } = require("./lib/common");

/* ================= things a human may need to extend after a big patch =================
   The appraiser's crafter groups are its first eight shop groups, in job order. The scrip
   index a reward pays in (CollectablesShopRewardScrip.Currency) maps to the scrip's item,
   the same indices build-currencies.js keeps in SCRIPS; only the crafters' two count here. */
const APPRAISER_NAME = /収集品納品|Collectable Appraiser/;
const JOBS = ["CRP", "BSM", "ARM", "GSM", "LTW", "WVR", "ALC", "CUL"];
const SCRIP_OF = { 2: "purple", 6: "orange" };
const SCRIP_ITEM = { purple: 33913, orange: 41784 };
const SCRIP_NAME = { purple: "Purple Crafters' Scrip", orange: "Orange Crafters' Scrip" };
/* ======================================================================================= */

const I = items();
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];
const warn = [];

/* ---- the current appraiser: the shop whose groups hold today's collectables ---- */
const shops = sheet("CollectablesShop").filter(s => APPRAISER_NAME.test(s.Name));
if (!shops.length) throw new Error("no Collectable Appraiser in CollectablesShop — has its name changed?");
/* several appraisers survive in the table; the live one is the one with the newest items */
const itemRows = sheet("CollectablesShopItem");
const groupsOf = s => [...Array(11).keys()].map(i => +s[`ShopItems[${i}]`]).filter(Boolean);
const newest = s => Math.max(0, ...itemRows.filter(r => groupsOf(s).includes(+r["#"].split(".")[0])).map(r => +r.Item));
const shop = shops.sort((a, b) => newest(b) - newest(a))[0];
const crafterGroups = groupsOf(shop).slice(0, JOBS.length);

const reward = {};
for (const r of sheet("CollectablesShopRewardScrip")) reward[r["#"]] = r;

/* ---- recipe trees: the lowest-id personal recipe for each item, as the simulator links use ---- */
const recipeOf = new Map();
for (const r of readJSON(need("recipes.json"))) {
  if (!/^\d+$/.test(String(r.id))) continue;
  const have = recipeOf.get(r.result);
  if (!have || +r.id < +have.id) recipeOf.set(r.result, r);
}
const JOB_ID = { 8: "CRP", 9: "BSM", 10: "ARM", 11: "GSM", 12: "LTW", 13: "WVR", 14: "ALC", 15: "CUL" };
function node(id, amount, seen) {
  const n = { id, name: I[id] ? I[id].n : "#" + id, amount };
  const r = recipeOf.get(id);
  if (!r || seen.has(id)) { n.craftable = false; return n; }
  n.craftable = true; n.yields = r.yields || 1; n.job = JOB_ID[r.job] || "";
  const next = new Set(seen).add(id);
  n.ings = r.ingredients.map(g => node(g.id, g.amount, next));
  return n;
}

const collectibles = [];
for (const r of itemRows) {
  const g = +r["#"].split(".")[0], job = crafterGroups.indexOf(g), id = +r.Item;
  if (job < 0 || !id) continue;
  const rw = reward[r.CollectablesShopRewardScrip], type = rw && SCRIP_OF[+rw.Currency];
  if (!type) continue;
  if (!recipeOf.has(id)) { warn.push(`WARNING: collectable ${I[id] ? I[id].n : id} has no recipe in Teamcraft's data`); continue; }
  const tree = node(id, 1, new Set());
  collectibles.push({ id, name: tree.name, class: JOBS[job], lvl: +r.LevelMin, scrips: +rw.HighReward, tree, scripType: type });
}
collectibles.sort((a, b) => (a.scripType === b.scripType ? 0 : a.scripType === "purple" ? -1 : 1) || a.lvl - b.lvl || JOBS.indexOf(a.class) - JOBS.indexOf(b.class));

/* ---- every grade of the three crafter materia ---- */
const MATERIA_RE = /^Craftsman's (Competence|Cunning|Command) Materia ([IVX]+)$/;
const materia = [];
for (const id in I) {
  const m = MATERIA_RE.exec(I[id].n);
  if (!m) continue;
  const gi = ROMAN.indexOf(m[2]);
  if (gi < 1) continue;
  materia.push({ id: +id, name: I[id].n, type: "Craftsman's " + m[1], grade: m[2], gi });
}
materia.sort((a, b) => b.gi - a.gi || a.type.localeCompare(b.type));
const materiaById = new Map(materia.map(m => [m.id, m]));

/* ---- what each scrip buys: every crafter materia in its shops, at the cheapest cost ---- */
const CUR = readJSON(need("out/CURRENCIES.json"));
const exchanges = {};
for (const type of ["purple", "orange"]) {
  const cur = CUR.currencies.find(c => c.id === SCRIP_ITEM[type]);
  const offers = cur ? cur.items.filter(e => materiaById.has(e.i)).map(e => ({ id: e.i, cost: e.c / (e.q || 1) })) : [];
  if (!offers.length) { warn.push(`WARNING: ${SCRIP_NAME[type]} buys no crafter materia in out/CURRENCIES.json — run build-currencies.js first`); continue; }
  const top = Math.max(...offers.map(o => materiaById.get(o.id).gi));
  const best = offers.filter(o => materiaById.get(o.id).gi === top);
  exchanges[type] = { name: SCRIP_NAME[type], materiaCost: best[0].cost, scripMateria: best.map(o => o.id), grade: ROMAN[top],
    offers: offers.sort((a, b) => materiaById.get(b.id).gi - materiaById.get(a.id).gi || a.id - b.id) };
}

writeJSON(path.join(OUT, "SCRIPS.json"), { exchanges, collectibles, materia });
const count = t => collectibles.filter(c => c.scripType === t).length;
console.log(`  Scrips  ${collectibles.length} collectables (${count("purple")} purple, ${count("orange")} orange), ${materia.length} materia`
  + Object.entries(exchanges).map(([t, e]) => `\n    ${t}: grade ${e.grade} at ${e.materiaCost}, ${e.offers.length} materia offers`).join("")
  + (warn.length ? "\n  " + warn.join("\n  ") : ""));
