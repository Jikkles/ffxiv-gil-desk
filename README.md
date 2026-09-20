# Jikky's Gil Factory

A market-board scanner for Final Fantasy XIV — "the desk" for short.

### **[→ Open the desk](https://jikkles.github.io/ffxiv-gil-desk/)**

## What it is

The desk scans the market board and works out where the gil actually is — through crafting,
cross-world flips, gathering, scrip loops, duty drops and currency spending. It pulls live
listings and 30-day sales history for thousands of items at once, prices out every material,
subtracts market tax, and ranks everything by what it would genuinely net.

It runs entirely in the browser from one HTML file: nothing to install, no dependencies, no API
keys, no accounts, no server. It works on every Western, Japanese and Oceanian data centre — pick
your world, tick the data centres you want materials priced across, and go.

## The idea

Every tab answers one question: **if I do this thing, how much gil do I end up with?**

```
profit = (sell price × (1 − tax)) − acquisition cost
```

What changes per tab is what "acquisition cost" means. Three things shape every number:

- **Sales history is the anchor, not listings.** `Avg 30d` is the median price of real sales over
  the past month; a single inflated listing is not a market.
- **Velocity matters as much as margin.** Tabs count *units* a day, not sales, and show a daily
  profit ceiling, so a 20k margin that moves 30 a day outranks a 500k one that moves twice a month.
- **Direction matters too.** `Trend` compares the newer half of the sales history against the
  older half, and shows nothing rather than a number it can't stand behind.

Every tab shares the same columns in the same order — **Item**, **Sell now**, **Avg 30d**,
**Trend**, **Units/day**, **Gil/day** — with its own extras slotted in around them.

## Quick start

Open the desk and pick your world — that's it. Picking a world starts a short guided tour, which
the **Tour** button brings back any time. Want it offline? Download [index.html](index.html) and
open it; it's one self-contained file.

Every tab scans as soon as you open it, except **Dashboard** and **Undercuts**, which wait for a
button because their scans are huge. **Refresh** in the sidebar pulls fresh prices any time.

## Tabs

**Dashboard.** The broad sweep: every personal craft, 9,400+ items, filtered to your class and
level. Pick a class and level range and it ranks consumables, furniture, gear, dyes and
intermediates by profit. Material cost defaults to *Precraft-optimised* — anything cheaper to
craft than to buy is costed as crafted, all the way down the tree. Click a row for the full
crafting tree, buy-vs-craft on every node, and the hours of the day the item sells best.

**Gathering.** Every marketable item a Miner or Botanist pulls from a node, about 730 of them,
ranked by gil an hour. Set your real gathering rate in the sidebar and it works out what an hour
at each node is worth after tax, naming the zone, coordinates, and when timed nodes are next up.

**Currencies.** Pick a currency — tomestones, scrips, seals, variant and deep dungeon potsherds —
and it finds which marketable item that currency buys at the best gil-per-unit rate, then what
that item sells for after tax. Every row names its vendor.

**Scrips.** The two collectable → scrip → materia loops, valued live across all 224 Rarefied
collectables: orange (lvl 100) into grade XII materia, purple (lvl 50–98) into grades IV to XI.
Profit subtracts materials and crystals, so you can see which loop actually wins.

**Duties + Maps.** The drops worth chasing in instanced and field content, with real drop rates:
dungeons, deep dungeons, variant and criterion, Eureka, Bozja, Occult Crescent, treasure maps and
map portals. Switch to **Maps & portals** for what one dug-up coffer is worth against what the
map itself sells for — open it or sell it.

**Flips.** Pure arbitrage, no crafting. Scans ~600 tradeable mounts, minions, hairstyles, emotes,
outfit coffers, pricier orchestrion rolls, facewear, fashion accessories and the two premium dyes
across every world on your picked data centres, and compares the cheapest listing anywhere with
what it sells for at home.

**Retainers.** What the four 18-hour exploration ventures bring back that's actually worth
selling: 26 drops, mostly minions and expensive furnishings, with how often each comes back and
at which venture tier. Ten are flagged as available from nowhere else in the game.

**Submersibles.** Set your subs' rank and parts and it works out the build's stats, then ranks
every voyage route by profit a day on the resend schedule you pick. Salvaged jewellery is valued
at its NPC price and everything else off the board, with voyage time, repairs and each sector's
surveillance and retrieval breakpoints accounted for.

**Workshop.** All 162 Free Company workshop projects — submersible and airship parts, housing
exteriors, aetherial wheels — costed phase by phase against their sale price. Click one for every
turn-in, its set breakdown, crafter level and full recipe tree.

**Vendors.** Every marketable item an NPC sells for plain gil, 4,943 of them, priced against the
board on your server. Vendor prices never move, so this is repeatable income rather than a snipe.
It defaults to what's profitable right now, sorted by gil a day, with the NPC, zone and map
coordinate on every row.

**Undercuts.** Add your retainer names, press **Check for Undercuts**, and it reads every listing
on your world in about ten seconds and keeps yours. It shows how far below you the cheapest rival
sits and how many beat you. **Keep checking** re-checks on a timer, tags new undercuts, counts
them on the tab bar, and can fire a desktop notification.

**Lists.** Up to five lists you fill yourself, renameable, kept in your browser. The 📋 button on
any row of any tab files an item into one, bringing its recipe tree, world, vendor or currency
with it. Each list is a full tab with the same columns and crafting trees.

## Shared features

- **Shopping list.** 🛒 adds an item's materials to a list shared across every tab, grouped by
  world, with a running gil total and NPC-shop alternatives where they're cheaper.
- **NPC shops.** Crafting tabs price every material at the cheaper of the board and an NPC gil shop.
- **Prices on other worlds.** 🌐 on any row answers the question that matters: *where do I get
  this many, and what does it cost?* — per-world stock, cheapest-first fill cost, best split.
- **Item search.** The top-right box (or `/`) looks up any item by name and opens that panel.
- **How this works.** A folded explainer on every tab, plus **▶ Show me**, a walkthrough of that
  tab on the live page.
- **Settings.** Home world, the data centres materials are priced across, and market tax are set
  per tab and remembered, along with each tab's filters, sort and folded sidebar.

## Data

Market data comes from the [Universalis](https://universalis.app) API — free, keyless, CORS-open.
Item and recipe metadata is baked into the file, from the public game data dumps, Teamcraft, and
[Infi's FFXIVGachaSpreadsheet](https://github.com/Infiziert90/FFXIVGachaSpreadsheet) for
crowd-sourced drop rates. Responses are cached for 12 minutes; **Refresh** skips the cache.

## Keeping it current

The baked datasets rebuild themselves: a free GitHub Actions job checks every Monday and rebakes
from 10 to 38 days after a patch. By hand it's one command:

```
node tools/rebake.js
```

## Architecture

The desk ships as one ~4MB `index.html` so it opens straight from disk, but that file is
**built**, not edited — the source lives in `src/`:

```
node tools/build.js           # after editing anything in src/
node tools/build.js --check   # does index.html match src/?
node tools/smoke.js           # draw every tab in a headless browser
```

| In `src/` | What it is |
| --- | --- |
| `index.html` | The shell: tab bar, iframes, search box |
| `tabs/*.html` | One complete page per tab (`list.html` is every saved list) |
| `shared/*.js`, `shared/ui.css` | The code and styles every tab shares |
| `tour/` | The guided tour, and the example page it walks through |
| `data/*` | The baked datasets and the item name, icon and recipe indexes |

Each tab is a standalone document injected into its own `<iframe>`, with the shared chunks spliced
in at render time, so tabs can't collide on globals or CSS. Commit `src/` and the rebuilt
`index.html` together. More detail in [tools/README.md](tools/README.md).

## Changelog

What changed, day by day, is in [CHANGELOG.md](CHANGELOG.md).
