/* Rebuilds the recipe catalogues behind the Dashboard and Precrafts tabs from Teamcraft's
   recipes and the game's Item table. They were first baked by a one-off script that was not
   kept, so this reproduces its rules and carries the hand-made parts of that bake forward:
     Dashboard  every marketable item a personal (not Free Company) recipe makes
     Precrafts  every craftable item that is itself an ingredient of some recipe
   What carries forward from the catalogues already in src/data/:
   - every row's order, so a rebake only shows what actually changed
   - the Dashboard's HQ or NQ choice for each item. About 430 HQ-able materials were set to
     sell NQ, which game data cannot reproduce, so only new items get the default (HQ when
     any recipe can make it HQ)
   - which recipe a row is costed on, where an item has several and the chosen one still exists
   - Precrafts rows added by hand, while the item is still craftable
   The "new" badge on Precrafts: an item whose id is past every id the old catalogues knew is
   new to the game, and is tagged with the patch; tags from any earlier patch are dropped.
     node tools/build-crafts.js             tag with the latest patch (PATCH env, or GitHub)
     node tools/build-crafts.js --offline   no lookup: new items stay untagged, old tags stay
   Writes out/DASHBOARD.json and out/PRECRAFTS.json as one-line JSON text; apply.js lays them
   out in src/data/. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { OUT, ROOT, need, readJSON, items, marketable, latestGameData } = require("./lib/common");

const JOBS = { 8: "CRP", 9: "BSM", 10: "ARM", 11: "GSM", 12: "LTW", 13: "WVR", 14: "ALC", 15: "CUL" };

/* the desk's own category words, so a new row's tag matches every other tab */
function loadCatLabel() {
  const src = fs.readFileSync(path.join(ROOT, "src/shared/data-layer.js"), "utf8");
  const a = src.indexOf("const CAT_GENERAL"), b = src.indexOf("function catSlug");
  if (a < 0 || b < a) throw new Error("src/shared/data-layer.js: could not find catLabel (CAT_GENERAL ... catSlug)");
  const box = {};
  vm.runInNewContext(src.slice(a, b) + "\nthis.catLabel = catLabel;", box);
  return box.catLabel;
}

(async () => {
  const offline = process.argv.includes("--offline");
  let patch = process.env.PATCH || null;
  if (!patch && !offline) {
    try { patch = (await latestGameData()).patch; }
    catch (e) { console.log(`  note: could not look up the patch (${e.message}), so no "new" badges change`); }
  }
  /* the badge reads "new <patch>", so only a patch number will do: a commit titled
     anything else (latestGameData falls back to "new game data") leaves the badges alone */
  if (patch && !/^\d+\.\d+[a-z]?$/.test(patch)) {
    console.log(`  "${patch}" is not a patch number, so no "new" badges change`);
    patch = null;
  }

  const I = items();
  const catLabel = loadCatLabel();
  const all = readJSON(need("recipes.json"));
  const personal = all.filter(r => /^\d+$/.test(String(r.id)) && JOBS[r.job]);
  const byResult = new Map();
  for (const r of personal) { if (!byResult.has(r.result)) byResult.set(r.result, []); byResult.get(r.result).push(r); }
  /* ingredients of any recipe, the Free Company's included: workshop parts are precrafts too */
  const usedAsIngredient = new Set();
  for (const r of all) for (const i of r.ingredients || []) usedAsIngredient.add(i.id);

  const dashFile = path.join(ROOT, "src/data/dashboard.json");
  const dashText0 = fs.readFileSync(dashFile, "utf8"), oldDash = JSON.parse(dashText0);
  /* parsing puts numeric keys in ascending order, so the names map's own order is read off the text */
  const oldNameOrder = [...dashText0.slice(dashText0.lastIndexOf('"names"')).matchAll(/"(\d+)"\s*:/g)].map(m => +m[1]);
  const oldPre = readJSON(path.join(ROOT, "src/data/precrafts.json"));
  const knownMax = Math.max(...oldDash.finished.map(f => f.id), ...Object.keys(oldPre).map(Number));
  const nameOf = id => (I[id] && I[id].n) || oldDash.names[id] || (oldPre[id] && oldPre[id].name) || null;
  const maxRlvl = id => Math.max(...byResult.get(id).map(r => r.rlvl || r.lvl || 0));
  const byLevelThenId = (a, b) => maxRlvl(b) - maxRlvl(a) || b - a;

  /* ---- Dashboard ---- */
  const sells = [...byResult.keys()].filter(id => marketable(I, id));
  const sellSet = new Set(sells);
  const oldFinished = new Map(oldDash.finished.map(f => [f.id, f]));
  const row = (id, q) => {
    const ui = I[id].ui;
    const kind = catLabel(ui).toLowerCase();
    return { id, name: I[id].n, kind, group: kind, q, note: ui };
  };
  const added = sells.filter(id => !oldFinished.has(id)).sort(byLevelThenId);
  const dropped = oldDash.finished.filter(f => !sellSet.has(f.id));
  const finished = [
    ...added.map(id => row(id, byResult.get(id).some(r => r.hq) ? "hq" : "nq")),
    ...oldDash.finished.filter(f => sellSet.has(f.id)).map(f => row(f.id, f.q)),
  ];

  const sameRecipe = (r, baked) => r.yields === baked.yields && r.ingredients.length === baked.ingredients.length
    && r.ingredients.every((ing, k) => ing.id === baked.ingredients[k].id && ing.amount === baked.ingredients[k].amount);
  let repicked = 0;
  const recipes = finished.map(f => {
    const options = byResult.get(f.id), baked = oldDash.recipes[f.id];
    let r = baked && options.find(o => sameRecipe(o, baked));
    if (!r) { r = options[options.length - 1]; if (baked) repicked++; }
    return [f.id, { name: f.name, yields: r.yields, ingredients: r.ingredients.map(i => ({ id: i.id, amount: i.amount })) }];
  });

  const wanted = new Set();
  for (const [, r] of recipes) for (const i of r.ingredients) wanted.add(i.id);
  const nameIds = [...oldNameOrder.filter(id => wanted.has(id)),
    ...[...wanted].filter(id => !(id in oldDash.names)).sort((a, b) => a - b)];
  const unnamed = nameIds.filter(id => !nameOf(id));
  if (unnamed.length) console.log(`  WARNING: ${unnamed.length} ingredient(s) have no name in Item.csv: ${unnamed.slice(0, 5).join(", ")}`);

  /* written as text so the recipe and name maps keep the catalogue's order: an object
     would put numeric keys back in ascending order and turn the rebake diff into noise */
  const J = JSON.stringify;
  const dashText = "{" + J("finished") + ":" + J(finished) + ","
    + J("recipes") + ":{" + recipes.map(([id, r]) => J(String(id)) + ":" + J(r)).join(",") + "},"
    + J("names") + ":{" + nameIds.filter(nameOf).map(id => J(String(id)) + ":" + J(nameOf(id))).join(",") + "}}";
  JSON.parse(dashText);
  fs.writeFileSync(path.join(OUT, "DASHBOARD.json"), dashText);

  /* ---- Precrafts ---- */
  const preIds = new Set([...byResult.keys()].filter(id => usedAsIngredient.has(id)));
  for (const id of Object.keys(oldPre).map(Number)) if (byResult.has(id)) preIds.add(id);   // hand-added rows stay while craftable
  const pre = {};
  let tagged = 0, untagged = 0;
  for (const id of [...preIds].sort((a, b) => a - b)) {
    const options = byResult.get(id), old = oldPre[id];
    const r = (old && options.find(o => JOBS[o.job] === old.job)) || options[0];
    const jobs = [...new Set(options.map(o => o.job))].sort((a, b) => a - b).map(j => JOBS[j]);
    const e = { name: I[id] ? I[id].n : old.name, yields: r.yields, job: JOBS[r.job] };
    if (jobs.length > 1) e.jobs = jobs;
    e.lvl = r.lvl;
    e.cat = ((I[id] && I[id].ui) || (old && old.cat) || "").replace(/–/g, "-");
    let tag = old && old.patch;
    if (patch) {
      if (tag && tag !== patch) { tag = null; untagged++; }
      if (!old && id > knownMax) { tag = patch; tagged++; }
    }
    if (tag) e.patch = tag;
    /* shards, crystals and clusters (ids 2-19) stay in: they are part of what a craft costs */
    e.ings = r.ingredients.map(i => ({ id: i.id, name: nameOf(i.id) || "#" + i.id, amount: i.amount }));
    pre[id] = e;
  }
  const preAdded = [...preIds].filter(id => !oldPre[id]), preDropped = Object.keys(oldPre).filter(id => !preIds.has(+id));
  fs.writeFileSync(path.join(OUT, "PRECRAFTS.json"), JSON.stringify(pre));

  const list = ids => ids.slice(0, 8).map(id => `${nameOf(id)} (${id})`).join(", ") + (ids.length > 8 ? `, and ${ids.length - 8} more` : "");
  console.log(`  Dashboard  ${oldDash.finished.length} -> ${finished.length} items`
    + (added.length ? `\n    added: ${list(added)}` : "")
    + (dropped.length ? `\n    dropped (no longer a marketable craft): ${list(dropped.map(f => f.id))}` : "")
    + (repicked ? `\n    ${repicked} item(s) re-costed on another recipe: the baked one no longer exists` : ""));
  console.log(`  Precrafts  ${Object.keys(oldPre).length} -> ${preIds.size} items`
    + (preAdded.length ? `\n    added: ${list(preAdded)}` : "")
    + (preDropped.length ? `\n    dropped (no longer craftable): ${list(preDropped.map(Number))}` : "")
    + (patch ? `\n    patch ${patch}: ${tagged} tagged new, ${untagged} earlier "new" tag(s) dropped` : ""));
})().catch(e => { console.error(e.message); process.exit(1); });
