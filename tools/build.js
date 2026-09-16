// Builds index.html from src/. The desk still ships as that one file (GitHub Pages serves it,
// and it opens straight from disk), but nobody edits it by hand: edit src/, then run this.
//   node tools/build.js           write index.html
//   node tools/build.js --check   exit 1 if index.html is not what src/ builds (the pre-commit hook)
//
// src/index.html is the shell. Two markers pull the other files in, paths relative to src/:
//   /*@string path*/""   the file as a JS string literal: shared code, tab documents, indexes.
//                        Markers inside that file are filled first.
//   /*@json path*/null   a data file squeezed back to one line: the datasets inside a tab
//   /*@pack path*/null   the same, packed small with its unpacker in front (the Dashboard
//                        catalogue; see tools/lib/dashboard-pack.js)
const fs = require("fs");
const path = require("path");
const { minifyJSON } = require("./lib/json-text");
const { packText } = require("./lib/dashboard-pack");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const INDEX = path.join(ROOT, "index.html");
const HEADER = "<!-- Built from src/ by tools/build.js. Edit the files there, then run: node tools/build.js -->";

const readSrc = rel => fs.readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
const writeSrc = (rel, text) => fs.writeFileSync(path.join(SRC, rel), text);

/* "<" is escaped so a document can never close the shell's own <script> */
const jsString = s => JSON.stringify(s).replace(/</g, "\\u003c");

function fill(text) {
  return text.replace(/\/\*@(string|json|pack) ([\w./-]+)\*\/(""|null)/g, (marker, kind, rel) => {
    if (kind === "string") return jsString(fill(readSrc(rel)));
    let json;
    try { json = minifyJSON(readSrc(rel)); }
    catch (e) { throw new Error(`src/${rel} is not valid JSON: ${e.message}`); }
    if (kind === "json") return json;
    const out = packText(readSrc(rel), json);
    if (!out.packed) console.log(`WARNING: src/${rel} went in unpacked (${out.why}). The desk works, but index.html is bigger; update tools/lib/dashboard-pack.js.`);
    return out.expr;
  });
}

function build() {
  const html = fill(readSrc("index.html"));
  const nl = html.indexOf("\n");
  return html.slice(0, nl + 1) + HEADER + html.slice(nl);
}

if (require.main === module) {
  try {
    const html = build();
    if (process.argv.includes("--check")) {
      const now = fs.existsSync(INDEX) ? fs.readFileSync(INDEX, "utf8").replace(/\r\n/g, "\n") : "";
      if (now !== html) {
        console.error("index.html does not match src/.\n"
          + "  Changed something in src/? Run: node tools/build.js\n"
          + "  Changed index.html itself? Make the change in src/ instead; the next build overwrites index.html.");
        process.exit(1);
      }
      console.log("index.html matches src/");
    } else {
      fs.writeFileSync(INDEX, html);
      console.log(`index.html built from src/ (${(html.length / 1024 / 1024).toFixed(1)} MB)`);
    }
  } catch (e) {
    console.error("build failed: " + e.message);
    process.exit(1);
  }
}

module.exports = { SRC, INDEX, readSrc, writeSrc, build };
