/* Builds the Vendors tab's data (tools/.cache/out/VENDORS.json): every marketable item an
   NPC sells for plain gil, what it costs, and one vendor to buy it from.
     node tools/build-vendors.js
   Read from the game's GilShopItem, GilShop, Item, ENpcBase, ENpcResident, Level, Map,
   PlaceName and TerritoryType tables.

   Which vendor is shown, when several stock the item: one with a map position before one
   without, a town vendor before one out in a field zone or a housing ward, then the lowest
   NPC id. The rest are counted, which is the tab's "+n more". Only NPCs whose shop list
   names the gil shop directly count; vendors reached through a menu of shops are not
   followed, so a few items show no NPC at all.

   Output shape, as src/tabs/vendors.html reads it:
     z zones, p NPC names, c UI categories, g groups: lookup lists the rows index into
     r rows: [id, name, gil cost, c, g, p (-1 none), z (-1 none), map x, map y, stack size,
              quest or achievement locked 0/1, vendors stocking it, seasonal shop 0/1] */
const { writeJSON, sheet, OUT } = require("./lib/common");
const path = require("path");

/* ================= things a human may need to extend after a big patch =================
   The tab's broad groups, and the UI categories in each. A category the game adds
   lands in Other with a note until it is filed here. */
const GROUPS = ["Weapon", "Tool", "Armour", "Accessory", "Housing", "Food", "Material", "Fishing", "Music", "Other"];
const GROUP_OF = {
  Armour: ["Head", "Body", "Legs", "Hands", "Feet", "Waist"],
  Accessory: ["Bracelets", "Earrings", "Necklace", "Ring"],
  Housing: ["Construction Permit", "Roof", "Exterior Wall", "Window", "Door", "Roof Decoration", "Exterior Wall Decoration",
    "Placard", "Fence", "Interior Wall", "Flooring", "Ceiling Light", "Outdoor Furnishing", "Furnishing", "Table",
    "Tabletop", "Wall-mounted", "Rug", "Gardening", "Painting"],
  Food: ["Medicine", "Meal", "Ingredient", "Seafood"],
  Material: ["Metal", "Stone", "Leather", "Cloth", "Lumber", "Bone", "Reagent", "Part", "Catalyst", "Dye", "Crystal"],
  Fishing: ["Fishing Tackle"],
  Music: ["Orchestrion Roll"],
  Other: ["Miscellany", "Seasonal Miscellany", "Minion", "Other"],
};
const notes = new Set();
function groupOf(cat) {
  if (/(Arm|Grimoire)$/.test(cat) || cat === "Shield") return "Weapon";
  if (/(Primary|Secondary) Tool$/.test(cat)) return "Tool";
  for (const g in GROUP_OF) if (GROUP_OF[g].includes(cat)) return g;
  notes.add(`note: UI category "${cat}" is in no group; filed under Other until GROUP_OF lists it`);
  return "Other";
}

const GIL_SHOP = v => v >= 262144 && v < 327680;
const TOWN = 0;   // TerritoryType.TerritoryIntendedUse for a city

/* ---- lookups ---- */
const uiName = {};
for (const r of sheet("ItemUICategory")) uiName[r["#"]] = r.Name;
const ITEM = {};
for (const r of sheet("Item")) if (r.Name) ITEM[r["#"]] = r;
const marketable = id => ITEM[id] && +ITEM[id].ItemSearchCategory > 0 && ITEM[id].IsUntradable !== "True";

const shops = {};
for (const r of sheet("GilShop")) shops[r["#"]] = r;

const npcName = {};
for (const r of sheet("ENpcResident")) if (r.Singular) npcName[r["#"]] = r.Singular;
const shopNpcs = new Map();
for (const r of sheet("ENpcBase")) {
  const npc = +r["#"];
  if (!npcName[npc]) continue;
  for (let i = 0; r[`ENpcData[${i}]`] !== undefined; i++) {
    const v = +r[`ENpcData[${i}]`];
    if (!GIL_SHOP(v)) continue;
    if (!shopNpcs.has(v)) shopNpcs.set(v, new Set());
    shopNpcs.get(v).add(npc);
  }
}

/* where each NPC stands: its first placement (Level type 8), as in-game map coordinates */
const maps = {}, places = {}, territories = {};
for (const r of sheet("Map")) maps[r["#"]] = r;
for (const r of sheet("PlaceName")) places[r["#"]] = r.Name;
for (const r of sheet("TerritoryType")) territories[r["#"]] = r;
const coord = (v, offset, sizeFactor) => {
  const scale = sizeFactor / 100;
  return Math.round(((41 / scale) * (((v + offset) * scale + 1024) / 2048) + 1) * 10) / 10;
};
const spot = new Map();
for (const r of sheet("Level")) {
  const npc = +r.Object;
  if (+r.Type !== 8 || spot.has(npc) || !npcName[npc]) continue;
  const m = maps[r.Map], t = territories[r.Territory];
  const zone = t && places[t.PlaceName];
  if (!m || !zone) continue;
  spot.set(npc, { zone, town: +t.TerritoryIntendedUse === TOWN,
    x: coord(+r.X, +m.OffsetX, +m.SizeFactor), y: coord(+r.Z, +m.OffsetY, +m.SizeFactor) });
}

/* ---- every gil shop line, grouped by item ---- */
const stocked = new Map();
for (const r of sheet("GilShopItem")) {
  const id = +r.Item, shop = +r["#"].split(".")[0];
  if (!id || !marketable(id) || !shops[shop]) continue;
  if (!stocked.has(id)) stocked.set(id, []);
  stocked.get(id).push({ shop, locked: !!(+r["QuestRequired[0]"] || +r["QuestRequired[1]"] || +r.AchievementRequired) });
}

const lists = { z: [], p: [], c: [] };
const index = (list, v) => { let i = lists[list].indexOf(v); if (i < 0) { i = lists[list].length; lists[list].push(v); } return i; };
const rows = [];
for (const id of [...stocked.keys()].sort((a, b) => a - b)) {
  const lines = stocked.get(id), it = ITEM[id];
  const npcs = new Set();
  for (const l of lines) for (const n of shopNpcs.get(l.shop) || []) npcs.add(n);
  const best = [...npcs].sort((a, b) => {
    const sa = spot.get(a), sb = spot.get(b);
    return (!sa - !sb) || ((sa && !sa.town) - (sb && !sb.town)) || a - b;
  })[0];
  const where = best != null ? spot.get(best) : null;
  const cat = uiName[it.ItemUICategory] || "";
  rows.push([id, it.Name, +it.PriceMid, index("c", cat), GROUPS.indexOf(groupOf(cat)),
    best != null ? index("p", npcName[best]) : -1,
    where ? index("z", where.zone) : -1, where ? where.x : 0, where ? where.y : 0,
    +it.StackSize,
    lines.some(l => l.locked) ? 1 : 0,
    npcs.size,
    lines.every(l => +shops[l.shop].FestivalId) ? 1 : 0]);
}

writeJSON(path.join(OUT, "VENDORS.json"), { z: lists.z, p: lists.p, c: lists.c, g: GROUPS, r: rows });
const located = rows.filter(r => r[6] >= 0).length, named = rows.filter(r => r[5] >= 0).length;
console.log(`VENDORS: ${rows.length} items, ${named} with a named NPC, ${located} with a map position, ${rows.filter(r => r[12]).length} seasonal`);
for (const n of notes) console.log("  " + n);
