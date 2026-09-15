/* Shared helpers for the rebake tools: paths, the download cache, the game's CSV
   sheets, and the item indexes baked into src/data/. */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const CACHE = path.join(ROOT, "tools", ".cache");
const OUT = path.join(CACHE, "out");
fs.mkdirSync(OUT, { recursive: true });

const cached = name => path.join(CACHE, name);
const readJSON = file => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data));
const need = name => {
  const f = cached(name);
  if (!fs.existsSync(f)) throw new Error(`${name} is not downloaded yet — run "node tools/fetch-data.js" first`);
  return f;
};

/* ---- the datamining CSVs: row 0 is the header, quoted fields may hold commas and newlines ---- */
function parseCSV(text) {
  const out = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f.replace(/\r$/, "")); out.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f.length || row.length) { row.push(f); out.push(row); }
  return out;
}
function sheet(name) {
  const all = parseCSV(fs.readFileSync(need(name + ".csv"), "utf8"));
  const head = all[0];
  return all.slice(1).filter(r => r.length > 1).map(r => { const o = {}; head.forEach((h, i) => o[h] = r[i]); return o; });
}

/* ---- every item, reduced to what the builders read; rebuilt when Item.csv changes ----
   n name, pl NPC sell price, ui UI category, sc market board search category (0 =
   not marketable), ut untradable, ic icon */
function items() {
  const src = need("Item.csv"), dst = cached("items_min.json");
  if (fs.existsSync(dst) && fs.statSync(dst).mtimeMs > fs.statSync(src).mtimeMs) return readJSON(dst);
  const ui = {}; for (const r of sheet("ItemUICategory")) ui[r["#"]] = r.Name;
  const m = {};
  for (const r of sheet("Item")) {
    if (!r.Name) continue;
    m[r["#"]] = { n: r.Name, pl: +r.PriceLow, ui: ui[r.ItemUICategory] || "", sc: +r.ItemSearchCategory, ut: r.IsUntradable === "True", ic: +r.Icon };
  }
  writeJSON(dst, m);
  return m;
}
const marketable = (I, id) => !!(I[id] && I[id].sc > 0 && !I[id].ut);

/* ---- the "base36 id-delta value" encoding shared by ICON_INDEX, ITEM_INDEX, RECIPE_INDEX ---- */
function decodeIndex(text) {
  const m = new Map(); let id = 0;
  for (const l of text.split("\n")) { const sp = l.indexOf(" "); if (sp < 0) continue; id += parseInt(l.slice(0, sp), 36); m.set(id, l.slice(sp + 1)); }
  return m;
}
function encodeIndex(m) {
  let prev = 0;
  return [...m.keys()].sort((a, b) => a - b).map(id => { const s = (id - prev).toString(36) + " " + m.get(id); prev = id; return s; }).join("\n");
}

/* ---- the patch the game data is on ----
   A patch shows up as a new commit to ffxiv-datamining's csv/en folder, titled with the
   patch ("7.56 (#117)"). The title is kept to plain characters: it ends up in a commit
   message, an issue and a badge on the page. */
async function latestGameData() {
  const headers = { "User-Agent": "ffxiv-gil-desk-rebake", Accept: "application/vnd.github+json" };
  if (process.env.GH_TOKEN) headers.Authorization = "Bearer " + process.env.GH_TOKEN;
  const r = await fetch("https://api.github.com/repos/xivapi/ffxiv-datamining/commits?path=csv/en&per_page=1", { headers });
  if (!r.ok) throw new Error("GitHub API " + r.status + " asking for the latest game data commit");
  const [latest] = await r.json();
  if (!latest) throw new Error("ffxiv-datamining has no commits under csv/en — has the folder moved?");
  const patch = latest.commit.message.split("\n")[0].replace(/\s*\(#\d+\)/g, "").replace(/[^\w .-]/g, "").trim() || "new game data";
  return { patch, when: new Date(latest.commit.committer.date) };
}

module.exports = { ROOT, CACHE, OUT, cached, need, readJSON, writeJSON, sheet, items, marketable, decodeIndex, encodeIndex, latestGameData };
