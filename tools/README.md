# Rebaking the desk after a patch

The **Dashboard**, **Precrafts**, **Currencies**, **Vendors**, **Submersibles**, **Workshop**, **Duties**, **Scrips**,
**Flips** and **Retainers** tabs carry baked game data — recipes, currency shops, NPC gil shops, sectors and loot
rates, workshop projects and recipes, duty drops and exchanges, scrip collectables, flip items and venture
drops — alongside the desk's item icon, search-name and Teamcraft recipe indexes. A
patch that adds a recipe, a shop, a sea, a workshop project, a deep dungeon or a field operation needs that
data pulled again. These scripts do it in one go.

Everything they read is a public file on GitHub, plus a price check against Universalis: free,
no key, no account. They need nothing but [Node.js](https://nodejs.org) 18 or newer — no
`npm install`.

## It runs itself

A GitHub Actions job ([`.github/workflows/rebake.yml`](../.github/workflows/rebake.yml)) does all of
this on its own. It is free for a public repo and needs no key or account.

- **Every Monday** `patch-check.js` looks at when the game data last changed (a new commit to
  ffxiv-datamining's `csv/en`, titled with the patch).
- **From 10 to 38 days after a patch** it rebakes each week. The wait lets players' loot records
  build up, and the repeats pick up better rates as they fill in. Outside that window it does nothing.
- **A clean rebake is pushed to main.** Clean means no WARNING or note, and `check-bake.js` passes:
  every script still parses, and no dataset shrank by more than a quarter. The one note it lets
  through is sectors still waiting on SubmarineTracker's breakpoints, which sorts itself out (see below). If nothing changed, nothing
  is committed.
- **Anything else pushes nothing** and opens an issue labelled `rebake` with the log, which GitHub
  emails you about. Make the fix from [When a human is needed](#when-a-human-is-needed), then either
  run the rebake locally and push, or start the job again. Close the issue once it is sorted; while it
  stays open, later failures are added to it as comments.
- **To rebake now**, go to the repo's **Actions → Weekly rebake → Run workflow**. That ignores the
  window.

GitHub turns off schedules in repos with no activity for 60 days, which can happen between patches.
The job switches itself back on each time it runs, so this should never bite. If it ever does, GitHub
emails you and one click on the Actions page turns it back on.

## After a patch, by hand

```
node tools/rebake.js
```

That downloads fresh data into `tools/.cache/` (about 80 MB, ignored by git), rebuilds all ten
datasets, writes them into `src/data/`, and rebuilds `index.html` from `src/`. Then:

1. Open `index.html` and look at the ten tabs.
2. Read what the rebake printed — anything marked **WARNING** or **note** needs a look (below).
3. Run `node tools/check-bake.js`, then `git diff --stat`, commit and push.

Give the community data a few days after a patch before rebaking. The loot rates come from players'
plugins uploading what they find, so a brand-new sea or coffer starts with a thin sample and fills in
over the first week or two. Rebaking again later simply picks up the better numbers.

| Option | What it does |
| --- | --- |
| `--offline` | Rebuild from what is already in `tools/.cache/`, without downloading |
| `--reprice` | Ask Universalis again for the Duties and Retainers price check even if the cached prices are under a day old |

Each step can also be run on its own: `fetch-data.js` (add `--missing` to fetch only files not yet
cached), `build-subs.js`, `build-workshop.js`, `build-currencies.js`, `build-vendors.js`, `build-duties.js`,
`build-crafts.js`, `build-scrips.js`, `build-flips.js`, `build-retainers.js`, then `apply.js` to write the results. Run
`build-currencies.js` before `build-duties.js` and `build-scrips.js`, which read its shops, and `build-retainers.js` last,
since it reads the other outputs to say where else a venture drop comes from.
`check-bake.js` looks the result over before you commit. It is the same check the weekly job runs.

## What each step reads

| Step | Source | Gives |
| --- | --- | --- |
| `fetch-data.js` | [ffxiv-datamining](https://github.com/xivapi/ffxiv-datamining) `csv/en/` | `Item`, `ItemUICategory`, `SpecialShop`, `TomestonesItem`, `GCScripShopItem`, `GilShop`, `GilShopItem`, `ENpcBase`, `ENpcResident`, `Level`, `Map`, `PlaceName`, `TerritoryType`, `ItemAction`, `RetainerTask*`, `Submarine*`, `CompanyCraft*` and `CollectablesShop*` game tables |
| | [Teamcraft](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft) `libs/data/src/lib/json/` | `recipes`, `item-icons`, `submarine-parts` |
| | [Infi's FFXIVGachaSpreadsheet](https://github.com/Infiziert90/FFXIVGachaSpreadsheet) `website/static/data/` | crowd-sourced loot: `Submarines`, `DeepDungeonSacks`, `EurekaBunnies`, `FieldOpLockboxes`, `OccultTreasuresV2`, `ChestDropsV2`, `Ventures` |
| | [SubmarineTracker](https://github.com/Infiziert90/SubmarineTracker) `Data/Sectors.cs` | surveillance / retrieval / favor breakpoints per sector |
| `build-subs.js` | the above | `SUB` — seas, sectors, loot per visit, parts, rank bonuses |
| `build-workshop.js` | the above | `WS` — every FC project, its phases, the recipes under its turn-ins |
| `build-currencies.js` | the game tables | `CURRENCIES` — each listed currency's marketable items, cost and shop |
| `build-vendors.js` | the game tables + Teamcraft `recipes` | `VENDORS` — every marketable gil-shop item, its price, one NPC and map position; `NPC_PRICES` — every crafting material or workshop turn-in an NPC sells all year, for the crafting tabs |
| `build-duties.js` | the above + `build-currencies.js`'s potsherd shops + Universalis EU/NA prices | `DUTY` — worthwhile drops with rates or exchange costs |
| `build-crafts.js` | Teamcraft `recipes` + the game tables + the catalogues already in `src/data/` | `DASHBOARD` — every marketable item a personal recipe makes, with its recipe; `PRECRAFTS` — every craftable item used as an ingredient. Keeps each row's order and the Dashboard's HQ/NQ choices, and tags items new to the game with the patch for the Precrafts *new* badge |
| `build-scrips.js` | the `CollectablesShop*` tables + Teamcraft `recipes` + `build-currencies.js`'s scrip shops | `SCRIPS` — every crafted collectable the appraiser takes for purple or orange crafters' scrips, its scrips at top collectability and its whole recipe tree; every crafter materia each scrip buys |
| `build-flips.js` | `Item` + `ItemAction` | `FLIPS` — every marketable mount, minion, hairstyle, emote and outfit coffer |
| `build-retainers.js` | Infi's `Ventures` + Universalis EU/NA prices + the other outputs | `RETAINERS` — exploration venture drops worth selling, their tiers and drop chance; keeps each existing row's hand-checked note on other sources |
| `apply.js` | the ten outputs | writes `CD`, `VD`, `SUB`, `WS`, `DUTY`, `DATA`, `PRE`, `T4`, `FLIP_ITEMS`, `VITEMS` to `src/data/currencies.json`, `vendors.json`, `submersibles.json`, `workshop.json`, `duties.json`, `dashboard.json`, `precrafts.json`, `scrips.json`, `flips.json`, `retainers.json`, and `NPC_PRICES` to `npc-prices.json`; adds any missing icons and search names; rebuilds `RECIPE_INDEX`; runs `build.js` |

`apply.js` only replaces those files in `src/data/`. Every other tab, and all the page code, is untouched.

## When a human is needed

Most patches need nothing but the command. Things that do need a small edit:

- **A new field operation lockbox zone.** `build-duties.js` prints
  `new lockbox zone "…" is not labelled`. Add it to `LOCKBOX_ZONES` (with its content group) or to
  `LOCKBOX_IGNORED` near the top of the file.
- **A new field operation currency** (like Bozjan Clusters or Occult Crescent's silver and gold
  pieces). Add its item id to `FIELD_CURRENCIES`. The id is in `tools/.cache/Item.csv`, or search the
  item on [Garland Tools](https://garlandtools.org) and use the number in its URL.
- **A new currency** (a tomestone, scrip, tribal currency or variant dungeon potsherd).
  `build-currencies.js` prints `currency … buys marketable items but is not in CURRENCIES or IGNORED`.
  Add it to `CURRENCIES` with its group, or to `IGNORED` if the tab should skip it. A new potsherd in
  the `Variant & Deep Dungeons` group reaches the Duties tab on its own.
- **New scrips.** When the game retires purple or orange scrips, it prints `scrip index … is not in
  SCRIPS`. Add the index to `SCRIPS` with the new scrip's item id, and the scrip to `CURRENCIES`.
- **A new item category on Vendors.** `build-vendors.js` prints `UI category "…" is in no group`; add it
  to the right group in `GROUP_OF`.
- **A whole new kind of content** (another Occult Crescent–style zone with its own coffer export).
  Add a `coffers(...)` call in `build-duties.js`, a group name to `MIN` and `GROUP_ORDER`, and the
  same group to `GROUPS` in `src/tabs/duties.html`, so it gets a sidebar entry and a card, then run
  `node tools/build.js`.
- **A new notorious monster drop worth money.** FATE rewards have no loot records; add a line to `FATE`.
- **A new sea.** Nothing to do — it is picked up automatically, and the Submersibles tab names it
  from the game data. If `build-subs.js` notes sectors without breakpoints, SubmarineTracker has not
  added them yet; those sectors are treated as fully met until it does, so rebake again later.
- **A new workshop category.** `build-workshop.js` warns; the Workshop tab's `groupOf()` and
  category list need the new one.
- **A new kind of unlock item.** `build-flips.js` notes unlock items that are neither a hairstyle nor an
  emote; add a line to `KIND` if they belong on Flips, and an option to the Flips tab's category list.
- **A new venture drop with no other source found.** Nothing to do for the rebake: `build-retainers.js`
  lists it and the tab says its other sources are unchecked. If you confirm the venture is the only
  source, add `"x":1` to its row in `src/data/retainers.json`, or `"o":"…"` naming where else it comes from.
- **A new collectable appraiser or scrip.** `build-scrips.js` warns when a collectable has no recipe or a
  scrip buys no materia; new scrip indices go in `SCRIP_OF` / `SCRIP_ITEM` there, as well as in
  `build-currencies.js`.

Thresholds live in `MIN` in `build-duties.js`: the lower of the Europe and North America 30-day
average an item needs to be listed (40k for dungeons and variant, 100k for deep dungeons, 50k for
field operations).
