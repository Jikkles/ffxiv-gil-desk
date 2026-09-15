/* Builds the Flips tab's item list (tools/.cache/out/FLIPS.json):
     node tools/build-flips.js
   Every marketable item that unlocks a mount, a minion, a hairstyle or an emote, and every
   outfit coffer, read from the game's Item and ItemAction tables. What an item does when
   used is its ItemAction, which is what tells a mount whistle from a crafting material that
   happens to be called "Ifrit's Horn". */
const path = require("path");
const { OUT, writeJSON, sheet, items, marketable } = require("./lib/common");

/* ================= things a human may need to extend after a big patch =================
   ItemAction.Action ids, and the name tests that split the one "unlock" action into
   hairstyles and emotes. */
const MOUNT = 1322, MINION = 853, UNLOCK = 2633, COFFER = 29153;
const KIND = [
  [a => a === MOUNT, "Mount"],
  [a => a === MINION, "Minion"],
  [(a, n) => a === UNLOCK && /^Modern Aesthetics\b/.test(n), "Hairstyle"],
  [(a, n) => a === UNLOCK && /^Ballroom Etiquette\b/.test(n), "Emote"],
  [(a, n) => a === COFFER && /\bCoffer\b/.test(n), "Outfit Coffer"],
];
const ORDER = KIND.map(k => k[1]);
/* ======================================================================================= */

const I = items();
const action = {};
for (const r of sheet("ItemAction")) action[r["#"]] = +r.Action;

const out = [], unsorted = [];
for (const r of sheet("Item")) {
  const id = +r["#"];
  if (!r.Name || !marketable(I, id)) continue;
  const a = action[r.ItemAction] || 0;
  const kind = KIND.find(([test]) => test(a, r.Name));
  if (kind) out.push({ id, name: r.Name.trim(), cat: kind[1] });
  else if (a === UNLOCK) unsorted.push(r.Name);
}
out.sort((x, y) => ORDER.indexOf(x.cat) - ORDER.indexOf(y.cat) || x.id - y.id);
writeJSON(path.join(OUT, "FLIPS.json"), out);

const count = {};
for (const x of out) count[x.cat] = (count[x.cat] || 0) + 1;
console.log(`  Flips  ${out.length} items: ` + ORDER.map(c => `${count[c] || 0} ${c.toLowerCase()}`).join(", ")
  + (unsorted.length ? `\n  note: ${unsorted.length} unlock item(s) are neither a hairstyle nor an emote and are left out: ${unsorted.slice(0, 5).join(", ")}` : ""));
