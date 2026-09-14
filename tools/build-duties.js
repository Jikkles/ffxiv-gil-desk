/* Builds the Duties tab's data (tools/.cache/out/DUTY.json): marketable drops from
   dungeons, deep dungeons, variant/criterion, Eureka, Bozja and Occult Crescent,
   with how often each drops (or what it costs at an exchange).

   Which drops make the list is decided by what they sell for, so this step asks
   Universalis for Europe and North America prices (the lower of the two, so one
   manipulated region cannot sneak an item in). Prices are cached for a day.
     node tools/build-duties.js              use cached prices if under a day old
     node tools/build-duties.js --reprice    ask Universalis again */
const fs = require("fs");
const { OUT, CACHE, cached, need, readJSON, writeJSON, sheet, items, marketable } = require("./lib/common");
const { readSrc } = require("./build");

const I = items();
const mb = id => marketable(I, id);

/* ================= things a human may need to extend after a big patch =================
   A new deep dungeon, field operation zone or variant dungeon usually arrives in
   Infi's exports on its own; the lists below only decide how it is labelled and
   whether it counts. Run the build and read its "unlabelled" warnings. */
/* lockbox zones that are field operations, and ones deliberately left out */
const LOCKBOX_ZONES = { Anemos: "Eureka", Pagos: "Eureka", Pyros: "Eureka", Hydatos: "Eureka", Bozja: "Bozja" };
const LOCKBOX_IGNORED = ["Oizys", "Auxesia"];   // Cosmic Exploration, not a duty
/* ChestDropsV2 categories: 2 = Dungeons, 30 = V&C Dungeon Finder */
const CHEST_CATEGORIES = { 2: "Dungeons", 30: "Variant & Criterion" };
/* field operation currencies and the content they belong to (SpecialShop item costs) */
const FIELD_CURRENCIES = {
  31135: ["Bozja", "Bozjan Cluster exchange"],
  45043: ["Occult Crescent", "Silver Piece exchange"],
  45044: ["Occult Crescent", "Gold Piece exchange"],
};
/* potsherds come from the Currencies tab's own shop data; these are deep dungeon ones */
const DEEP_POTSHERDS = /Gelmorran|Empyrean/;
/* notorious monster FATE drops no coffer record can see, so no rate: [item, group, place, FATE] */
const FATE = [
  [22973, "Eureka", "Eureka Pagos", "Cassie and the Copycats (Copycat Cassie)"],
  [36121, "Eureka", "Eureka Pagos", "Hear Ye, Hear Ye (King Arthro)"],
  [23342, "Eureka", "Eureka Pagos", "Third Impact (Behemoth)"],
  [24285, "Eureka", "Eureka Pyros", "Thirty Whacks (Lamebrix Strikebocks)"],
  [24286, "Eureka", "Eureka Pyros", "Haunter of the Dark (Ying-Yang)"],
  [24287, "Eureka", "Eureka Pyros", "Heavens' Warg (Skoll)"],
  [24817, "Eureka", "Eureka Hydatos", "Bullheaded Berserker (Molech)"],
  [24818, "Eureka", "Eureka Hydatos", "Duty-free (Goldemar)"],
  [24819, "Eureka", "Eureka Hydatos", "Stone-cold Killer (Ceto)"],
];
/* the price a drop needs (lower of EU and NA 30-day averages) to be worth listing */
const MIN = { "Dungeons": 40000, "Variant & Criterion": 40000, "Deep dungeons": 100000, "Eureka": 50000, "Bozja": 50000, "Occult Crescent": 50000 };
const GROUP_ORDER = ["Dungeons", "Deep dungeons", "Variant & Criterion", "Eureka", "Bozja", "Occult Crescent"];
/* ======================================================================================= */

const sources = {};   // item -> [{g, p, f, pct, n} | {g, p, f:"exchange", cost, cur, curId} | {g, p, f, fate}]
const add = (id, s) => { if (mb(id)) (sources[id] = sources[id] || []).push(s); };
const warn = [];

/* coffers: every patch a pool was recorded in is summed, so a thin recent patch
   does not swing the rate; pct = times seen / coffers opened */
function coffers(file, groupOf, placeOf, nameOf) {
  for (const c of readJSON(need(file + ".json"))) {
    const g = groupOf(c); if (!g) continue;
    for (const v of c.Variants) {
      let total = 0; const agg = {};
      for (const p of Object.values(v.Patches)) {
        total += p.Total;
        for (const x of p.Items || []) { const a = agg[x.Id] = agg[x.Id] || { amount: 0 }; a.amount += x.Amount; }
      }
      for (const [id, a] of Object.entries(agg))
        add(+id, { g, p: placeOf(c, v), f: nameOf(v), pct: a.amount / total * 100, n: total });
    }
  }
}
coffers("DeepDungeonSacks", () => "Deep dungeons", c => c.Name, v => v.Name);
coffers("EurekaBunnies", () => "Eureka", c => "Eureka " + c.Name, v => v.Name.toLowerCase() + " bunny coffer");
coffers("FieldOpLockboxes",
  c => {
    if (LOCKBOX_ZONES[c.Name]) return LOCKBOX_ZONES[c.Name];
    if (!LOCKBOX_IGNORED.includes(c.Name)) warn.push(`new lockbox zone "${c.Name}" is not labelled — add it to LOCKBOX_ZONES or LOCKBOX_IGNORED`);
    return null;
  },
  (c, v) => LOCKBOX_ZONES[c.Name] === "Bozja" ? (/Zadnor/.test(v.Name) ? "Zadnor" : "Bozjan Southern Front") : "Eureka " + c.Name,
  v => v.Name);
coffers("OccultTreasuresV2", () => "Occult Crescent", c => "Occult Crescent · " + c.Name, v => {
  const m = /^(Treasure|Pot|Bunny) (Bronze|Silver|Gold)$/.exec(v.Name);
  return m ? m[2].toLowerCase() + " " + { Treasure: "treasure coffer", Pot: "pot coffer", Bunny: "bunny coffer" }[m[1]] : v.Name;
});

/* duty chests: a run opens every chest once, so a run's chance is the sum of each
   chest's own rate, capped at 100% */
for (const cat of readJSON(need("ChestDropsV2.json"))) {
  const g = CHEST_CATEGORIES[cat.Id]; if (!g) continue;
  for (const e of cat.Expansions) for (const h of e.Headers) for (const d of h.Duties) {
    const per = {};
    for (const chests of Object.values(d.Chests)) for (const ch of chests) {
      const k = ch.Id + ":" + Math.round(ch.Position.X) + ":" + Math.round(ch.Position.Z);
      const p = per[k] = per[k] || { rec: 0, it: {} };
      p.rec += ch.Records;
      for (const x of ch.Rewards) p.it[x.Id] = (p.it[x.Id] || 0) + x.Amount;
    }
    const run = {};
    for (const p of Object.values(per)) for (const [id, amt] of Object.entries(p.it)) run[id] = (run[id] || 0) + amt / p.rec;
    for (const [id, pr] of Object.entries(run))
      add(+id, { g, p: d.Name, f: e.Name + " dungeon chests", pct: Math.min(100, pr * 100), n: d.Records });
  }
}

/* potsherd exchanges, read from the Currencies data so the two tabs always agree: this
   rebake's build-currencies.js output when there is one, otherwise what the tab has now */
const CD = fs.existsSync(cached("out/CURRENCIES.json")) ? readJSON(cached("out/CURRENCIES.json")) : JSON.parse(readSrc("data/currencies.json"));
for (const c of CD.currencies) {
  if (c.group !== "Variant & Deep Dungeons") continue;
  const deep = DEEP_POTSHERDS.test(c.name);
  for (const x of c.items)
    add(x.i, { g: deep ? "Deep dungeons" : "Variant & Criterion", p: c.name.replace(" Potsherd", "") + (deep ? " potsherd exchange" : " variant exchange"), f: "exchange", cost: x.c, cur: c.name, curId: c.id });
}
/* field operation currency exchanges, from the game's SpecialShop table */
for (const r of sheet("SpecialShop")) {
  for (let i = 0; i < 60; i++) {
    const rid = +r[`Item[${i}].Item[0]`]; if (r[`Item[${i}].Item[0]`] == null) break; if (!rid) continue;
    for (let c = 0; c < 3; c++) {
      const cid = +r[`Item[${i}].ItemCost[${c}]`], fc = FIELD_CURRENCIES[cid];
      if (!fc) continue;
      add(rid, { g: fc[0], p: fc[1], f: "exchange", cost: +r[`Item[${i}].CurrencyCost[${c}]`], cur: I[cid].n, curId: cid });
    }
  }
}
for (const [id, g, p, f] of FATE) add(id, { g, p, f, fate: 1 });

/* ---- prices: which of these sell for real money ---- */
async function prices(scope, ids) {
  const file = cached(`prices-${scope}.json`);
  let out = {};
  const fresh = fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < 86400000 && !process.argv.includes("--reprice");
  if (fresh) out = readJSON(file);
  const todo = ids.filter(id => !(id in out));
  const region = /^(Europe|North-America|Japan|Oceania)$/.test(scope);
  for (let i = 0; i < todo.length; i += 100) {
    const batch = todo.slice(i, i + 100);
    for (let a = 0; a < 5; a++) {
      try {
        const r = await fetch(`https://universalis.app/api/v2/aggregated/${scope}/${batch.join(",")}`);
        if (!r.ok) throw new Error("HTTP " + r.status);
        const j = await r.json();
        for (const row of j.results || []) {
          const pick = q => q && q.averageSalePrice && q.averageSalePrice[region ? "region" : "dc"] ? q.averageSalePrice[region ? "region" : "dc"].price : null;
          out[row.itemId] = pick(row.nq) ?? pick(row.hq);
        }
        for (const id of batch) if (!(id in out)) out[id] = null;
        break;
      } catch (e) {
        if (a === 4) throw new Error("Universalis " + scope + ": " + e.message);
        await new Promise(res => setTimeout(res, 3000 * (a + 1)));
      }
    }
    process.stdout.write(`\r  pricing on ${scope}: ${Math.min(i + 100, todo.length)}/${todo.length}`);
    await new Promise(res => setTimeout(res, 400));
  }
  if (todo.length) process.stdout.write("\n");
  writeJSON(file, out);
  return out;
}

(async () => {
  const ids = Object.keys(sources).map(Number);
  const EU = await prices("Europe", ids), NA = await prices("North-America", ids);
  const robust = id => EU[id] != null && NA[id] != null ? Math.min(EU[id], NA[id]) : null;
  const best = id => Math.max(EU[id] || 0, NA[id] || 0);

  const items = {};
  const keep = (id, s) => {
    const it = items[id] = items[id] || { i: id, n: I[id].n, c: I[id].ui, src: [] };
    const key = s.g + "|" + s.p + "|" + s.f;
    const ex = it.src.find(x => x.g + "|" + x.p + "|" + x.f === key);
    if (ex) { if (s.pct != null) ex.pct = Math.max(ex.pct || 0, s.pct); return; }
    it.src.push(s);
  };
  for (const id of ids) {
    for (const s of sources[id]) {
      if (s.fate) { if (best(id) >= 500000 || robust(id) >= MIN[s.g]) keep(id, { g: s.g, p: s.p, f: s.f, fate: 1 }); continue; }
      if (robust(id) == null || robust(id) < MIN[s.g]) continue;
      if (s.pct != null && s.pct < 0.01) continue;   // a handful of freak records
      if (s.cost != null) keep(id, { g: s.g, p: s.p, f: "exchange", cost: s.cost, cur: s.cur, curId: s.curId });
      else keep(id, { g: s.g, p: s.p, f: s.f, pct: +s.pct.toFixed(3), n: s.n });
    }
  }
  const out = Object.values(items).map(it => { it.src.sort((a, b) => (b.pct || 0) - (a.pct || 0) || (a.cost || 0) - (b.cost || 0)); return it; })
    .sort((a, b) => a.n.localeCompare(b.n));
  const DUTY = { groups: GROUP_ORDER, items: out, updated: readJSON(need("LastUpdate.json")) };
  writeJSON(OUT + "/DUTY.json", DUTY);

  const cnt = {}; for (const it of out) for (const g of new Set(it.src.map(s => s.g))) cnt[g] = (cnt[g] || 0) + 1;
  console.log(`DUTY: ${out.length} items — ` + GROUP_ORDER.map(g => `${g} ${cnt[g] || 0}`).join(", "));
  for (const w of [...new Set(warn)]) console.log("  note: " + w);
})().catch(e => { console.error(e.message); process.exit(1); });
