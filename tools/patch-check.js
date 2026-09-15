/* Is a patch due a rebake? The weekly GitHub job asks this before doing anything.
   A patch shows up as a new commit to ffxiv-datamining's csv/en folder (they are titled
   with the patch, e.g. "7.56"). The rebake waits WAIT_DAYS after that for players' loot
   records to build up, then runs on every weekly check until STOP_DAYS, so the rates keep
   improving for a month. Outside that window it does nothing.
     node tools/patch-check.js           print the answer
     node tools/patch-check.js --force   say yes regardless
   Under GitHub Actions it also writes rebake=true|false, patch and days to $GITHUB_OUTPUT. */
const fs = require("fs");
const { latestGameData } = require("./lib/common");

const WAIT_DAYS = 10;
const STOP_DAYS = 38;

(async () => {
  /* "7.56 (#117)" -> "7.56": that PR number would link to the wrong repo */
  const { patch, when } = await latestGameData();
  const days = Math.floor((Date.now() - when) / 86400000);
  const force = process.argv.includes("--force");
  const rebake = force || (days >= WAIT_DAYS && days <= STOP_DAYS);

  console.log(`latest game data: "${patch}", ${when.toISOString().slice(0, 10)} (${days} day(s) ago)`);
  console.log(rebake
    ? `rebake: yes${force ? " (forced)" : ` — inside the ${WAIT_DAYS}-${STOP_DAYS} day window`}`
    : `rebake: no — ${days < WAIT_DAYS ? `waiting until day ${WAIT_DAYS} for loot records` : `the ${STOP_DAYS}-day window has passed`}`);

  if (process.env.GITHUB_OUTPUT)
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `rebake=${rebake}\npatch=${patch}\ndays=${days}\n`);
})().catch(e => { console.error(e.message); process.exit(1); });
