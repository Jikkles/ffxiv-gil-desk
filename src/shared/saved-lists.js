/* ===== v17: shared saved lists (up to five, renameable, browser-stored) ===== */
const LIST_KEY="gildesk:lists:v1";
/* a cleared list is parked here until it is restored or the list is cleared again,
   so an accidental Clear list survives even a page reload */
const LIST_UNDO_KEY="gildesk:lists:undo:v1";
const LIST_SLOTS=[1,2,3,4,5];
const LIST_MAX=LIST_SLOTS.length;
const listDef=n=>"List "+n;
const lesc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* A saved row shows whatever tag the source tab stored when you saved it, so a
   list built before a vocabulary change keeps the old word. The provenance kinds
   - vendor, flip, currency, precraft - are what those tabs deliberately store
   and are left alone; only the category slugs that were renamed are carried
   forward. A tag that is not merely renamed but plainly wrong cannot be fixed
   here, because the list tab does not carry the item catalogue - the Dashboard
   repairs its own rows instead, on load. */
const LIST_TAG_ALIAS={potion:"medicine",material:"materials",consumable:"food",item:"misc"};
function listTag(k){const s=String(k==null?"":k).toLowerCase();return LIST_TAG_ALIAS[s]||s;}

const Lists={
  /* ---- storage ---- */
  read(){
    let d=null;try{d=JSON.parse(localStorage.getItem(LIST_KEY)||"null");}catch(e){}
    const out={order:[],names:{},items:{}};
    for(const n of LIST_SLOTS){
      const nm=d&&d.names&&typeof d.names[n]==="string"?d.names[n].trim():"";
      out.names[n]=nm||listDef(n);
      out.items[n]=(d&&d.items&&Array.isArray(d.items[n]))?d.items[n]:[];
    }
    /* saved before lists became addable: those files always held exactly two */
    const raw=d&&Array.isArray(d.order)?d.order:[1,2];
    out.order=[...new Set(raw.map(Number).filter(n=>LIST_SLOTS.indexOf(n)>=0))];
    return out;},
  write(d){
    try{localStorage.setItem(LIST_KEY,JSON.stringify(d));}
    catch(e){Lists.toast("Browser storage is full — could not save");return false;}
    Lists.broadcast();Lists.paint();
    try{if(window.__listChanged)window.__listChanged();}catch(e){}
    return true;},
  /* the tab shell (parent frame) repaints its tab labels on this */
  broadcast(){try{if(window.parent&&window.parent!==window)window.parent.postMessage({gildesk:"lists"},"*");}catch(e){}},

  /* ---- queries ---- */
  nameOf(n){return Lists.read().names[n];},
  items(n){return Lists.read().items[n];},
  has(n,id){return Lists.read().items[n].some(x=>+x.id===+id);},

  /* ---- mutations ---- */
  /* entry is built by the host page via window.__listEntry(id) so each tab
     can hand over its own name / quality / recipe subtree */
  toggle(n,id){
    const d=Lists.read(),i=d.items[n].findIndex(x=>+x.id===+id);
    if(i>=0){const nm=d.items[n][i].name;d.items[n].splice(i,1);
      if(Lists.write(d))Lists.toast("Removed "+nm+" from "+d.names[n]);return false;}
    let e=null;try{e=window.__listEntry?window.__listEntry(id):null;}catch(err){}
    if(!e){Lists.toast("Couldn't read that item");return false;}
    e.t=Date.now();d.items[n].push(e);
    if(Lists.write(d))Lists.toast("Added "+e.name+" to "+d.names[n]);
    return true;},
  remove(n,id){const d=Lists.read();d.items[n]=d.items[n].filter(x=>+x.id!==+id);Lists.write(d);},

  /* ---- adding and removing whole lists ---- */
  /* lowest free slot, or null when all five are in use */
  freeSlot(){const o=Lists.read().order;return LIST_SLOTS.find(n=>o.indexOf(n)<0)||null;},
  addList(){
    const d=Lists.read();
    if(d.order.length>=LIST_MAX){Lists.toast("That's all five lists — remove one first");return null;}
    const n=LIST_SLOTS.find(x=>d.order.indexOf(x)<0);
    if(n==null)return null;
    d.order=d.order.concat([n]);d.names[n]=listDef(n);d.items[n]=[];
    if(!Lists.write(d))return null;
    Lists.toast("Added "+d.names[n]);
    return n;},
  removeList(n){
    const d=Lists.read(),nm=d.names[n];
    d.order=d.order.filter(x=>+x!==+n);
    d.items[n]=[];d.names[n]=listDef(n);
    const u=Lists.readUndo();delete u[n];Lists.writeUndo(u);
    if(Lists.write(d))Lists.toast("Removed "+nm);},

  /* ---- clear / undo ---- */
  readUndo(){try{const u=JSON.parse(localStorage.getItem(LIST_UNDO_KEY)||"null");
    if(u&&typeof u==="object")return u;}catch(e){}return{};},
  writeUndo(u){try{localStorage.setItem(LIST_UNDO_KEY,JSON.stringify(u));}catch(e){}},
  /* null when there is nothing to put back */
  undoInfo(n){const s=Lists.readUndo()[n];
    return(s&&Array.isArray(s.items)&&s.items.length)?{count:s.items.length,t:s.t||0}:null;},
  clear(n){
    const d=Lists.read();
    if(!d.items[n].length)return;
    const count=d.items[n].length;
    const u=Lists.readUndo();u[n]={items:d.items[n],t:Date.now()};Lists.writeUndo(u);
    d.items[n]=[];
    if(Lists.write(d))Lists.toast("Cleared "+count+" item"+(count!==1?"s":"")+" · Undo sits next to Clear list");},
  undo(n){
    const u=Lists.readUndo(),snap=u[n];
    if(!snap||!snap.items||!snap.items.length)return false;
    const d=Lists.read();
    /* anything added since the clear is kept, the restored items go back on top */
    const back=new Set(snap.items.map(x=>+x.id));
    d.items[n]=snap.items.concat(d.items[n].filter(x=>!back.has(+x.id)));
    delete u[n];Lists.writeUndo(u);
    if(Lists.write(d))Lists.toast("Restored "+snap.items.length+" item"+(snap.items.length!==1?"s":"")+" to "+d.names[n]);
    return true;},
  rename(n,name){const d=Lists.read();d.names[n]=String(name||"").trim().slice(0,28)||listDef(n);Lists.write(d);},

  /* ---- add-button state ---- */
  paint(){
    const d=Lists.read();
    document.querySelectorAll("[data-listadd]").forEach(b=>{
      const id=+b.getAttribute("data-listadd");
      const inl=d.order.filter(n=>d.items[n].some(x=>+x.id===id));
      b.classList.toggle("on",inl.length>0);
      b.title=inl.length?"In "+inl.map(n=>d.names[n]).join(" + ")+" — click to change":"Add to a saved list";});},

  /* ---- picker ---- */
  openMenu(btn){
    Lists.closeMenu();
    const id=+btn.getAttribute("data-listadd"),d=Lists.read();
    const m=document.createElement("div");m.id="listMenu";
    const opts=d.order.map(n=>{
      const on=d.items[n].some(x=>+x.id===id);
      return `<button class="lm-opt${on?" on":""}" data-listpick="${n}" data-listid="${id}">
        <span class="lm-tick">${on?"✓":"+"}</span><span class="lm-name">${lesc(d.names[n])}</span>
        <span class="lm-n">${d.items[n].length}</span></button>`;}).join("");
    const room=d.order.length<LIST_MAX;
    m.innerHTML='<div class="lm-head">Add to list</div>'+
      (opts||'<div class="lm-none">No lists yet</div>')+
      (room?`<button class="lm-opt lm-new" data-listnew="${id}">
        <span class="lm-tick">＋</span><span class="lm-name">New list…</span></button>`:"")+
      '<div class="lm-foot">Saved in this browser · rename on the list’s own tab</div>';
    document.body.appendChild(m);
    const r=btn.getBoundingClientRect(),w=m.offsetWidth,h=m.offsetHeight;
    let left=r.left,top=r.bottom+6;
    if(left+w>innerWidth-8)left=innerWidth-w-8;
    if(top+h>innerHeight-8)top=Math.max(8,r.top-h-6);
    m.style.left=Math.max(8,left)+"px";m.style.top=top+"px";},
  closeMenu(){const m=document.getElementById("listMenu");if(m)m.remove();},

  toast(msg){
    try{if(typeof Shop!=="undefined"&&Shop&&Shop.toast)return Shop.toast(msg);}catch(e){}
    let t=document.getElementById("shopToast");
    if(!t){t=document.createElement("div");t.id="shopToast";document.body.appendChild(t);}
    t.textContent=msg;t.classList.add("show");
    clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove("show"),1800);},

  init(){
    const css=document.createElement("style");
    css.textContent=`
    .listbtn{all:unset;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:23px;height:23px;flex:0 0 auto;
      border-radius:7px;border:1px solid var(--line,var(--line));background:var(--panel2,var(--panel2));color:var(--muted,var(--muted));font-size:11px;line-height:1}
    .listbtn:hover{border-color:var(--gil,var(--gil));color:var(--gil,var(--gil))}
    .listbtn.on{color:var(--gil,var(--gil));border-color:var(--gil-line);background:var(--gil-soft)}
    #listMenu{position:fixed;z-index:120;min-width:210px;background:var(--panel,var(--panel));border:1px solid var(--line,var(--line));
      border-radius:12px;overflow:hidden;box-shadow:0 14px 40px #00000070;font-family:"JetBrains Mono",monospace}
    #listMenu .lm-head{padding:9px 12px 7px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--aether,var(--aether));border-bottom:1px solid var(--line,var(--line))}
    #listMenu .lm-opt{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:9px;width:100%;padding:9px 12px;font-size:12.5px;color:var(--ink,var(--ink))}
    #listMenu .lm-opt:hover{background:var(--panel2,var(--panel2))}
    #listMenu .lm-opt.on{color:var(--gil,var(--gil))}
    #listMenu .lm-tick{width:14px;flex:none;text-align:center;color:var(--faint,var(--faint))}
    #listMenu .lm-opt.on .lm-tick{color:var(--gil,var(--gil))}
    #listMenu .lm-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:"Inter",system-ui,sans-serif}
    #listMenu .lm-n{color:var(--faint,var(--faint));font-size:11px}
    #listMenu .lm-new{color:var(--aether,var(--aether));border-top:1px solid var(--line,var(--line))}
    #listMenu .lm-new .lm-tick{color:var(--aether,var(--aether))}
    #listMenu .lm-none{padding:9px 12px;font-size:12px;color:var(--faint,var(--faint))}
    #listMenu .lm-foot{padding:7px 12px 9px;font-size:10px;color:var(--faint,var(--faint));border-top:1px solid var(--line,var(--line));line-height:1.4}`;
    document.head.appendChild(css);

    document.addEventListener("click",function(e){
      const mk=e.target.closest("[data-listnew]");
      if(mk){e.preventDefault();e.stopPropagation();
        const id=+mk.getAttribute("data-listnew"),n=Lists.addList();
        if(n!=null)Lists.toggle(n,id);
        Lists.closeMenu();return;}
      const pick=e.target.closest("[data-listpick]");
      if(pick){e.preventDefault();e.stopPropagation();
        Lists.toggle(+pick.getAttribute("data-listpick"),+pick.getAttribute("data-listid"));
        Lists.closeMenu();return;}
      const add=e.target.closest("[data-listadd]");
      if(add){e.preventDefault();e.stopPropagation();
        const open=document.getElementById("listMenu");
        if(open&&open._for===add){Lists.closeMenu();return;}
        Lists.openMenu(add);
        const m=document.getElementById("listMenu");if(m)m._for=add;return;}
      if(!e.target.closest("#listMenu"))Lists.closeMenu();
    },true);
    document.addEventListener("keydown",e=>{if(e.key==="Escape")Lists.closeMenu();});
    addEventListener("scroll",()=>Lists.closeMenu(),true);
    addEventListener("resize",()=>Lists.closeMenu());

    /* rows are re-rendered wholesale by each tab — repaint button state when they are */
    let t=null;
    new MutationObserver(()=>{clearTimeout(t);t=setTimeout(()=>Lists.paint(),40);})
      .observe(document.body,{childList:true,subtree:true});

    addEventListener("storage",e=>{if(e.key===LIST_KEY){Lists.paint();
      try{if(window.__listChanged)window.__listChanged();}catch(err){}}});
    Lists.paint();
  }
};
Lists.init();
