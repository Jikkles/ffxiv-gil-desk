/* JSON as text: lay the baked datasets out one record per line in src/data/, and squeeze them
   back to one line for index.html. Both work on the text, never on parsed objects, so key order
   and every number and string stay exactly as written (parsing would reorder numeric keys). */

const WIDTH = 100;   // anything whose one-line form fits in this many columns stays on one line

function parse(s) {
  let i = 0;
  const fail = what => { throw new Error(`expected ${what} at character ${i}`); };
  const ws = () => { while (i < s.length && " \t\n\r".includes(s[i])) i++; };
  const str = () => {
    if (s[i] !== '"') fail("a string");
    const a = i++;
    while (i < s.length && s[i] !== '"') i += s[i] === "\\" ? 2 : 1;
    if (i >= s.length) fail("the end of a string");
    return s.slice(a, ++i);
  };
  const value = () => {
    ws();
    if (s[i] === "{" || s[i] === "[") {
      const obj = s[i++] === "{", close = obj ? "}" : "]", node = { obj, kids: [] };
      ws();
      if (s[i] === close) { i++; return node; }
      for (;;) {
        ws();
        let key = null;
        if (obj) { key = str(); ws(); if (s[i++] !== ":") fail('":"'); }
        node.kids.push([key, value()]);
        ws();
        if (s[i] === ",") { i++; continue; }
        if (s[i++] !== close) fail(`"," or "${close}"`);
        return node;
      }
    }
    if (s[i] === '"') return str();
    const a = i;
    while (i < s.length && /[-+.\w]/.test(s[i])) i++;
    if (a === i) fail("a value");
    return s.slice(a, i);
  };
  const v = value();
  ws();
  if (i < s.length) fail("the end of the data");
  return v;
}

const compact = n => typeof n === "string" ? n
  : n.one || (n.one = (n.obj ? "{" : "[") + n.kids.map(([k, v]) => (k ? k + ":" : "") + compact(v)).join(",") + (n.obj ? "}" : "]"));

function pretty(n, pad) {
  const one = compact(n);
  if (typeof n === "string" || pad.length + one.length <= WIDTH || !n.kids.length) return one;
  const inner = pad + "  ";
  return (n.obj ? "{" : "[") + "\n"
    + n.kids.map(([k, v]) => inner + (k ? k + ": " : "") + pretty(v, inner)).join(",\n")
    + "\n" + pad + (n.obj ? "}" : "]");
}

/* one-line JSON text -> readable, diffable file content */
const formatJSON = text => pretty(parse(text), "") + "\n";

/* file content -> one-line JSON text; throws if it is not valid JSON */
function minifyJSON(text) {
  let out = "", inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      out += c;
      if (c === "\\") out += text[++i];
      else if (c === '"') inStr = false;
    } else if (c === '"') { inStr = true; out += c; }
    else if (!" \t\n\r".includes(c)) out += c;
  }
  JSON.parse(out);
  return out;
}

module.exports = { formatJSON, minifyJSON };
