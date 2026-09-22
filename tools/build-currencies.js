/* Builds the Currencies tab's data (tools/.cache/out/CURRENCIES.json): for each currency the
   desk tracks, every marketable item it buys, what it costs and which shop sells it.
     node tools/build-currencies.js
   Read from the game's SpecialShop table (tomestones, scrips, seals, tribal currencies,
   potsherds...) and GCScripShopItem (Grand Company seals). Only offers priced in a single
   currency count, and the game's developer shops and placeholder rows are skipped. Where
   an item is sold for the same currency in several shops, the cheapest per unit wins,
   then the lowest shop id. */
const { writeJSON, sheet, OUT } = require("./lib/common");
const path = require("path");

/* ================= things a human may need to extend after a big patch =================
   The currencies the tab lists, in the order it shows them. A new tomestone, scrip or
   tribal currency needs a line here; the build prints a note when it finds one. */
const CURRENCIES = [
  [28, "Allagan Tomestone of Poetics", "Tomestones"],
  [48, "Allagan Tomestone of Mathematics", "Tomestones"],
  [33913, "Purple Crafters' Scrip", "Crafter & Gatherer Scrips"],
  [41784, "Orange Crafters' Scrip", "Crafter & Gatherer Scrips"],
  [33914, "Purple Gatherers' Scrip", "Crafter & Gatherer Scrips"],
  [41785, "Orange Gatherers' Scrip", "Crafter & Gatherer Scrips"],
  [28063, "Skybuilders' Scrip", "Crafter & Gatherer Scrips"],
  [27, "Allied Seal", "Hunts, PvP & Seals"],
  [10307, "Centurio Seal", "Hunts, PvP & Seals"],
  [26533, "Sack of Nuts", "Hunts, PvP & Seals"],
  [25, "Wolf Mark", "Hunts, PvP & Seals"],
  [36656, "Trophy Crystal", "Hunts, PvP & Seals"],
  [20, "Grand Company Seals", "Hunts, PvP & Seals"],
  [26807, "Bicolor Gemstone", "Exploration & Events"],
  [30341, "Faux Leaf", "Exploration & Events"],
  [21172, "Achievement Certificate", "Exploration & Events"],
  [29, "MGP", "Exploration & Events"],
  [37549, "Seafarer's Cowrie", "Exploration & Events"],
  [37550, "Islander's Cowrie", "Exploration & Events"],
  [45690, "Cosmocredit", "Exploration & Events"],
  [51734, "Faded Remnant of Resilience", "Exploration & Events"],
  [38533, "Sil'dihn Potsherd", "Variant & Deep Dungeons"],
  [39884, "Rokkon Potsherd", "Variant & Deep Dungeons"],
  [41078, "Aloalo Potsherd", "Variant & Deep Dungeons"],
  [50434, "Corvosi Potsherd", "Variant & Deep Dungeons"],
  [15422, "Gelmorran Potsherd", "Variant & Deep Dungeons"],
  [23164, "Empyrean Potsherd", "Variant & Deep Dungeons"],
  [21073, "Ixali Oaknot", "Tribal / Society"],
  [21074, "Vanu Whitebone", "Tribal / Society"],
  [21075, "Sylphic Goldleaf", "Tribal / Society"],
  [21076, "Steel Amalj'ok", "Tribal / Society"],
  [21077, "Rainbowtide Psashp", "Tribal / Society"],
  [21078, "Titan Cobaltpiece", "Tribal / Society"],
  [21079, "Black Copper Gil", "Tribal / Society"],
  [21080, "Carved Kupo Nut", "Tribal / Society"],
  [21081, "Kojin Sango", "Tribal / Society"],
  [21935, "Ananta Dreamstaff", "Tribal / Society"],
  [22525, "Namazu Koban", "Tribal / Society"],
  [28186, "Fae Fancy", "Tribal / Society"],
  [28187, "Qitari Compliment", "Tribal / Society"],
  [28188, "Hammered Frogment", "Tribal / Society"],
  [36657, "Arkasodara Pana", "Tribal / Society"],
  [37854, "Omicron Omnitoken", "Tribal / Society"],
  [38952, "Loporrit Carat", "Tribal / Society"],
  [44472, "Pelu Pelplume", "Tribal / Society"],
  [46178, "Yok Huy Ward", "Tribal / Society"],
  [48084, "Mamool Ja Nanook", "Tribal / Society"],
];
/* currency-category items that buy marketable things but are deliberately not listed:
   criterion and variant side currencies, and the Gold Saucer's festival MGF */
const IGNORED = [38534, 39885, 41079, 41629, 49125];
/* SpecialShop costs of type 3 are an index into the scrips, not an item id */
const SCRIPS = { 2: 33913, 4: 33914, 6: 41784, 7: 41785 };
/* the game's developer shops, and the Potion it pads unused scrip shop slots with at 999 */
const DEV_SHOPS = /^(Currency Test|Items in Development)$/;
const PLACEHOLDER_ITEMS = [4551];
/* shops whose name the game leaves blank, named by the currency they take */
const BLANK_SHOP_NAMES = { 23164: "Exchange artifacts" };

const GC_SHOP_NAME = "Grand Company Quartermaster";
const GC_SEALS = 20;

/* ---- the item table, as this build reads it ---- */
const ITEM = {};
const uiName = {};
for (const r of sheet("ItemUICategory")) uiName[r["#"]] = r.Name;
for (const r of sheet("Item")) {
  if (!r.Name) continue;
  ITEM[r["#"]] = { n: r.Name, cat: +r.ItemUICategory, st: +r.StackSize, hq: r.CanBeHq === "True",
    ic: +r.Icon, mb: +r.ItemSearchCategory > 0 && r.IsUntradable !== "True" };
}
const listed = new Map(CURRENCIES.map(([id]) => [id, []]));
const notes = new Set();

/* tomestone costs (type 2) are a slot in TomestonesItem, which moves each expansion */
const TOMESTONES = {};
for (const r of sheet("TomestonesItem")) if (+r.Tomestones) TOMESTONES[+r.Tomestones] = +r.Item;

function offer(cur, e) {
  const list = listed.get(cur);
  if (list) { list.push(e); return; }
  if (IGNORED.includes(cur)) return;
  const it = ITEM[cur];
  if (it && uiName[it.cat] === "Currency") notes.add(`note: currency ${cur} "${it.n}" buys marketable items but is not in CURRENCIES or IGNORED`);
}

for (const r of sheet("SpecialShop")) {
  const shop = +r["#"];
  for (let k = 0; r[`Item[${k}].Item[0]`] !== undefined; k++) {
    const id = +r[`Item[${k}].Item[0]`];
    if (!id || !ITEM[id] || !ITEM[id].mb || PLACEHOLDER_ITEMS.includes(id) || DEV_SHOPS.test(r.Name)) continue;
    const costs = [0, 1, 2].map(j => [+r[`Item[${k}].ItemCost[${j}]`], +r[`Item[${k}].CurrencyCost[${j}]`], +r[`Item[${k}].CostType[${j}]`]])
      .filter(([c, amt]) => c || amt);
    /* a price in two currencies at once has no single rate to rank by */
    if (costs.length !== 1) continue;
    const [raw, amount, type] = costs[0];
    let cur = raw;
    if (type === 2) {
      cur = TOMESTONES[raw];
      if (!cur) { notes.add(`note: tomestone slot ${raw} is not in TomestonesItem`); continue; }
    } else if (type === 3) {
      cur = SCRIPS[raw];
      if (!cur) { notes.add(`note: scrip index ${raw} is not in SCRIPS`); continue; }
    }
    offer(cur, { i: id, c: amount, q: +r[`Item[${k}].ReceiveCount[0]`], s: r.Name || BLANK_SHOP_NAMES[cur] || "", shop, k });
  }
}
for (const r of sheet("GCScripShopItem")) {
  const id = +r.Item, [shop, k] = r["#"].split(".").map(Number);
  if (!id || !ITEM[id] || !ITEM[id].mb) continue;
  offer(GC_SEALS, { i: id, c: +r.CostGCSeals, q: 1, s: GC_SHOP_NAME, shop, k });
}

const out = { currencies: [], items: {} };
const used = new Set();
for (const [id, name, group] of CURRENCIES) {
  if (!ITEM[id]) { notes.add(`note: currency ${id} "${name}" is no longer in the item table`); continue; }
  const best = new Map();
  for (const e of listed.get(id)) {
    const have = best.get(e.i);
    if (!have || e.c / e.q < have.c / have.q || (e.c / e.q === have.c / have.q && (e.shop - have.shop || e.k - have.k) < 0)) best.set(e.i, e);
  }
  const items = [...best.values()].sort((a, b) => a.c - b.c || a.i - b.i).map(e => ({ i: e.i, c: e.c, q: e.q, s: e.s }));
  if (!items.length) notes.add(`note: ${name} buys nothing marketable any more`);
  for (const e of items) used.add(e.i);
  out.currencies.push({ id, name, group, items, ic: ITEM[id].ic });
}
for (const id of [...used].sort((a, b) => a - b)) {
  const it = ITEM[id], m = { n: it.n, cat: it.cat, st: it.st };
  if (it.hq) m.hq = 1;
  out.items[id] = m;
}

writeJSON(path.join(OUT, "CURRENCIES.json"), out);
console.log(`CURRENCIES: ${out.currencies.length} currencies, ${used.size} items, ${out.currencies.reduce((s, c) => s + c.items.length, 0)} offers`);
for (const n of notes) console.log("  " + n);
