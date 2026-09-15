/* One command after a patch:
     node tools/rebake.js              download fresh data, rebuild, write into src/data and index.html
     node tools/rebake.js --offline    rebuild from what is already in tools/.cache
     node tools/rebake.js --reprice    also re-ask Universalis for the Duties price check
   Then open index.html, check the Dashboard, Precrafts, Currencies, Vendors, Submersibles, Workshop
   and Duties tabs, and commit. */
const { execFileSync } = require("child_process");
const path = require("path");

const args = process.argv.slice(2);
const run = (script, extra = []) => {
  console.log(`\n> ${script} ${extra.join(" ")}`.trimEnd());
  execFileSync(process.execPath, [path.join(__dirname, script), ...extra], { stdio: "inherit" });
};
try {
  if (!args.includes("--offline")) run("fetch-data.js");
  run("build-subs.js");
  run("build-workshop.js");
  run("build-currencies.js");   // before Duties, which reads its potsherd exchanges
  run("build-vendors.js");
  run("build-duties.js", args.includes("--reprice") ? ["--reprice"] : []);
  run("build-crafts.js", args.includes("--offline") ? ["--offline"] : []);
  run("apply.js");
  console.log("\nDone. Review the seven tabs, then `git diff --stat` and commit.");
} catch (e) {
  console.error("\nRebake stopped: src/ and index.html were not changed unless apply.js ran.");
  process.exit(1);
}
