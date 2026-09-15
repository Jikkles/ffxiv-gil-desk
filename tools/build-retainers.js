/* Builds the Retainers tab's data (tools/.cache/out/RETAINERS.json): what the four
   exploration ventures bring back that is worth selling.
     node tools/build-retainers.js              use cached prices if under a day old
     node tools/build-retainers.js --reprice    ask Universalis again
   Run after build-currencies, build-vendors, build-duties and build-subs, whose outputs it
   reads to say where else a new drop comes from.

   Drops come from Infi's crowd-sourced venture records (Ventures.json): per venture tier,
   how many ventures were logged and how many brought each item back. A drop is listed when
   it is marketable, rare (under RARE of the ventures of its best tier) and worth MIN_PRICE
   or more on the lower of the Europe and North America averages, so one manipulated region
   cannot sneak it in. Rows already on the tab stay while they still drop, with the note a
   human checked by hand on whether anything else in the game makes them. */
const fs = require("fs");
const path = require("path");
const { ROOT, OUT, need, readJSON, writeJSON, items, marketable, regionPrices } = require("./lib/common");

/* ================= things a human may need to extend after a big patch ================= */
const VENTURE_OF = { "DoW/DoM": "Field Exploration", "MIN": "Highland Exploration", "BTN": "Woodland Exploration", "FSH": "Waterside Exploration" };
const VENTURE_ORDER = ["Field Exploration", "Highland Exploration", "Woodland Exploration", "Waterside Exploration"];
const MIN_PRICE = 5000;
const RARE = 0.10;
const MIN_SEEN = 3;   // records per tier below this are treated as noise
/* ======================================================================================= */

const I = items();
const ROMAN = n => { const m = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]; let s = ""; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; };
const fromRoman = s => { const v = { I: 1, V: 5, X: 10 }; let n = 0; for (let i = 0; i < s.length; i++) { const a = v[s[i]], b = v[s[i + 1]] || 0; n += a < b ? -a : a; } return n; };
const notes = [];

/* ---- every exploration tier's drops, summed over the patches the records cover ---- */
const drops = new Map();   // id -> { ventures: Map(venture -> Map(tier -> pct)) }
let quick = new Set();
for (const cat of readJSON(need("Ventures.json"))) {
  const venture = VENTURE_OF[cat.Name];
  for (const task of cat.Tasks || []) {
    let total = 0; const seen = {};
    for (const p of Object.values(task.Patches || {})) {
      total += p.Total || 0;
      for (const e of (p.Primaries || []).concat(p.Secondaries || [])) seen[e.Id] = (seen[e.Id] || 0) + (e.Amount || 0);
    }
    if (!venture) { for (const id in seen) if (seen[id] >= MIN_SEEN) quick.add(+id); continue; }
    const m = /\b([IVX]+)$/.exec(task.Name || "");
    if (!m || !total) { notes.push(`note: venture task "${task.Name}" has no tier numeral or no records`); continue; }
    const tier = fromRoman(m[1]);
    for (const id in seen) {
      if (seen[id] < MIN_SEEN || !marketable(I, +id)) continue;
      const d = drops.get(+id) || { ventures: new Map() };
      const t = d.ventures.get(venture) || new Map();
      t.set(tier, Math.max(t.get(tier) || 0, seen[id] / total));
      d.ventures.set(venture, t); drops.set(+id, d);
    }
  }
}

/* ---- tiers as the tab writes them: runs joined with a dash, the rest with commas ---- */
function tierText(tiers) {
  const t = [...new Set(tiers)].sort((a, b) => a - b), out = [];
  for (let i = 0; i < t.length;) {
    let j = i; while (j + 1 < t.length && t[j + 1] === t[j] + 1) j++;
    out.push(j > i ? ROMAN(t[i]) + "-" + ROMAN(t[j]) : ROMAN(t[i]));
    i = j + 1;
  }
  return out.join(", ");
}

/* ---- where else a drop comes from, as far as the desk's own data knows ---- */
const craftable = new Set(readJSON(need("recipes.json")).map(r => r.result));
const optional = name => { try { return readJSON(need("out/" + name)); } catch (e) { notes.push(`note: out/${name} is missing, so other sources are not checked against it`); return null; } };
const VEN = optional("VENDORS.json"), CUR = optional("CURRENCIES.json"), DUTY = optional("DUTY.json"), SUB = optional("SUB.json");
const gilShop = new Set(VEN ? VEN.r.map(r => r[0]) : []);
const currencyOf = new Map();
if (CUR) for (const c of CUR.currencies) for (const e of c.items) if (!currencyOf.has(e.i)) currencyOf.set(e.i, c.name);
const dutyOf = new Map();
if (DUTY) for (const it of DUTY.items) dutyOf.set(it.i, [...new Set(it.src.map(s => s.g))].join(", "));
const subLoot = new Set(SUB ? SUB.sectors.flatMap(s => s.loot.map(l => l[0])) : []);
function elsewhere(id) {
  const o = [];
  if (craftable.has(id)) o.push("crafting");
  if (gilShop.has(id)) o.push("an NPC for gil");
  if (currencyOf.has(id)) o.push(currencyOf.get(id) + " exchange");
  if (dutyOf.has(id)) o.push(dutyOf.get(id));
  if (subLoot.has(id)) o.push("submersible voyages");
  if (quick.has(id)) o.push("quick exploration");
  return o.join(", ");
}

(async () => {
  const old = readJSON(path.join(ROOT, "src/data/retainers.json"));
  const oldById = new Map(old.map(x => [x.i, x]));
  const ids = [...drops.keys()];
  const EU = await regionPrices("Europe", ids), NA = await regionPrices("North-America", ids);
  const robust = id => EU[id] != null && NA[id] != null ? Math.min(EU[id], NA[id]) : null;

  const out = [], gone = [];
  for (const [id, d] of drops) {
    const best = Math.max(...[...d.ventures.values()].flatMap(t => [...t.values()]));
    const was = oldById.get(id);
    const worth = best < RARE && robust(id) != null && robust(id) >= MIN_PRICE;
    if (!was && !worth) continue;
    const vl = VENTURE_ORDER.filter(v => d.ventures.has(v));
    const row = { i: id, n: I[id].n, v: vl.length === 1 ? vl[0] : vl.length === 4 ? "All four" : ["", "", "Two ventures", "Three ventures"][vl.length],
      t: tierText(vl.flatMap(v => [...d.ventures.get(v).keys()])), c: I[id].ui, p: +best.toFixed(4) };
    if (was && (was.x || was.o)) { if (was.x) row.x = 1; else row.o = was.o; }
    else { const o = elsewhere(id); if (o) row.o = o; }
    if (vl.length > 1) row.vl = vl;
    out.push(row);
  }
  for (const x of old) if (!drops.has(x.i)) gone.push(x.n);
  out.sort((a, b) => ((a.vl ? 9 : VENTURE_ORDER.indexOf(a.v)) - (b.vl ? 9 : VENTURE_ORDER.indexOf(b.v)))
    || (a.vl && b.vl ? b.vl.length - a.vl.length : 0) || (robust(b.i) || 0) - (robust(a.i) || 0));
  writeJSON(path.join(OUT, "RETAINERS.json"), out);

  const added = out.filter(r => !oldById.has(r.i));
  console.log(`  Retainers  ${old.length} -> ${out.length} drops`
    + (added.length ? `\n    added: ${added.map(r => `${r.n} (${r.v}, ${Math.round(robust(r.i))} gil)`).join(", ")}` : "")
    + (gone.length ? `\n    no longer in the venture records, dropped: ${gone.join(", ")}` : "")
    /* informational, not a note: a new drop still lists, it just says its other sources are unchecked */
    + (added.some(r => !r.o) ? `\n    ${added.filter(r => !r.o).map(r => r.n).join(", ")}: no other source in the desk's data, so the tab says other sources are unchecked. If the venture really is the only source, mark x in src/data/retainers.json` : "")
    + (notes.length ? "\n  " + [...new Set(notes)].join("\n  ") : ""));
})().catch(e => { console.error(e.message); process.exit(1); });
