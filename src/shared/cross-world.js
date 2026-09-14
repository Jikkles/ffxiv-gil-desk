/* ===== v20: cross-world price lookup — one item, every world on the DC =====
   Answers the question the per-row price cannot: the cheapest listing is 50 gil
   but only 10 of them exist, so where do the other 89 come from and what do they
   cost? Runs standalone — it borrows tfetch/Cache from shared v12 when the page
   has them and falls back to its own when it does not (the tab shell has neither). */
const XW_KEY="gildesk:xw:v1";
const XW_TTL=5*60*1000;
const XW_DC_TTL=24*60*60*1000;
/* The cheapest N listings across the whole scope — not per world, which is what
   sets this number. A DC is eight worlds, so 50 leaves roughly six listings each;
   go much lower and the pricier worlds fall off the bottom entirely and the table
   stops being a comparison. The panel says when it hits this wall, since "units
   listed" is a floor rather than the true depth once it does. */
const XW_LISTINGS=50;
/* Used only when the page has no topology of its own (the tab shell) and
   /data-centers cannot be reached. Mirrors the baked table in shared v19 so the
   picker still covers every data centre offline. */
const XW_DC_FALLBACK=[
  {name:"Aether",region:"North America"},{name:"Primal",region:"North America"},
  {name:"Crystal",region:"North America"},{name:"Dynamis",region:"North America"},
  {name:"Chaos",region:"Europe"},{name:"Light",region:"Europe"},{name:"Shadow",region:"Europe"},
  {name:"Elemental",region:"Japan"},{name:"Gaia",region:"Japan"},
  {name:"Mana",region:"Japan"},{name:"Meteor",region:"Japan"},
  {name:"Materia",region:"Oceania"}];
/* Same four regions as the desk: no Korean, Chinese or test data centres. */
const XW_LIVE_REGIONS=["North America","Europe","Japan","Oceania"];
const XW_TEST_RE=/test|beta|cloud|\bdev\b|\bqa\b/i;
const xregion=s=>String(s==null?"":s).replace(/[-_]+/g," ").trim();
const XW_LATIN_RE=/^[\x20-\x7E]+$/;   /* our worlds are all plain ASCII */
const xLiveDc=(name,region)=>!!name&&XW_LATIN_RE.test(name)&&!XW_TEST_RE.test(name)
  &&XW_LIVE_REGIONS.indexOf(xregion(region))>=0;

const xfmt=n=>n==null||!isFinite(n)?"—":Math.round(n).toLocaleString("en-GB");
const xfmtk=n=>{if(n==null||!isFinite(n))return"—";
  if(Math.abs(n)>=1e6)return(n/1e6).toFixed(2)+"M";
  if(Math.abs(n)>=1e4)return(n/1e3).toFixed(1)+"k";
  return Math.round(n).toLocaleString("en-GB");};
const xesc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const xago=ms=>{if(!ms)return"never";const s=(Date.now()-ms)/1000;
  if(s<90)return"just now";if(s<5400)return Math.round(s/60)+"m ago";
  if(s<172800)return Math.round(s/3600)+"h ago";return Math.round(s/86400)+"d ago";};

const XW={
  /* ---- state ---- */
  item:null,        /* {id,name} */
  scope:null,       /* "Chaos" | "Light" | "Europe" | … */
  quality:"any",    /* any | nq | hq */
  want:1,
  dcs:null,         /* [{name,region}] once /data-centers has answered */
  data:null,        /* the parsed Universalis payload for item+scope */
  err:null,
  busy:false,
  open:new Set(),   /* worlds whose raw listings are expanded */
  index:null,       /* [[id,name],…] — only the tab shell carries one */

  /* ---- plumbing that works with or without shared v12 ---- */
  fetch(url){
    try{if(typeof tfetch==="function")return tfetch(url);}catch(e){}
    const c=new AbortController(),t=setTimeout(()=>c.abort(),20000);
    return fetch(url,{headers:{Accept:"application/json"},signal:c.signal})
      .then(r=>{clearTimeout(t);return r;},e=>{clearTimeout(t);throw e;});
  },
  cacheGet(k,ttl){
    try{if(typeof Cache!=="undefined"&&Cache&&Cache.get)return Cache.get(k,ttl);}catch(e){}
    try{const raw=sessionStorage.getItem(XW_KEY+":"+k);if(!raw)return null;
      const o=JSON.parse(raw);return Date.now()-o.t>ttl?null:o.d;}catch(e){return null;}
  },
  cacheSet(k,d){
    try{if(typeof Cache!=="undefined"&&Cache&&Cache.set)return Cache.set(k,d);}catch(e){}
    try{sessionStorage.setItem(XW_KEY+":"+k,JSON.stringify({t:Date.now(),d:d}));}catch(e){}
  },

  /* ---- remembered scope, so the panel opens where it was left ---- */
  prefs(){try{const p=JSON.parse(localStorage.getItem(XW_KEY)||"null");
    return p&&typeof p==="object"?p:{};}catch(e){return{};}},
  savePrefs(p){try{localStorage.setItem(XW_KEY,JSON.stringify(Object.assign(XW.prefs(),p)));}catch(e){}},

  /* Where the rest of the desk is pointed, when the page has a state to ask.
     "Mats from" is a list of data centres: one means look at that one, several
     inside a single region mean look at the region. */
  deskScope(){
    try{
      if(typeof state==="undefined"||!state)return null;
      const a=(state.dcs&&state.dcs.length)?state.dcs:null;
      if(a){
        if(a.length===1)return a[0];
        if(typeof regionOfDc==="function"){
          const rs=[];for(const d of a){const r=regionOfDc(d);if(r&&rs.indexOf(r)<0)rs.push(r);}
          if(rs.length===1)return rs[0];
        }
        return a[0];
      }
      /* the pre-multi-DC shape, in case a page is still on it */
      if(typeof state.dc==="string"&&state.dc){
        const first=state.dc.split(",")[0].trim();
        if(first==="light")return"Light";
        if(first==="both")return"Europe";
        if(first==="chaos")return"Chaos";
        return first||null;
      }
    }catch(e){}
    return null;
  },
  /* the tab shell has no state of its own, so fall back to whatever world the
     dashboard was last set to sell on — that is the one "home" means here */
  homeWorld(){
    try{if(typeof state!=="undefined"&&state&&state.home)return state.home;}catch(e){}
    try{const s=JSON.parse(localStorage.getItem("gildesk:all:settings")||"null");
      if(s&&typeof s.home==="string"&&s.home)return s.home;}catch(e){}
    return null;},

  /* ---- data ---- */
  async loadDCs(){
    if(XW.dcs)return XW.dcs;
    /* inside a tab the desk already holds the live topology — one source, no second call */
    try{
      if(typeof WORLD_TOPO!=="undefined"&&Array.isArray(WORLD_TOPO)&&WORLD_TOPO.length){
        const out=[];
        const topo=typeof liveWorlds==="function"?liveWorlds():WORLD_TOPO;
        for(const r of topo)for(const d in r.dcs)
          if(xLiveDc(d,r.region))out.push({name:d,region:xregion(r.region)});
        if(out.length){XW.dcs=out;return out;}
      }
    }catch(e){}
    const hit=XW.cacheGet("xw:dcs",XW_DC_TTL);
    if(Array.isArray(hit)){
      const live=hit.filter(d=>d&&xLiveDc(d.name,d.region));   /* older caches carry the lot */
      if(live.length){XW.dcs=live;return live;}
    }
    try{
      const r=await XW.fetch("https://universalis.app/api/v2/data-centers");
      if(!r.ok)throw new Error("HTTP "+r.status);
      const a=await r.json();
      const out=(Array.isArray(a)?a:[]).map(d=>({name:d.name,region:xregion(d.region)}))
        .filter(d=>xLiveDc(d.name,d.region));
      XW.dcs=out.length?out:XW_DC_FALLBACK;
    }catch(e){XW.dcs=XW_DC_FALLBACK;}
    XW.cacheSet("xw:dcs",XW.dcs);
    return XW.dcs;
  },
  /* every scope the picker offers: each region, then the DCs inside it */
  scopeOptions(){
    const dcs=(XW.dcs||XW_DC_FALLBACK).filter(d=>d&&xLiveDc(d.name,d.region)),seen=[],out=[];
    for(const d of dcs)if(d.region&&seen.indexOf(d.region)<0)seen.push(d.region);
    for(const rg of seen){
      out.push({v:rg,label:rg+" (all DCs)",group:rg});
      for(const d of dcs)if(d.region===rg)out.push({v:d.name,label:d.name,group:rg});
    }
    if(!out.length)for(const d of XW_DC_FALLBACK)out.push({v:d.name,label:d.name,group:"Europe"});
    return out;
  },

  async fetchItem(id,scope){
    const ck=`xw:${scope}:${id}`;
    const hit=XW.cacheGet(ck,XW_TTL);
    if(hit)return hit;
    /* "North America" is North-America to the API; worlds and DCs have no spaces */
    const url=`https://universalis.app/api/v2/${encodeURIComponent(scope.replace(/\s+/g,"-"))}/${id}`
      +`?listings=${XW_LISTINGS}&entries=8`;
    const r=await XW.fetch(url);
    /* the wider search can offer things that never reach the market board */
    if(r.status===400||r.status===404)
      throw new Error("Universalis has no market for this item — it is probably untradeable");
    if(!r.ok)throw new Error("Universalis returned HTTP "+r.status+" for "+scope);
    const j=await r.json();
    /* a single id answers as the item itself; guard the multi-item shape anyway */
    const it=j&&j.items?(j.items[id]||j.items[String(id)]):j;
    if(!it)throw new Error("No market data came back for that item");
    const packed={
      listings:(it.listings||[]).map(l=>({
        w:l.worldName||l.WorldName||null,
        p:l.pricePerUnit,q:l.quantity,hq:!!l.hq,
        t:(l.lastReviewTime||0)*1000,
        r:l.retainerName||null})).filter(l=>l.p>0&&l.q>0),
      avg:it.averagePrice!=null?it.averagePrice:null,
      avgNQ:it.averagePriceNQ!=null?it.averagePriceNQ:null,
      avgHQ:it.averagePriceHQ!=null?it.averagePriceHQ:null,
      vel:it.regularSaleVelocity!=null?it.regularSaleVelocity:null,
      upload:it.lastUploadTime||0,
      /* whether the listing wall was cut short — units available is a floor if so */
      capped:(it.listings||[]).length>=XW_LISTINGS,
      recent:(it.recentHistory||[]).slice(0,8).map(h=>({p:h.pricePerUnit,q:h.quantity,hq:!!h.hq,
        w:h.worldName||null,t:(h.timestamp||0)*1000}))};
    XW.cacheSet(ck,packed);
    return packed;
  },

  /* ---- pure maths, so the rendering stays dumb ---- */
  /* listings the current quality filter lets through, cheapest first */
  visible(){
    if(!XW.data)return[];
    const q=XW.quality;
    return XW.data.listings
      .filter(l=>q==="any"||(q==="hq"?l.hq:!l.hq))
      .sort((a,b)=>a.p-b.p||a.q-b.q);
  },
  /* cheapest-first fill of n units from a set of listings
     → {cost,filled,short,worlds:[{world,units,cost}]} */
  fill(listings,n){
    let need=n,cost=0;const by={};
    for(const l of listings){
      if(need<=0)break;
      const take=Math.min(need,l.q);
      need-=take;cost+=take*l.p;
      const g=by[l.w||"—"]||(by[l.w||"—"]={world:l.w||"—",units:0,cost:0});
      g.units+=take;g.cost+=take*l.p;
    }
    const worlds=Object.values(by).sort((a,b)=>b.units-a.units||a.cost-b.cost);
    return{cost:cost,filled:n-need,short:need,worlds:worlds};
  },
  /* one row per world, each already knowing what it alone could do for you */
  perWorld(){
    const want=Math.max(1,XW.want|0),by={};
    for(const l of XW.visible()){
      const w=l.w||"—";
      (by[w]=by[w]||{world:w,listings:[],units:0,count:0,from:null}).listings.push(l);
    }
    const rows=Object.values(by).map(g=>{
      g.units=g.listings.reduce((s,l)=>s+l.q,0);
      g.count=g.listings.length;
      g.from=g.listings.length?g.listings[0].p:null;
      const f=XW.fill(g.listings,want);
      g.fillCost=f.short?null:f.cost;              /* null = this world cannot fill it alone */
      g.fillUnit=f.short?null:f.cost/want;
      g.short=f.short;
      return g;});
    /* worlds that can fill the order come first, cheapest by what it actually costs */
    rows.sort((a,b)=>{
      if((a.fillCost==null)!==(b.fillCost==null))return a.fillCost==null?1:-1;
      if(a.fillCost!=null)return a.fillCost-b.fillCost;
      return(a.from??Infinity)-(b.from??Infinity);});
    return rows;
  },

  /* ---- opening ---- */
  async show(id,opts){
    id=+id;if(!id)return;
    opts=opts||{};
    XW.item={id:id,name:opts.name||XW.nameOf(id)||("Item #"+id)};
    XW.quality=opts.hq===true?"hq":(opts.hq===false?"nq":(XW.prefs().quality||"any"));
    XW.want=Math.max(1,+(opts.qty||XW.prefs().want||1)|0);
    XW.data=null;XW.err=null;XW.open=new Set();
    await XW.loadDCs();
    XW.scope=opts.scope||XW.prefs().scope||XW.deskScope()||"Chaos";
    if(!XW.scopeOptions().some(o=>o.v===XW.scope))XW.scope=XW.scopeOptions()[0].v;
    XW.paint();
    XW.reload();
  },
  async reload(force){
    if(!XW.item)return;
    XW.busy=true;XW.err=null;XW.paint();
    const id=XW.item.id,scope=XW.scope;
    try{
      if(force){try{if(typeof Cache!=="undefined"&&Cache&&Cache.key)localStorage.removeItem(Cache.key(`xw:${scope}:${id}`));}catch(e){}
        try{sessionStorage.removeItem(XW_KEY+":"+`xw:${scope}:${id}`);}catch(e){}}
      const d=await XW.fetchItem(id,scope);
      /* a slow answer for an item the user has already navigated away from is dropped */
      if(!XW.item||XW.item.id!==id||XW.scope!==scope)return;
      XW.data=d;
    }catch(e){
      if(!XW.item||XW.item.id!==id||XW.scope!==scope)return;
      XW.err=e&&e.message?e.message:String(e);
    }finally{XW.busy=false;XW.paint();}
  },
  close(){XW.item=null;XW.data=null;XW.err=null;
    const m=document.getElementById("xwModal");if(m)m.remove();},

  nameOf(id){
    if(XW.index){for(const e of XW.index)if(e[0]===+id)return e[1];}
    try{if(typeof NAMES!=="undefined"&&NAMES&&NAMES[id])return NAMES[id];}catch(e){}
    try{if(typeof RECIPES!=="undefined"&&RECIPES&&RECIPES[id])return RECIPES[id].name;}catch(e){}
    return null;
  },

  /* ---- rendering ---- */
  paint(){
    if(!XW.item)return;
    let m=document.getElementById("xwModal");
    if(!m){m=document.createElement("div");m.id="xwModal";document.body.appendChild(m);}
    /* the whole panel is redrawn on every tweak, so put the reader back where they were */
    const keep=m.querySelector(".xw-tw");const scroll=keep?keep.scrollTop:0;
    const it=XW.item,home=XW.homeWorld();
    const opts=XW.scopeOptions();
    let sel="",lastGroup=null;
    for(const o of opts){
      if(o.group!==lastGroup){if(lastGroup!==null)sel+="</optgroup>";sel+=`<optgroup label="${xesc(o.group)}">`;lastGroup=o.group;}
      sel+=`<option value="${xesc(o.v)}"${o.v===XW.scope?" selected":""}>${xesc(o.label)}</option>`;}
    if(lastGroup!==null)sel+="</optgroup>";

    const qbtn=(v,l,t)=>`<button class="xw-q${XW.quality===v?" on":""}" data-xwq="${v}" title="${t}">${l}</button>`;

    let body;
    if(XW.err)body=`<div class="xw-msg bad">Couldn't load prices — ${xesc(XW.err)}<br>
      <span class="xw-dim">Universalis may be busy; try again in a moment.</span></div>`;
    else if(!XW.data)body=`<div class="xw-msg">Reading every world on ${xesc(XW.scope)}…</div>`;
    else body=XW.bodyHTML();

    m.innerHTML=`<div class="xw-back" data-xwclose="1"></div>
      <div class="xw-panel" role="dialog" aria-modal="true" aria-label="Prices on other worlds">
        <div class="xw-head">
          <span class="xw-ico">🌐</span>
          <span class="xw-name">${xesc(it.name)}</span>
          <span class="xw-id">#${it.id}</span>
          <a class="xw-ext" href="https://universalis.app/market/${it.id}" target="_blank" rel="noopener"
             title="Open this item on Universalis">Universalis ↗</a>
          <button class="xw-x" data-xwclose="1" title="Close (Esc)">✕</button>
        </div>
        <div class="xw-bar">
          <label class="xw-f"><span>Look at</span><select id="xwScope">${sel}</select></label>
          <span class="xw-seg">${qbtn("any","Any","Both qualities")}${qbtn("nq","NQ","Normal quality only")}${qbtn("hq","HQ","High quality only")}</span>
          <label class="xw-f"><span>I want</span><input id="xwWant" type="number" min="1" max="9999" value="${XW.want}"></label>
          <button class="xw-btn" data-xwreload="1" ${XW.busy?"disabled":""}>${XW.busy?"Loading…":"⟳ Refresh"}</button>
          ${home?`<span class="xw-home">home: <b>${xesc(home)}</b></span>`:""}
        </div>
        ${body}
      </div>`;
    if(scroll){const tw=m.querySelector(".xw-tw");if(tw)tw.scrollTop=scroll;}
  },

  bodyHTML(){
    const d=XW.data,want=Math.max(1,XW.want|0),home=XW.homeWorld();
    const vis=XW.visible();
    if(!vis.length)return`<div class="xw-msg">No ${XW.quality==="any"?"":XW.quality.toUpperCase()+" "}listings on ${xesc(XW.scope)} right now.
      ${XW.quality!=="any"?'<br><span class="xw-dim">Try “Any” — the other quality may still be stocked.</span>':""}</div>`;

    const rows=XW.perWorld();
    const plan=XW.fill(vis,want);
    const single=rows.find(r=>r.fillCost!=null)||null;
    const totalUnits=vis.reduce((s,l)=>s+l.q,0);
    const avg=XW.quality==="hq"&&d.avgHQ!=null?d.avgHQ:(XW.quality==="nq"&&d.avgNQ!=null?d.avgNQ:d.avg);

    /* the headline: what filling the order actually takes */
    let plead;
    if(plan.short){
      plead=`<b class="warn">Only ${xfmt(plan.filled)} listed</b> across ${xesc(XW.scope)} — ${xfmt(plan.short)} short of ${xfmt(want)}.
        ${d.capped?`<span class="xw-dim">(listing wall capped at ${XW_LISTINGS} — there may be more)</span>`:""}`;
    }else if(plan.worlds.length===1){
      plead=`All ${xfmt(want)} from <b>${xesc(plan.worlds[0].world)}</b> for <b class="gil">${xfmt(plan.cost)}</b> gil
        <span class="xw-dim">· ${xfmt(plan.cost/want)} each</span>`;
    }else{
      const bits=plan.worlds.map(w=>`${xfmt(w.units)}× ${xesc(w.world)}`).join(" + ");
      plead=`Cheapest ${xfmt(want)} costs <b class="gil">${xfmt(plan.cost)}</b> gil
        <span class="xw-dim">(${xfmt(plan.cost/want)} each)</span> but spans ${plan.worlds.length} worlds: <b>${bits}</b>`;
    }
    let single_line="";
    if(single&&(plan.worlds.length>1||plan.short)){
      const extra=plan.short?null:single.fillCost-plan.cost;
      single_line=`<div class="xw-sub">One trip only: <b>${xesc(single.world)}</b> alone covers all ${xfmt(want)}
        for <b class="gil">${xfmt(single.fillCost)}</b> gil${extra!=null&&extra>0?` <span class="xw-dim">— ${xfmt(extra)} more than splitting</span>`:""}.</div>`;
    }else if(!single&&!plan.short){
      single_line=`<div class="xw-sub xw-dim">No single world can cover all ${xfmt(want)} — the split above is the only way.</div>`;
    }

    const head=`<div class="xw-lead">${plead}${single_line}
      <div class="xw-stats">
        <span title="Every listing on ${xesc(XW.scope)} that matches the quality filter">${xfmt(totalUnits)} units listed · ${xfmt(vis.length)} listing${vis.length!==1?"s":""} · ${rows.length} world${rows.length!==1?"s":""}</span>
        ${avg!=null?`<span title="Universalis average sale price on this scope">avg sale ${xfmt(avg)}</span>`:""}
        ${d.vel!=null?`<span title="Units sold a day across this scope, over Universalis' rolling week — a stack of 99 counts as 99, not as one sale">${d.vel>=10?xfmt(Math.round(d.vel)):d.vel.toFixed(1)}/day sold</span>`:""}
        <span title="Most recent price upload on this scope">updated ${xago(d.upload)}</span>
      </div></div>`;

    let trs="";
    for(const r of rows){
      const isHome=home&&r.world===home;
      const open=XW.open.has(r.world);
      const cheapest=rows[0]&&rows[0].fillCost!=null&&r.fillCost!=null&&r.fillCost===rows[0].fillCost;
      const cost=r.fillCost!=null
        ?`<b class="gil">${xfmt(r.fillCost)}</b>`
        :`<span class="xw-dim" title="This world has ${xfmt(r.units)} of the ${xfmt(want)} you want">\u00d7${xfmt(r.units)} only</span>`;
      trs+=`<tr class="xw-r${open?" open":""}${isHome?" home":""}" data-xww="${xesc(r.world)}">
        <td class="xw-w"><span class="xw-caret">${open?"▾":"▸"}</span>${xesc(r.world)}
          ${!home?"":(isHome?'<span class="xw-tag home">home</span>':'<span class="xw-tag hop">hop</span>')}
          ${cheapest?'<span class="xw-tag best">cheapest</span>':""}</td>
        <td class="num">${xfmt(r.from)}</td>
        <td class="num">\u00d7${xfmt(r.units)}</td>
        <td class="num dim">${xfmt(r.count)}</td>
        <td class="num">${cost}</td>
        <td class="num dim">${r.fillUnit!=null?xfmt(r.fillUnit):"—"}</td></tr>`;
      if(open){
        let ls="";
        for(const l of r.listings.slice(0,20))
          ls+=`<div class="xw-l"><span class="xw-lp">${xfmt(l.p)}</span>
            <span class="xw-lq">× ${xfmt(l.q)}</span>
            <span class="xw-lt ${l.hq?"hq":""}">${l.hq?"HQ":"NQ"}</span>
            <span class="xw-ln">${xfmt(l.p*l.q)} total</span>
            <span class="xw-lu">${xago(l.t)}</span></div>`;
        if(r.listings.length>20)ls+=`<div class="xw-l xw-dim">…and ${r.listings.length-20} more on this world</div>`;
        trs+=`<tr class="xw-exp"><td colspan="6"><div class="xw-ls">${ls}</div></td></tr>`;
      }
    }

    const recent=(d.recent&&d.recent.length)
      ?`<div class="xw-recent"><span class="xw-rh">Recently sold</span>${d.recent.map(h=>
          `<span class="xw-rp" title="${xesc(h.w||"")} · ${xago(h.t)}">${xfmt(h.p)}<i>×${xfmt(h.q)}</i></span>`).join("")}</div>`
      :"";

    return `${head}
      <div class="xw-tw"><table class="xw-t">
        <thead><tr>
          <th>World</th>
          <th class="num" title="Cheapest single listing on that world">From</th>
          <th class="num" title="Total units listed on that world">Units</th>
          <th class="num">Lots</th>
          <th class="num" title="Cheapest-first cost of buying every unit you asked for, on that world alone">Cost for ${xfmt(want)}</th>
          <th class="num" title="What that works out at per unit">Each</th>
        </tr></thead><tbody>${trs}</tbody></table></div>
      ${recent}
      <div class="xw-foot">Click a world to see its individual listings.
        ${d.capped?`Only the ${XW_LISTINGS} cheapest listings are read, so “units” is a floor.`:""}
        Prices are whatever Universalis was last told — cross-check in game before a long trip.</div>`;
  },

  /* ---- search box (the tab shell mounts this; it needs XW.index) ---- */
  searchScore(q,name){
    const n=name.toLowerCase();
    if(n===q)return 0;
    if(n.startsWith(q))return 1;
    if(n.indexOf(" "+q)>=0)return 2;
    if(n.indexOf(q)>=0)return 3;
    return-1;
  },
  searchLocal(q,limit){
    if(!XW.index)return[];
    q=q.toLowerCase().trim();
    if(!q)return[];
    const hits=[];
    for(const e of XW.index){
      const s=XW.searchScore(q,e[1]);
      if(s>=0)hits.push([s,e[1].length,e[0],e[1]]);
    }
    hits.sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[3].localeCompare(b[3]));
    return hits.slice(0,limit||14).map(h=>({id:h[2],name:h[3]}));
  },
  /* anything the desk has never priced — gear, minions, glamour — via XIVAPI.
     Purely additive: a failure here leaves the local hits untouched. */
  async searchRemote(q){
    try{
      const url="https://v2.xivapi.com/api/search?sheets=Item&fields=Name"
        +"&query="+encodeURIComponent('Name~"'+q.replace(/"/g,"")+'"')+"&limit=15";
      const r=await XW.fetch(url);
      if(!r.ok)return[];
      const j=await r.json();
      return(j&&Array.isArray(j.results)?j.results:[])
        .map(x=>({id:x.row_id,name:x.fields&&x.fields.Name}))
        .filter(x=>x.id&&x.name);
    }catch(e){return[];}
  },

  mountSearch(host){
    if(!host||document.getElementById("xwSearch"))return;
    const box=document.createElement("div");
    box.id="xwSearch";
    box.innerHTML=`<span class="xs-ico"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8.7" cy="8.7" r="5.2"/><path d="M12.6 12.6l4 4"/></svg></span>
      <input id="xwSearchIn" type="text" autocomplete="off" spellcheck="false"
        placeholder="search any item…" aria-label="Search the market board for an item">
      <span class="xs-hint">/</span>
      <div id="xwSearchDrop" hidden></div>`;
    host.appendChild(box);

    const input=box.querySelector("#xwSearchIn"),drop=box.querySelector("#xwSearchDrop");
    let items=[],cursor=-1,timer=null,seq=0;

    function render(){
      if(!items.length){drop.hidden=true;drop.innerHTML="";return;}
      drop.innerHTML=items.map((it,i)=>
        `<button class="xs-opt${i===cursor?" on":""}" data-xwpick="${it.id}" data-xwpickname="${xesc(it.name)}">
          <span class="xs-n">${xesc(it.name)}</span>
          <span class="xs-i">#${it.id}</span>${it.remote?'<span class="xs-r" title="Found on XIVAPI — not one of the items this desk tracks">wider</span>':""}
        </button>`).join("");
      drop.hidden=false;
    }
    function close(){drop.hidden=true;cursor=-1;}
    function pick(i){
      const it=items[i];if(!it)return;
      close();input.blur();
      XW.show(it.id,{name:it.name});
    }
    function search(){
      const q=input.value.trim();
      if(q.length<2){items=[];render();return;}
      const my=++seq;
      items=XW.searchLocal(q,14).map(x=>({id:x.id,name:x.name}));
      cursor=items.length?0:-1;
      render();
      if(items.length<10){
        XW.searchRemote(q).then(extra=>{
          if(my!==seq)return;
          const have=new Set(items.map(x=>x.id));
          for(const e of extra){
            if(items.length>=14)break;
            if(have.has(e.id))continue;
            have.add(e.id);items.push({id:e.id,name:e.name,remote:true});}
          if(cursor<0&&items.length)cursor=0;
          render();});
      }
    }

    input.addEventListener("input",()=>{clearTimeout(timer);timer=setTimeout(search,90);});
    input.addEventListener("focus",()=>{if(items.length)render();});
    input.addEventListener("keydown",e=>{
      if(e.key==="ArrowDown"){e.preventDefault();if(items.length){cursor=(cursor+1)%items.length;render();}}
      else if(e.key==="ArrowUp"){e.preventDefault();if(items.length){cursor=(cursor-1+items.length)%items.length;render();}}
      else if(e.key==="Enter"){e.preventDefault();pick(cursor<0?0:cursor);}
      else if(e.key==="Escape"){e.preventDefault();if(drop.hidden){input.value="";input.blur();}else close();}
    });
    drop.addEventListener("mousedown",e=>{
      const b=e.target.closest("[data-xwpick]");
      if(!b)return;
      e.preventDefault();
      close();input.blur();
      XW.show(+b.getAttribute("data-xwpick"),{name:b.getAttribute("data-xwpickname")});
    });
    document.addEventListener("click",e=>{if(!box.contains(e.target))close();});
    XW.focusSearch=()=>{input.focus();input.select();};
  },

  /* ---- wiring ---- */
  init(){
    const css=document.createElement("style");
    css.textContent=`
    .xwbtn{all:unset;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:23px;height:23px;flex:0 0 auto;
      border-radius:7px;border:1px solid var(--line,var(--line));background:var(--panel2,var(--panel2));color:var(--muted,var(--muted));font-size:11px;line-height:1}
    .xwbtn:hover{border-color:var(--aether,var(--aether));color:var(--aether,var(--aether))}
    .xwbtn.sm{width:19px;height:19px;font-size:10px;border-radius:6px;margin-right:2px}
    #xwModal{position:fixed;inset:0;z-index:200;display:flex;align-items:flex-start;justify-content:center;
      font-family:"Inter",system-ui,sans-serif}
    #xwModal .xw-back{position:absolute;inset:0;background:var(--scrim);backdrop-filter:blur(2px)}
    #xwModal .xw-panel{position:relative;margin:44px 16px;width:min(880px,100%);max-height:calc(100vh - 88px);
      display:flex;flex-direction:column;background:var(--panel,var(--panel));border:1px solid var(--line,var(--line));
      border-radius:16px;overflow:hidden;box-shadow:0 24px 70px #00000090}
    #xwModal .xw-head{display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid var(--line,var(--line))}
    #xwModal .xw-ico{font-size:15px}
    #xwModal .xw-name{font-size:16px;font-weight:700;color:var(--ink,var(--ink));min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #xwModal .xw-id{font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--faint,var(--faint))}
    #xwModal .xw-ext{margin-left:auto;font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--aether,var(--aether));text-decoration:none;
      border:1px solid var(--aether-line);border-radius:8px;padding:4px 9px}
    #xwModal .xw-ext:hover{background:var(--accent-soft)}
    #xwModal .xw-x{all:unset;cursor:pointer;color:var(--faint,var(--faint));font-size:13px;padding:4px 6px;border-radius:7px}
    #xwModal .xw-x:hover{color:var(--loss,var(--loss))}
    #xwModal .xw-bar{display:flex;flex-wrap:wrap;align-items:center;gap:9px;padding:11px 16px;border-bottom:1px solid var(--line,var(--line));
      background:var(--panel2,var(--panel2))}
    #xwModal .xw-f{display:flex;align-items:center;gap:7px;background:var(--panel,var(--panel));border:1px solid var(--line,var(--line));border-radius:9px;padding:5px 9px}
    #xwModal .xw-f span{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint,var(--faint))}
    #xwModal .xw-f select,#xwModal .xw-f input{all:unset;font-family:"JetBrains Mono",monospace;font-size:12.5px;color:var(--ink,var(--ink));cursor:pointer}
    #xwModal .xw-f input{width:52px;cursor:text;text-align:center}
    #xwModal .xw-f select option{background:var(--panel)}
    #xwModal .xw-seg{display:inline-flex;border:1px solid var(--line,var(--line));border-radius:9px;overflow:hidden}
    #xwModal .xw-q{all:unset;cursor:pointer;padding:6px 11px;font-family:"JetBrains Mono",monospace;font-size:11.5px;color:var(--muted,var(--muted));background:var(--panel,var(--panel))}
    #xwModal .xw-q:hover{color:var(--ink,var(--ink))}
    #xwModal .xw-q.on{color:var(--bg);background:var(--aether,var(--aether))}
    #xwModal .xw-btn{all:unset;cursor:pointer;padding:6px 12px;border-radius:9px;border:1px solid var(--line,var(--line));
      font-family:"JetBrains Mono",monospace;font-size:11.5px;color:var(--muted,var(--muted));background:var(--panel,var(--panel))}
    #xwModal .xw-btn:hover{color:var(--ink,var(--ink));border-color:var(--line2)}
    #xwModal .xw-btn[disabled]{opacity:.5;cursor:default}
    #xwModal .xw-home{margin-left:auto;font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--faint,var(--faint))}
    #xwModal .xw-home b{color:var(--win,var(--win));font-weight:500}
    #xwModal .xw-msg{padding:26px 18px;text-align:center;color:var(--muted,var(--muted));font-size:13.5px;line-height:1.6}
    #xwModal .xw-msg.bad{color:var(--loss,var(--loss))}
    #xwModal .xw-dim{color:var(--faint,var(--faint))}
    #xwModal .xw-lead{padding:13px 16px;font-size:14px;color:var(--ink,var(--ink));line-height:1.55;border-bottom:1px solid var(--line,var(--line))}
    #xwModal .xw-lead .gil{color:var(--gil,var(--gil))}
    #xwModal .xw-lead .warn{color:var(--warn,var(--hop))}
    #xwModal .xw-sub{margin-top:5px;font-size:13px;color:var(--muted,var(--muted))}
    #xwModal .xw-sub b{color:var(--ink,var(--ink));font-weight:500}
    #xwModal .xw-stats{display:flex;flex-wrap:wrap;gap:14px;margin-top:8px;font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--faint,var(--faint))}
    #xwModal .xw-tw{overflow:auto;flex:1;min-height:0}
    #xwModal .xw-t{width:100%;border-collapse:collapse;font-family:"JetBrains Mono",monospace;font-size:12.5px}
    #xwModal .xw-t th{position:sticky;top:0;z-index:1;background:var(--panel,var(--panel));text-align:left;padding:9px 14px;
      font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--faint,var(--faint));font-weight:400;
      border-bottom:1px solid var(--line,var(--line));white-space:nowrap}
    #xwModal .xw-t td{padding:8px 14px;border-bottom:1px solid var(--line);color:var(--ink,var(--ink));white-space:nowrap}
    #xwModal .xw-t .num{text-align:center}
    #xwModal .xw-t td.dim{color:var(--faint,var(--faint))}
    #xwModal .xw-t .gil{color:var(--gil,var(--gil));font-weight:500}
    #xwModal .xw-r{cursor:pointer}
    #xwModal .xw-r:hover{background:var(--panel2,var(--panel2))}
    #xwModal .xw-w{display:flex;align-items:center;gap:7px}
    #xwModal .xw-caret{color:var(--faint,var(--faint));font-size:9px;width:9px}
    #xwModal .xw-tag{font-size:9px;padding:1px 6px;border-radius:99px;border:1px solid var(--line,var(--line));color:var(--faint,var(--faint))}
    #xwModal .xw-tag.home{color:var(--win,var(--win));border-color:var(--win-line)}
    #xwModal .xw-tag.hop{color:var(--hop,var(--hop));border-color:var(--hop-line)}
    #xwModal .xw-tag.best{color:var(--aether,var(--aether));border-color:var(--aether-line);background:var(--accent-soft)}
    #xwModal .xw-exp td{padding:0;background:var(--bg2)}
    #xwModal .xw-ls{display:flex;flex-direction:column;padding:5px 14px 9px 32px}
    #xwModal .xw-l{display:flex;align-items:center;gap:12px;padding:3px 0;font-size:12px;color:var(--muted,var(--muted))}
    #xwModal .xw-lp{color:var(--ink,var(--ink));min-width:64px;text-align:center}
    #xwModal .xw-lq{color:var(--gil,var(--gil));min-width:52px}
    #xwModal .xw-lt{font-size:9px;padding:0 5px;border-radius:99px;border:1px solid var(--line,var(--line))}
    #xwModal .xw-lt.hq{color:var(--gil,var(--gil));border-color:var(--gil-line)}
    #xwModal .xw-ln,#xwModal .xw-lu{color:var(--faint,var(--faint));font-size:11px}
    #xwModal .xw-lu{margin-left:auto}
    #xwModal .xw-recent{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:9px 16px;border-top:1px solid var(--line,var(--line));
      font-family:"JetBrains Mono",monospace;font-size:11.5px;color:var(--muted,var(--muted))}
    #xwModal .xw-rh{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--faint,var(--faint))}
    #xwModal .xw-rp{border:1px solid var(--line,var(--line));border-radius:99px;padding:1px 8px;cursor:help}
    #xwModal .xw-rp i{color:var(--faint,var(--faint));font-style:normal;font-size:10px;margin-left:3px}
    #xwModal .xw-foot{padding:9px 16px 12px;border-top:1px solid var(--line,var(--line));font-size:11px;color:var(--faint,var(--faint));line-height:1.5}
    #xwSearch{position:relative;display:flex;align-items:center;gap:7px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:5px 10px}
    #xwSearch:focus-within{border-color:var(--aether)}
    #xwSearch .xs-ico{display:flex;opacity:.75}#xwSearch .xs-ico svg{width:15px;height:15px;display:block}
    #xwSearch input{all:unset;width:190px;font-family:"JetBrains Mono",monospace;font-size:12.5px;color:var(--ink)}
    #xwSearch input::placeholder{color:var(--faint)}
    #xwSearch .xs-hint{font-family:"JetBrains Mono",monospace;font-size:10px;color:var(--faint);border:1px solid var(--line);border-radius:5px;padding:0 5px;line-height:15px}
    #xwSearch:focus-within .xs-hint{display:none}
    #xwSearchDrop{position:absolute;top:calc(100% + 6px);right:0;min-width:300px;max-height:min(60vh,420px);overflow:auto;z-index:210;
      background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:0 16px 44px #00000080;padding:4px}
    #xwSearchDrop[hidden]{display:none}
    #xwSearchDrop .xs-opt{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:9px;width:100%;
      padding:7px 10px;border-radius:8px;font-size:13px;color:var(--ink)}
    #xwSearchDrop .xs-opt:hover,#xwSearchDrop .xs-opt.on{background:var(--panel2)}
    #xwSearchDrop .xs-n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #xwSearchDrop .xs-i{font-family:"JetBrains Mono",monospace;font-size:10.5px;color:var(--faint)}
    #xwSearchDrop .xs-r{font-family:"JetBrains Mono",monospace;font-size:9px;color:var(--muted);border:1px solid var(--line);border-radius:99px;padding:0 6px}
    @media(max-width:820px){
      #xwSearch input{width:118px}
      #xwModal .xw-panel{margin:10px 8px;max-height:calc(100vh - 20px)}
      #xwModal .xw-t th:nth-child(4),#xwModal .xw-t td:nth-child(4),
      #xwModal .xw-t th:nth-child(6),#xwModal .xw-t td:nth-child(6){display:none}
    }`;
    document.head.appendChild(css);

    document.addEventListener("click",function(e){
      if(e.target.closest("[data-xwclose]")){e.preventDefault();e.stopPropagation();XW.close();return;}
      if(e.target.closest("[data-xwreload]")){e.preventDefault();e.stopPropagation();XW.reload(true);return;}
      const q=e.target.closest("[data-xwq]");
      if(q){e.preventDefault();e.stopPropagation();
        XW.quality=q.getAttribute("data-xwq");XW.savePrefs({quality:XW.quality});XW.paint();return;}
      const w=e.target.closest("[data-xww]");
      if(w){e.preventDefault();e.stopPropagation();
        const k=w.getAttribute("data-xww");
        if(XW.open.has(k))XW.open.delete(k);else XW.open.add(k);
        XW.paint();return;}
      const b=e.target.closest("[data-xw]");
      if(b){e.preventDefault();e.stopPropagation();
        XW.show(+b.getAttribute("data-xw"),{
          name:b.getAttribute("data-xwname")||null,
          qty:b.getAttribute("data-xwqty")?+b.getAttribute("data-xwqty"):null,
          hq:b.hasAttribute("data-xwhq")?b.getAttribute("data-xwhq")==="1":null});
        return;}
    },true);

    document.addEventListener("change",function(e){
      if(e.target&&e.target.id==="xwScope"){
        XW.scope=e.target.value;XW.savePrefs({scope:XW.scope});
        XW.data=null;XW.open=new Set();XW.reload();}
    });
    document.addEventListener("input",function(e){
      if(e.target&&e.target.id==="xwWant"){
        const v=Math.max(1,Math.min(9999,+e.target.value||1));
        XW.want=v;XW.savePrefs({want:v});
        /* repaint the numbers without stealing the caret out of the box */
        const el=e.target,pos=el.selectionStart;
        XW.paint();
        const again=document.getElementById("xwWant");
        if(again){again.focus();try{again.setSelectionRange(pos,pos);}catch(err){}}}
    });
    document.addEventListener("keydown",function(e){
      if(e.key==="Escape"&&XW.item){XW.close();return;}
      /* "/" or ctrl-K reaches the search box even while a tab has the focus */
      const tag=(e.target&&e.target.tagName||"").toLowerCase();
      const typing=tag==="input"||tag==="textarea"||tag==="select"||(e.target&&e.target.isContentEditable);
      if((e.key==="/"&&!typing)||((e.ctrlKey||e.metaKey)&&(e.key==="k"||e.key==="K"))){
        e.preventDefault();
        if(XW.focusSearch)XW.focusSearch();
        else try{if(window.parent&&window.parent!==window)window.parent.postMessage({gildesk:"focusSearch"},"*");}catch(err){}}
    });
  }
};
XW.init();
