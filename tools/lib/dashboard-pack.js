/* The Dashboard's recipe catalogue is by far the biggest thing in index.html, and most of it is the
   same few keys repeated nine thousand times, with every quote escaped twice over (the tab is a JS
   string inside the shell). build.js packs it into flat number lists and joined strings instead,
   and puts the unpacker in front of it, so the tab still gets exactly the object src/data/dashboard.json
   describes:
     const DATA = /*@pack data/dashboard.json*\/null;   ->   const DATA = (function(p){…})({…});
   pack() checks its own work: if unpacking would not give back the same data (a rebake added a
   field, say), packText() returns the plain JSON and says so, and the desk works as before. */
const vm = require("vm");

const SEP = "|";   // joins the names; pack() refuses data with a name that contains it

/* Runs in the tab. Keep it to statements ending in ";" or "}" and block comments only:
   build.js puts it on one line. Keys go on in the order src/data/dashboard.json has them. */
function unpack(p) {
  var S = "|", un = function (a) { var o = [], x = 0; for (var i = 0; i < a.length; i++) { x += a[i]; o.push(x); } return o; };
  var rid = un(p.r), dict = un(p.d), rn = p.n.split(S), recipes = {}, names = {}, at = 0;
  for (var i = 0; i < rid.length; i++) {
    var yields = p.i[at++], n = p.i[at++], ings = [];
    for (var j = 0; j < n; j++) { ings.push({ id: dict[p.i[at]], amount: p.i[at + 1] }); at += 2; }
    recipes[rid[i]] = { name: rn[i], yields: yields, ingredients: ings };
  }
  var nk = p.k ? un(p.k) : dict, nv = p.m.split(S);
  for (i = 0; i < nk.length; i++) names[nk[i]] = nv[i];
  var finished = [];
  for (i = 0; i < p.f.length; i += 7) {
    var id = rid[p.f[i]], kind = p.t.kind[p.f[i + 1]], fl = p.f[i + 6];
    var f = { id: id, name: recipes[id].name, kind: kind, group: kind, q: fl & 1 ? "hq" : "nq",
      note: p.t.note[p.f[i + 2]], job: p.t.job[p.f[i + 3]], lvl: p.f[i + 4] };
    if (p.f[i + 5]) f.jobs = p.t.jobs[p.f[i + 5] - 1].split(",");
    if (fl & 2) f.nohq = 1;
    if (fl & 4) f.pre = 1;
    finished.push(f);
  }
  return { finished: finished, recipes: recipes, names: names };
}

const delta = a => a.map((x, i) => x - (i ? a[i - 1] : 0));
const table = () => { const list = [], at = new Map(); return { list, of: v => { if (!at.has(v)) { at.set(v, list.length); list.push(v); } return at.get(v); } }; };
const join = (names, what) => {
  for (const n of names) if (typeof n !== "string" || n.includes(SEP)) throw new Error(`${what} ${JSON.stringify(n)} cannot be joined with "${SEP}"`);
  return names.join(SEP);
};

function pack(data) {
  const keys = Object.keys(data).join(",");
  if (keys !== "finished,recipes,names") throw new Error(`top-level keys are ${keys}`);
  const rid = Object.keys(data.recipes).map(Number);
  const rIndex = new Map(rid.map((id, i) => [id, i]));
  const dict = [...new Set(Object.values(data.recipes).flatMap(r => r.ingredients.map(g => g.id)))].sort((a, b) => a - b);
  const dIndex = new Map(dict.map((id, i) => [id, i]));
  const stream = [];
  for (const id of rid) {
    const r = data.recipes[id];
    stream.push(r.yields, r.ingredients.length);
    for (const g of r.ingredients) stream.push(dIndex.get(g.id), g.amount);
  }
  const nk = Object.keys(data.names).map(Number);
  const sameKeys = nk.length === dict.length && nk.every((id, i) => id === dict[i]);
  const t = { kind: table(), note: table(), job: table(), jobs: table() };
  const rows = [];
  for (const f of data.finished) {
    if (!rIndex.has(f.id)) throw new Error(`finished item ${f.id} has no recipe`);
    if (f.jobs && (!Array.isArray(f.jobs) || !f.jobs.length)) throw new Error(`finished item ${f.id} has odd jobs`);
    rows.push(rIndex.get(f.id), t.kind.of(f.kind), t.note.of(f.note), t.job.of(f.job), f.lvl,
      f.jobs ? t.jobs.of(f.jobs.join(",")) + 1 : 0,
      (f.q === "hq" ? 1 : 0) | (f.nohq ? 2 : 0) | (f.pre ? 4 : 0));
  }
  return {
    r: delta(rid), n: join(rid.map(id => data.recipes[id].name), "recipe name"),
    d: delta(dict), i: stream,
    ...(sameKeys ? {} : { k: delta(nk) }), m: join(nk.map(id => data.names[id]), "name"),
    t: Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.list])),
    f: rows,
  };
}

/* the unpacker as one line of source, so the DATA line stays one line (check-bake.js reads it so) */
const UNPACK = unpack.toString().replace(/\s*\n\s*/g, " ");

/* data file text -> the JS expression build.js writes, and whether it had to fall back to plain JSON */
function packText(text, plain) {
  const canonical = JSON.stringify(JSON.parse(text));
  try {
    const packed = JSON.stringify(pack(JSON.parse(text))).replace(/<\//g, "<\\/");
    const expr = `(${UNPACK})(${packed})`;
    const back = vm.runInNewContext(expr);
    if (JSON.stringify(back) !== canonical) throw new Error("unpacking does not give the same data back");
    return { expr, packed: true };
  } catch (e) {
    return { expr: plain, packed: false, why: e.message };
  }
}

module.exports = { pack, unpack, packText };
