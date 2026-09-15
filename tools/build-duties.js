/* Builds the Duties + Maps tab's data (tools/.cache/out/DUTY.json): marketable drops from
   dungeons, deep dungeons, variant/criterion, Eureka, Bozja, Occult Crescent, treasure map
   coffers and the portal dungeons maps open, with how often each drops (or what it costs at
   an exchange). It also writes every treasure map and portal with its whole marketable loot
   table, so the tab can say what one map or portal chest is worth.

   Which drops make the list is decided by what they sell for, so this step asks
   Universalis for Europe and North America prices (the lower of the two, so one
   manipulated region cannot sneak an item in). Prices are cached for a day.
     node tools/build-duties.js              use cached prices if under a day old
     node tools/build-duties.js --reprice    ask Universalis again */
const fs = require("fs");
const { OUT, CACHE, cached, need, readJSON, writeJSON, sheet, items, marketable, regionPrices } = require("./lib/common");
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
const MIN = { "Dungeons": 40000, "Variant & Criterion": 40000, "Deep dungeons": 100000, "Eureka": 50000, "Bozja": 50000, "Occult Crescent": 50000,
  "Treasure maps": 40000, "Map portals": 40000 };
const GROUP_ORDER = ["Dungeons", "Deep dungeons", "Variant & Criterion", "Eureka", "Bozja", "Occult Crescent", "Treasure maps", "Map portals"];
/* which maps can open each portal dungeon (the game tables do not link them). From the
   Treasure Hunt page of the consolegameswiki; Presumably Special follows the pattern of
   every other expansion's special map. Map item ids from TreasureHuntRank. A new portal
   shows up as an "unlabelled portal" note. */
const PORTALS = {
  "The Aquapolis": [12243],                                  // Dragonskin
  "The Lost Canals of Uznair": [17836, 24794],               // Gazelleskin, Seemingly Special
  "The Shifting Altars of Uznair": [17836, 24794],
  "The Hidden Canals of Uznair": [19770],                    // Thief's
  "The Dungeons of Lyhe Ghiah": [26745, 33328],              // Zonureskin, Ostensibly Special
  "The Shifting Oubliettes of Lyhe Ghiah": [26745, 33328],
  "The Excitatron 6000": [36612, 39593],                     // Kumbhiraskin, Potentially Special
  "The Shifting Gymnasion Agonon": [39591, 39918],           // Ophiotauroskin, Conceivably Special
  "Cenote Ja Ja Gural": [43557, 44349],                      // Br'aaxskin, Presumably Special
  "Vault Oneiron": [46185],                                  // Gargantuaskin
};
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

/* ---- treasure maps ----
   Dug-up coffers are recorded per zone, and most zones dig up more than one kind of map, so
   the records cannot tell those maps apart. Zones are pooled by expansion, and a zone only
   one map digs in (Elpis, Living Memory) keeps its own pool. Portal chests are recorded as
   one chest for the whole dungeon, so their rate is per chest opened: a run opens one for
   every room you clear. */
const titleCase = n => n.replace(/ (Of|The|And) /g, m => m.toLowerCase());
const MAPS = [];   // {k: "coffer"|"portal", p: pool name, maps: [map item ids], zones, rec, loot: {id: pct}}
{
  const lvlTerr = {}; for (const r of sheet("Level")) lvlTerr[r["#"]] = r.Territory;
  const place = {}; for (const r of sheet("PlaceName")) place[r["#"]] = r.Name;
  const terrName = {}; for (const r of sheet("TerritoryType")) terrName[r["#"]] = place[r.PlaceName];
  const rankMap = {}; for (const r of sheet("TreasureHuntRank")) if (+r.ItemName) rankMap[r["#"]] = +r.ItemName;
  const digs = {};   // zone name -> map item ids
  for (const r of sheet("TreasureSpot")) {
    const map = rankMap[r["#"].split(".")[0]], zone = terrName[lvlTerr[r.Location]];
    if (map && zone) (digs[zone] = digs[zone] || new Set()).add(map);
  }
  const zonesOf = {}; for (const [z, ms] of Object.entries(digs)) for (const m of ms) (zonesOf[m] = zonesOf[m] || new Set()).add(z);
  const pool = (key, init) => { let x = MAPS.find(m => m.key === key); if (!x) MAPS.push(x = { key, ...init, zones: [], rec: 0, amt: {} }); return x; };
  const addChests = (x, d) => {
    for (const chests of Object.values(d.Chests)) for (const ch of chests) {
      x.rec += ch.Records;
      for (const r of ch.Rewards) x.amt[r.Id] = (x.amt[r.Id] || 0) + r.Amount;
    }
  };
  const cats = readJSON(need("ChestDropsV2.json"));
  for (const cat of cats) {
    if (cat.Id === 9) for (const e of cat.Expansions) for (const h of e.Headers) for (const d of h.Duties) {
      const name = titleCase(d.Name), opened = PORTALS[name];
      if (!opened) { warn.push(`unlabelled portal "${name}" — add it to PORTALS with the maps that open it`); continue; }
      addChests(pool("portal|" + name, { k: "portal", p: name, exp: e.Name, maps: opened }), d);
    }
    if (cat.Id === 100000) for (const e of cat.Expansions) for (const h of e.Headers) for (const d of h.Duties) {
      const ms = digs[titleCase(d.Name)] || digs[d.Name];
      if (!ms) continue;   // not a treasure zone (the unnamed rows are other open-world coffers)
      const sold = [...ms].filter(mb);
      const own = sold.length === 1 && zonesOf[sold[0]].size === 1;
      const x = pool(own ? "coffer|" + sold[0] : "coffer|" + e.Name, { k: "coffer", exp: e.Name, maps: [] });
      for (const m of sold) if (!x.maps.includes(m)) x.maps.push(m);
      x.zones.push(d.Name);
      addChests(x, d);
    }
  }
  for (const x of MAPS) {
    x.maps.sort((a, b) => a - b);
    /* "Loboskin or Br'aaxskin map"; a pool of many low-level maps goes by its expansion */
    const short = x.maps.map(m => I[m].n.replace(/^Timeworn /, "").replace(/ Map$/, ""));
    if (x.k === "coffer") x.p = short.length > 3 ? x.exp + " maps" : short.slice(0, -1).join(", ") + (short.length > 1 ? " or " : "") + short[short.length - 1] + " map";
    x.loot = {};
    for (const [id, a] of Object.entries(x.amt)) if (mb(+id) && a / x.rec >= 0.0001) x.loot[id] = a / x.rec * 100;
    for (const [id, pct] of Object.entries(x.loot))
      add(+id, { g: x.k === "portal" ? "Map portals" : "Treasure maps", p: x.p, f: x.k === "portal" ? "portal chest" : "treasure coffer", pct, n: x.rec });
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
const prices = regionPrices;

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
  /* every map and portal with its whole marketable loot table, likeliest first; names for
     loot the item list above does not already carry */
  const listed = new Set(out.map(it => it.i)), names = {};
  const maps = MAPS.map(x => {
    const loot = Object.entries(x.loot).map(([id, pct]) => [+id, +pct.toFixed(3)]).sort((a, b) => b[1] - a[1]);
    for (const id of [...loot.map(l => l[0]), ...x.maps]) if (!listed.has(id)) names[id] = I[id].n;
    const m = { k: x.k, p: x.p, exp: x.exp, maps: x.maps, rec: x.rec, loot };
    if (x.zones.length) m.zones = x.zones.map(titleCase);
    return m;
  });
  const DUTY = { groups: GROUP_ORDER, items: out, maps, names, updated: readJSON(need("LastUpdate.json")) };
  writeJSON(OUT + "/DUTY.json", DUTY);

  const cnt = {}; for (const it of out) for (const g of new Set(it.src.map(s => s.g))) cnt[g] = (cnt[g] || 0) + 1;
  console.log(`DUTY: ${out.length} items — ` + GROUP_ORDER.map(g => `${g} ${cnt[g] || 0}`).join(", ")
    + `; ${maps.length} maps and portals, ${Object.keys(names).length} extra loot names`);
  for (const w of [...new Set(warn)]) console.log("  note: " + w);
})().catch(e => { console.error(e.message); process.exit(1); });
