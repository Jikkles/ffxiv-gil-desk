# Jikky's Gil Factory

A market-board scanner for Final Fantasy XIV — "the desk" for short.

### **[→ Open the desk](https://jikkles.github.io/ffxiv-gil-desk/)**

The whole idea is to scan the market board and work out, quickly and efficiently, where the
most gil is actually available — mainly through crafting, but also through cross-world flips,
scrip loops and currency spending. Rather than eyeballing prices item by item, the desk pulls
live listings and 30-day sales history for thousands of items at once, prices out every
material, subtracts market tax, and ranks everything by what it would genuinely net.

It runs entirely in the browser from a single HTML file. Nothing to install or build to use it,
no dependencies, no API keys, no accounts, no server. (The file itself is assembled from `src/`
by one script; see [Architecture](#architecture) if you want to change it.)

It works on **every Western and Japanese data centre**: pick your world from the North
American, European, Japanese and Oceanian list, and tick whichever data centres you want
materials priced across. The Korean and Chinese services and Square Enix's test data centres
are separate markets, so they are left out.

---

## Quick start

**[Open the desk](https://jikkles.github.io/ffxiv-gil-desk/)** and pick your world. That's it —
nothing to install or sign into. Picking a world starts a short guided tour of the desk, which the
**Tour** button in the top right brings back any time.

Prefer it offline, or want your own copy? Download [index.html](index.html) and open it in a
browser. It is one self-contained file and behaves identically either way; settings and saved
lists live in that browser, so the hosted desk and a local copy keep their own.

Each tab scans as soon as you open it, so a tab is never a blank table waiting for a click —
except the **Dashboard**. The desk opens on it, and its scan is thousands of lookups, so until it
has prices it shows one big **Load live prices** button rather than rate-limiting whichever tab
you actually came for. Come back to a tab and it only rescans if its cached prices have gone cold
(12 minutes), so flipping between tabs costs nothing; **Refresh** in the sidebar skips that cache
and pulls fresh prices every time, with an *Updating…* label and a progress bar along the top
while it works.

## The core idea

Every tab answers a variation of one question: **if I do this thing, how much gil do I end up
with?**

The desk always works from the same profit model:

```
profit = (sell price × (1 − tax)) − acquisition cost
```

What varies per tab is what "acquisition cost" means — buying materials and crafting, buying
the finished item on a cheaper world, spending scrips, or spending a currency at a vendor.

Four deliberate choices run through the whole thing:

- **Sales history is the anchor, not listings.** A single inflated listing is not a market.
  The `Avg 30d` column is the quantity-weighted average of *actual sales* over the past month,
  and most tabs default to pricing against it rather than the current cheapest listing. Rows
  whose current listing sits far from that average get a ⚠ so you can spot noise.
- **Velocity matters as much as margin.** A 500k margin on an item that sells twice a month is
  worse than a 20k margin on something that moves 30 times a day. Tabs surface units/day and a
  *daily profit ceiling* (profit per unit × units per day) so you can rank by what actually
  turns over. That ceiling is a ranking device, not a promise — you capture a slice of the
  market, not all of it.
- **Units, not sales.** People buy caramel popcorn 99 at a time, so counting *sales* said the
  market took four a day when it was taking four hundred. Every velocity on the desk counts
  units: the number in `Units/day` is what a profit-per-unit is multiplied by, and the `×99`
  beside it is the stack the item moves in. The sale count still shows next to `Avg 30d`, since
  how many separate buyers turned up is its own useful number.
- **Direction matters as well as level.** An average tells you where a price has been,
  not where it is going. The `Trend` column splits the sales history in half and compares
  the newer half against the older one, so a margin that is opening up reads differently
  from one that is closing. It is deliberately quiet: it needs at least two days of
  history and three sales on each side, measured on the same quality you are pricing on,
  or it shows nothing rather than a number it cannot stand behind.

## Tabs

| Tab | What it works out |
| --- | --- |
| **Dashboard** | Profit scanner across 9,400+ personal-craft items |
| **Precrafts** | Every craftable intermediate, as a one-step buy-craft-sell flip |
| **Currencies** | Which marketable item each currency buys at the best gil rate |
| **Scrips** | The two collectible → scrip → materia loops, valued live |
| **Duties** | Valuable drops from dungeons, deep dungeons, variant, Eureka, Bozja and Occult Crescent, with drop rates |
| **Flips** | Cross-world flips on mounts, minions, hairstyles and outfit coffers |
| **Retainers** | What the four exploration ventures bring back that is worth selling |
| **Submersibles** | Which voyage route earns the most for your sub build and resend schedule |
| **Workshop** | All 162 Free Company workshop projects, costed phase by phase against their sale price |
| **Vendors** | Every gil-priced NPC item, and what it resells for on your server |
| **Lists** | Up to five lists you fill yourself, renameable, kept in your browser |

The tabs share one set of columns, in the same order everywhere: **Item**, **Sell now**,
**Avg 30d**, **Trend**, **Units/day** and **Gil/day**, with each tab's own extras (a vendor cost,
a buy price, a profit) slotted in around them. `Sell now` carries a small age pill showing how
old that listing is. `Gil/day` is net sale price × units a day — how much gil the item moves on
your world, not your cut of it.

`Trend` is sortable like any other column — sort by it to see what is moving before you commit
to a craft. Hover a trend for the two averages behind it and the window they cover.

Two things sit outside the tabs and work from all of them: the **search box** in the top right,
for looking up any item by name, and the **🌐** button on every row, which shows what that item
costs and how many of it are stocked on each world. Both are described under
[Shared features](#shared-features).

### Dashboard

The broad sweep: consumables, furniture, intermediate materials, gear, tools and dyes.

**Mat cost** has two bases and defaults to *Precraft-optimised*: every intermediate that is
cheaper to craft than to buy is costed as crafted, recursively, all the way down the tree —
which is what actually happens if you precraft. Switch it to *Buy all mats* to price every
direct material straight off the board instead (craftable intermediates HQ, raw materials NQ).
The choice flows through profit, margin and the daily ceiling, and the 🛒 button follows it too:
on the optimised basis the shopping list holds the raw materials you'd buy rather than the
intermediates you'd craft.

Click any item to open its full crafting tree. Each craftable node inside the tree shows the
**HQ buy price vs the cost to craft it yourself**, and a *Precraft-optimised* total showing what
you'd pay if you crafted the intermediates that are cheaper to make than to buy. That's the
difference between a recipe looking unprofitable and actually being profitable.

Turn on *Hide no-sales* and sort by profit to find what's worth bulk-crafting.

*Skip dead items* (on by default) leaves out anything that has not sold in 30 days, which makes a
refresh much faster. The dead list rebuilds itself weekly; **shift-click Refresh** for a full
rescan of every item, dead ones included.

### Precrafts

Every craftable intermediate in the game (900+), scanned as a deliberately simple one-step flip:
buy the materials → craft it once → sell it HQ. No precrafting chains, no FC workshop bonuses,
just the single craft. Filter by crafter class and level range, and click any row for its
material shopping list.

*Deep 30d* swaps the quick recent-average for a true 30-day history pull — slower, but more
reliable on thin markets. Intermediates with thin HQ markets may show no sales; switching *Sell*
to NQ often reveals the real bulk market.

### Currencies

Pick a currency and it works out which marketable item that currency buys at the best
gil-per-unit rate, then what that item sells for after tax. Each row's Item cell shows the item's
own icon and name over its vendor, with the currency icon and what one costs pinned to the right
of the same cell, so the tab keeps the same columns as the rest of the desk.

Vendor costs are read from the game's `SpecialShop` and `GCScripShopItem` tables, filtered to
items actually sellable on the market board, and rebaked after each patch (see
[Keeping it current](#keeping-it-current)). Only prices in a single currency count, and the game's
developer shops and placeholder rows are left out. Where the same item is sold by multiple vendors
for the same currency, the cheapest is used. Some shop rows belong to vendors that no longer exist
in-game, so the vendor name is shown on every row.

Alongside the tomestones, scrips and seals there's a **Variant & Deep Dungeons** group: the four
variant dungeon potsherds (Sil'dihn, Rokkon, Aloalo, Corvosi), all traded to Trisassant in Old
Sharlayan for glamour, emotes, hairstyles and orchestrion rolls, plus the two deep dungeon
potsherds (Gelmorran from Palace of the Dead, Empyrean from Heaven-on-High), which mostly buy
grade V and VI materia. These drop slowly and their rewards are thin on the market board, so set
**min units/day** to `Any` to see the whole shop.

### Scrips

Two scrip-flip loops, valued live:

- **Orange** collectibles (lvl 100, 144 scrips) → grade XII materia at 500 scrips
- **Purple** collectibles (lvl 92–98, 142–198 scrips) → grade XI materia at 250 scrips

Revenue per craft is what those scrips are worth as materia on your home world; profit subtracts
the material cost. `gil/scrip` uses whichever of the three crafter materia (Competence, Cunning,
Command) at that grade sells highest, net of tax. Lower-level Purple collectibles give fewer
scrips but often use much cheaper materials — sorting by profit shows which loop actually wins.

In this tab's recipe trees, precrafts are bought NQ wherever they're listed (you'd rather buy
than precraft here) and only expanded into their own materials when nothing is for sale.

### Duties

The drops worth chasing in instanced and field content, with how often each one actually drops:

- **Dungeons** — minions, orchestrion rolls and furnishings such as the Verdant Partition. The chance
  is per run, every chest in the duty added together, and the item still goes to a party loot roll.
- **Deep dungeons** — what the Palace of the Dead, Heaven-on-High, Eureka Orthos and Pilgrim's
  Traverse sacks appraise into (the Night Pegasus Whistle, the Pilgrim's Traverse horns and
  resonator, glamour weapons), plus the Gelmorran and Empyrean potsherd exchanges.
- **Variant & Criterion** — the Sil'dihn, Rokkon, Aloalo and Corvosi potsherd exchanges, plus the
  Merchant's Tale (Advanced) chests. Variant route minions are untradable, so they are not here.
- **Eureka** — lockboxes and bunny coffers per zone, and notorious-monster FATE drops such as the
  Cassie Earring and Blitzring, which have no recorded rate and say so.
- **Bozja** — Southern Front and Zadnor lockboxes, and the Bozjan Cluster exchange.
- **Occult Crescent** — treasure, pot and bunny coffers in both horns (the Occult accessories of
  Blood and Magic among them), and the Enlightenment silver and gold piece exchanges.

Only drops that sell for real money are listed. **Expected** is what one run, coffer or sack is worth
from that item (chance × average after tax), or gil per unit of currency for an exchange. Sell now
is your world and the rest is measured across your data centre, because rare drops
sell a handful of times a month on any one world.

### Flips

No crafting involved — pure arbitrage. Scans mounts, minions, hairstyles, outfit coffers and
emotes (the tradeable `Ballroom Etiquette` manuals) across every world on the data centres you
have picked, finds the cheapest listing anywhere, and compares it to the 30-day average sale
price on your home world. The world name is colour-coded: orange means a
world hop is required, teal means it's already on your world.

Rare, slow-moving items are exactly where current listings lie most, so this tab leans hardest
on sales history.

### Retainers

What the four 18-hour exploration ventures (Field, Highland, Woodland and Waterside) bring back
that is worth selling: 26 drops, mostly minions plus a few expensive furnishings. Anything worth
only a few thousand gil is left off, because it is a venture reward but not a reason to send one.

Ten of the rows are tagged **only from this venture**: they have no other source in the game (not
craftable, not sold by a vendor, not a quest, duty or gathering drop, and not returned by a
different venture). The rest can also be had elsewhere, and each row says where. The **Tier(s)**
column gives the venture tiers in Roman numerals; a higher tier needs a higher-level retainer.

The headline cards rank the four ventures by their most valuable drop. Filter to one venture, tick
*Venture-exclusive only*, or tick *Only what is actually selling* to drop anything with no sales
in 30 days.

As on Duties, Sell now is your world but Avg 30d, Trend, Units/day and Gil/day are measured
across your data centre, because these items sell a handful of times a month on any one world.
Gil/day is Avg 30d after tax × units a day.

### Submersibles

Free Company submersibles are sent on voyages of up to five sectors and come back with loot. Nearly
all of the gil is **salvaged jewellery** (Salvaged and Extravagant Salvaged rings, bracelets, earrings
and necklaces), which cannot go on the market board but sells to any NPC for a fixed 8,000–34,500. It
drops in Deep-sea Site sectors J, M, O, R and Z, and in the Sea of Ash's Ascetic's Demise — which is
why players run **OJ** (the Wreckage of *Discovery I* and the unidentified derelict) once a day, or
**MROJZ** / **JORZ** on a longer cycle.

Set your subs' **rank** and **parts** (hull, stern, bow, bridge — `S+` is a modified Shark, and so
on) and the tab works out the build's surveillance, retrieval, speed, range and favor, then ranks
every route worth sailing:

- **Loot per visit** comes from crowd-sourced voyage records (see [Data](#data)): units per loot roll,
  times the rolls a visit gives when favor clears the sector's breakpoint. Short of a sector's
  surveillance breakpoints the build loses that tier's loot; short of its retrieval breakpoint it
  brings back the smaller quantity band. Both are flagged per sector.
- **Salvage** is valued at the NPC price; everything else at the lower of its 30-day average and its
  cheapest listing across your data centre, after tax, so a single troll sale cannot make a sector.
- **Voyage time** uses the game's own formula — travel and survey time scaled by speed, plus a fixed
  12 hours — and each route is sailed in the quickest order that fits the build's range.
- **Repairs** are Magitek Repair Materials at the current price, spread over the voyages a part
  lasts. Ceruleum tanks cost company credits, not gil, so they are counted but not subtracted.
- **Profit/day** is what the fleet nets a day on the resend schedule you pick. A 22-hour voyage sent
  once a day earns every day; a 26-hour one only every other day, which is exactly the trade-off
  between OJ and the longer routes.

Click a route for what each sector brings back and which breakpoints the build meets. The **Loot**
view lists every item a voyage can return, with the desk's standard price columns.

### Workshop

All 162 projects a Free Company workshop can build — submersible and airship parts, housing
exteriors and aetherial wheels — read straight from the game's `CompanyCraftSequence`,
`CompanyCraftPart`, `CompanyCraftProcess` and `CompanyCraftSupplyItem` tables, so every phase, set
size and set count is what the workshop really asks for. Columns match the Dashboard: sell now,
30-day average, trend, material cost, profit, margin, units/day and gil/day.

Click a project for its phases, each turn-in with its set breakdown and crafter level, and the recipe
under every craftable turn-in, as deep as it goes. **Mat cost** defaults to *Precraft-optimised* (a
turn-in cheaper to craft than to buy is costed as crafted, crystals included); *Buy turn-ins* prices
each turn-in straight off the board. Turn-ins accept either quality, so each is bought at whichever of
NQ and HQ is cheaper. Drafts, company credits and workshop time are not gil, so they are not counted.
Projects that have not sold in 30 days carry a ⚠ and are kept out of the headline cards.

### Vendors

Every marketable item an NPC will sell you for plain gil — **4,943** of them — priced against
the market board on the server you pick. Vendor prices are fixed and never move, so unlike the
crafting tabs the only variable is what the board pays, which makes anything here a repeatable
run rather than a one-off snipe.

By default the tab shows **only what is turning a profit right now**. That is still around
1,200 rows on a busy server, so the default sort is **Gil/day** rather than raw margin — a 40M
margin on something that sells twice a year is worth less than a 5k margin on something that
shifts thirty a day, and sorting this way sinks the dead stock on its own. The best profit/day
(profit per unit × units per day) is still shown in the headline cards.

The columns read Item, Bought from, Vendor cost, Sell now, Sell avg 30d, Trend, Profit/unit,
Margin, Units/day and Gil/day. Trend is pulled only for the rows on screen and fills in just
after the table draws, since fetching 30 days of sales for all 4,943 items would take fifty
extra batches. Tick **Show ALL vendor items** to see the whole 4,943 including the losers;
it's off by default because most vendor stock never sells for more than it costs.

**Sell price** has three bases. *Realistic* (the default) takes the lower of the cheapest
current listing and the 30-day average — you have to undercut the board to sell, but a lone
silly listing is not a real price. *Cheapest listing* and *30-day average* are also available.

A ⚠ chip means the price is not backed by real sales: either nothing has sold on that server in
30 days, or the listing sits far from the average that did. Most vendor stock hits one of those,
so the chip is common — the headline figures at the top of the tab ignore those rows entirely,
and **Hide ⚠ unreliable** drops them from the table. Without this the tab would happily report a
142M profit on an interior wall that has never once sold.

**Bought from** is joined out of the game's own shop tables: the NPC, the zone and the map
coordinate. Where several NPCs stock an item, the one shown is a vendor with a map position before
one without, then a city vendor before one out in the field or in a housing ward. *+n more* counts
the other NPCs that stock it. Two tags flag stock you may not be able to buy
today: `locked?` where a quest or achievement gates the shop, and `seasonal` where the shop only
opens during an event (46 items, mostly Starlight, Valentione's and Heavensturn furnishings).

### Lists

Up to five lists you fill yourself. The 📋 button on any row of any tab, and on any material inside
a crafting tree, opens a picker with your lists on it; choose one and the item lands there.
Clicking the same list again takes it back off.

Each tab hands over what it knows: a precraft or a Scrips collectable brings its whole recipe
tree so the list can price the materials, a flip brings the world it was cheapest on, a vendor
item brings the NPC and zone, and a currency item brings the currency and shop it came from.

Each list is a full tab: sell now, 30-day average, material cost, profit, margin, units/day and
gil/day, plus the same recursive crafting tree as the Dashboard. An item saved without a recipe
(a raw material, say) is still priced — it just shows no crafting cost.

- **＋ List** in the tab bar creates another list, up to five. **New list…** at the bottom of the
  picker does the same thing and files the item into it in one go.
- **✎ Rename** calls a list whatever you want — *Consumables*, *Weekly craft*, *Watchlist*. The
  tab label follows immediately.
- **Clear list** empties one, and **↩ Undo clear** puts it straight back. The cleared items are
  parked in `localStorage`, so the undo still works after a reload.
- **✕ Remove list** drops the tab entirely.

Lists live in your browser's `localStorage` and are never uploaded anywhere. Each saved item
carries its own recipe tree with it, which is what lets a list price a full craft without
loading the Dashboard's 9,000-item catalogue.

## Shared features

**Shopping list.** The 🛒 button adds an item's materials to a list shared across every tab. It is
on the rows of the Dashboard, Precrafts, Scrips and your lists, where it adds the recipe's
materials; on Workshop, where it adds every turn-in the project needs; and on Flips, Retainers and
Vendors, where it adds the item itself. Currencies, Duties
and Submersibles have nothing to buy with gil, so they don't carry one. It groups by world (flagging which need a hop), tracks a running gil total, and tags
each line with which finished item it's for. Worlds stay in the order they were first added, so
ticking items off never moves the world you're halfway through buying. Prices are captured at the time of adding, and each
line is badged against the recent average so you can see whether you're buying into a dip or
overpaying. Crystals, shards and clusters are excluded — assumed stocked.

**Teamcraft simulator.** Every craftable row on the **Dashboard**, **Precrafts** and list tabs —
and every craftable material inside a crafting tree, including the Workshop's — has a Teamcraft button, marked with its TC logo, that opens that exact
recipe in the [Teamcraft](https://ffxivteamcraft.com) craft simulator, so you can check a
rotation before you commit. Rows that aren't crafted don't get one.

**Tab links.** Every tab has its own address — `#dashboard`, `#precrafts`, `#currencies`,
`#scrips`, `#duties`, `#flips`, `#retainers`, `#submersibles`, `#workshop`, `#vendors`, and
`#list1` to `#list5` — so a link or bookmark opens the desk straight on that tab, and the browser's
Back and Forward buttons step through the tabs you visited. An address for a list you don't have
opens the Dashboard.

**Guided tour.** A first visit that picks a world goes straight into a walkthrough of an example
Dashboard with made-up prices, sized to your window: it dims everything but the part it is
explaining, zooms in on it, and talks through it in a speech bubble. It covers the side panel,
the page summary and cards, the item list, ⚠ outliers, how fresh prices are, the crafting tree
and where to buy materials, each row button, and the other tabs. **Tour** in the top right runs
it again; the arrow keys step through it and Esc closes it. The example is drawn with the real
Dashboard's stylesheet and a copy of your tab bar, so it never shows a desk that looks different
from yours, and it loads and scans nothing.

**How this works.** Every tab has a folded **How this works** panel just under its headline cards:
what that tab works out, how to read its own columns and controls, and the catch worth knowing
(why Duties measures prices across your data centre, why a 26-hour submersible route only earns
every second day, why ⚠ is common on Vendors). Open one and it stays open on that tab next visit.
**▶ Show me** beside it walks through that tab on the live page, the same dim-and-spotlight as the
tour: four to six steps lighting up the controls and columns that tab adds, scrolled into view. A
step whose part isn't on screen yet, rows before prices arrive for instance, is passed over. On the
Dashboard, Show me starts the full tour.

**Folding sidebar.** The arrow at the top of any tab's filters panel folds it down to a narrow
rail, giving the table the width. It is one setting for the whole desk: fold it on one tab and
every tab follows, and it stays folded next visit.

**Tab bar.** When the window narrows, the bar tightens step by step (tab padding, a shorter
search box, an icon-only theme button, smaller text, and finally no tab icons) before anything
wraps, so the search box and theme button stay on the right. The list tabs carry on along the
same row while there is room.

**Item search.** The search box in the top right of the tab bar looks up any item by name and
opens the cross-world panel for it, from whichever tab you happen to be on. It matches against
the 13,000+ items the desk carries names for, instantly and offline; anything outside that —
gear, minions, glamour — is resolved live through XIVAPI and marked `wider`. Press `/` or
`Ctrl`/`Cmd`+`K` from anywhere to jump into it.

**Prices on other worlds.** The 🌐 button on any row opens the same panel for that item. The
cheapest listing is only half the story — 50 gil is no use if there are only ten of them — so
the panel answers the question that actually matters: *where do I get this many, and what does
it cost?*

Set how many you want, and each world reports its cheapest listing, how many units are actually
on the board, how many separate lots that is, and the cheapest-first cost of filling your whole
order from that world alone. Worlds that can fill it sort first, cheapest by real cost rather
than by headline price. Above the table sit two answers: the cheapest split across worlds
(`64× Omega + 25× Phantom + 10× Moogle`) and the cheapest single world that can cover the lot,
with the gil difference between them — so you can decide whether a second trip is worth it.

Click any world to see its individual listings. The scope selector covers every data centre and
region the desk trades in, so you can look beyond the ones you are pricing materials across,
and an HQ/NQ filter narrows the maths to one quality. Where a row already implies a quantity — a
material in a recipe tree — the panel opens prefilled with the amount you need. The panel opens
on whichever data centre *Mats from* is set to, or on the whole region when that spans several.

**Category tags.** Every row carries a small tag — `Gear`, `Furniture`, `Materials`,
`Food`, `Medicine`, `Tool`, `Music`, `Minion`, `Dye`, `Misc`. The game's own categories are
far too fine-grained to scan (`Stone`, `Cloth`, `Wall-mounted` and `Rug` are all real ones),
so each folds into the word a player would actually use, and the same ten words mean the
same thing on every tab. The specific game category is kept as the row's subtitle on the
Dashboard and in the tag's tooltip on Vendors, so the detail is still there. Anything the
game classes as `Miscellany`, `Other` or `Seasonal Miscellany` lands in `Misc`, and so does
anything unrecognised — an unknown item is never guessed into a category it might not be in.

**Settings.** Home world (default **Spriggan**), the data centres materials are priced across
(default **Chaos**), and market tax (default **5%**) are set per tab and persisted. Each tab
remembers its own filters and sort between sessions.

On a first visit the desk asks which world you play on, and every tab starts on that world and its
data centre. From then on each tab's world is its own: change it on one tab and the others stay
where they are.

**Worlds and data centres.** *Sell on* lists every world across North America, Europe, Japan and
Oceania, grouped by region and data centre. *Mats from* is a checklist rather than a dropdown of fixed combinations — tick any number
of data centres and materials are priced across all of them, cheapest wins. A shortcut on each
region ticks the whole region at once (all four of North America, all three of Europe, and so
on), and picking a world moves the material search to that world's data centre if it isn't
already selected.

Data-centre travel only works inside your own physical region, so a selection spanning regions is
flagged in the picker — those prices are worth watching, but you can't go and buy them. Every
extra data centre is another full pass over the item list, so a wide selection scans noticeably
slower; the picker says so once you pass four.

The world and data-centre list is baked in as a fallback but refreshed from Universalis on every
load, so a new data centre appears on its own without this file changing. The cross-world panel
reads the same list, so it offers every data centre too.

**Freshness.** Every row shows how stale its data is, from `<1h` through to a day-level warning,
so you know whether you're acting on a live market or yesterday's.

## Data

All market data comes from the [Universalis](https://universalis.app) API — free, keyless and
CORS-open. Item and recipe metadata is baked into the file.

The **Submersibles** and **Duties** drop rates come from
[Infi's FFXIVGachaSpreadsheet](https://github.com/Infiziert90/FFXIVGachaSpreadsheet) exports
(`Submarines.json`, `DeepDungeonSacks.json`, `EurekaBunnies.json`, `FieldOpLockboxes.json`,
`OccultTreasuresV2.json`, `ChestDropsV2.json`) — the loot records uploaded by the SubmarineTracker
and related plugins — baked in by `tools/rebake.js`, which a weekly job reruns after each patch. Sector positions, survey times, tanks and
part stats come from the game's `SubmarineExploration`, `SubmarinePart` and `SubmarineRank` tables,
and the stat breakpoints from [SubmarineTracker](https://github.com/Infiziert90/SubmarineTracker).
Exchange costs are read from `SpecialShop`, as are the **Currencies** shops
(`tools/build-currencies.js`). The **Workshop** projects come from the
`CompanyCraft*` tables, and the recipes under each turn-in from Teamcraft's public data.

The **Vendors** dataset is built by `tools/build-vendors.js` from the game's own `GilShopItem`,
`GilShop`, `Item`, `ENpcBase`, `ENpcResident`, `Level`, `Map`, `PlaceName` and `TerritoryType` tables
(via the public [ffxiv-datamining](https://github.com/xivapi/ffxiv-datamining) CSVs), filtered to
items that are tradable, listed in a gil shop, and sellable on the market board. Map coordinates are the usual
`SizeFactor`/offset transform; 2,842 of the 4,943 items resolve to a coordinate and 4,568 to a
named NPC.

The network layer batches 100 item IDs per request, runs 5 requests concurrently, retries twice
with backoff on rate limits and server errors, and caches responses in `localStorage` for 12
minutes (world lists for 24 hours). **Refresh** always skips that cache and pulls fresh prices;
it never touches your saved lists, shopping list or settings.

Universalis rate-limits heavy scans, and its rate-limit responses don't carry CORS headers, so a
large refresh will log some `blocked by CORS policy` errors in the browser console. These are
absorbed by the retry layer and are harmless — if batches genuinely fail, the tab shows a
*Partial data* warning instead.

Data is only as good as what players have uploaded. Items nobody has scanned recently will show
stale or missing prices.

## Keeping it current

Currency shops, vendor stock, submersible routes, workshop projects and duty drops are baked into
the file, so a patch that adds new ones needs them pulled again. That happens on its own: a free GitHub Actions job checks
every Monday, and from 10 to 38 days after a patch it rebakes, checks the result and pushes it. If a
patch needs a human, it pushes nothing and opens an issue instead. By hand it is one command — see
[tools/README.md](tools/README.md):

```
node tools/rebake.js
```

It downloads the latest public game data and crowd-sourced loot rates, rebuilds the five
datasets and writes them into `src/data/` and `index.html`. It needs only Node.js, and nothing it touches needs a
key or an account.

The Dashboard and Precrafts recipe lists are not covered yet: the script that built them was not
kept, so they stay on patch 7.55 until it is rewritten.

## Architecture

The whole desk ships as one ~5.4MB `index.html`, so it opens straight from disk. That file is
**built**, not edited: the source lives in `src/`, and one command puts it back together.

```
node tools/build.js           # after editing anything in src/
node tools/build.js --check   # does index.html match src/?
```

| In `src/` | What it is |
| --- | --- |
| `index.html` | The shell: tab bar, iframes, search box |
| `tabs/*.html` | One complete page per tab (`list.html` is every saved list) |
| `shared/*.js`, `shared/ui.css` | The code and styles every tab shares |
| `tour/tour.js`, `tour/mock.html` | The guided tour: its steps, and the example page it walks through |
| `data/*.json` | The baked datasets inside the tabs, one record per line |
| `data/*-index.txt` | The item name, icon and recipe indexes |

Two markers join them: `/*@string path*/""` drops a file in as a string (a tab, shared code, an
index), and `/*@json path*/null` drops a dataset in. Commit `src/` and the rebuilt `index.html`
together. To have git refuse a commit where they disagree, run this once per clone:
`git config core.hooksPath .githooks`.

Inside the built file:

- A thin shell holds the tab bar and one `<iframe>` per tab.
- `BLOBS` maps each tab key to a complete, standalone HTML document.
- On first visit to a tab, its document is injected via `srcdoc`. Every tab scans on first open
  except the Dashboard, which waits for its **Load live prices** button.
- Five shared code chunks are spliced into each document at render time via placeholder
  comments: `SHARED_A` (fetch/retry/cache layer), `SHARED_B` (world topology, the data-centre
  picker and the multi-DC market helpers), `SHARED_SHOP` (the shopping list), `SHARED_LIST`
  (the saved lists) and `SHARED_XW` (the cross-world price panel and the search box).
- `SHARED_XW` is the one chunk the shell runs itself as well, so the search box and its panel
  work above the iframes. It has no hard dependencies: it borrows `SHARED_A`'s fetch and cache
  and `SHARED_B`'s world topology when the page has them, and falls back to its own when it
  doesn't — which is how the same code runs inside a tab and in the shell.
- `ITEM_INDEX` is the search box's offline name index — every item id the desk knows a name for,
  delta-encoded as `base36-id-delta name` to keep it compact.
- Every list tab is the same document: `LIST_TPL` is rendered once per list slot, and the tab
  bar builds its list tabs from `localStorage` at load.

Isolating each tab in an iframe means they can't collide on globals or CSS, at the cost of
duplicating some code — which is why the shared chunks exist.

## Caveats

- Profit figures assume you can buy materials at the listed price and sell at the modelled price.
  Both move, and you're competing with other crafters.
- The default *Precraft-optimised* mat cost assumes you will actually craft the intermediates it
  costs as crafted. If you buy them instead, switch **Mat cost** to *Buy all mats* — the optimised
  figure is the floor, not the price you'd pay walking up to the board.
- Prices from a data centre in another region are informational: you cannot travel there.
- Daily ceilings are rankings, not forecasts.
- Nothing accounts for crafting stats, materia, food, or whether you can actually hit HQ.
- The Currencies, Vendors, Submersibles, Workshop and Duties data are rebaked automatically after
  each patch, but only from 10 days after it, so a brand-new shop or vendor can be missing until then.
  The Dashboard and Precrafts recipe lists are still pinned to patch 7.55.
- Submersible and duty drop rates are crowd-sourced averages. They describe a lot of voyages and
  coffers, not your next one, and a rate on a thin sample (a few hundred coffers) can move a long way.
- The cross-world panel reads the 50 cheapest listings per scope. That is across the scope, not
  per world, which is what sets the number: a data centre is eight worlds, so 50 leaves roughly
  six listings each. On a heavily stocked item the units-available figure is therefore a floor,
  and the panel says so when it hits that wall.
- Universalis returns at most 200 sales per item, so on a heavily traded item the history
  reaches back only part of the month — which is also why the `Trend` column compares the
  window the data actually covers rather than a fixed seven days and says which window it
  used, and why `Units/day` divides by that window rather than by thirty. For the same reason
  `Avg 30d` on a busy item is really the average of its last 200 sales, not of a full month.
- On the **Vendors** tab, a row with a ⚠ has no real sales behind its price. Treat those profits
  as hypothetical, not as gil you can go and collect.
- Vendor locations come from the shop tables, which don't record seasonal availability perfectly
  — an unflagged item can still turn out to be event-only.

## Changelog

### 15 September 2026

- **Guided tour.** Picking your world on a first visit starts a walkthrough of the desk, and the
  new **Tour** button in the top right replays it (see [Shared features](#shared-features)).
- **How this works** on every tab: a folded panel under the headline cards explaining what the tab
  works out, how to read it, and what to watch for. Its **▶ Show me** button runs a short spotlight
  guide on that tab.
- Teamcraft buttons carry Teamcraft's TC logo instead of an arrow.
- In every crafting tree, the ▼/▲ badge comparing a material's price with its average now also
  sits beside the buy price, not only beside the material's name.

### 14 September 2026

**New tabs and data**
- **Submersibles**, **Workshop** and **Duties** tabs, baked from the game tables and crowd-sourced
  loot records, and rebaked for patch 7.56.
- A weekly GitHub Actions job rebakes those three tabs 10–38 days after a patch and pushes the
  result on its own (see [Keeping it current](#keeping-it-current)).
- The 150 items that had no icon (Bicolor Gemstone Vouchers, Tomestones of Frivolity, orchestrion
  rolls, a lot of furnishings) now have one.

**Across the desk**
- The desk is now called **Jikky's Gil Factory** in the tab bar.
- New tab order: Dashboard, Precrafts, Currencies, Scrips, Duties, Flips, Retainers, Submersibles,
  Workshop, Vendors, then your lists.
- Every tab uses the same columns in the same order (Item, Sell now, Avg 30d, Trend, Units/day,
  Gil/day), plus its own extras. **Flips** gains Gil/day, and **Vendors** gains Trend and Gil/day.
- Every craftable row, and every craftable material in a crafting tree, links to its recipe in the
  Teamcraft simulator.
- The filters panel folds down to a rail, and the whole desk remembers the choice.
- The tab bar stays on one row as the window narrows, and the list tabs carry on along it.
- Every tab has its own link (`…/ffxiv-gil-desk/#vendors`), and Back and Forward move between
  tabs.

**Dashboard and Refresh**
- Until it has prices, the Dashboard shows a big **Load live prices** button in place of an empty table.
- **Refresh** now really pulls fresh prices instead of re-reading the 12-minute cache, and shows
  an *Updating…* label and a progress bar while it works.
- **Shift-click Refresh** on the Dashboard now rescans the items *Skip dead items* leaves out, as
  its tooltip always said. Before, it only cleared the price cache.

**Currencies and Vendors kept current**
- **Currencies** and **Vendors** are now rebuilt from the game tables by `tools/build-currencies.js`
  and `tools/build-vendors.js`, and the weekly job rebakes them after each patch along with the
  other three. Both were stuck on patch 7.55.
- Currencies drops a few rows that were never really for sale: six MGP items from a developer
  shop called "Currency Test", and Potions listed at 999 scrips, which the game uses to pad empty
  shop slots.
- On Vendors, 446 items now name a different NPC. It is still one that stocks the item; the pick
  now follows a written rule (see [Vendors](#vendors)).
- 141 vendor and currency items that the search box couldn't find are now searchable.

**Fixes**
- The world you pick on a first visit now reaches every tab. It used to set only the Dashboard,
  so the other tabs still opened on Spriggan.
- **Retainers** remembers its world and filters between visits, like every other tab.
- **Retainers**' *Daily gil* column is now **Gil/day**, the same name as on every other tab.
- When prices fail to load, every tab gives the same message: Universalis may be down or
  rate-limiting, so wait a minute and press Refresh. The old wording talked about a sandbox and
  opening the file directly, which made no sense on the hosted desk.

**Currencies, Vendors and the shopping list**
- **Currencies** shows the currency cost inside the Item cell rather than in two extra columns,
  and fetches sales history only for the rows on screen, so big scans no longer fail.
- **Vendors** sorts by Gil/day by default. Its Server field is now *Sell on*, listed above the
  buy side as on the other tabs.
- The shopping list no longer reorders its worlds as you tick items off.

**Under the hood**
- `index.html` is now built from `src/` with `node tools/build.js` (see [Architecture](#architecture)).
