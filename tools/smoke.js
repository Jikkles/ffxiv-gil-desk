/* Opens the desk in a headless browser against made-up Universalis prices and checks every tab
   actually draws its table: the one thing the build and check-bake.js cannot see.
     node tools/smoke.js               every tab shows rows, with no script errors, no error box and
                                       no NaN or undefined in a cell
     node tools/smoke.js --diff [ref]  the same, then compares every tab's table with the index.html
                                       committed at ref (default HEAD). A refactor should change nothing.
     node tools/smoke.js --file x.html check that file instead of index.html
   It needs Playwright's Chromium, which this repo does not install (there is no package.json on
   purpose). Point PLAYWRIGHT at an installed copy, e.g.
     PLAYWRIGHT="C:/path/to/node_modules/playwright" node tools/smoke.js
   or have "playwright" resolvable through NODE_PATH. The prices, sales and clock are fixed, so two
   runs of the same file give the same tables. Exits 1 if anything is wrong. */
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const ROOT = path.resolve(__dirname, "..");
const TABS = ["all", "gathering", "flips", "materia", "currencies", "vendors", "retainer", "submersible", "workshop", "duties", "list1"];
const NAMES = { all: "Dashboard", materia: "Scrips", retainer: "Retainers", submersible: "Submersibles", list1: "List 1" };
const nameOf = k => NAMES[k] || k[0].toUpperCase() + k.slice(1);
const ROWS_COMPARED = 40;

function playwright() {
  for (const at of [process.env.PLAYWRIGHT, "playwright"].filter(Boolean)) {
    try { return require(at); } catch (e) { /* next */ }
  }
  console.error("Playwright was not found. Set PLAYWRIGHT to an installed copy's folder, e.g.\n"
    + '  PLAYWRIGHT="C:/path/to/node_modules/playwright" node tools/smoke.js\n'
    + "(install one anywhere outside this repo with: npm install playwright && npx playwright install chromium)");
  process.exit(2);
}

/* ---- a pretend Universalis: every item sells, prices depend only on the item id ---- */
const NOW = 1758000000;   // seconds; the page's clock is pinned here too
const WORLDS = [
  { id: 85, name: "Spriggan" }, { id: 80, name: "Cerberus" }, { id: 71, name: "Moogle" }, { id: 39, name: "Omega" },
  { id: 83, name: "Louisoix" }, { id: 97, name: "Ragnarok" }, { id: 400, name: "Sagittarius" }, { id: 401, name: "Phantom" },
  { id: 36, name: "Lich" }, { id: 66, name: "Odin" },
];
const DCS = [
  { name: "Chaos", region: "Europe", worlds: [85, 80, 71, 39, 83, 97, 400, 401] },
  { name: "Light", region: "Europe", worlds: [36, 66] },
];
const basePrice = id => 2500000 + (id % 977) * 4000;
function aggFor(id) {
  const b = basePrice(id);
  const q = mul => ({
    minListing: { world: { price: Math.round(b * mul), worldId: 85 }, dc: { price: Math.round(b * mul * 0.55), worldId: 80 } },
    averageSalePrice: { world: { price: Math.round(b * mul * 1.05) }, dc: { price: Math.round(b * mul * 0.95) } },
    dailySaleVelocity: { world: { quantity: 3.5 }, dc: { quantity: 9.25 } },
  });
  return { itemId: id, hq: q(1.4), nq: q(1), worldUploadTimes: [{ worldId: 85, timestamp: NOW * 1000 - 3600e3 }] };
}
function histFor(id) {
  const b = basePrice(id), entries = [];
  for (let i = 0; i < 24; i++)
    entries.push({ timestamp: NOW - i * 3600 * 20, pricePerUnit: Math.round(b * (1 + ((i * 7) % 11) / 100)), quantity: 1 + (i % 5), hq: i % 4 === 0 });
  return { itemID: id, entries };
}
const idsFrom = s => s.split(",").map(Number).filter(Boolean);
const BLANK_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function stubNetwork(page) {
  await page.route("**://universalis.app/**", route => {
    const p = new URL(route.request().url()).pathname;
    const json = b => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (p.endsWith("/worlds")) return json(WORLDS);
    if (p.endsWith("/data-centers")) return json(DCS);
    let m = /^\/api\/v2\/aggregated\/[^/]+\/(.+)$/.exec(p);
    if (m) return json({ results: idsFrom(m[1]).map(aggFor) });
    m = /^\/api\/v2\/history\/[^/]+\/(.+)$/.exec(p);
    if (m) return json({ items: Object.fromEntries(idsFrom(m[1]).map(id => [id, histFor(id)])) });
    m = /^\/api\/v2\/[^/]+\/(\d+)$/.exec(p);
    if (m) return json({ itemID: +m[1], listings: [], recentHistory: [], averagePrice: 100, lastUploadTime: NOW * 1000 });
    return json({});
  });
  for (const pat of ["**://*.xivapi.com/**", "**://xivapi.com/**"])
    await page.route(pat, r => r.request().url().includes("/i/")
      ? r.fulfill({ status: 200, contentType: "image/png", body: BLANK_PNG })
      : r.fulfill({ status: 200, contentType: "application/json", body: '{"results":[]}' }));
  /* nothing else may leave the machine: a test must not depend on, or bother, anyone's server */
  await page.route(u => !/^(file|data|blob|about):/.test(u.protocol) && !/(^|\.)(universalis\.app|xivapi\.com)$/.test(u.hostname),
    r => r.abort("blockedbyclient"));
}

/* the page's clock stands still at NOW, so two runs put the same sales in the same windows */
const pinClock = page => page.addInitScript(t => {
  const F = t * 1000, OD = Date;
  function D(...a) { return a.length ? new OD(...a) : new OD(F); }
  D.prototype = OD.prototype; D.now = () => F; D.UTC = OD.UTC; D.parse = OD.parse;
  window.Date = D;
}, NOW);

/* ---- one file, every tab ---- */
async function run(browser, file) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String((e && e.message) || e)));
  page.on("console", m => { if (m.type() === "error" && !/net::ERR|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await pinClock(page);
  await stubNetwork(page);

  const url = pathToFileURL(file).href;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { try { localStorage.setItem("gildesk:homePicked:v1", "1"); } catch (e) { /* the picker will show */ } });
  await page.reload({ waitUntil: "domcontentloaded" });
  const started = await page.waitForFunction(() => typeof window.activate === "function", null, { timeout: 60000 }).then(() => true, () => false);
  if (!started) {
    await context.close();
    const why = ["the desk itself never started" + (errors.length ? ": " + errors[0].slice(0, 200) : "")];
    return Object.fromEntries(TABS.map(k => [k, { headers: [], rows: [], errbox: "", count: 0, problems: why }]));
  }

  const out = {};
  for (const key of TABS) {
    const tabErrors = errors.length;
    await page.evaluate(k => window.activate(k), key);
    const frame = `iframe[data-frame="${key}"]`;
    /* a tab's document is parsed a moment after activate(), and its scripts (the Dashboard's is several MB)
       only wire #refresh up once the parser is past them, so wait for the whole document, not just the button */
    const opened = await page.waitForFunction(f => {
      const d = document.querySelector(f)?.contentDocument;
      return d && d.readyState !== "loading" && d.getElementById("refresh");
    }, frame, { timeout: 60000 }).then(() => true, () => false);
    if (!opened) {
      out[key] = { headers: [], rows: [], errbox: "", count: 0, problems: ["the tab never opened", ...errors.slice(tabErrors).map(e => "script error: " + e.slice(0, 200))] };
      continue;
    }
    if (key === "all") await page.evaluate(f => document.querySelector(f).contentDocument.getElementById("refresh").click(), frame);
    const settled = await page.waitForFunction(({ f, list }) => {
      const d = document.querySelector(f).contentDocument, b = d.getElementById("refresh");
      if (!b || b.disabled) return false;
      const box = d.getElementById("errbox");
      return (box && box.textContent.trim()) || d.querySelector("table:not([hidden]) tbody tr") || (list && d.body.textContent.trim());
    }, { f: frame, list: key.startsWith("list") }, { timeout: 180000, polling: 300 }).then(() => true, () => false);
    await page.waitForTimeout(500);   // let the last render land
    const got = await page.evaluate(f => {
      const d = document.querySelector(f).contentDocument, clean = s => s.replace(/\s+/g, " ").trim();
      const tables = [...d.querySelectorAll("table:not([hidden])")].filter(t => t.offsetParent !== null);
      return {
        headers: tables.flatMap(t => [...t.querySelectorAll("thead th")].map(th => clean(th.textContent))),
        rows: tables.flatMap(t => [...t.querySelectorAll("tbody tr")].map(tr => [...tr.querySelectorAll("td")].map(td => clean(td.textContent)).join(" | "))),
        errbox: clean((d.getElementById("errbox") || {}).textContent || ""),
      };
    }, frame);
    const problems = [];
    if (!settled) problems.push("never finished loading");
    if (got.errbox) problems.push("error box says: " + got.errbox.slice(0, 160));
    if (!key.startsWith("list") && !got.rows.length) problems.push("no rows");
    const bad = got.rows.find(r => /\bNaN\b|\bundefined\b|\[object |Infinity/.test(r));
    if (bad) problems.push("odd cell: " + bad.slice(0, 160));
    problems.push(...[...new Set(errors.slice(tabErrors))].map(e => "script error: " + e.slice(0, 200)));
    out[key] = { ...got, problems, count: got.rows.length, rows: got.rows.slice(0, ROWS_COMPARED) };
  }
  await context.close();
  return out;
}

function committed(ref) {
  const text = execFileSync("git", ["show", `${ref}:index.html`], { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "desk-smoke-")), "index.html");
  fs.writeFileSync(file, text);
  return file;
}

function diff(label, a, b) {
  const lines = [];
  if (a.headers.join(" | ") !== b.headers.join(" | ")) lines.push(`headers: ${a.headers.join(" | ")}\n      now: ${b.headers.join(" | ")}`);
  if (a.count !== b.count) lines.push(`row count: ${a.count} -> ${b.count}`);
  for (let i = 0; i < Math.max(a.rows.length, b.rows.length); i++)
    if (a.rows[i] !== b.rows[i]) lines.push(`row ${i + 1}: ${a.rows[i] ?? "(none)"}\n      now: ${b.rows[i] ?? "(none)"}`);
  return lines.length ? [`${label}:`, ...lines.slice(0, 8).map(l => "    " + l), ...(lines.length > 8 ? [`    … and ${lines.length - 8} more`] : [])] : [];
}

/* one-off probes can borrow the pretend Universalis: const { stubNetwork, pinClock } = require("./smoke") */
module.exports = { stubNetwork, pinClock, NOW };

if (require.main === module) (async () => {
  const args = process.argv.slice(2);
  const opt = name => { const i = args.indexOf(name); return i < 0 ? null : (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true); };
  const file = path.resolve(typeof opt("--file") === "string" ? opt("--file") : path.join(ROOT, "index.html"));
  const ref = opt("--diff") === true ? "HEAD" : opt("--diff");

  const { chromium } = playwright();
  const browser = await chromium.launch();
  let failed = false;
  try {
    const now = await run(browser, file);
    console.log(`${path.relative(ROOT, file) || file}:`);
    for (const key of TABS) {
      const t = now[key];
      console.log(`  ${nameOf(key).padEnd(13)} ${String(t.count).padStart(5)} rows  ${t.problems.length ? "FAIL" : "ok"}`);
      for (const p of t.problems) console.log("      " + p);
      if (t.problems.length) failed = true;
    }
    if (ref) {
      const before = await run(browser, committed(ref));
      const lines = TABS.flatMap(k => diff(nameOf(k), before[k], now[k]));
      console.log(lines.length ? `\nTables differ from ${ref}:\n  ` + lines.join("\n  ") : `\nEvery tab's table matches ${ref}.`);
      if (lines.length) failed = true;
    }
  } finally {
    await browser.close();
  }
  console.log(failed ? "\nSMOKE TEST FAILED" : "\nsmoke test passed");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error("smoke test could not run: " + (e.stack || e)); process.exit(2); });
