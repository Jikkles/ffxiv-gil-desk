/* Builds the Flips tab's item list (tools/.cache/out/FLIPS.json):
     node tools/build-flips.js              use cached prices if under a day old
     node tools/build-flips.js --reprice    ask Universalis again
   Every marketable item that unlocks a mount, a minion, a hairstyle or an emote, and every
   outfit coffer, read from the game's Item and ItemAction tables. What an item does when
   used is its ItemAction, which is what tells a mount whistle from a crafting material that
   happens to be called "Ifrit's Horn".
   Glamour extras - orchestrion rolls, facewear and fashion accessories (parasols, wings) -
   run to hundreds of cheap items, so only the ones that sell for real money make the list:
   the lower of the Europe and North America 30-day averages must reach MIN, so one
   manipulated region cannot sneak an item in. Pure White and Jet Black dye are always in. */
const path = require("path");
const { OUT, writeJSON, sheet, items, marketable, regionPrices } = require("./lib/common");

/* ================= things a human may need to extend after a big patch =================
   ItemAction.Action ids, and the name tests that split the one "unlock" action into
   hairstyles and emotes. */
const MOUNT = 1322, MINION = 853, UNLOCK = 2633, COFFER = 29153, ROLL = 25183, FACEWEAR = 37312, ACCESSORY = 20086;
const KIND = [
  [a => a === MOUNT, "Mount"],
  [a => a === MINION, "Minion"],
  [(a, n) => a === UNLOCK && /^Modern Aesthetics\b/.test(n), "Hairstyle"],
  [(a, n) => a === UNLOCK && /^Ballroom Etiquette\b/.test(n), "Emote"],
  [(a, n) => a === COFFER && /\bCoffer\b/.test(n), "Outfit Coffer"],
  [a => a === ROLL, "Orchestrion Roll"],
  [a => a === FACEWEAR, "Facewear"],
  [a => a === ACCESSORY, "Fashion Accessory"],
  [(a, n) => /^General-purpose (Pure White|Jet Black) Dye$/.test(n), "Dye"],
];
/* the kinds that must sell for at least this much to be listed */
const MIN = { "Orchestrion Roll": 50000, "Facewear": 50000, "Fashion Accessory": 50000 };
const ORDER = KIND.map(k => k[1]);
/* ======================================================================================= */

const I = items();
const action = {};
for (const r of sheet("ItemAction")) action[r["#"]] = +r.Action;

(async () => {
  const found = [], unsorted = [];
  for (const r of sheet("Item")) {
    const id = +r["#"];
    if (!r.Name || !marketable(I, id)) continue;
    const a = action[r.ItemAction] || 0;
    const kind = KIND.find(([test]) => test(a, r.Name));
    if (kind) found.push({ id, name: r.Name.trim(), cat: kind[1] });
    else if (a === UNLOCK) unsorted.push(r.Name);
  }

  const priced = found.filter(x => MIN[x.cat]).map(x => x.id);
  const EU = await regionPrices("Europe", priced), NA = await regionPrices("North-America", priced);
  const robust = id => EU[id] != null && NA[id] != null ? Math.min(EU[id], NA[id]) : null;
  const cut = {};
  const out = found.filter(x => {
    if (!MIN[x.cat] || robust(x.id) >= MIN[x.cat]) return true;
    cut[x.cat] = (cut[x.cat] || 0) + 1;
    return false;
  });
  out.sort((x, y) => ORDER.indexOf(x.cat) - ORDER.indexOf(y.cat) || x.id - y.id);
  writeJSON(path.join(OUT, "FLIPS.json"), out);

  const count = {};
  for (const x of out) count[x.cat] = (count[x.cat] || 0) + 1;
  console.log(`  Flips  ${out.length} items: ` + ORDER.map(c => `${count[c] || 0} ${c.toLowerCase()}`).join(", ")
    + `\n    under the price floor, left out: ` + Object.keys(MIN).map(c => `${cut[c] || 0} ${c.toLowerCase()}`).join(", ")
    + (unsorted.length ? `\n  note: ${unsorted.length} unlock item(s) are neither a hairstyle nor an emote and are left out: ${unsorted.slice(0, 5).join(", ")}` : ""));
})().catch(e => { console.error(e.message); process.exit(1); });
