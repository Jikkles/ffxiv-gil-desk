# Gil Desk

A market-board scanner for Final Fantasy XIV.

The whole idea is to scan the market board and work out, quickly and efficiently, where the
most gil is actually available — mainly through crafting, but also through cross-world flips,
scrip loops and currency spending. Rather than eyeballing prices item by item, the desk pulls
live listings and 30-day sales history for thousands of items at once, prices out every
material, subtracts market tax, and ranks everything by what it would genuinely net.

It runs entirely in the browser from a single HTML file. No install, no build step, no
dependencies, no API keys, no accounts, no server.

---

## Quick start

Open [index.html](index.html) in a browser. That's it.

Each tab loads on first visit and then waits — hit **Refresh** on a tab to pull live prices.
Nothing is fetched until you ask for it, so opening the desk costs nothing.

## The core idea

Every tab answers a variation of one question: **if I do this thing, how much gil do I end up
with?**

The desk always works from the same profit model:

```
profit = (sell price × (1 − tax)) − acquisition cost
```

What varies per tab is what "acquisition cost" means — buying materials and crafting, buying
the finished item on a cheaper world, spending scrips, or spending a currency at a vendor.

Two deliberate choices run through the whole thing:

- **Sales history is the anchor, not listings.** A single inflated listing is not a market.
  The `Avg 30d` column is the quantity-weighted average of *actual sales* over the past month,
  and most tabs default to pricing against it rather than the current cheapest listing. Rows
  whose current listing sits far from that average get a ⚠ so you can spot noise.
- **Velocity matters as much as margin.** A 500k margin on an item that sells twice a month is
  worse than a 20k margin on something that moves 30 times a day. Tabs surface sales/day and a
  *daily profit ceiling* (profit per unit × sales per day) so you can rank by what actually
  turns over. That ceiling is a ranking device, not a promise — you capture a slice of the
  market, not all of it.

## Tabs

| Tab | What it works out |
| --- | --- |
| **Dashboard** | Profit scanner across 9,400+ personal-craft items |
| **Precrafts** | Every craftable intermediate, as a one-step buy-craft-sell flip |
| **Flips** | Cross-world flips on mounts, minions, hairstyles and outfit coffers |
| **Scrips** | The two collectible → scrip → materia loops, valued live |
| **Currencies** | Which marketable item each currency buys at the best gil rate |
| **Vendors** | *Work in progress* — NPC vendor arbitrage |
| **Lists** | Up to five lists you fill yourself, renameable, kept in your browser |

### Dashboard

The broad sweep: consumables, furniture, intermediate materials, gear, tools and dyes. Material
cost assumes buying every direct material off the board — craftable intermediates priced HQ,
raw materials NQ.

Click any item to open its full crafting tree. Each craftable node inside the tree shows the
**HQ buy price vs the cost to craft it yourself**, and a *Precraft-optimised* total showing what
you'd pay if you crafted the intermediates that are cheaper to make than to buy. That's the
difference between a recipe looking unprofitable and actually being profitable.

Turn on *Hide no-sales* and sort by profit to find what's worth bulk-crafting.

### Precrafts

Every craftable intermediate in the game (900+), scanned as a deliberately simple one-step flip:
buy the materials → craft it once → sell it HQ. No precrafting chains, no FC workshop bonuses,
just the single craft. Filter by crafter class and level range, and click any row for its
material shopping list.

*Deep 30d* swaps the quick recent-average for a true 30-day history pull — slower, but more
reliable on thin markets. Intermediates with thin HQ markets may show no sales; switching *Sell*
to NQ often reveals the real bulk market.

### Flips

No crafting involved — pure arbitrage. Scans mounts, minions, hairstyles, outfit coffers and
emotes (the tradeable `Ballroom Etiquette` manuals) across every world on the data centre, finds
the cheapest listing anywhere, and compares it to
the 30-day average sale price on your home world. The world name is colour-coded: orange means a
world hop is required, teal means it's already on your world.

Rare, slow-moving items are exactly where current listings lie most, so this tab leans hardest
on sales history.

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

### Currencies

Pick a currency and it works out which marketable item that currency buys at the best
gil-per-unit rate, then what that item sells for after tax.

Vendor costs are read from the game's `SpecialShop` and `GCScripShopItem` tables at **patch
7.55**, filtered to items actually sellable on the market board. Where the same item is sold by
multiple vendors for the same currency, the cheapest is used. Some shop rows belong to vendors
that no longer exist in-game, so the vendor name is shown on every row.

Alongside the tomestones, scrips and seals there's a **Variant & Deep Dungeons** group: the four
variant dungeon potsherds (Sil'dihn, Rokkon, Aloalo, Corvosi), all traded to Trisassant in Old
Sharlayan for glamour, emotes, hairstyles and orchestrion rolls, plus the two deep dungeon
potsherds (Gelmorran from Palace of the Dead, Empyrean from Heaven-on-High), which mostly buy
grade V and VI materia. These drop slowly and their rewards are thin on the market board, so set
**min sales/day** to `Any` to see the whole shop.

### Vendors — work in progress

A stub. The intent is items worth buying from NPC vendors and reselling on the market board, and
market items cheaper to buy from a vendor than to craft. Nothing is wired up yet.

### Lists

Up to five lists you fill yourself. The 📋 button on any row of the **Dashboard** or
**Precrafts** tab — on the item, and on any material inside its crafting tree — opens a picker
with your lists on it; choose one and the item lands there. Clicking the same list again takes
it back off.

Each list is a full tab: sell now, 30-day average, material cost, profit, margin, sales/day and
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

**Shopping list.** The 🛒 button on any row adds that item's materials to a list shared across
every tab. It groups by world (flagging which need a hop), tracks a running gil total, and tags
each line with which finished item it's for. Prices are captured at the time of adding, and each
line is badged against the recent average so you can see whether you're buying into a dip or
overpaying. Crystals, shards and clusters are excluded — assumed stocked.

**Settings.** Home world (default **Spriggan**), data centre (default **Chaos**, switchable to
Light or both), and market tax (default **5%**) are set per tab and persisted. Each tab remembers
its own filters and sort between sessions.

**Freshness.** Every row shows how stale its data is, from `<1h` through to a day-level warning,
so you know whether you're acting on a live market or yesterday's.

## Data

All market data comes from the [Universalis](https://universalis.app) API — free, keyless and
CORS-open. Item and recipe metadata is baked into the file.

The network layer batches 100 item IDs per request, runs 5 requests concurrently, retries twice
with backoff on rate limits and server errors, and caches responses in `localStorage` for 12
minutes (world lists for 24 hours). Shift-clicking **Refresh** forces a fresh pull; it clears
only cached prices, never your saved lists, shopping list or settings.

Universalis rate-limits heavy scans, and its rate-limit responses don't carry CORS headers, so a
large refresh will log some `blocked by CORS policy` errors in the browser console. These are
absorbed by the retry layer and are harmless — if batches genuinely fail, the tab shows a
*Partial data* warning instead.

Data is only as good as what players have uploaded. Items nobody has scanned recently will show
stale or missing prices.

## Architecture

The whole desk is one ~4MB `index.html` with no build step.

- A thin shell holds the tab bar and one `<iframe>` per tab.
- `BLOBS` maps each tab key to a complete, standalone HTML document.
- On first visit to a tab, its document is injected via `srcdoc`. Tabs never auto-load data.
- Four shared code chunks are spliced into each document at render time via placeholder
  comments: `SHARED_A` (fetch/retry/cache layer), `SHARED_B` (multi-DC market helpers),
  `SHARED_SHOP` (the shopping list) and `SHARED_LIST` (the saved lists).
- Every list tab is the same document: `LIST_TPL` is rendered once per list slot, and the tab
  bar builds its list tabs from `localStorage` at load.

Isolating each tab in an iframe means they can't collide on globals or CSS, at the cost of
duplicating some code — which is why the shared chunks exist.

## Caveats

- Profit figures assume you can buy materials at the listed price and sell at the modelled price.
  Both move, and you're competing with other crafters.
- Daily ceilings are rankings, not forecasts.
- Nothing accounts for crafting stats, materia, food, or whether you can actually hit HQ.
- Vendor costs are pinned to patch 7.55 and will drift as the game updates.
