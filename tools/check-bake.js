/* A last look at index.html after a rebake, before anything is committed:
   - every <script> in the page and in every tab still parses
   - the Dashboard, Precrafts, Currencies, Vendors, Submersibles, Workshop, Duties, Scrips, Flips and
     Retainers data did not shrink
     by more than a quarter
     against the last commit (a source changing its format would show up as a collapse)
     node tools/check-bake.js
   Exits 1 with the reasons if anything looks wrong. */
const { execFileSync } = require("child_process");
const fs = require("fs");
const vm = require("vm");
const { ROOT } = require("./lib/common");
const { INDEX } = require("./build");

const SHRINK = 0.75;

/* the shell, and each tab document (one per line of BLOBS) */
function documents(text) {
  const docs = { shell: [] };
  for (const l of text.split("\n")) {
    const m = /^  "([\w-]+)": "/.exec(l);
    if (m) docs[m[1]] = JSON.parse(l.slice(l.indexOf('": "') + 3).replace(/,\r?$/, ""));
    else docs.shell.push(l);
  }
  docs.shell = docs.shell.join("\n");
  return docs;
}
const dataset = (docs, tab, name) => {
  const m = new RegExp("^const " + name + " = ([^\\r\\n]*);", "m").exec(docs[tab] || "");
  try { return m ? JSON.parse(m[1]) : null; }
  catch (e) { return null; }   // reported below as "none left"
};
function counts(docs) {
  const SUB = dataset(docs, "submersible", "SUB"), WS = dataset(docs, "workshop", "WS"), DUTY = dataset(docs, "duties", "DUTY");
  const CD = dataset(docs, "currencies", "CD"), VD = dataset(docs, "vendors", "VD");
  const DATA = dataset(docs, "all", "DATA"), PRE = dataset(docs, "precraft", "PRE");
  const T4 = dataset(docs, "materia", "T4"), FLIPS = dataset(docs, "flips", "FLIP_ITEMS"), RET = dataset(docs, "retainer", "VITEMS");
  return {
    "currencies": CD ? CD.currencies.length : 0,
    "currency offers": CD ? CD.currencies.reduce((s, c) => s + c.items.length, 0) : 0,
    "vendor items": VD ? VD.r.length : 0,
    "vendor NPCs shown": VD ? VD.r.filter(r => r[5] >= 0).length : 0,
    "submarine sectors": SUB ? SUB.sectors.length : 0,
    "sectors with loot": SUB ? SUB.sectors.filter(s => s.loot.length).length : 0,
    "workshop projects": WS ? WS.projects.length : 0,
    "workshop recipes": WS ? Object.keys(WS.recipes).length : 0,
    "duty items": DUTY ? DUTY.items.length : 0,
    "dashboard crafts": DATA ? DATA.finished.length : 0,
    "precrafts": PRE ? Object.keys(PRE).length : 0,
    "scrip collectables": T4 ? T4.collectibles.length : 0,
    "flip items": FLIPS ? FLIPS.length : 0,
    "retainer drops": RET ? RET.length : 0,
  };
}

const problems = [];
const now = documents(fs.readFileSync(INDEX, "utf8"));

for (const [doc, html] of Object.entries(now)) {
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m, n = 0;
  while ((m = re.exec(html))) {
    n++;
    /* tabs carry /*__ICON_INDEX__*\/-style slots the shell fills in when it loads them */
    const code = m[1].replace(/\/\*__[A-Z_]+__\*\//g, "0");
    try { new vm.Script(code, { filename: `${doc} script ${n}` }); }
    catch (e) { problems.push(`${doc}: script ${n} no longer parses — ${e.message}`); }
  }
}

let before = null;
try { before = documents(execFileSync("git", ["show", "HEAD:index.html"], { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })); }
catch (e) { console.log("  (no committed index.html to compare against)"); }
const a = counts(now), b = before && counts(before);
for (const k of Object.keys(a)) {
  console.log(`  ${k.padEnd(18)} ${b ? String(b[k]).padStart(5) + " -> " : ""}${a[k]}`);
  if (!a[k]) problems.push(`${k}: none left`);
  else if (b && a[k] < b[k] * SHRINK) problems.push(`${k}: dropped from ${b[k]} to ${a[k]}`);
}

if (problems.length) {
  console.log("\nCHECK FAILED:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("check passed");
