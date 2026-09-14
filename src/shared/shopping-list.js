/* ===== v14: shared shopping list (all tabs, grouped by world) ===== */
const SHOP_KEY="gildesk:shoplist:v1";
const SFMT=n=>n==null||!isFinite(n)?"—":Math.round(n).toLocaleString("en-GB");
const SFMTK=n=>{if(n==null||!isFinite(n))return"—";if(Math.abs(n)>=1e6)return(n/1e6).toFixed(2)+"M";if(Math.abs(n)>=1e3)return(n/1e3).toFixed(1)+"k";return Math.round(n).toString();};

/* v15: average-price badge — mirrors stockBadge() from shared v13.
   Tweak these two numbers to change sensitivity (0.20 = 20% either way). */
const SHOP_DIP=0.25,SHOP_OVER=0.30;
function shopAvgBadge(unit,avg){
  if(unit==null||avg==null||!isFinite(unit)||!isFinite(avg)||avg<=0)return"";
  if(unit<=avg*(1-SHOP_DIP)){const u=Math.round((1-unit/avg)*100);
    return `<span class="sp-badge good" title="Buying at ${SFMT(unit)} vs ${SFMT(avg)} recent average — ${u}% below, good time to buy">\u25bc \u2212${u}%</span>`;}
  if(unit>=avg*(1+SHOP_OVER)){const o=Math.round((unit/avg-1)*100);
    return `<span class="sp-badge bad" title="Buying at ${SFMT(unit)} vs ${SFMT(avg)} recent average — ${o}% above, consider waiting">\u25b2 +${o}%</span>`;}
  return"";}

const Shop={
  /* v15: pull the recent average sale price out of a packed Universalis result.
     Prefers the DC-wide average, falls back to the home-world one. */
  avgFrom(res,hq){const q=res?(hq?res.h:res.n):null;if(!q)return null;
    return q.ad!=null?q.ad:(q.aw!=null?q.aw:null);},

  read(){try{const r=JSON.parse(localStorage.getItem(SHOP_KEY)||"null");
    if(r&&Array.isArray(r.items))return r;}catch(e){}
    return{t:0,open:false,items:[]};},
  write(d){d.t=Date.now();try{localStorage.setItem(SHOP_KEY,JSON.stringify(d));}catch(e){}Shop.render();},

  /* entries: [{id,name,qty,unit,worldId,world,hq}] · label: finished item these mats are for
     crystals/shards/clusters (ids 2–19) are excluded — assumed stocked, not shopped for */
  add(entries,label){
    const d=Shop.read();let added=0;
    for(const e of entries){
      if(!e||!(e.qty>0))continue;
      if(+e.id>=2&&+e.id<=19)continue;
      added++;
      const k=e.id+":"+(e.hq?1:0);
      const ex=d.items.find(x=>x.key===k);
      if(ex){ex.qty+=e.qty;
        if(e.unit!=null){ex.unit=e.unit;ex.worldId=e.worldId!=null?e.worldId:ex.worldId;ex.world=e.world||ex.world;}
        if(e.avg!=null)ex.avg=e.avg;
        if(label&&!(ex.for||[]).includes(label))(ex.for=ex.for||[]).push(label);
        ex.done=false;}
      else d.items.push({key:k,id:e.id,name:e.name,qty:e.qty,unit:e.unit!=null?e.unit:null,
        avg:e.avg!=null&&isFinite(e.avg)?e.avg:null,
        worldId:e.worldId!=null?e.worldId:null,world:e.world||null,hq:!!e.hq,for:label?[label]:[],done:false});
    }
    if(!added)return Shop.toast("Nothing to add");
    d.open=true;Shop.write(d);
    Shop.toast(label?`Added ${added} mat${added!==1?"s":""} · ${label}`:`Added to shopping list`);
  },

  act(a,key){
    const d=Shop.read();
    if(a==="toggleopen"){d.open=!d.open;return Shop.write(d);}
    if(a==="clear"){d.items=[];return Shop.write(d);}
    if(a==="cleardone"){d.items=d.items.filter(x=>!x.done);return Shop.write(d);}
    const it=d.items.find(x=>x.key===key);if(!it)return;
    if(a==="done")it.done=!it.done;
    else if(a==="del")d.items=d.items.filter(x=>x.key!==key);
    else if(a==="inc")it.qty++;
    else if(a==="dec"){it.qty--;if(it.qty<=0)d.items=d.items.filter(x=>x.key!==key);}
    Shop.write(d);
  },

  /* pure: group items by world → ordered list [{world,home,items,subtotal,remaining,count}]
     The order is the order the worlds first turned up in the list, and it stays
     put. It used to rank them by how many un-ticked items each had and how much
     gil was left in them, so ticking a thing off re-ranked the worlds underneath
     you and the run you were halfway down moved somewhere else. A Map keeps
     first-seen order, and the sort below only lifts home to the top and drops
     the unlistable to the bottom - both of which hold still while you shop. */
  groups(items,homeName){
    const by=new Map();
    for(const it of items){const w=it.world||"No listing";
      if(!by.has(w))by.set(w,[]);
      by.get(w).push(it);}
    const gs=[...by].map(([w,its])=>({world:w,home:w===homeName,items:its,
      count:its.filter(i=>!i.done).length,
      subtotal:its.reduce((s,i)=>s+(i.unit!=null?i.unit*i.qty:0),0),
      remaining:its.filter(i=>!i.done).reduce((s,i)=>s+(i.unit!=null?i.unit*i.qty:0),0)}));
    /* sort is stable, so equal ranks keep the first-seen order above */
    gs.sort((a,b)=>{
      if((a.world==="No listing")!==(b.world==="No listing"))return a.world==="No listing"?1:-1;
      if(a.home!==b.home)return a.home?-1:1;
      return 0;});
    return gs;
  },

  panel(){
    let p=document.getElementById("shopPanel");
    if(p)return p;
    p=document.createElement("div");p.id="shopPanel";
    const anchor=document.getElementById("status")||document.getElementById("errbox")||document.getElementById("tbl")||document.getElementById("ctbl");
    if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(p,anchor);
    else (document.querySelector(".wrap")||document.body).prepend(p);
    return p;
  },

  render(){
    const d=Shop.read(),p=Shop.panel();
    let homeName=null;try{homeName=(typeof state!=="undefined"&&state&&state.home)||null;}catch(e){/* state not yet initialised on this page */}
    const live=d.items.filter(i=>!i.done);
    const total=d.items.reduce((s,i)=>s+(i.unit!=null?i.unit*i.qty:0),0);
    const remaining=live.reduce((s,i)=>s+(i.unit!=null?i.unit*i.qty:0),0);
    const gs=Shop.groups(d.items,homeName);
    const nWorlds=gs.filter(g=>g.world!=="No listing"&&g.count>0).length;
    const summary=d.items.length
      ?`${live.length} item${live.length!==1?"s":""} · ~${SFMTK(remaining)} gil · ${nWorlds} world${nWorlds!==1?"s":""}`
      :`empty — use 🛒 on a row to add its materials`;
    let h=`<div class="sp-head" data-shopact="toggleopen">
      <span class="sp-cart">🛒</span><span class="sp-title">Shopping list</span>
      <span class="sp-sum">${summary}</span>
      <span class="sp-caret">${d.open?"▾":"▸"}</span></div>`;
    if(d.open&&d.items.length){
      h+=`<div class="sp-body">`;
      for(const g of gs){
        const tag=g.world==="No listing"?`<span class="sp-tag dim">check manually</span>`
          :g.home?`<span class="sp-tag home">home ✓</span>`:`<span class="sp-tag hop">hop</span>`;
        h+=`<div class="sp-world"><b>${g.world}</b>${tag}<span class="sp-wsum">${g.count} item${g.count!==1?"s":""} · ${SFMT(g.remaining)} gil</span></div>`;
        for(const it of g.items){
          const forTtl=(it.for&&it.for.length)?` title="For: ${it.for.join(", ").replace(/"/g,"&quot;")}"`:"";
          h+=`<div class="sp-row${it.done?" done":""}"${forTtl}>
            <button class="sp-chk" data-shopact="done" data-shopkey="${it.key}" title="${it.done?"Un-tick":"Tick off as bought"}">${it.done?"✓":""}</button>
            <span class="sp-name"><span class="sp-qty">${it.qty}×</span>${it.name}<span class="qtag ${it.hq?"hq":""}">${it.hq?"HQ":"NQ"}</span></span>
            <span class="sp-step"><button data-shopact="dec" data-shopkey="${it.key}" title="−1">−</button><button data-shopact="inc" data-shopkey="${it.key}" title="+1">+</button></span>
            <span class="sp-unit">${it.unit!=null?SFMT(it.unit)+" ea":"—"}</span>
            <span class="sp-avg${shopAvgBadge(it.unit,it.avg)?" has-badge":""}">${it.avg!=null?`<span class="sp-avgv" title="Recent average sale price across the DC at the time this was added">avg ${SFMT(it.avg)}</span>`:`<span class="sp-avgv dim">no avg</span>`}${shopAvgBadge(it.unit,it.avg)}</span>
            <span class="sp-line">${it.unit!=null?SFMT(it.unit*it.qty):"—"}</span>
            <button class="sp-del" data-shopact="del" data-shopkey="${it.key}" title="Remove">✕</button></div>`;
        }
      }
      const ticked=d.items.length-live.length;
      const dips=live.filter(i=>i.avg!=null&&i.unit!=null&&i.unit<=i.avg*(1-SHOP_DIP)).length;
      const overs=live.filter(i=>i.avg!=null&&i.unit!=null&&i.unit>=i.avg*(1+SHOP_OVER)).length;
      const vs=[dips?`<span class="sp-tally good">\u25bc ${dips} below avg</span>`:"",
                overs?`<span class="sp-tally bad">\u25b2 ${overs} above avg</span>`:""].join("");
      h+=`<div class="sp-foot">
        <span>Remaining <b>${SFMT(remaining)}</b> gil${ticked?` · bought ${SFMT(total-remaining)}`:""} ${vs}<span class="dim">· prices &amp; averages as at time of adding — re-add after a refresh for fresh numbers</span></span>
        <span class="sp-actions">${ticked?`<button data-shopact="cleardone">Clear ticked</button>`:""}<button data-shopact="clear">Clear all</button></span></div>`;
      h+=`</div>`;
    }
    p.innerHTML=h;
  },

  toast(msg){
    let t=document.getElementById("shopToast");
    if(!t){t=document.createElement("div");t.id="shopToast";document.body.appendChild(t);}
    t.textContent=msg;t.classList.add("show");
    clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove("show"),1800);
  },

  init(){
    const css=document.createElement("style");
    css.textContent=`
    .shopbtn{all:unset;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:23px;height:23px;flex:0 0 auto;
      border-radius:7px;border:1px solid var(--line,var(--line));background:var(--panel2,var(--panel2));color:var(--aether,var(--aether));font-size:12px;line-height:1}
    .shopbtn:hover{border-color:var(--aether,var(--aether))}
    .shopbtn.sm{width:19px;height:19px;font-size:12px;border-radius:6px;margin-right:2px;color:var(--gil,var(--gil))}
    #shopPanel{margin:14px 0 8px;background:var(--panel,var(--panel));border:1px solid var(--line,var(--line));border-radius:14px;overflow:hidden;box-shadow:var(--shadow,none)}
    .hero .hicon+div{flex:1 1 320px;min-width:0}
    .hero .kpis{display:flex;gap:11px;margin-bottom:0;flex:1 1 780px}
    .hero .kpi{flex:1 1 0;min-width:0;padding:13px 13px}
    @media(max-width:1100px){.hero{flex-wrap:wrap}.hero .kpis{flex:1 1 100%;margin-top:4px}}
    #shopPanel .sp-head{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;user-select:none}
    #shopPanel .sp-title{font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--aether,var(--aether))}
    #shopPanel .sp-sum{font-family:"JetBrains Mono",monospace;font-size:12px;color:var(--muted,var(--muted))}
    #shopPanel .sp-caret{margin-left:auto;color:var(--faint,var(--faint));font-size:11px}
    #shopPanel .sp-body{border-top:1px solid var(--line,var(--line));padding:4px 0 0}
    #shopPanel .sp-world{display:flex;align-items:center;gap:8px;padding:8px 14px 4px;font-family:"JetBrains Mono",monospace;font-size:12px;color:var(--ink,var(--ink))}
    #shopPanel .sp-world b{color:var(--gil,var(--gil));font-weight:500}
    #shopPanel .sp-wsum{margin-left:auto;color:var(--muted,var(--muted));font-size:11.5px}
    #shopPanel .sp-tag{font-size:10px;padding:1px 7px;border-radius:99px;border:1px solid var(--line,var(--line))}
    #shopPanel .sp-tag.home{color:var(--win,var(--win));border-color:var(--win-line)}
    #shopPanel .sp-tag.hop{color:var(--hop,var(--hop));border-color:var(--hop-line)}
    #shopPanel .sp-tag.dim,#shopPanel .dim{color:var(--faint,var(--faint))}
    #shopPanel .sp-row{display:grid;grid-template-columns:20px minmax(0,1fr) max-content max-content max-content max-content 22px;gap:9px;align-items:center;
      padding:4px 14px;font-family:"JetBrains Mono",monospace;font-size:12.5px;color:var(--ink,var(--ink))}
    #shopPanel .sp-row:hover{background:var(--panel2,var(--panel2))}
    #shopPanel .sp-row.done .sp-name,#shopPanel .sp-row.done .sp-unit,#shopPanel .sp-row.done .sp-line{text-decoration:line-through;color:var(--faint,var(--faint))}
    #shopPanel .sp-row.done .sp-avg{opacity:.45}
    #shopPanel .sp-chk{all:unset;cursor:pointer;width:15px;height:15px;border-radius:5px;border:1px solid var(--line,var(--line));display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:var(--win,var(--win))}
    #shopPanel .sp-chk:hover{border-color:var(--win,var(--win))}
    #shopPanel .sp-name{display:flex;align-items:center;gap:7px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #shopPanel .sp-qty{color:var(--gil,var(--gil))}
    #shopPanel .sp-name .qtag{font-size:9px;padding:0 5px;border-radius:99px;border:1px solid var(--line,var(--line));color:var(--muted,var(--muted))}
    #shopPanel .sp-name .qtag.hq{color:var(--gil,var(--gil));border-color:var(--gil-line)}
    #shopPanel .sp-step button{all:unset;cursor:pointer;width:16px;height:16px;border-radius:5px;border:1px solid var(--line,var(--line));color:var(--muted,var(--muted));display:inline-flex;align-items:center;justify-content:center;font-size:11px;margin-left:3px}
    #shopPanel .sp-step button:hover{color:var(--ink,var(--ink));border-color:var(--line2)}
    #shopPanel .sp-unit{color:var(--muted,var(--muted))}
    #shopPanel .sp-avg{display:flex;align-items:center;justify-content:flex-end;gap:6px;white-space:nowrap;min-width:104px;font-size:11.5px}
    #shopPanel .sp-avgv{color:var(--faint,var(--faint));cursor:help}
    #shopPanel .sp-badge{font-size:10px;line-height:1.6;padding:0 6px;border-radius:99px;border:1px solid var(--line,var(--line));cursor:help}
    #shopPanel .sp-badge.good{color:var(--win,var(--win));border-color:var(--win-line);background:var(--win-soft)}
    #shopPanel .sp-badge.bad{color:var(--loss,var(--loss));border-color:var(--loss-line);background:var(--loss-soft)}
    #shopPanel .sp-tally{font-size:10.5px;padding:1px 7px;border-radius:99px;border:1px solid var(--line,var(--line));margin-right:6px}
    #shopPanel .sp-tally.good{color:var(--win,var(--win));border-color:var(--win-line)}
    #shopPanel .sp-tally.bad{color:var(--loss,var(--loss));border-color:var(--loss-line)}
    @media(max-width:720px){
      #shopPanel .sp-row{grid-template-columns:20px minmax(0,1fr) max-content max-content max-content 22px;gap:7px}
      #shopPanel .sp-avg{display:none}
      #shopPanel .sp-avg.has-badge{display:flex;min-width:0;grid-column:2/-1;justify-content:flex-start}
    }
    #shopPanel .sp-line{min-width:70px;text-align:center}
    #shopPanel .sp-del{all:unset;cursor:pointer;color:var(--faint,var(--faint));font-size:11px;text-align:center}
    #shopPanel .sp-del:hover{color:var(--loss,var(--loss))}
    #shopPanel .sp-foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-top:1px solid var(--line,var(--line));margin-top:6px;padding:9px 14px;font-family:"JetBrains Mono",monospace;font-size:12px;color:var(--muted,var(--muted))}
    #shopPanel .sp-foot b{color:var(--gil,var(--gil));font-weight:500}
    #shopPanel .sp-actions{margin-left:auto;display:flex;gap:8px}
    #shopPanel .sp-actions button{all:unset;cursor:pointer;font-size:11px;padding:4px 10px;border-radius:8px;border:1px solid var(--line,var(--line));color:var(--muted,var(--muted))}
    #shopPanel .sp-actions button:hover{color:var(--ink,var(--ink));border-color:var(--line2)}
    #shopToast{position:fixed;right:16px;bottom:16px;z-index:99;background:var(--panel2,var(--panel2));border:1px solid var(--line,var(--line));color:var(--ink,var(--ink));
      font-family:"JetBrains Mono",monospace;font-size:12px;padding:9px 14px;border-radius:10px;opacity:0;transform:translateY(6px);transition:.18s;pointer-events:none;box-shadow:0 10px 30px #00000060}
    #shopToast.show{opacity:1;transform:none}`;
    document.head.appendChild(css);

    document.addEventListener("click",function(e){
      const act=e.target.closest("[data-shopact]");
      if(act){e.preventDefault();e.stopPropagation();Shop.act(act.getAttribute("data-shopact"),act.getAttribute("data-shopkey"));return;}
      const bi=e.target.closest("[data-shopitem]");
      if(bi){e.preventDefault();e.stopPropagation();if(window.__shopAddItem)window.__shopAddItem(bi.getAttribute("data-shopitem"));return;}
      const bm=e.target.closest("[data-shopmat]");
      if(bm){e.preventDefault();e.stopPropagation();if(window.__shopAddMat)window.__shopAddMat(bm.getAttribute("data-shopmat"));return;}
    },true);

    window.addEventListener("storage",e=>{if(e.key===SHOP_KEY)Shop.render();});
    Shop.render();
  }
};
Shop.init();
