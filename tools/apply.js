/* Writes the rebuilt data into index.html:
   - the SUB, WS and DUTY constants inside the Submersibles, Workshop and Duties tabs
   - ICON_INDEX and ITEM_INDEX: any item those tabs show that the desk has no icon or
     searchable name for yet is added (existing entries are left exactly as they are)
   - RECIPE_INDEX: rebuilt whole from Teamcraft's recipes, so new crafts get their
     simulator link
   Nothing else in the file is touched. */
const { OUT, need, readJSON, items, openIndex, decodeIndex, encodeIndex } = require("./lib/common");

const I = items();
const idx = openIndex();
const report = [];

/* ---- the three tabs' data ---- */
for (const [tab, name, file] of [["submersible", "SUB", "SUB.json"], ["workshop", "WS", "WS.json"], ["duties", "DUTY", "DUTY.json"]]) {
  const json = JSON.stringify(readJSON(need("out/" + file))).replace(/<\//g, "<\\/");
  const html = idx.getBlob(tab);
  const re = new RegExp("^const " + name + " = [^\\r\\n]*;", "m");
  if (!re.test(html)) throw new Error(`the ${tab} tab has no "const ${name} = ...;" line to replace`);
  const before = html.match(re)[0].length;
  idx.setBlob(tab, html.replace(re, () => `const ${name} = ${json};`));
  report.push(`${tab.padEnd(12)} ${name.padEnd(5)} ${(before / 1024).toFixed(0)} KB -> ${(json.length / 1024).toFixed(0)} KB`);
}

/* ---- icons and search names for everything those tabs show ---- */
const SUB = readJSON(need("out/SUB.json")), WS = readJSON(need("out/WS.json")), DUTY = readJSON(need("out/DUTY.json"));
const shown = new Set([
  ...Object.keys(SUB.names).map(Number),
  ...Object.keys(WS.names).map(Number),
  ...DUTY.items.map(x => x.i),
  ...DUTY.items.flatMap(x => x.src.filter(s => s.curId).map(s => s.curId)),
]);
const icons = decodeIndex(idx.getConst("ICON_INDEX")), names = decodeIndex(idx.getConst("ITEM_INDEX"));
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
idx.setConst("ICON_INDEX", encodeIndex(icons));
idx.setConst("ITEM_INDEX", encodeIndex(names));
report.push(`ICON_INDEX   +${addIcons} (${icons.size} items)`, `ITEM_INDEX   +${addNames} (${names.size} items)`);

/* ---- recipe ids for the Teamcraft simulator links: lowest recipe id per item ---- */
const recipes = new Map();
for (const r of readJSON(need("recipes.json"))) {
  if (typeof r.id !== "number" && !/^\d+$/.test(String(r.id))) continue;
  const id = +r.id, have = recipes.get(r.result);
  if (have == null || id < have) recipes.set(r.result, id);
}
const oldRecipes = decodeIndex(idx.getConst("RECIPE_INDEX"));
const enc = new Map([...recipes].map(([item, rid]) => [item, rid.toString(36)]));
idx.setConst("RECIPE_INDEX", encodeIndex(enc));
report.push(`RECIPE_INDEX ${oldRecipes.size} -> ${enc.size} items`);

idx.save();
console.log("index.html updated:\n  " + report.join("\n  "));
