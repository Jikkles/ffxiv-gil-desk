/* Writes the rebuilt data into src/data/, then rebuilds index.html:
   - the CD, VD, SUB, WS and DUTY datasets of the Currencies, Vendors, Submersibles, Workshop
     and Duties tabs, and the DATA and PRE recipe catalogues of the Dashboard and Precrafts
   - ICON_INDEX and ITEM_INDEX: any item those tabs show that the desk has no icon or
     searchable name for yet is added (existing entries are left exactly as they are)
   - RECIPE_INDEX: rebuilt whole from Teamcraft's recipes, so new crafts get their
     simulator link
   Nothing else in src/ is touched. */
const fs = require("fs");
const { OUT, need, readJSON, items, decodeIndex, encodeIndex } = require("./lib/common");
const { INDEX, readSrc, writeSrc, build } = require("./build");
const { formatJSON, minifyJSON } = require("./lib/json-text");

const I = items();
const report = [];

/* ---- each tab's data ---- */
for (const [tab, name, file] of [["currencies", "CD", "CURRENCIES.json"], ["vendors", "VD", "VENDORS.json"],
  ["submersibles", "SUB", "SUB.json"], ["workshop", "WS", "WS.json"], ["duties", "DUTY", "DUTY.json"],
  ["dashboard", "DATA", "DASHBOARD.json"], ["precrafts", "PRE", "PRECRAFTS.json"]]) {
  const data = `data/${tab}.json`;
  if (!readSrc(`tabs/${tab}.html`).includes(`const ${name} = /*@json ${data}*/null;`))
    throw new Error(`src/tabs/${tab}.html has no "const ${name} = /*@json ${data}*/null;" line to fill`);
  /* read as text, not parsed and re-written: the Dashboard catalogue's key order is part of the file */
  const text = fs.readFileSync(need("out/" + file), "utf8");
  JSON.parse(text);
  const json = text.replace(/<\//g, "<\\/");
  const before = minifyJSON(readSrc(data)).length;
  writeSrc(data, formatJSON(json));
  report.push(`${tab.padEnd(12)} ${name.padEnd(5)} ${(before / 1024).toFixed(0)} KB -> ${(json.length / 1024).toFixed(0)} KB`);
}

/* ---- icons and search names for everything those tabs show ---- */
const SUB = readJSON(need("out/SUB.json")), WS = readJSON(need("out/WS.json")), DUTY = readJSON(need("out/DUTY.json"));
const CUR = readJSON(need("out/CURRENCIES.json")), VEN = readJSON(need("out/VENDORS.json"));
const DASH = readJSON(need("out/DASHBOARD.json")), PRE = readJSON(need("out/PRECRAFTS.json"));
const shown = new Set([
  ...Object.keys(CUR.items).map(Number),
  ...CUR.currencies.map(c => c.id),
  ...VEN.r.map(r => r[0]),
  ...Object.keys(SUB.names).map(Number),
  ...Object.keys(WS.names).map(Number),
  ...DUTY.items.map(x => x.i),
  ...DUTY.items.flatMap(x => x.src.filter(s => s.curId).map(s => s.curId)),
  ...DASH.finished.map(f => f.id),
  ...Object.keys(DASH.names).map(Number),
  ...Object.keys(PRE).map(Number),
  ...Object.values(PRE).flatMap(p => p.ings.map(i => i.id)),
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
