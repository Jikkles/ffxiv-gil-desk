/* Builds the Workshop tab's data (tools/.cache/out/WS.json): every Free Company
   workshop project with its phases, and the recipe under every turn-in so the
   tree can go all the way down. */
const { OUT, need, readJSON, writeJSON, sheet, items } = require("./lib/common");

const I = items();
const R = readJSON(need("recipes.json"));
const JOBS = { 8: "CRP", 9: "BSM", 10: "ARM", 11: "GSM", 12: "LTW", 13: "WVR", 14: "ALC", 15: "CUL" };
const nameOf = id => (I[id] ? I[id].n : "#" + id);

/* the game's tables: sequence -> parts -> processes (phases) -> supply items */
const P = {}, PR = {}, SI = {}, T = {}, DC = {};
for (const r of sheet("CompanyCraftPart")) P[r["#"]] = r;
for (const r of sheet("CompanyCraftProcess")) PR[r["#"]] = r;
for (const r of sheet("CompanyCraftSupplyItem")) SI[r["#"]] = +r.Item;
for (const r of sheet("CompanyCraftType")) T[r["#"]] = r.Name;
for (const r of sheet("CompanyCraftDraftCategory")) DC[r["#"]] = r.Name;

/* one recipe per item, the lowest id — the same rule RECIPE_INDEX uses;
   crystals (ids 2-19) are kept apart so the tree can hide them */
const rec = {};
for (const r of R) {
  if (typeof r.id !== "number" && !/^\d+$/.test(String(r.id))) continue;   // FC and island projects
  const id = +r.id;
  if (rec[r.result] && rec[r.result].rid < id) continue;
  rec[r.result] = {
    rid: id, y: r.yields || 1, job: JOBS[r.job] || "", lvl: r.lvl,
    g: r.ingredients.filter(g => g.id > 19 || g.id < 2).map(g => [g.id, g.amount]),
    cx: r.ingredients.filter(g => g.id >= 2 && g.id <= 19).map(g => [g.id, g.amount])
  };
}

const projects = [], recipes = {}, names = {};
const walk = id => {
  if (recipes[id] || !rec[id]) return;
  recipes[id] = rec[id];
  for (const [g] of rec[id].g) { names[g] = nameOf(g); walk(g); }
  for (const [c] of rec[id].cx) names[c] = nameOf(c);
};
for (const s of sheet("CompanyCraftSequence")) {
  const res = +s.ResultItem; if (!res) continue;
  const phases = [];
  for (let p = 0; p < 8; p++) {
    const part = P[s[`CompanyCraftPart[${p}]`]]; if (!part || part["#"] === "0") continue;
    const procs = [0, 1, 2].map(k => part[`CompanyCraftProcess[${k}]`]).filter(x => +x);
    procs.forEach((prid, i) => {
      const pr = PR[prid], its = [];
      for (let j = 0; j < 12; j++) {
        const si = +pr[`SupplyItem[${j}]`]; if (!si) continue;
        its.push([SI[si], +pr[`SetQuantity[${j}]`], +pr[`SetsRequired[${j}]`]]);
      }
      phases.push({ part: T[part.CompanyCraftType], step: i + 1, of: procs.length, items: its });
    });
  }
  projects.push({ i: res, n: nameOf(res), cat: DC[s.CompanyCraftDraftCategory], type: I[res] ? I[res].ui : "", phases });
  names[res] = nameOf(res);
  for (const ph of phases) for (const [id] of ph.items) { names[id] = nameOf(id); walk(id); }
}
for (const r of Object.values(recipes)) delete r.rid;

const WS = { projects, recipes, names };
writeJSON(OUT + "/WS.json", WS);
const unknownCat = projects.filter(p => !["Housing", "Aetherial Wheels", "Airships & Submersibles"].includes(p.cat));
console.log(`WS: ${projects.length} projects, ${Object.keys(recipes).length} recipes under their turn-ins`);
if (unknownCat.length) console.log(`  WARNING: ${unknownCat.length} project(s) in a category the tab does not know: ${[...new Set(unknownCat.map(p => p.cat))].join(", ")}`);
