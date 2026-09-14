# Rebaking the desk after a patch

The **Submersibles**, **Workshop** and **Duties** tabs carry baked game data — sectors and loot
rates, workshop projects and recipes, duty drops and exchanges — alongside the desk's item icon,
search-name and Teamcraft recipe indexes. A patch that adds a sea, a workshop project, a deep
dungeon or a field operation needs that data pulled again. These scripts do it in one go.

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

That downloads fresh data into `tools/.cache/` (about 45 MB, ignored by git), rebuilds all three
datasets, and writes them into `index.html`. Then:

1. Open `index.html` and look at the three tabs.
2. Read what the rebake printed — anything marked **WARNING** or **note** needs a look (below).
3. Run `node tools/check-bake.js`, then `git diff --stat`, commit and push.

Give the community data a few days after a patch before rebaking. The loot rates come from players'
plugins uploading what they find, so a brand-new sea or coffer starts with a thin sample and fills in
over the first week or two. Rebaking again later simply picks up the better numbers.

| Option | What it does |
| --- | --- |
| `--offline` | Rebuild from what is already in `tools/.cache/`, without downloading |
| `--reprice` | Ask Universalis again for the Duties price check even if the cached prices are under a day old |

Each step can also be run on its own: `fetch-data.js` (add `--missing` to fetch only files not yet
cached), `build-subs.js`, `build-workshop.js`, `build-duties.js`, then `apply.js` to write the results.
`check-bake.js` looks the result over before you commit. It is the same check the weekly job runs.

## What each step reads

| Step | Source | Gives |
| --- | --- | --- |
| `fetch-data.js` | [ffxiv-datamining](https://github.com/xivapi/ffxiv-datamining) `csv/en/` | `Item`, `SpecialShop`, `Submarine*` and `CompanyCraft*` game tables |
| | [Teamcraft](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft) `libs/data/src/lib/json/` | `recipes`, `item-icons`, `submarine-parts` |
| | [Infi's FFXIVGachaSpreadsheet](https://github.com/Infiziert90/FFXIVGachaSpreadsheet) `website/static/data/` | crowd-sourced loot: `Submarines`, `DeepDungeonSacks`, `EurekaBunnies`, `FieldOpLockboxes`, `OccultTreasuresV2`, `ChestDropsV2` |
| | [SubmarineTracker](https://github.com/Infiziert90/SubmarineTracker) `Data/Sectors.cs` | surveillance / retrieval / favor breakpoints per sector |
| `build-subs.js` | the above | `SUB` — seas, sectors, loot per visit, parts, rank bonuses |
| `build-workshop.js` | the above | `WS` — every FC project, its phases, the recipes under its turn-ins |
| `build-duties.js` | the above + the Currencies tab's potsherd shops + Universalis EU/NA prices | `DUTY` — worthwhile drops with rates or exchange costs |
| `apply.js` | the three outputs | writes `SUB`, `WS`, `DUTY` into their tabs; adds any missing icons and search names; rebuilds `RECIPE_INDEX` |

`apply.js` only replaces those constants. Every other tab, and all the page code, is untouched.

## When a human is needed

Most patches need nothing but the command. Things that do need a small edit:

- **A new field operation lockbox zone.** `build-duties.js` prints
  `new lockbox zone "…" is not labelled`. Add it to `LOCKBOX_ZONES` (with its content group) or to
  `LOCKBOX_IGNORED` near the top of the file.
- **A new field operation currency** (like Bozjan Clusters or Occult Crescent's silver and gold
  pieces). Add its item id to `FIELD_CURRENCIES`. The id is in `tools/.cache/Item.csv`, or search the
  item on [Garland Tools](https://garlandtools.org) and use the number in its URL.
- **A new variant dungeon.** Its potsherd arrives through the Currencies tab's shop data, which this
  does not rebuild. Until that tab is updated its exchange will not appear.
- **A whole new kind of content** (another Occult Crescent–style zone with its own coffer export).
  Add a `coffers(...)` call in `build-duties.js`, a group name to `MIN` and `GROUP_ORDER`, and the
  same group to `GROUPS` in the Duties tab inside `index.html`, so it gets a sidebar entry and a card.
- **A new notorious monster drop worth money.** FATE rewards have no loot records; add a line to `FATE`.
- **A new sea.** Nothing to do — it is picked up automatically, and the Submersibles tab names it
  from the game data. If `build-subs.js` notes sectors without breakpoints, SubmarineTracker has not
  added them yet; those sectors are treated as fully met until it does, so rebake again later.
- **A new workshop category.** `build-workshop.js` warns; the Workshop tab's `groupOf()` and
  category list need the new one.

Thresholds live in `MIN` in `build-duties.js`: the lower of the Europe and North America 30-day
average an item needs to be listed (40k for dungeons and variant, 100k for deep dungeons, 50k for
field operations).

## Not covered here

The **Vendors** and **Currencies** datasets, and the Dashboard and Precrafts recipe catalogues,
were baked by earlier one-off scripts that were not kept. They still work, but their costs and
catalogues are pinned to the patch they were built on (7.55).
