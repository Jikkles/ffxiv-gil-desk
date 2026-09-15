/* ===== v12 data layer: retry, concurrency, cache ===== */
const NET={CONCURRENCY:5,BATCH_SIZE:100,TIMEOUT_MS:20000,RETRIES:3,BACKOFF_MS:1500,MAX_OPEN:8,CACHE_TTL_MS:12*60*1000,WORLDS_TTL_MS:24*60*60*1000};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
/* Every request on the desk waits its turn here. Each scan phase runs its own
   five workers, and the Dashboard runs three phases at once, so it was opening
   fifteen connections to Universalis - more than it lets one address hold. The
   extra ones came back refused (without CORS headers, so the browser reports
   them as blocked), their retries landed while the rest were still open, and
   whole batches were lost. The slots live on the shell's window, so a tab still
   scanning in the background and the tab you just opened share one limit
   rather than having one each. A slot is a small object and a waiting request
   polls for a free one, rather than one frame calling back into another; a
   slot older than any request can live (a tab closed mid-scan never gives its
   slots back) is treated as free. */
const Gate=(function(){
  let g=null;
  try{g=window.top.__gildeskGate||(window.top.__gildeskGate={slots:[]});}catch(e){}
  return g||{slots:[]};})();
function gateTake(ms){
  const now=Date.now(),stale=(ms||NET.TIMEOUT_MS)+5000;
  for(let i=Gate.slots.length-1;i>=0;i--)if(now-Gate.slots[i].t>Gate.slots[i].life)Gate.slots.splice(i,1);
  if(Gate.slots.length>=NET.MAX_OPEN)return null;
  const slot={t:now,life:stale};Gate.slots.push(slot);return slot;}
function gateGive(slot){const i=Gate.slots.indexOf(slot);if(i>=0)Gate.slots.splice(i,1);}
async function tfetch(url,ms){let lastErr;
  for(let attempt=0;attempt<=NET.RETRIES;attempt++){
    /* the timeout starts once the request is actually sent, not while it queues */
    let slot;while(!(slot=gateTake(ms)))await sleep(40);
    const c=new AbortController();const t=setTimeout(()=>c.abort(),ms||NET.TIMEOUT_MS);
    try{const res=await fetch(url,{headers:{Accept:"application/json"},signal:c.signal});
      if(res.status===429||res.status>=500)throw new Error("HTTP "+res.status);
      /* the body still has to arrive, so the slot is held until it has */
      const body=await res.arrayBuffer();
      /* a response that may carry no body (204, 304) cannot be rebuilt with one */
      const empty=[101,204,205,304].indexOf(res.status)>=0;
      return new Response(empty?null:body,{status:res.status,statusText:res.statusText,headers:res.headers});
    }catch(e){lastErr=e;}
    finally{clearTimeout(t);gateGive(slot);}
    if(attempt<NET.RETRIES)await sleep(NET.BACKOFF_MS*(attempt+1));}
  throw lastErr;}
/* v26: a history summary now carries units as well as sale counts, so anything
   written under the old version is a shape nothing here reads. The version
   bumps and the stale entries are swept rather than read back as no sales. */
/* v3: the 30-day prices in a summary became medians rather than means, so
   summaries cached as means are swept rather than mixed in with them. */
const CACHE_VER="v3";
const Cache={
  /* Set while a Refresh is in flight, so the button fetches instead of
     re-reading what is already on screen. See forceNextScan below. */
  skip:false,
  key(k){return `gildesk:${CACHE_VER}:${k}`;},
  get(k,ttl){if(Cache.skip){try{localStorage.removeItem(this.key(k));}catch(e){}return null;}
    try{const raw=localStorage.getItem(this.key(k));if(!raw)return null;
    const{t,d}=JSON.parse(raw);if(Date.now()-t>ttl){localStorage.removeItem(this.key(k));return null;}return d;}catch(e){return null;}},
  set(k,d){try{localStorage.setItem(this.key(k),JSON.stringify({t:Date.now(),d}));}
    catch(e){this.evict();try{localStorage.setItem(this.key(k),JSON.stringify({t:Date.now(),d}));}catch(e2){}}},
  evict(){const now=Date.now();
    for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(!k||!k.startsWith(`gildesk:${CACHE_VER}:`))continue;
      try{const{t}=JSON.parse(localStorage.getItem(k));if(now-t>NET.CACHE_TTL_MS)localStorage.removeItem(k);}catch(e){localStorage.removeItem(k);}}},
  clear(){for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);
    if(k&&k.startsWith(`gildesk:${CACHE_VER}:`))localStorage.removeItem(k);}},
  /* Whatever an earlier CACHE_VER left behind, dropped without parsing it. The
     pattern matches the price-cache namespace only, so saved lists
     (gildesk:lists:...) and the shopping list are never in range. */
  sweepOld(){try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);
    if(k&&/^gildesk:v\d+:/.test(k)&&!k.startsWith(`gildesk:${CACHE_VER}:`))localStorage.removeItem(k);}}catch(e){}}};
Cache.sweepOld();
/* Refresh means refresh. Prices are cached for twelve minutes, so a click
   inside that window handed back exactly what was already on screen - and
   the status line told you to shift-click for a fresh pull, which nothing
   in the desk ever implemented. The click is caught on the way down, before
   the tab’s own handler runs, and the cache is told to miss until that scan
   is done. Every tab’s load() disables the button while it works, so that is
   what marks the end; the timeout is only there for a tab that never does. */
function forceNextScan(btn){
  if(Cache.skip)return;
  Cache.skip=true;
  let mo=null;
  const stop=()=>{Cache.skip=false;clearTimeout(t);if(mo)mo.disconnect();};
  const t=setTimeout(stop,120000);
  try{
    mo=new MutationObserver(()=>{if(!btn.disabled)stop();});
    mo.observe(btn,{attributes:true,attributeFilter:["disabled"]});
  }catch(e){}
}
addEventListener("click",e=>{
  const b=e.target&&e.target.closest&&e.target.closest("#refresh");
  if(b&&!b.disabled)forceNextScan(b);
},true);
/* A scan used to look like nothing had happened: the button greyed out and
   that was all. The same disabled flag drives this, so every tab gets it
   without wiring of its own - the label reads "Updating…" and a thin bar runs
   along the top of the tab, which stays in view with the filters folded away.
   The bar fills from runBatches, summed over every batch run in the scan, and
   never steps backwards when a later phase adds more batches; it just holds
   short of the end until the button comes back. A cache hit that is over
   inside the grace period shows neither, so it does not flicker. */
const Busy={
  GRACE_MS:150,runs:[],shown:0,btn:null,bar:null,label:"",timer:0,on:false,
  track(total){const run={done:0,total};Busy.runs.push(run);Busy.paint();return run;},
  paint(){
    if(!Busy.on)return;
    let d=0,t=0;for(const r of Busy.runs){d+=r.done;t+=r.total;}
    const pct=d?Math.min(96,Math.floor(d/t*100)):null;
    if(pct!=null)Busy.shown=Math.max(Busy.shown,pct);
    Busy.bar.classList.toggle("indet",pct==null);
    Busy.bar.firstChild.style.width=pct==null?"":Busy.shown+"%";
    Busy.btn.innerHTML=`<span class="rspin" aria-hidden="true"></span>Updating…${pct==null?"":" "+Busy.shown+"%"}`;
  },
  start(){
    Busy.on=true;Busy.shown=0;
    Busy.runs=Busy.runs.filter(r=>r.done<r.total);
    Busy.label=Busy.btn.innerHTML;
    Busy.btn.classList.add("busy");Busy.btn.setAttribute("aria-busy","true");
    Busy.bar.hidden=false;Busy.paint();
  },
  stop(){
    clearTimeout(Busy.timer);Busy.timer=0;Busy.runs=[];
    if(!Busy.on)return;
    Busy.on=false;
    Busy.btn.innerHTML=Busy.label;
    Busy.btn.classList.remove("busy");Busy.btn.removeAttribute("aria-busy");
    Busy.bar.hidden=true;
  },
  watch(){
    const btn=document.getElementById("refresh");
    if(!btn||Busy.btn)return;
    Busy.btn=btn;
    Busy.bar=document.createElement("div");
    Busy.bar.className="scanbar";Busy.bar.hidden=true;Busy.bar.setAttribute("aria-hidden","true");
    Busy.bar.appendChild(document.createElement("i"));
    document.body.appendChild(Busy.bar);
    const sync=()=>{
      if(btn.disabled){if(!Busy.on&&!Busy.timer)Busy.timer=setTimeout(()=>{Busy.timer=0;if(btn.disabled)Busy.start();},Busy.GRACE_MS);}
      else Busy.stop();
    };
    try{new MutationObserver(sync).observe(btn,{attributes:true,attributeFilter:["disabled"]});}catch(e){}
    sync();
  }
};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",Busy.watch);else Busy.watch();
function hashIds(ids){let h=0;for(const id of ids)h=(h*31+id)>>>0;return ids.length+"-"+h.toString(36);}
async function runBatches(ids,fn,onProgress){
  const batches=[];for(let i=0;i<ids.length;i+=NET.BATCH_SIZE)batches.push(ids.slice(i,i+NET.BATCH_SIZE));
  const out={},failed=[],run=Busy.track(batches.length);let done=0,next=0;
  async function worker(){while(next<batches.length){const idx=next++;const batch=batches[idx];
    try{Object.assign(out,await fn(batch));}catch(e){failed.push({ids:batch,error:e.message||String(e)});}
    done++;run.done=done;Busy.paint();if(onProgress)onProgress(done,batches.length);}}
  await Promise.all(Array.from({length:Math.min(NET.CONCURRENCY,batches.length)},worker));
  return{out,failed};}
/* compress aggregated results to only the fields the desk reads (keeps cache small) */
function packQ(q){if(!q)return null;const o={};
  const mw=q.minListing&&q.minListing.world,md=q.minListing&&q.minListing.dc;
  if(mw&&mw.price!=null)o.mw=[mw.price,mw.worldId!=null?mw.worldId:null];
  if(md&&md.price!=null)o.md=[md.price,md.worldId!=null?md.worldId:null];
  const aw=q.averageSalePrice&&q.averageSalePrice.world,ad=q.averageSalePrice&&q.averageSalePrice.dc;
  if(aw&&aw.price!=null)o.aw=aw.price;if(ad&&ad.price!=null)o.ad=ad.price;
  const num=v=>v==null?null:(typeof v==="number"?v:(v.quantity!=null?v.quantity:null));
  const vw=num(q.dailySaleVelocity&&q.dailySaleVelocity.world),vd=num(q.dailySaleVelocity&&q.dailySaleVelocity.dc);
  if(vw!=null)o.vw=vw;if(vd!=null)o.vd=vd;
  return o;}
function compressAgg(r){let u=0;if(r.worldUploadTimes)for(const w of r.worldUploadTimes)u=Math.max(u,w.timestamp||0);
  return{h:packQ(r.hq),n:packQ(r.nq),u:u};}
/* One pull of sales history. The window has to be asked for: left to itself the
   API hands back only the last week of entries, which the desk was then dividing
   by thirty - every velocity on the board came out roughly a quarter of what it
   should have been. 200 entries is as many as a batched pull returns per item,
   so a busy item still arrives truncated; summarizeHist records how far the
   entries it did get reach back, and the rate is divided by that instead. */
const HIST_ENTRIES=200,HIST_DAYS=30,HIST_SECS=HIST_DAYS*86400;
/* The typical price of a set of sales: the median, weighted by units, so the
   price half of the units sold at or under. It used to be the mean, and a mean
   has no defence against a single sale at a joke price - one 180M "sale" of a
   pair of cotton slops, two ordinary ones beside it, and the 30-day average read
   181M and the row topped the board. A median shrugs that off, and still counts
   a stack of 99 as 99 units of evidence rather than one. xs is [price,units]. */
function medianPrice(xs){
  if(!xs.length)return null;
  xs.sort((a,b)=>a[0]-b[0]);
  let total=0;for(const x of xs)total+=x[1];
  let run=0;for(const x of xs){run+=x[1];if(run*2>=total)return x[0];}
  return xs[xs.length-1][0];}
/* The UK hour a sale landed in, for the best-time-to-sell chart: GMT through the
   winter, BST (an hour on) from 01:00 UTC on the last Sunday in March until
   01:00 UTC on the last Sunday in October. Worked out by rule rather than through
   Intl, because this runs once for every sale of every item in a scan. */
const _bst={};
function bstOf(y){
  if(!_bst[y]){const lastSun=m=>{const end=new Date(Date.UTC(y,m+1,0));return Date.UTC(y,m,end.getUTCDate()-end.getUTCDay(),1)/1000;};
    _bst[y]=[lastSun(2),lastSun(9)];}
  return _bst[y];}
function ukHour(ts){const d=new Date(ts*1000),b=bstOf(d.getUTCFullYear());return(d.getUTCHours()+(ts>=b[0]&&ts<b[1]?1:0))%24;}
/* summarize history to 30-day aggregates: h/n = unit-weighted median by quality, a = any quality, p = plain median per sale */
function summarizeHist(it){const out={h:[null,0],n:[null,0],a:[null,0],p:[null,0],bh:{},bn:{},ch:0,cn:0,qh:0,qn:0,qa:0,days:HIST_DAYS,cap:false,
    r:{h:[null,0],n:[null,0],a:[null,0],p:[null,0]},o:{h:[null,0],n:[null,0],a:[null,0],p:[null,0]},win:0};
  if(!it||!it.entries||!it.entries.length)return out;
  const now=Date.now()/1000,cut=now-HIST_SECS;
  /* Universalis caps a history pull at 200 entries, so on a busy item those 200
     sales reach back only part of the month - a fixed 7-day split would put
     every one of them on the recent side and never report anything. So split
     whatever window the entries actually cover down the middle instead: r is the
     newer half, o the older half, and win records the span so a row can say what
     it compared. On a thin item that window is most of the month; on a busy one
     it is a couple of days, which is the honest limit of what was returned. */
  let oldest=now;
  for(const e of it.entries){let ts=e.timestamp;if(ts>1e12)ts/=1000;
    if(ts<cut)continue;if(ts<oldest)oldest=ts;}
  out.win=now-oldest;
  /* A truncated pull only speaks for the span it covers, so that span is what a
     rate is divided by. An untruncated one was asked for the whole month and its
     quiet days are real, so thirty is. */
  out.cap=it.entries.length>=HIST_ENTRIES;
  out.days=out.cap?Math.max(out.win/86400,0.5):HIST_DAYS;
  const split=now-out.win/2;
  /* each bucket keeps its sales as [price,units] for the median: HQ, NQ, and
     one price per sale, for the whole window and for its newer and older halves */
  const bucket=()=>({h:[],n:[],p:[],qh:0,qn:0});
  const all=bucket(),w={r:bucket(),o:bucket()};
  for(const e of it.entries){let ts=e.timestamp;if(ts>1e12)ts/=1000;if(ts<cut)continue;
    const qq=e.quantity||1,pp=e.pricePerUnit;
    const half=ts>=split?w.r:w.o,hr=ukHour(ts);
    for(const b of[all,half]){
      if(pp>0)b.p.push([pp,1]);
      if(e.hq){b.h.push([pp,qq]);b.qh+=qq;}else{b.n.push([pp,qq]);b.qn+=qq;}}
    if(e.hq){out.bh[hr]=(out.bh[hr]||0)+qq;out.ch++;}
    else{out.bn[hr]=(out.bn[hr]||0)+qq;out.cn++;}}
  const fill=(t,b)=>{
    if(b.h.length)t.h=[Math.round(medianPrice(b.h.slice())),b.h.length];
    if(b.n.length)t.n=[Math.round(medianPrice(b.n.slice())),b.n.length];
    const any=b.h.concat(b.n);if(any.length)t.a=[Math.round(medianPrice(any)),any.length];
    if(b.p.length)t.p=[medianPrice(b.p),b.p.length];};
  out.qh=all.qh;out.qn=all.qn;out.qa=all.qh+all.qn;
  fill(out,all);fill(out.r,w.r);fill(out.o,w.o);
  return out;}
/* Trend: the newer half of the covered window against the older half. Both
   halves have to be measured the same way or the comparison invents movement
   that never happened - an HQ average one side against an NQ or mixed average
   the other side is not a price change, it is a change in what was selling - so
   the basis is fixed to the quality the row is priced on and the trend is simply
   withheld when both halves do not carry it. There is deliberately no drop to
   any-quality: a direction you cannot measure on the basis you are trading on is
   one worth staying quiet about. Wants two days of cover and three sales either
   side as well, because a couple of sales of a thin item is noise. Summaries
   cached before this existed have no r/o and return null until the cache rolls. */
const TREND_MIN_SALES=3;
function trend30(s,wantHQ){
  if(!s||!s.r||!s.o||!(s.win>=172800))return null;
  const key=wantHQ===undefined?"p":(wantHQ?"h":"n");
  const a=s.r[key],b=s.o[key];
  const ok=v=>!!v&&v[0]!=null&&v[0]>0&&v[1]>=TREND_MIN_SALES;
  if(!ok(a)||!ok(b))return null;
  return{pct:(a[0]-b[0])/b[0]*100,recent:a[0],prior:b[0],n:a[1],win:s.win};}
let _trCss=false;
function trendCss(){if(_trCss)return;_trCss=true;
  const s=document.createElement("style");s.id="trendcss";
  s.textContent=".tr{font-family:'JetBrains Mono',monospace;font-size:13px;white-space:nowrap}"+
    ".tr.up{color:var(--win,var(--win))}.tr.dn{color:var(--loss,var(--loss))}.tr.dip{color:var(--win,var(--win))}.tr.flat{color:var(--faint,var(--faint))}";
  (document.head||document.documentElement).appendChild(s);}
/* half the covered window, as the span each side of the comparison */
function trendWin(w){const h=w/2/3600;return h<48?Math.round(h)+"h":Math.round(h/24)+"d";}
/* `why` replaces the empty chip's tooltip when the reason is not thin history,
   such as a tab that has not read the history at all */
function trendChip(t,why){trendCss();
  const g=v=>Math.round(v).toLocaleString("en-GB");
  if(!t)return'<span class="tr flat" title="'+(why||"Not enough sales history either side of the midpoint to compare")+'">·</span>';
  /* A fall of 30% or more is a genuine dip rather than a slide, and reads
   green like the craft-tree price badges do at the same depth. */
  const p=t.pct,cls=Math.abs(p)<5?"flat":(p>0?"up":(p<=-30?"dip":"dn")),k=trendWin(t.win);
  const arrow=cls==="flat"?'→':(p>0?'▲':'▼');
  const txt=(p>0?"+":"")+(Math.abs(p)>=10?Math.round(p):p.toFixed(1))+"%";
  return`<span class="tr ${cls}" title="Last ${k} sold at a median of ${g(t.recent)} gil against ${g(t.prior)} over the ${k} before, on ${t.n} recent sale(s)">${arrow} ${txt}</span>`;}
/* Sales a day and units a day are not the same number, and on anything that
   moves in stacks they are two orders of magnitude apart: 99 caramel popcorn
   leaving in one transaction is a single sale and ninety-nine units. Counting
   sales had that item reading as four a day while the board was absorbing four
   hundred, and every daily ceiling built on it was wrong by whatever the stack
   size happened to be. A ceiling multiplies profit per unit, so units are what
   it has to multiply. The sale count comes back as well - how many separate
   buyers turned up is a different and still useful thing to know, and it is
   what the stack size is read from. */
function vel30(s,wantHQ){
  const none={units:0,sales:0,perDay:0,salesPerDay:0,stack:0,days:HIST_DAYS,cap:false,fb:false,agg:false};
  if(!s||s.qa==null)return none;
  const days=s.days>0?s.days:HIST_DAYS,both=wantHQ==null;
  let units=both?s.qa:(wantHQ?s.qh:s.qn),sales=both?(s.ch||0)+(s.cn||0):(wantHQ?s.ch:s.cn),fb=false;
  /* nothing sold at the quality asked for: count the whole market instead, the
     same fallback the 30-day average makes, rather than calling the item dead */
  if(!(units>0)){units=s.qa||0;sales=(s.ch||0)+(s.cn||0);fb=!both;}
  if(!(units>0))return none;
  return{units,sales,perDay:units/days,salesPerDay:sales/days,stack:sales?units/sales:0,days,cap:!!s.cap,fb,agg:false};}
/* The aggregate endpoint reports units a day itself, over its own rolling
   few-day window, with no sale count to read a stack size from. */
function velAgg(perDay){return{units:0,sales:0,perDay:perDay||0,salesPerDay:0,stack:0,days:0,cap:false,fb:false,agg:true};}
const velNum=v=>(v==null||!isFinite(v))?"0":(v>=100?Math.round(v).toLocaleString("en-GB"):(v>=10?v.toFixed(1):v.toFixed(2)));
function velTitle(v){
  if(v.agg)return"Units sold a day, from Universalis' own rolling average of the last few days.";
  const g=n=>Math.round(n).toLocaleString("en-GB");
  const win=v.days>=HIST_DAYS?"30 days":(v.days<2?Math.round(v.days*24)+" hours":Math.round(v.days)+" days");
  let t=g(v.units)+" units across "+g(v.sales)+" sale"+(Math.round(v.sales)===1?"":"s")+" in "+win;
  if(v.stack>=1.5)t+=", about "+g(v.stack)+" a sale";
  t+=" — "+velNum(v.salesPerDay)+" sales a day.";
  if(v.cap)t+=" A history pull stops at "+HIST_ENTRIES+" sales, so the rate is measured over the window those cover.";
  if(v.fb)t+=" Nothing sold at the quality asked for, so this counts both.";
  return t;}
/* Units a day, with the stack they move in, because the two together are the
   whole story and either one alone misleads. */
function velCell(v){
  if(!v||!(v.perDay>0))return"0";
  const stack=(!v.agg&&v.stack>=1.5)?' <span class="q">×'+Math.round(v.stack)+'</span>':"";
  return'<span title="'+velTitle(v).replace(/"/g,"&quot;")+'">'+velNum(v.perDay)+'</span>'+stack;}
/* One general vocabulary for the little category tag, shared by every tab. The
   game's own ItemUICategory is far too fine-grained to read at a glance - Stone,
   Cloth, Wall-mounted and Rug are all real categories - so each one folds into
   the word a player would actually use. The specific category is still kept as
   the row subtitle, so the detail is there when you want it. Anything already
   general passes straight through, and anything unrecognised lands in Misc
   rather than being guessed at. */
const CAT_GENERAL=["Gear","Tool","Furniture","Materials","Food","Medicine","Dye","Music","Minion","Misc"];
const CAT_HOUSE=new Set(["Furnishing","Tabletop","Table","Wall-mounted","Rug","Flooring","Interior Wall","Exterior Wall",
  "Ceiling Light","Outdoor Furnishing","Exterior Wall Decoration","Roof","Roof Decoration","Fence","Placard","Painting",
  "Gardening","Construction Permit","Door","Window","Chair","Bed","Chandelier"]);
const CAT_MATS=new Set(["Metal","Stone","Cloth","Leather","Lumber","Bone","Part","Catalyst","Reagent","Crystal"]);
const CAT_FOOD=new Set(["Meal","Ingredient","Seafood"]);
const CAT_WORN=new Set(["Head","Body","Legs","Feet","Hands","Waist","Shield","Necklace","Earrings","Bracelets","Ring"]);
function catLabel(c){
  if(!c)return"Misc";
  const s=String(c);
  const already=CAT_GENERAL.find(g=>g.toLowerCase()===s.toLowerCase());
  if(already)return already;
  if(/(Arms?|Grimoire)$/.test(s)&&!/Barding/.test(s))return"Gear";
  if(CAT_WORN.has(s))return"Gear";
  if(/(Primary Tool|Secondary Tool)$/.test(s)||s==="Fishing Tackle")return"Tool";
  if(CAT_HOUSE.has(s))return"Furniture";
  if(CAT_MATS.has(s))return"Materials";
  if(CAT_FOOD.has(s))return"Food";
  if(s==="Medicine")return"Medicine";
  if(s==="Dye")return"Dye";
  if(s==="Orchestrion Roll")return"Music";
  if(s==="Minion")return"Minion";
  return"Misc";}
function catSlug(c){return catLabel(c).toLowerCase();}
/* the tag colours live here too, so every tab paints the same word the same */
let _catCss=false;
function catCss(){if(_catCss)return;_catCss=true;
  const s=document.createElement("style");s.id="catcss";
  s.textContent=".pill.gear{color:#f3a0b6;border-color:#5a2f3c}"+
    ".pill.tool{color:#9fb6ff;border-color:#33406a}"+
    ".pill.furniture{color:#e6b98c;border-color:#5a4632}"+
    ".pill.materials{color:var(--win);border-color:#2c4a39}"+
    ".pill.food{color:#9fd0ff;border-color:#2f4a63}"+
    ".pill.medicine{color:#b89cff;border-color:#3a3357}"+
    ".pill.dye{color:#d8a0f0;border-color:#4a3357}"+
    ".pill.music{color:#8fd8e8;border-color:#2c4a52}"+
    ".pill.minion{color:#f0c987;border-color:#5a4a2e}"+
    ".pill.misc{color:var(--muted);border-color:var(--line2)}";
  (document.head||document.documentElement).appendChild(s);}
catCss();
function showWarn(h){const b=document.getElementById("errbox");if(!b)return;
  b.innerHTML=`<div class="err" style="border-color:color-mix(in srgb,var(--hop) 33%,transparent);color:var(--hop);background:color-mix(in srgb,var(--hop) 10%,transparent)">${h}</div>`;}
function finishStatus(results){
  const failed=results.reduce((s,r)=>s+r.failed.length,0);
  const cached=results.some(r=>r.fromCache);
  if(failed)showWarn(`<b>Partial data:</b> ${failed} batch(es) failed &mdash; some prices may be missing. Refresh to retry.`);
  else if(cached)setStatus(`Loaded from cache (&le;${Math.round(NET.CACHE_TTL_MS/60000)} min old) &middot; Refresh pulls fresh prices`);}