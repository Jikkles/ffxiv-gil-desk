/* Builds the Submersibles tab's data (tools/.cache/out/SUB.json):
   every sector with its position, survey time and distance, tanks, exp and
   breakpoints; the loot a visit brings back; part stats and rank bonuses. */
const fs = require("fs");
const { OUT, need, readJSON, writeJSON, sheet, items } = require("./lib/common");

const I = items();
const LOOT = readJSON(need("Submarines.json"));
const TP = readJSON(need("submarine-parts.json"));

/* SubmarineTracker's MapBreakpoints: sector -> [T2, T3, Normal, Optimal, Favor].
   A sector newer than the tracker's table has none, and the tab then treats the
   build as meeting it — so pull Sectors.cs again when a new sea arrives. */
const bp = {};
for (const m of fs.readFileSync(need("Sectors.cs"), "utf8").matchAll(/\{\s*(\d+),\s*new Breakpoint\((\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\)\s*\}/g))
  bp[+m[1]] = [+m[2], +m[3], +m[4], +m[5], +m[6]];

const maps = {};
for (const r of sheet("SubmarineMap")) if (r.Name) maps[r["#"]] = r.Name;

const starts = {}, sectors = [], itemsUsed = new Set(), vendor = {};
const mid = a => a ? (a[0] + a[1]) / 2 : null;
let noBp = 0;
for (const r of sheet("SubmarineExploration")) {
  const pos = [+r.X, +r.Y, +r.Z];
  if (r.StartingPoint === "True") { starts[r.Map] = pos; continue; }
  if (!r.Destination) continue;
  const id = +r["#"];
  const L = LOOT.Sectors[id];
  if (!bp[id]) noBp++;
  const s = {
    id, m: +r.Map, l: r.Location, n: r.Destination.replace(/\s*\([A-Z]+\)$/, "").replace(/\*/g, ""),
    r: +r.RankReq, p: pos, sm: +r.SurveyDurationmin, sd: +r.SurveyDistance, t: +r.CeruleumTankReq, xp: +r.ExpReward,
    bp: bp[id] || null, rpv: 1, n0: 0, loot: []
  };
  if (L && L.Records > 1000) {
    /* Records counts loot rolls. A visit whose favor proc'd rolls twice, and both
       of those rolls are counted in DoubleDips, so visits = singles + doubles / 2 */
    let dd = 0; for (const p of Object.values(L.Pools)) dd += (p.Stats && p.Stats.DoubleDips) || 0;
    s.rpv = +(L.Records / ((L.Records - dd) + dd / 2)).toFixed(3);
    s.n0 = L.Records;
    for (const [tier, p] of Object.entries(L.Pools)) {
      for (const rw of Object.values(p.Rewards)) {
        const x = I[rw.Id]; if (!x) continue;
        const perRoll = rw.Total / L.Records;
        if (perRoll < 0.0005) continue;
        const mb = x.sc > 0 && !x.ut;
        const isVendor = !mb && x.pl >= 1000;           // the salvaged accessories
        if (!mb && !isVendor) continue;
        const avgQ = rw.Total / rw.Amount;
        const nrm = mid(rw.MinMax && rw.MinMax.Normal);
        /* retrieval below the optimal breakpoint: the quantity falls to the normal band */
        const normFactor = nrm && avgQ ? Math.min(1, nrm / avgQ) : 1;
        s.loot.push([rw.Id, +perRoll.toFixed(4), +normFactor.toFixed(3), +tier.replace("Tier", "")]);
        itemsUsed.add(rw.Id);
        if (isVendor) vendor[rw.Id] = x.pl;
      }
    }
    s.loot.sort((a, b) => b[1] - a[1]);
  }
  sectors.push(s);
}

const parts = sheet("SubmarinePart").filter(p => p["#"] !== "0").map(p => {
  const t = TP[p["#"]];
  return { id: +p["#"], c: +p.Class, slot: +p.Slot, rank: +p.Rank, st: [+p.Surveillance, +p.Retrieval, +p.Speed, +p.Range, +p.Favor], rep: +p.RepairMaterials, item: t ? t.itemId : 0 };
});
/* rank bonus rows, index = rank; the sheet's last rows are zeroed placeholders,
   so they hold the last real bonus */
const ranks = [[0, 0, 0, 0, 0]];
for (const r of sheet("SubmarineRank")) {
  if (r["#"] === "0") continue;
  ranks[+r["#"]] = [+r.SurveillanceBonus, +r.RetrievalBonus, +r.SpeedBonus, +r.RangeBonus, +r.FavorBonus];
}
let last = ranks[1];
for (let i = 1; i < ranks.length; i++) { if (ranks[i] && ranks[i].some(v => v)) last = ranks[i]; else if (i > 50) ranks[i] = last; }

const names = {};
for (const id of itemsUsed) names[id] = [I[id].n, I[id].ui];
for (const p of parts) if (p.item && I[p.item]) names[p.item] = [I[p.item].n, I[p.item].ui];
names[10373] = [I[10373].n, I[10373].ui];   // Magitek Repair Materials

const SUB = { maps, starts, sectors, parts, ranks, vendor, names, records: LOOT.Total };
writeJSON(OUT + "/SUB.json", SUB);
console.log(`SUB: ${Object.keys(maps).length} seas, ${sectors.length} sectors (${sectors.filter(s => s.loot.length).length} with loot records), ${itemsUsed.size} loot items`);
if (noBp) console.log(`  note: ${noBp} sector(s) have no breakpoints in SubmarineTracker yet`);
const seasWithoutStart = Object.keys(maps).filter(m => !starts[m]);
if (seasWithoutStart.length) console.log(`  WARNING: no starting point for sea(s) ${seasWithoutStart.join(", ")}`);
