/* Downloads everything the rebake needs into tools/.cache. All sources are public
   GitHub files: free, keyless, no account. Run it after every patch, then rebake.
     node tools/fetch-data.js            download everything again
     node tools/fetch-data.js --missing  only fetch files not already cached */
const fs = require("fs");
const { cached } = require("./lib/common");

const DATAMINING = "https://raw.githubusercontent.com/xivapi/ffxiv-datamining/master/csv/en/";
const TEAMCRAFT = "https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/staging/libs/data/src/lib/json/";
const INFI = "https://raw.githubusercontent.com/Infiziert90/FFXIVGachaSpreadsheet/refs/heads/master/website/static/data/";
const TRACKER = "https://raw.githubusercontent.com/Infiziert90/SubmarineTracker/master/SubmarineTracker/";
const FISHTRACKER = "https://raw.githubusercontent.com/icykoneko/ff14-fish-tracker-app/master/";

const FILES = [
  /* the game's own tables */
  ...["Item", "ItemUICategory", "SpecialShop", "TomestonesItem", "GCScripShopItem",
    "GilShop", "GilShopItem", "ENpcBase", "ENpcResident", "Level", "Map", "PlaceName", "TerritoryType",
    "SubmarineExploration", "SubmarineMap", "SubmarinePart", "SubmarineRank",
    "CompanyCraftSequence", "CompanyCraftPart", "CompanyCraftProcess", "CompanyCraftSupplyItem",
    "CompanyCraftType", "CompanyCraftDraftCategory",
    "CollectablesShop", "CollectablesShopItem", "CollectablesShopItemGroup", "CollectablesShopRewardScrip",
    "CollectablesShopRefine", "ItemAction", "RetainerTaskRandom", "RetainerTask", "TreasureHuntRank", "TreasureSpot"].map(n => [n + ".csv", DATAMINING + n + ".csv"]),
  /* Teamcraft: recipes (workshop trees, simulator links), icons, sub part -> item, gathering nodes, fish per spot */
  ...["recipes", "item-icons", "submarine-parts", "nodes", "fishing-spots"].map(n => [n + ".json", TEAMCRAFT + n + ".json"]),
  /* Infi's crowd-sourced loot records: submarine voyages and duty coffers */
  ...["Submarines", "DeepDungeonSacks", "EurekaBunnies", "FieldOpLockboxes", "OccultTreasuresV2", "ChestDropsV2", "Ventures", "LastUpdate"]
    .map(n => [n + ".json", INFI + n + ".json"]),
  /* SubmarineTracker's surveillance / retrieval / favor breakpoints per sector */
  ["Sectors.cs", TRACKER + "Data/Sectors.cs"],
  /* the Carbuncle Plushy fish tracker: each fish's hours and weather, and every zone's weather odds */
  ["fishtracker-data.js", FISHTRACKER + "js/app/data.js"],
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url) {
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (a === 3) throw new Error(url + ": " + e.message);
      await sleep(2000 * (a + 1));
    }
  }
}
(async () => {
  const missingOnly = process.argv.includes("--missing");
  let n = 0;
  for (const [name, url] of FILES) {
    if (missingOnly && fs.existsSync(cached(name))) continue;
    const buf = await get(url);
    fs.writeFileSync(cached(name), buf);
    console.log(`  ${name.padEnd(30)} ${(buf.length / 1024).toFixed(0).padStart(7)} KB`);
    n++;
  }
  console.log(`fetched ${n} file(s) into tools/.cache`);
})().catch(e => { console.error(e.message); process.exit(1); });
