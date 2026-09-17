/* Writes the rebuilt data into src/data/, then rebuilds index.html:
   - the CD, VD, SUB, WS, DUTY, T4, FLIP_ITEMS and VITEMS datasets of the Currencies, Vendors,
     Submersibles, Workshop, Duties + Maps, Scrips, Flips, Retainers and Gathering tabs, and the DATA recipe
     catalogue of the Dashboard
   - NPC_PRICES, the NPC price index the shell hands to every crafting tab
   - ICON_INDEX and ITEM_INDEX: any item those tabs show, and any marketable item at all (the
     Undercuts tab can meet any of them on a retainer), that the desk has no icon or searchable
     name for yet is added (existing entries are left exactly as they are)
   - RECIPE_INDEX: rebuilt whole from Teamcraft's recipes, so new crafts get their
     simulator link
   Nothing else in src/ is touched. */
const fs = require("fs");
const { OUT, need, readJSON, items, marketable, decodeIndex, encodeIndex } = require("./lib/common");
const { INDEX, readSrc, writeSrc, build } = require("./build");
const { formatJSON, minifyJSON } = require("./lib/json-text");

const I = items();
const report = [];

/* ---- each tab's data ---- */
for (const [tab, name, file, dataName] of [["currencies", "CD", "CURRENCIES.json"], ["vendors", "VD", "VENDORS.json"],
  ["submersibles", "SUB", "SUB.json"], ["workshop", "WS", "WS.json"], ["duties", "DUTY", "DUTY.json"],
  ["dashboard", "DATA", "DASHBOARD.json"],
  ["scrips", "T4", "SCRIPS.json"], ["flips", "FLIP_ITEMS", "FLIPS.json"], ["gathering", "GATHER", "GATHERING.json"], ["retainer", "VITEMS", "RETAINERS.json", "retainers"]]) {
  const data = `data/${dataName || tab}.json`;
  const html = readSrc(`tabs/${tab}.html`);
  if (![`json`, `pack`].some(kind => html.includes(`const ${name} = /*@${kind} ${data}*/null;`)))
    throw new Error(`src/tabs/${tab}.html has no "const ${name} = /*@json ${data}*/null;" (or /*@pack …*/) line to fill`);
  /* read as text, not parsed and re-written: the Dashboard catalogue's key order is part of the file */
  const text = fs.readFileSync(need("out/" + file), "utf8");
  JSON.parse(text);
  const json = text.replace(/<\//g, "<\\/");
  const before = minifyJSON(readSrc(data)).length;
  writeSrc(data, formatJSON(json));
  report.push(`${tab.padEnd(12)} ${name.padEnd(5)} ${(before / 1024).toFixed(0)} KB -> ${(json.length / 1024).toFixed(0)} KB`);
}

/* ---- the NPC price index, which the shell hands to every crafting tab ---- */
{
  if (!readSrc("index.html").includes("const NPC_PRICES = /*@json data/npc-prices.json*/null;"))
    throw new Error('src/index.html has no "const NPC_PRICES = /*@json data/npc-prices.json*/null;" line to fill');
  const text = fs.readFileSync(need("out/NPC_PRICES.json"), "utf8");
  JSON.parse(text);
  const json = text.replace(/<\//g, "<\\/");
  const before = minifyJSON(readSrc("data/npc-prices.json")).length;
  writeSrc("data/npc-prices.json", formatJSON(json));
  report.push(`${"shell".padEnd(12)} ${"NPC_PRICES"} ${(before / 1024).toFixed(0)} KB -> ${(json.length / 1024).toFixed(0)} KB`);
}

/* ---- icons and search names for everything those tabs show ---- */
const SUB = readJSON(need("out/SUB.json")), WS = readJSON(need("out/WS.json")), DUTY = readJSON(need("out/DUTY.json"));
const CUR = readJSON(need("out/CURRENCIES.json")), VEN = readJSON(need("out/VENDORS.json"));
const DASH = readJSON(need("out/DASHBOARD.json"));
const SCRIPS = readJSON(need("out/SCRIPS.json")), FLIPS = readJSON(need("out/FLIPS.json")), RET = readJSON(need("out/RETAINERS.json"));
const GATHER = readJSON(need("out/GATHERING.json"));
const treeIds = n => [n.id, ...(n.ings || []).flatMap(treeIds)];
const shown = new Set([
  ...Object.keys(CUR.items).map(Number),
  ...CUR.currencies.map(c => c.id),
  ...VEN.r.map(r => r[0]),
  ...Object.keys(SUB.names).map(Number),
  ...Object.keys(WS.names).map(Number),
  ...DUTY.items.map(x => x.i),
  ...DUTY.items.flatMap(x => x.src.filter(s => s.curId).map(s => s.curId)),
  ...(DUTY.maps || []).flatMap(m => [...m.maps, ...m.loot.map(l => l[0])]),
  ...DASH.finished.map(f => f.id),
  ...Object.keys(DASH.names).map(Number),
  ...SCRIPS.materia.map(m => m.id),
  ...SCRIPS.collectibles.flatMap(c => treeIds(c.tree)),
  ...FLIPS.map(f => f.id),
  ...RET.map(r => r.i),
  ...GATHER.map(g => g.i),
  ...Object.keys(I).map(Number).filter(id => marketable(I, id)),
]);
const icons = decodeIndex(readSrc("data/icon-index.txt")), names = decodeIndex(readSrc("data/item-index.txt"));
const teamcraftIcons = readJSON(need("item-icons.json"));
let addIcons = 0, addNames = 0;
for (const id of shown) {
  if (!icons.has(id)) {
    const m = /(\d{6})(?:_hr1)?\.tex/.exec(teamcraftIcons[id] || "");
    const ic = m ? +m[1] : (I[id] && I[id].ic) || 0;
    if (ic) { icons.set(id, ic.toString(36)); addIcons++; }
  }
  if (!names.has(id) && I[id]) { names.set(id, I[id].n); addNames++; }
}
writeSrc("data/icon-index.txt", encodeIndex(icons));
writeSrc("data/item-index.txt", encodeIndex(names));
report.push(`ICON_INDEX   +${addIcons} (${icons.size} items)`, `ITEM_INDEX   +${addNames} (${names.size} items)`);

/* ---- recipe ids for the Teamcraft simulator links: lowest recipe id per item ---- */
const recipes = new Map();
for (const r of readJSON(need("recipes.json"))) {
  if (typeof r.id !== "number" && !/^\d+$/.test(String(r.id))) continue;
  const id = +r.id, have = recipes.get(r.result);
  if (have == null || id < have) recipes.set(r.result, id);
}
const oldRecipes = decodeIndex(readSrc("data/recipe-index.txt"));
const enc = new Map([...recipes].map(([item, rid]) => [item, rid.toString(36)]));
writeSrc("data/recipe-index.txt", encodeIndex(enc));
report.push(`RECIPE_INDEX ${oldRecipes.size} -> ${enc.size} items`);

fs.writeFileSync(INDEX, build());
console.log("src/data/ updated and index.html rebuilt:\n  " + report.join("\n  "));
