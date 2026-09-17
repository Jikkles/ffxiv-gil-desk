# Changelog

What changed on [Jikky's Gil Factory](README.md), newest first.

## 17 September 2026

**New Undercuts tab**
- A new tab after Vendors, set apart on the bar, that checks your own retainers' listings. Add their
  names, press **Check for Undercuts**, and it reads every listing on your **Sell on** world and
  shows which of yours someone has undercut, by how much, and how many listings sit below you.
  See [Undercuts](README.md#undercuts).
- Undercuts says, under its header and above its results, that it can only show listings Universalis
  has been sent: one you put up since an item was last uploaded appears once someone opens that item
  on the market board with an uploader running.
- Undercuts no longer shows the shopping list, since nothing there is bought.
- The 📋 button on Undercuts and on **Retainers** adds the item to a list. On Retainers it had only
  ever said "Couldn't read that item".
- The search box now knows every marketable item, about 1,850 more than before, mostly older gear,
  and all of them have icons.
- The tab bar tightens a little further before it drops its icons, so it still fits on one row
  with the extra tab (with icons at 1920 pixels wide, as before).

## 16 September 2026

**Shopping list**
- Every line has a 🌐 button beside its tick box that opens the world-price panel for that item, as
  it does on the tables.
- The amount sits at the left of each line between − and +, and you can type an exact number into it
  (Enter to keep it, Esc to leave it as it was). Shift-click − or + to move by 10. − stops at 1;
  ✕ removes a line.

**A lighter desk**
- The desk file is down from 6.9 MB to 4 MB, so it downloads and opens faster. The Dashboard's
  recipe list is stored packed and unpacked as the tab opens; nothing you see has changed.
- Every change, and every weekly rebake, is now checked in a real browser before it goes live, so a
  tab that stops drawing its table is caught before anyone opens it.

## 15 September 2026

**Gathering, treasure maps, wider flips, and Precrafts folded into the Dashboard**
- **New Gathering tab**, second on the bar: every marketable Miner and Botanist item ranked by gil an
  hour, from an hourly estimate you set to match your gear, with live spawn timers on timed nodes.
- **Precrafts is now part of the Dashboard.** The Dashboard already priced all but 154 of its
  items, and those 154 cannot be sold on the market board. It gains *Class*, *Min lvl* / *Max lvl*,
  *Precrafts only* and an HQ/NQ *Sell* switch, plus the best-time-to-sell chart in each recipe and
  the patch *new* badge. It still waits for Refresh.
- **Duties is now Duties + Maps**, with treasure map coffers and the ten portal dungeons as two new
  content groups, and a *Maps & portals* view that prices a whole map or portal chest.
- **Flips** adds orchestrion rolls, facewear and fashion accessories that average 50k or more, and
  General-purpose Pure White and Jet Black dye, with lower *Min profit* and *Min avg price* options.
- The tour, How this works panels and Show me guides cover all of it.

**NPC shops and a full browser store**
- **Materials an NPC sells are bought from the NPC when that is cheaper.** Every craft cost used only
  the market board, but 526 crafting materials are sold by an NPC for gil all year, and on a typical data
  centre the board wants more than the NPC for over a hundred of them. That touched more than a
  thousand recipes, and a recipe needing one with no listing could not be priced at all. The
  Dashboard, Precrafts, Scrips, Workshop and lists now buy each material at the cheaper of the board
  and the NPC. The tree says **NPC** and the zone (hover for the vendor, their map position and the
  board's price), and the shopping list puts those lines under their own **NPC shops** group. The two
  prices lists and Scrips had typed in by hand, and their Vendor column, are gone.
- **A Dashboard scan no longer fills the browser's storage.** It cached several million characters
  of prices, more than the store every tab shares can hold, so the shopping list could fail to save
  while the page said "Added". The Dashboard no longer caches its scan (Refresh always fetched fresh
  anyway), a full store now drops cached prices to make room for your lists and shopping list, and a
  save that still fails says so. Clearing the cache had also been leaving some entries behind.

**Second pass: costs, flips and rebakes**
- **Crystals are costed everywhere.** Precrafts and Scrips had left shards and crystals out of the
  material cost, so cheap intermediates looked more profitable than they are. A new **Show crystals**
  toggle lists them in the recipe trees on the Dashboard, Precrafts, Scrips, Workshop and lists. List
  rows saved from Precrafts or Scrips before this get their crystals back when the desk loads.
- **Avg 30d is a 30-day median on every tab.** Vendors, Currencies, Precrafts, Retainers and the
  Submersibles loot view had been reading Universalis' short rolling mean under that name, which the
  median fix above did not reach. Precrafts no longer needs *Deep 30d*, which is gone: it always reads
  a month of sales, and so does Currencies. Units/day on those tabs is a 30-day figure too.
- **Flips** prices a sale at your world's cheapest listing when that is below the 30-day average (you
  would have to undercut it), marks a row with no sales in 30 days ⚠, and keeps those off the card.
- **Skip dead items** checks each skipped item again a week after it was last found dead, and keeps a
  list per world. The old list reset its timer on every scan, so anything skipped was never checked
  again by anyone who scanned weekly, and a list built on one world applied to all of them.
- **Scrips, Flips and Retainers are rebaked after each patch** like the rest. Scrips now covers all 224
  Rarefied collectables from level 50 up, not only the level 92–100 ones, and values a purple scrip at
  the best of every materia it buys. Flips scans all 395 tradeable mounts, minions, hairstyles, emotes
  and outfit coffers; the old hand list had 21 crafting materials and furnishings filed as mounts and
  minions (Ifrit's Horn, Tiny Crown). Retainers shows how often each drop comes back.
- Before its first scan, changing *Sell on* or *Mats from* on the Dashboard no longer starts one.
- Vendors and Currencies drop a price pull that finishes after you have switched world, rather than
  writing the old world's numbers over the new one's.
- The cross-world panel's **I want** box takes a typed number again. It redrew itself on every
  keystroke and put the caret back at the start, so typing 50 gave 5.

**Prices you can trust**
- **Hide ⚠ outliers** now starts ticked on the Dashboard, Precrafts and Workshop. Unticked, the
  Dashboard was topped by listings at 999,999,999 gil. Anyone who had the desk open before gets the
  new default once; untick it again and it stays unticked.
- The headline cards never count a ⚠ row, whether or not those rows are hidden, and they read every
  row that passes the filters rather than only the 300 drawn. *Profitable / shown* read "300 / 7581"
  when the first number was capped at 300. A saved list's cards skip ⚠ rows too.
- **Avg 30d** and **Trend** use the median sale price, weighted by units, instead of the mean. One
  "sale" at a joke price had pushed an item's 30-day average to 181M on three sales.
- **Best time to sell** follows UK clocks through the year. It had been an hour out all winter, and
  its bars now say units sold, which is what they count.

**Scans**
- A Dashboard scan no longer loses batches to Universalis' connection limit. It had opened about
  fifteen requests at once, and three batches failed on a clean first scan. The whole desk now keeps
  at most eight open, including a tab still scanning in the background, and a refused request is
  tried four times rather than three before its batch counts as failed.

**Layout**
- At 1600px wide every column fits again: long item names wrap onto a second line, and so do
  headers like *Sell avg 30d*, rather than Units/day and Gil/day being cut off. Vendors' cells are a
  touch narrower to fit its ten columns, and its freshness tag can drop under the price.
- Currencies no longer scrolls sideways, and the right-most currency icons' labels open leftwards.
- On a narrower screen the headline cards no longer squeeze a tab's intro down to one word a line
  once prices load (Vendors at 1366px was the worst); their captions cut off with an ellipsis instead.
- A few colours that browsers ignored now show: the orange partial-data warning, the glow on the
  selected currency, and two hover backgrounds.

**Recipes kept current**
- The Dashboard and Precrafts recipe lists are rebuilt by `tools/build-crafts.js` and rebaked with the
  rest after each patch; they had been pinned to 7.55. This first rebuild adds eight crafts to the
  Dashboard (the Crumbling Aqueduct set, Garden Canal, and the three 7.55 intermediates) and six
  Precrafts reagents, picks up four items the game renamed, and lists every job that can make a
  precraft, so *Class* finds Bronze Ingot under Armorer as well as Blacksmith.

**Tour, guides and trees**
- **Guided tour.** Picking your world on a first visit starts a walkthrough of the desk, and the
  new **Tour** button in the top right replays it (see [Shared features](README.md#shared-features)).
- **How this works** on every tab: a folded panel under the headline cards explaining what the tab
  works out, how to read it, and what to watch for. Its **▶ Show me** button runs a short spotlight
  guide on that tab.
- Teamcraft buttons carry Teamcraft's TC logo instead of an arrow.
- In every crafting tree, the ▼/▲ badge comparing a material's price with its average now also
  sits beside the buy price, not only beside the material's name.

## 14 September 2026

**New tabs and data**
- **Submersibles**, **Workshop** and **Duties** tabs, baked from the game tables and crowd-sourced
  loot records, and rebaked for patch 7.56.
- A weekly GitHub Actions job rebakes those three tabs 10–38 days after a patch and pushes the
  result on its own (see [Keeping it current](README.md#keeping-it-current)).
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
  now follows a written rule (see [Vendors](README.md#vendors)).
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
- `index.html` is now built from `src/` with `node tools/build.js` (see [Architecture](README.md#architecture)).
