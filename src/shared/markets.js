/* ===== v19: world topology + multi-DC market layer + stockpile helpers ===== */
/* Baked fallback so the pickers work before (and without) a network call.
   Refreshed from Universalis on every load, so new worlds and data centres
   appear on their own. */
let WORLD_TOPO=[
  {region:"North America",dcs:{
    "Aether":["Adamantoise","Cactuar","Faerie","Gilgamesh","Jenova","Midgardsormr","Sargatanas","Siren"],
    "Primal":["Behemoth","Excalibur","Exodus","Famfrit","Hyperion","Lamia","Leviathan","Ultros"],
    "Crystal":["Balmung","Brynhildr","Coeurl","Diabolos","Goblin","Malboro","Mateus","Zalera"],
    "Dynamis":["Cuchulainn","Golem","Halicarnassus","Kraken","Maduin","Marilith","Rafflesia","Seraph"]}},
  {region:"Europe",dcs:{
    "Chaos":["Cerberus","Louisoix","Moogle","Omega","Phantom","Ragnarok","Sagittarius","Spriggan"],
    "Light":["Alpha","Lich","Odin","Phoenix","Raiden","Shiva","Twintania","Zodiark"],
    "Shadow":["Innocence","Pixie","Titania","Tycoon"]}},
  {region:"Japan",dcs:{
    "Elemental":["Aegis","Atomos","Carbuncle","Garuda","Gungnir","Kujata","Tonberry","Typhon"],
    "Gaia":["Alexander","Bahamut","Durandal","Fenrir","Ifrit","Ridill","Tiamat","Ultima"],
    "Mana":["Anima","Asura","Chocobo","Hades","Ixion","Masamune","Pandaemonium","Titan"],
    "Meteor":["Belias","Mandragora","Ramuh","Shinryu","Unicorn","Valefor","Yojimbo","Zeromus"]}},
  {region:"Oceania",dcs:{
    "Materia":["Bismarck","Ravana","Sephirot","Sophia","Zurvan"]}}
];
const DEFAULT_HOME="Spriggan";
/* Universalis also serves the Korean and Chinese services and Square Enix's
   internal test data centres. None of them share a market with us, so they are
   dropped on the way in and never reach a picker. */
const LIVE_REGIONS=["North America","Europe","Japan","Oceania"];
const TEST_NAME_RE=/test|beta|cloud|\bdev\b|\bqa\b/i;
/* Every world and data centre we trade with is named in plain ASCII, so this
   catches the Korean and Chinese services whatever region they are filed under. */
const LATIN_NAME_RE=/^[\x20-\x7E]+$/;
function normRegion(s){return String(s==null?"":s).replace(/[-_]+/g," ").trim();}
function isLiveRegion(r){return LIVE_REGIONS.indexOf(normRegion(r))>=0;}
function isLiveName(n){return!!n&&LATIN_NAME_RE.test(n)&&!TEST_NAME_RE.test(n);}
function isLiveDc(name,region){return isLiveName(name)&&isLiveRegion(region);}
/* Also runs over cached topology, so a table saved before this filter existed
   loses its Korean, Chinese and test entries on the next load. */
function liveTopo(t){
  if(!Array.isArray(t))return[];
  const out=[];
  for(const r of t){
    if(!r||!r.dcs||!isLiveRegion(r.region))continue;
    const dcs={};
    for(const d in r.dcs){
      if(!isLiveDc(d,r.region))continue;
      const ws=(r.dcs[d]||[]).filter(isLiveName);
      if(ws.length)dcs[d]=ws;
    }
    if(Object.keys(dcs).length)out.push({region:normRegion(r.region),dcs});
  }
  return out;
}
/* Every picker and lookup reads the topology through here, so nothing unwanted
   can reach a menu even if it somehow got into WORLD_TOPO. Memoised on the
   table itself, which only changes when a refresh replaces it. */
let _liveSrc=null,_liveOut=null;
function liveWorlds(){if(_liveSrc!==WORLD_TOPO){_liveSrc=WORLD_TOPO;_liveOut=liveTopo(WORLD_TOPO);}return _liveOut;}
function dcNames(){const o=[];for(const r of liveWorlds())for(const d in r.dcs)o.push(d);return o;}
function worldsOfDc(dc){for(const r of liveWorlds())if(r.dcs[dc])return r.dcs[dc];return[];}
function dcOfWorld(w){for(const r of liveWorlds())for(const d in r.dcs)if(r.dcs[d].indexOf(w)>=0)return d;return null;}
function regionOfDc(dc){for(const r of liveWorlds())if(r.dcs[dc])return r.region;return null;}
function allWorldNames(){const o=[];for(const r of liveWorlds())for(const d in r.dcs)for(const w of r.dcs[d])o.push(w);return o;}
const dcEsc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

/* Pull the real topology from Universalis (cached 24h) and fold it in, so a new
   data centre works without touching this file. Silently keeps the baked table
   on any failure. */
async function refreshTopology(){
  const hit=liveTopo(Cache.get("topology2",NET.WORLDS_TTL_MS));   /* v2: pre-filter caches are ignored */
  if(hit.length){WORLD_TOPO=hit;return WORLD_TOPO;}
  try{
    const[dr,wr]=await Promise.all([
      tfetch("https://universalis.app/api/v2/data-centers"),
      tfetch("https://universalis.app/api/v2/worlds")]);
    const dcs=await dr.json(),worlds=await wr.json();
    if(!Array.isArray(dcs)||!Array.isArray(worlds)||!dcs.length)return WORLD_TOPO;
    const byId={};for(const w of worlds)byId[w.id]=w.name;
    Cache.set("worlds",byId,NET.WORLDS_TTL_MS);   /* fetchWorlds() wants exactly this, so save it a round trip */
    const order=LIVE_REGIONS,out=[],seen={};
    for(const d of dcs){
      if(!d||!d.name||!Array.isArray(d.worlds))continue;
      const region=normRegion(d.region);
      if(!isLiveDc(d.name,region))continue;   /* Korea, China and the test DCs stop here */
      const names=d.worlds.map(id=>byId[id]).filter(w=>w&&!TEST_NAME_RE.test(w)).sort((a,b)=>a.localeCompare(b));
      if(!names.length)continue;
      let g=seen[region];
      if(!g){g={region,dcs:{}};seen[region]=g;out.push(g);}
      g.dcs[d.name]=names;
    }
    if(!out.length)return WORLD_TOPO;
    out.sort((a,b)=>{const ia=order.indexOf(a.region),ib=order.indexOf(b.region);
      return(ia<0?99:ia)-(ib<0?99:ib)||a.region.localeCompare(b.region);});
    WORLD_TOPO=out;Cache.set("topology2",out,NET.WORLDS_TTL_MS);
  }catch(e){}
  return WORLD_TOPO;
}

/* ---- which data centres are we pricing materials across? ---- */
function normDcs(v){
  let a;
  if(Array.isArray(v))a=v.slice();
  else if(typeof v==="string"){
    const s=v.trim();
    if(s==="chaos")a=["Chaos"];                 /* v18 and earlier stored a single */
    else if(s==="light")a=["Light"];            /* string, so migrate it here       */
    else if(s==="both")a=["Chaos","Light"];
    else a=s.split(",");
  }else a=[];
  const known=dcNames();
  return[...new Set(a.map(x=>String(x).trim()).filter(x=>known.indexOf(x)>=0))];
}
function ensureDcs(){
  let a=normDcs(state.dcs!=null?state.dcs:state.dc);
  if(!a.length){const d=dcOfWorld(state.home)||dcOfWorld(DEFAULT_HOME);a=d?[d]:[dcNames()[0]];}
  state.dcs=a;state.dc=a.join(",");
  return a;
}
function dcLabel(){
  const a=(state.dcs&&state.dcs.length)?state.dcs:ensureDcs();
  for(const r of liveWorlds()){const ds=Object.keys(r.dcs);
    if(ds.length>1&&ds.length===a.length&&ds.every(d=>a.indexOf(d)>=0))return"All "+r.region;}
  if(a.length<=3)return a.join(" + ");
  return a.length+" data centres";
}
function dcRegions(){const s=[];for(const d of(state.dcs||[])){const r=regionOfDc(d);if(r&&s.indexOf(r)<0)s.push(r);}return s;}
function syncDcNames(){try{document.querySelectorAll(".dcname").forEach(e=>{e.textContent=dcLabel();});}catch(e){}}
function syncHomeNames(){try{document.querySelectorAll(".homename").forEach(e=>{e.textContent=state.home;});}catch(e){}}

function mergeMarkets(a,b){const out={};const keys=new Set([...Object.keys(a),...Object.keys(b)]);
  const pick=(qa,qb)=>{if(!qa)return qb||null;if(!qb)return qa;
    const pa=qa.md?qa.md[0]:null,pb=qb.md?qb.md[0]:null;
    if(pa==null)return qb;if(pb==null)return qa;return pa<=pb?qa:qb;};
  for(const k of keys){const x=a[k],y=b[k];
    if(!x){out[k]=y;continue;}if(!y){out[k]=x;continue;}
    out[k]={h:pick(x.h,y.h),n:pick(x.n,y.n),u:Math.max(x.u||0,y.u||0)};}
  return out;}

/* Price ids across every selected data centre and keep the cheapest of each.
   Two data centres are fetched at a time — Universalis rate-limits hard, and a
   twelve-DC selection would otherwise open sixty parallel requests. */
async function fetchMarket(ids,onProgress){
  const dcs=ensureDcs();
  const per=Math.max(1,Math.ceil(ids.length/NET.BATCH_SIZE)),total=per*dcs.length;
  const done=new Array(dcs.length).fill(0);
  const report=()=>{if(onProgress)onProgress(done.reduce((s,n)=>s+n,0),total);};
  const res=new Array(dcs.length);let next=0;
  async function worker(){while(next<dcs.length){const i=next++;
    res[i]=await fetchAgg(dcs[i],ids,(d,t)=>{done[i]=t?Math.round(d/t*per):0;report();});
    done[i]=per;report();}}
  await Promise.all(Array.from({length:Math.min(2,dcs.length)},worker));
  const live=res.filter(Boolean);
  if(!live.length)return{out:{},failed:[],fromCache:false};
  return live.reduce((x,y)=>({out:mergeMarkets(x.out,y.out),failed:x.failed.concat(y.failed),fromCache:!!(x.fromCache&&y.fromCache)}));}

/* ---- the "Mats from" data-centre picker ---- */
const DC_CSS=`
/* Every tab already styles .field label / .field input, so the picker's own rules
   need a second class to outrank them. */
.field.dcwrap{position:relative}
.field .dcbtn{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:7px;
  font-family:"JetBrains Mono",monospace;font-size:13px;color:var(--ink);white-space:nowrap}
.field .dcbtn .dccar{color:var(--faint);font-size:10px}
.field .dcbtn:hover .dcn{color:var(--gil)}
.field .dcmenu{position:absolute;z-index:60;top:calc(100% + 8px);left:-1px;width:288px;max-width:calc(100vw - 32px);max-height:min(70vh,440px);
  overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:8px;
  box-shadow:0 16px 44px #00000080;cursor:default}
.field .dcmenu[hidden]{display:none}
.dcmenu .dcgroup+.dcgroup{margin-top:8px;border-top:1px solid var(--line);padding-top:8px}
.dcmenu .dchead{display:flex;align-items:center;justify-content:space-between;gap:10px;font-family:"JetBrains Mono",monospace;
  font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);padding:2px 6px 5px}
.dcmenu .dchead .here{color:var(--aether);letter-spacing:.04em;text-transform:none}
.dcmenu .dcall{all:unset;cursor:pointer;color:var(--gil);font-family:"JetBrains Mono",monospace;font-size:10px;
  letter-spacing:.06em;padding:1px 6px;border-radius:5px;border:1px solid transparent}
.dcmenu .dcall:hover{border-color:var(--gil-line);background:color-mix(in srgb,var(--gil) 6%,transparent)}
.dcmenu .dcopt{display:flex;align-items:center;gap:9px;padding:5px 6px;border-radius:7px;cursor:pointer;
  font-family:"Inter",system-ui,sans-serif;font-size:13px;letter-spacing:0;text-transform:none;color:var(--ink)}
.dcmenu .dcopt:hover{background:var(--panel2)}
.dcmenu .dcopt input[type=checkbox]{all:revert;accent-color:var(--aether);flex:0 0 auto;
  width:15px;height:15px;min-width:0;margin:0;cursor:pointer}
.dcmenu .dcopt em{margin-left:auto;font-style:normal;font-family:"JetBrains Mono",monospace;font-size:10px;
  letter-spacing:0;text-transform:none;color:var(--faint)}
.dcmenu .dcfoot{margin-top:8px;border-top:1px solid var(--line);padding:8px 6px 2px;font-size:11px;
  font-family:"Inter",system-ui,sans-serif;line-height:1.5;letter-spacing:0;text-transform:none;color:var(--faint)}
.dcmenu .dcfoot b{color:var(--hop)}
`;
function injectDcCss(){if(document.getElementById("dccss"))return;
  const s=document.createElement("style");s.id="dccss";s.textContent=DC_CSS;document.head.appendChild(s);}

let _dcRepaint=null;
/* Set the selection from anywhere (restore, home-world change, the picker itself). */
function setDcs(v){
  state.dcs=normDcs(v);
  if(!state.dcs.length){const d=dcOfWorld(state.home);state.dcs=d?[d]:[];}
  ensureDcs();
  const hid=document.getElementById("dc");if(hid)hid.value=state.dc;
  if(_dcRepaint)_dcRepaint();
  syncDcNames();
}
/* The last Buy from anyone picked, on any tab. Tabs without a picker have no
   Buy from of their own, so the world-price panel there reads this one. */
const BUY_FROM_KEY="gildesk:buyFrom:v1";
function rememberBuyFrom(){try{localStorage.setItem(BUY_FROM_KEY,JSON.stringify(state.dcs));}catch(e){}}
/* onChange fires only when the selection actually moved. */
function initDcPicker(onChange){
  const btn=document.getElementById("dcBtn"),menu=document.getElementById("dcMenu"),hid=document.getElementById("dc");
  if(!btn||!menu)return;
  injectDcCss();ensureDcs();
  function paint(){
    const home=dcOfWorld(state.home),regions=dcRegions(),scroll=menu.scrollTop;
    menu.innerHTML=liveWorlds().map(r=>{
      const ds=Object.keys(r.dcs),on=ds.filter(d=>state.dcs.indexOf(d)>=0).length;
      const mine=home&&r.dcs[home];
      return`<div class="dcgroup"><div class="dchead"><span>${dcEsc(r.region)}${mine?' <span class="here">· yours</span>':""}</span>`+
        `<button type="button" class="dcall" data-region="${dcEsc(r.region)}">${on===ds.length?"clear":"all"}</button></div>`+
        ds.map(d=>`<label class="dcopt"><input type="checkbox" data-dc="${dcEsc(d)}"${state.dcs.indexOf(d)>=0?" checked":""}>`+
          `<span>${dcEsc(d)}</span><em>${r.dcs[d].length} worlds</em></label>`).join("")+`</div>`;
    }).join("")+`<div class="dcfoot">${notes(regions).join("<br>")}</div>`;
    menu.scrollTop=scroll;
    btn.innerHTML=`<span class="dcn">${dcEsc(dcLabel())}</span><span class="dccar">▾</span>`;
    btn.title=state.dcs.join(", ");
    if(hid)hid.value=state.dcs.join(",");
  }
  function notes(regions){
    const out=[];
    if(regions.length>1)out.push(`<b>Heads up:</b> ${dcEsc(regions.join(", "))} are different physical regions. `+
      `Data-centre travel only works inside your own region, so those prices are worth watching but not shoppable.`);
    if(state.dcs.length>=4)out.push(`<b>${state.dcs.length} data centres</b> is ${state.dcs.length}\u00d7 the price lookups \u2014 a big scan will take noticeably longer.`);
    if(!out.length)out.push("Pick every data centre you can travel to. Materials are priced across all of them, and the cheapest wins.");
    return out;
  }
  _dcRepaint=paint;paint();
  const close=()=>{menu.hidden=true;btn.setAttribute("aria-expanded","false");};
  btn.setAttribute("aria-expanded","false");
  btn.addEventListener("click",e=>{e.stopPropagation();
    const open=menu.hidden;menu.hidden=!open;btn.setAttribute("aria-expanded",String(open));});
  menu.addEventListener("click",e=>e.stopPropagation());
  document.addEventListener("click",close);
  addEventListener("keydown",e=>{if(e.key==="Escape")close();});
  function commit(before){
    ensureDcs();paint();
    if(hid){hid.value=state.dcs.join(",");hid.dispatchEvent(new Event("change",{bubbles:true}));}
    if(before!==state.dcs.join(","))rememberBuyFrom();
    if(before!==state.dcs.join(",")&&onChange)onChange(state.dcs);
  }
  menu.addEventListener("change",e=>{
    const cb=e.target.closest("input[data-dc]");if(!cb)return;
    const before=state.dcs.join(","),d=cb.dataset.dc,i=state.dcs.indexOf(d);
    if(cb.checked&&i<0)state.dcs=state.dcs.concat([d]);
    else if(!cb.checked&&i>=0)state.dcs=state.dcs.filter(x=>x!==d);
    if(!state.dcs.length){state.dcs=[d];}   /* never leave it empty */
    commit(before);
  });
  menu.addEventListener("click",e=>{
    const b=e.target.closest(".dcall");if(!b)return;
    const before=state.dcs.join(",");
    const r=liveWorlds().find(x=>x.region===b.dataset.region);if(!r)return;
    const ds=Object.keys(r.dcs),all=ds.every(d=>state.dcs.indexOf(d)>=0);
    state.dcs=all?state.dcs.filter(d=>ds.indexOf(d)<0):[...new Set(state.dcs.concat(ds))];
    commit(before);
  });
}

/* ---- the "Sell on" world picker: every world in the game, grouped ---- */
function buildHomeSelect(sel,selected){
  if(!sel)return;
  const want=selected||sel.value||state.home||DEFAULT_HOME;
  sel.innerHTML=liveWorlds().map(r=>Object.keys(r.dcs).map(d=>
    `<optgroup label="${dcEsc(r.region)} · ${dcEsc(d)}">`+
    r.dcs[d].map(w=>`<option value="${dcEsc(w)}">${dcEsc(w)}</option>`).join("")+`</optgroup>`).join("")).join("");
  sel.value=want;
  if(!sel.value)sel.value=DEFAULT_HOME;
  if(!sel.value&&sel.options.length)sel.selectedIndex=0;
  state.home=sel.value;
  syncHomeNames();
  return sel.value;
}
/* Moving to a world you can't shop from is never what you meant, so follow it. */
function homeChanged(world){
  state.home=world;syncHomeNames();
  const d=dcOfWorld(world);
  if(d&&state.dcs.indexOf(d)<0){setDcs([d]);return true;}
  syncDcNames();return false;
}

/* ---- NPC gil shops as a place to buy materials ----
   Hundreds of crafting materials are sold by an NPC for gil, and the board often
   wants more for them, or has none listed at all. Every craft used to be costed
   off the board alone, so a recipe could look dearer than it is, or go unpriced
   because one material had no listing. The shell fills the slot below with the
   baked index (tools/build-vendors.js): one vendor each, seasonal shops left out.
   A buy is the cheaper of the board and the NPC, and the NPC wins a tie, since it
   never runs out and needs no world visit. An NPC sells NQ only. */
const NPC_RAW=[/*__NPC_PRICES__*/][0]||null;
const NPC_SHOP=(function(){const m=new Map();
  if(!NPC_RAW||!Array.isArray(NPC_RAW.r))return m;
  const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):"";
  for(const[id,price,p,z,x,y,locked]of NPC_RAW.r)
    m.set(id,{price,npc:cap(NPC_RAW.p[p]),zone:z>=0?NPC_RAW.z[z]:null,x,y,locked:!!locked});
  return m;})();
function npcOf(id){return NPC_SHOP.get(+id)||null;}
/* buy is a tab's own board buy, {price,worldId,world,hop,hq}; the NPC one keeps it as board */
function npcBuy(buy,id){const v=npcOf(id);
  if(!v||(buy.price!=null&&buy.price<v.price))return buy;
  return{price:v.price,worldId:null,world:"NPC",hop:false,hq:false,npc:v,board:buy};}
/* "Name, Zone (x, y)", for the shopping list and tooltips */
function npcWhere(v){return v.npc+(v.zone?", "+v.zone+(v.x?" ("+v.x+", "+v.y+")":""):"");}
function npcTitle(b){const v=b.npc;
  let t="Sold by "+npcWhere(v)+" for "+Math.round(v.price).toLocaleString("en-GB")+" gil.";
  if(v.locked)t+=" Their shop opens after a quest or achievement.";
  const bp=b.board&&b.board.price;
  t+=bp!=null?" Cheapest on the board: "+Math.round(bp).toLocaleString("en-GB")+(b.board.world?" on "+b.board.world:"")+".":" None listed on the board.";
  return t.replace(/&/g,"&amp;").replace(/"/g,"&quot;");}
let _npcCss=false;
function npcCss(){if(_npcCss)return;_npcCss=true;
  const s=document.createElement("style");s.id="npccss";
  s.textContent=".server.npc{color:var(--aether);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:help}"+
    ".npctag{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--aether);border:1px solid color-mix(in srgb,var(--aether) 40%,transparent);border-radius:5px;padding:0 4px;margin-left:4px}";
  (document.head||document.documentElement).appendChild(s);}
/* the two tree cells a bought material shows: its price, and where to buy it */
function npcPriceHTML(b){npcCss();return'<span title="'+npcTitle(b)+'">npc '+fmt(b.price)+' <span class="qtag">NQ</span></span>';}
function npcServerHTML(b,style){npcCss();
  return'<div class="server npc"'+(style?' style="'+style+'"':'')+' title="'+npcTitle(b)+'">'+(b.npc.locked?'🔒 ':'')+'NPC'+(b.npc.zone?' · '+dcEsc(b.npc.zone):'')+'</div>';}
function buyAvg(res,hq){const q=side(res,hq);if(!q)return null;return q.ad!=null?q.ad:(q.aw!=null?q.aw:null);}
function stockBadge(buyPrice,avg){if(buyPrice==null||avg==null||avg<=0)return"";
  const under=Math.round((1-buyPrice/avg)*100);
  if(buyPrice<=avg*0.75)return `<span class="stk good" title="Current buy ${fmt(buyPrice)} is ${under}% below the recent average sale price ${fmt(avg)} — genuine dip, good time to stockpile">▼ −${under}%</span>`;
  const over=Math.round((buyPrice/avg-1)*100);
  if(buyPrice>=avg*1.3)return `<span class="stk bad" title="Current buy ${fmt(buyPrice)} is ${over}% above the recent average sale price ${fmt(avg)} — consider waiting">▲ +${over}%</span>`;
  return"";}

function agePill(ms){if(!ms)return"";
  const h=(Date.now()-ms)/3600000;
  if(h<1)return'<span class="age-pill age-fresh">&lt;1h</span>';
  if(h<6)return`<span class="age-pill age-ok">${Math.round(h)}h</span>`;
  return`<span class="age-pill age-stale">${h<24?Math.round(h)+'h':Math.round(h/24)+'d'}</span>`;}
/* ---- a tab scans itself the moment you open it ----
   The shell renders a tab's document on the first visit, so this kick is
   that tab's first scan. On later visits the shell pings the frame instead,
   and we only rescan once the price cache has gone cold — flipping between
   tabs costs nothing. */
let LAST_LOAD=0;
/* A tab can opt out by setting window.MANUAL_SCAN: the Dashboard does, because
   it is the page the desk opens on and its scan is thousands of lookups - left
   to itself it ran on every visit and rate-limited whichever tab you actually
   came for. It waits for Refresh instead. */
function autoLoad(force){
  if(typeof load!=="function"||window.MANUAL_SCAN)return;
  const btn=document.getElementById("refresh");
  if(btn&&btn.disabled)return;                                   /* a scan is already running */
  if(!force&&LAST_LOAD&&Date.now()-LAST_LOAD<NET.CACHE_TTL_MS)return;
  LAST_LOAD=Date.now();
  try{const r=load();if(r&&r.catch)r.catch(()=>{});}catch(e){}
}
addEventListener("message",e=>{if(e.data&&e.data.gildesk==="activate")autoLoad(false);});
/* deferred, so the tab's own load() and its wiring exist by the time we call it */
setTimeout(()=>autoLoad(true),0);
/* ===== end shared v19 ===== */
