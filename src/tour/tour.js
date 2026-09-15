/* ===== guided tour =====
   Walks a new player round the desk once they have picked their world, and again
   whenever the Tour button is pressed. It never touches a live tab: it draws an
   example Dashboard (src/tour/mock.html, made-up prices) the size of the window,
   dims everything but the part being explained, zooms in on it, and puts a speech
   bubble beside it.

   Runs in the shell, which evaluates it; it needs the shell's TOUR_MOCK, BLOBS,
   UI_CSS, UI_JS, ICON_INDEX, RECIPE_INDEX, the shared module sources and HOME_TOPO. */
window.Tour=(function(){
  /* Each step: sec (the bubble's small heading), title, body (HTML; {home} and {dc}
     are filled in), spot (the data-t name to light up, none for a centred bubble),
     focus (a wider data-t name to frame, when the spot alone is too small to read
     in context), side (where the bubble would rather sit), zoom (the most it may
     magnify), state (which of the page's staged changes are showing). */
  const STEPS=[
    {sec:"Welcome",title:"Welcome to Jikky’s Gil Factory",
      body:"Here’s a one-minute tour of an example Dashboard, priced for <b>{home}</b>. Every tab is laid out the same way, so what you learn here works everywhere. The prices on it are made up.",
      next:"Start the tour"},
    {sec:"Side panel",title:"The side panel",spot:"side",side:"right",
      body:"Everything that changes what the table shows lives down this side: your server, Refresh, and the filters. The arrow at the top folds it away when you want more room."},
    {sec:"Side panel",title:"Your server",spot:"server",focus:"side",side:"right",
      body:"<b>Sell on</b> is the world you sell on, set to {home} from the picker. <b>Mats from</b> is where materials are priced: tick more data centres and the cheapest listing across all of them wins."},
    {sec:"Side panel",title:"Refresh",spot:"refresh",focus:"side",side:"right",
      body:"Pulls live prices from Universalis. Other tabs load on their own, but the Dashboard checks over 9,000 items, so it waits for you to press this. <b>Shift-click</b> rescans everything, even items that haven’t sold lately."},
    {sec:"Side panel",title:"Filters",spot:"filters",focus:"side",side:"right",
      body:"Hide items that don’t sell or have suspect prices, measure profit against the cheapest listing or the 30-day average, set the market tax, and narrow the list to one category. Each tab remembers its own."},
    {sec:"Page info",title:"What this tab does",spot:"hero",side:"bottom",zoom:1.5,
      body:"Every tab opens with a short summary of what it works out."},
    {sec:"Page info",title:"How this works",spot:"howto",side:"bottom",zoom:1.6,
      body:"Just under the cards on every tab. Click the bar to open it: what the tab calculates, how to read its columns, and what to watch out for."},
    {sec:"Page info",title:"▶ Show me",spot:"showme",focus:"howto",side:"bottom",zoom:2.2,
      body:"Every tab has its own <b>Show me</b> button. It walks you through that tab’s own controls and columns one at a time, on the real page with live prices. On the Dashboard it brings back this tour."},
    {sec:"Page info",title:"At a glance",spot:"kpis",side:"bottom",zoom:1.4,
      body:"The cards pick out the headlines: the best profit on a single item, the most gil a day everything in view could make, and how many items are profitable. They follow your filters."},
    {sec:"Item list",title:"The item list",spot:"table",side:"bottom",
      body:"One row per item: what it sells for now, its 30-day average, which way the price is heading, what the materials cost, the profit, and how many sell a day. Click a column heading to sort by it."},
    {sec:"Item list",title:"⚠ Prices to double-check",spot:"outlier",focus:"outrow",side:"bottom",zoom:1.6,
      body:"A <b>⚠</b> means the price can’t be trusted. Here one listing at 1,150,000 sits against a 30-day average of 12,000 from just two sales, so the profit is fantasy. It also shows when there’s no listing and the average rests on a sale or two, which is easy to rig. Hover it for the reason, or tick <b>Hide ⚠ outliers</b> in the side panel to drop these rows."},
    {sec:"Freshness",title:"How fresh a price is",spot:"age",side:"right",zoom:1.8,
      body:"The pill beside each price says how long ago that item’s listings were last uploaded to Universalis: <b>green</b> under an hour, <b>orange</b> a few hours, <b>red</b> a day or more. An old price may already have sold or been undercut, so check it in game before you commit."},
    {sec:"Freshness",title:"Last scan",spot:"scan",focus:"side",side:"right",
      body:"When this tab last pulled prices. The time turns red once it’s half an hour old, a nudge to press <b>Refresh</b> before you buy or list anything."},
    {sec:"Item list",title:"Open a row for the details",spot:"tree",state:{tree:1},side:"top",
      body:"Click a row to open it. For a craft, that’s the whole recipe: every material, what it costs to buy, and whether crafting it yourself is cheaper. Click a craftable material to go a level deeper. On tabs like Vendors, Currencies and Duties, the row itself shows where the item comes from."},
    {sec:"Item list",title:"Where to buy the materials",spot:"buyon",focus:"tree",state:{tree:1},side:"top",
      body:"<b>Buy</b> is the cheapest listing across {dc}, and <b>Buy on</b> is the world it’s on. Green is your own world; orange <b>hop</b> means it’s cheaper to travel. A green <b>▼</b> badge flags a material selling well under its average."},
    {sec:"Row buttons",title:"🛒 Add to shopping list",spot:"b-shop",focus:"rowhead",state:{tree:1},side:"bottom",zoom:2.3,
      body:"Adds every material this craft needs to your shopping list. Inside a recipe, the <b>+</b> button adds just that one material."},
    {sec:"Row buttons",title:"Your shopping list",spot:"shop",state:{tree:1,shop:1},side:"bottom",zoom:1.4,
      body:"Materials land here, grouped by the world to buy them on, with a running gil total. Tick lines off as you buy. It’s the same list on every tab."},
    {sec:"Row buttons",title:"📋 Add to a list",spot:"b-list",focus:"rowhead",state:{tree:1,shop:1},side:"bottom",zoom:2.3,
      body:"Saves the item to one of your own lists, which sit as tabs at the end of the bar: a weekly craft, say, or a watchlist. Pick the same list again to take it off."},
    {sec:"Row buttons",title:"🌐 Compare worlds",spot:"b-xw",focus:"rowhead",state:{tree:1,shop:1},side:"bottom",zoom:2.3,
      body:"Shows this item’s price and stock on every world, and the cheapest way to buy as many as you need, even if that means splitting the order across worlds."},
    {sec:"Row buttons",title:"Open in Teamcraft",spot:"b-tc",focus:"rowhead",state:{tree:1,shop:1},side:"bottom",zoom:2.3,
      body:"Opens this exact recipe in the Teamcraft craft simulator, so you can check a rotation before you commit. Only items you craft have one."},
    {sec:"Tabs",title:"The other tabs",spot:"tabs",state:{tabs:1},side:"bottom",
      body:"Each tab is its own way of making gil, laid out like this one. Pick any of them from the bar."},
    {sec:"Tabs",title:"Search, and this tour",spot:"tabright",side:"bottom",zoom:1.8,next:"Finish",
      body:"Search for any item by name from any tab (press <b>/</b> to jump in). <b>Tour</b> brings this walkthrough back whenever you want it."}
  ];
  /* one line under each tab on the "other tabs" step */
  const TAB_NOTES={all:"Profit on 9,400+ crafts",precraft:"Buy, craft and sell intermediates",
    currencies:"Best gil rate for each currency",materia:"Collectables to scrips to materia",
    duties:"Valuable drops, with drop rates",flips:"Buy low on one world, sell on another",
    retainer:"What ventures bring back",submersible:"Best voyage for your sub build",
    workshop:"FC projects, costed phase by phase",vendors:"NPC items that resell for more",
    list:"Your own lists of items"};

  const M=20,GAP=18;
  let root=null,stage,frame,spot,bubble,doc=null,at=0,V=null,pageH=0,mock=null,lastFocus=null;

  function css(){
    if(document.getElementById("tourCss"))return;
    const s=document.createElement("style");s.id="tourCss";
    s.textContent=`
    .tour{position:fixed;inset:0;z-index:90;background:var(--bg);overflow:hidden;opacity:0;transition:opacity .25s ease}
    .tour.on{opacity:1}
    .tour-frame{position:absolute;left:0;top:0;border:0;display:block;transform-origin:0 0;pointer-events:none;
      transition:transform .6s cubic-bezier(.22,.7,.2,1)}
    .tour-spot{position:absolute;left:50%;top:50%;width:0;height:0;border-radius:12px;pointer-events:none;
      box-shadow:0 0 0 2px var(--aether),0 0 22px 2px #4de1c166,0 0 0 200vmax rgba(3,6,10,.74);
      transition:left .6s cubic-bezier(.22,.7,.2,1),top .6s cubic-bezier(.22,.7,.2,1),width .6s cubic-bezier(.22,.7,.2,1),height .6s cubic-bezier(.22,.7,.2,1)}
    :root[data-theme="light"] .tour-spot{box-shadow:0 0 0 2px var(--aether),0 0 22px 2px #0a736155,0 0 0 200vmax rgba(10,18,28,.62)}
    .tour-spot.off{box-shadow:0 0 0 200vmax rgba(3,6,10,.6)}
    .tour-bub{position:absolute;left:0;top:0;width:350px;background:var(--panel);border:1px solid var(--line2);border-radius:14px;
      padding:15px 17px 13px;box-shadow:0 20px 60px #00000080;font-family:"Inter",sans-serif;color:var(--ink);
      opacity:0;transform:translateY(4px);transition:opacity .2s ease,transform .2s ease}
    .tour-bub.show{opacity:1;transform:none}
    .tour-bub.wide{width:420px}
    .tour-bub .tour-top{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-family:"JetBrains Mono",monospace;
      font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--aether)}
    .tour-bub .tour-n{margin-left:auto;color:var(--faint);letter-spacing:.06em}
    .tour-bub h3{margin:0 0 6px;font-size:16px;line-height:1.3}
    .tour-bub p{margin:0;font-size:13px;line-height:1.55;color:var(--muted)}
    .tour-bub p b{color:var(--ink);font-weight:600}
    .tour-prog{height:3px;border-radius:3px;background:var(--line);margin:13px 0 11px;overflow:hidden}
    .tour-prog i{display:block;height:100%;background:linear-gradient(90deg,var(--aether),var(--gil));transition:width .3s ease}
    .tour-nav{display:flex;align-items:center;gap:8px}
    .tour-nav button{all:unset;box-sizing:border-box;cursor:pointer;font-family:"Inter",sans-serif;font-size:12.5px;padding:7px 13px;border-radius:9px}
    .tour-nav button:focus-visible{outline:2px solid var(--aether);outline-offset:2px}
    .tour-nav .tour-skip{color:var(--faint);padding-left:0}
    .tour-nav .tour-skip:hover{color:var(--ink)}
    .tour-nav .tour-back{margin-left:auto;color:var(--muted);border:1px solid var(--line)}
    .tour-nav .tour-back:hover{color:var(--ink);border-color:var(--line2)}
    .tour-nav .tour-back[hidden]{display:none}
    .tour-nav .tour-back[hidden]+.tour-next{margin-left:auto}
    .tour-nav .tour-next{color:#0b1017;background:var(--gil);font-weight:700}
    :root[data-theme="light"] .tour-nav .tour-next{color:#fff}
    .tour-nav .tour-next:hover{filter:brightness(1.08)}
    .tour-arrow{position:absolute;width:14px;height:14px;background:var(--panel);transform:rotate(45deg);pointer-events:none}
    .tour-bub[data-side="right"] .tour-arrow{left:-8px;border-left:1px solid var(--line2);border-bottom:1px solid var(--line2)}
    .tour-bub[data-side="left"] .tour-arrow{right:-8px;border-right:1px solid var(--line2);border-top:1px solid var(--line2)}
    .tour-bub[data-side="bottom"] .tour-arrow{top:-8px;border-left:1px solid var(--line2);border-top:1px solid var(--line2)}
    .tour-bub[data-side="top"] .tour-arrow{bottom:-8px;border-right:1px solid var(--line2);border-bottom:1px solid var(--line2)}
    .tour-bub[data-side="none"] .tour-arrow{display:none}
    .tour-badge{transition:opacity .2s ease;position:absolute;left:14px;bottom:12px;font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.12em;
      text-transform:uppercase;color:var(--muted);background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:5px 9px}
    @media (prefers-reduced-motion:reduce){.tour,.tour-frame,.tour-spot,.tour-bub,.tour-prog i{transition:none}}`;
    document.head.appendChild(s);
  }

  /* the world the tour prices its example for, and that world's data centre */
  function where(){
    let home="Spriggan",dc=null;
    try{const s=JSON.parse(localStorage.getItem("gildesk:all:settings")||"null");
      if(s&&typeof s.home==="string"&&s.home)home=s.home;}catch(e){}
    let worlds=[];
    for(const r of HOME_TOPO)for(const d in r.dcs)if(r.dcs[d].indexOf(home)>=0){dc=d;worlds=r.dcs[d];}
    return {home,dc:dc||"Chaos",worlds:worlds.length?worlds:[home]};
  }
  /* The example page wears the Dashboard's real stylesheet and the row-button styles
     the shared modules inject at runtime, lifted from their sources, so it can't
     drift from the desk. */
  function pageHTML(){
    const dash=(BLOBS.all.match(/<style>([\s\S]*?)<\/style>/)||["",""])[1].replace("/*__UI_CSS__*/",()=>UI_CSS);
    const injected=[SHARED_SHOP,SHARED_LIST,SHARED_XW].map(src=>(src.match(/textContent\s*=\s*`([\s\S]*?)`/)||["",""])[1])
      .concat((SHARED_B.match(/DC_CSS\s*=\s*`([\s\S]*?)`/)||["",""])[1]).join("\n");
    return TOUR_MOCK
      .replace("/*__PAGE_CSS__*/",()=>dash+"\n"+injected)
      .replace("/*__UI_JS__*/",()=>UI_JS)
      .replace("/*__ICON_INDEX__*/",()=>JSON.stringify(ICON_INDEX))
      .replace("/*__RECIPE_INDEX__*/",()=>JSON.stringify(RECIPE_INDEX))
      .replace("/*__MOCK__*/null",()=>JSON.stringify(mock).replace(/</g,"\\u003c"));
  }

  function start(){
    if(root)return;
    css();
    mock=where();
    V={w:innerWidth,h:innerHeight};
    lastFocus=document.activeElement;
    root=document.createElement("div");
    root.className="tour";
    root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-label","Tour of the desk");
    root.innerHTML=`<iframe class="tour-frame" tabindex="-1" aria-hidden="true" title="Example page"></iframe>
      <div class="tour-spot off"></div>
      <div class="tour-badge">Example page · made-up prices</div>
      <div class="tour-bub" data-side="none"><span class="tour-arrow"></span>
        <div class="tour-top"><span class="tour-sec"></span><span class="tour-n"></span></div>
        <h3></h3><p></p>
        <div class="tour-prog"><i></i></div>
        <div class="tour-nav"><button type="button" class="tour-skip">Skip tour</button>
          <button type="button" class="tour-back">Back</button><button type="button" class="tour-next">Next</button></div>
      </div>`;
    document.body.appendChild(root);
    stage=root;frame=root.querySelector(".tour-frame");spot=root.querySelector(".tour-spot");bubble=root.querySelector(".tour-bub");
    frame.setAttribute("inert","");
    frame.style.width=V.w+"px";frame.style.height=V.h+"px";
    bubble.querySelector(".tour-skip").addEventListener("click",close);
    bubble.querySelector(".tour-back").addEventListener("click",()=>go(at-1));
    bubble.querySelector(".tour-next").addEventListener("click",()=>at>=STEPS.length-1?close():go(at+1));
    addEventListener("keydown",onKey,true);
    addEventListener("resize",onResize);
    frame.addEventListener("load",()=>{
      doc=frame.contentDocument;
      prepare();
      const ready=doc.fonts&&doc.fonts.ready?doc.fonts.ready:Promise.resolve();
      /* never hang on a font that doesn't arrive */
      Promise.race([ready,new Promise(r=>setTimeout(r,1500))]).then(()=>{
        if(!root)return;
        placeNotes();
        root.classList.add("on");
        go(0);
      });
    },{once:true});
    frame.srcdoc=pageHTML();
  }

  /* the tab bar comes from the shell as it is right now, list tabs and all */
  function prepare(){
    const de=doc.documentElement;
    de.setAttribute("data-side","open");
    /* the fold arrow is part of the side panel the tour lights up */
    const fold=doc.querySelector(".sidetoggle");
    if(fold)fold.setAttribute("data-t","side");
    const shellCss=[...document.querySelectorAll("style")].filter(s=>s.id!=="tourCss").map(s=>s.textContent).join("\n");
    const st=doc.createElement("style");st.textContent=shellCss;
    doc.head.insertBefore(st,doc.head.querySelector("style"));
    const bar=document.querySelector(".tabbar").cloneNode(true);
    /* ids stay: the search box is styled by its id, and nothing on the page shares one */
    bar.querySelectorAll("button,a,input").forEach(e=>e.setAttribute("tabindex","-1"));
    bar.querySelectorAll("input").forEach(e=>{e.value="";});
    bar.querySelectorAll(".tab[data-tab]").forEach(t=>t.setAttribute("aria-selected",String(t.dataset.tab==="all")));
    bar.querySelector(".tabs").setAttribute("data-t","tabs");
    bar.querySelector(".tabright").setAttribute("data-t","tabright");
    doc.body.insertBefore(bar,doc.body.firstChild);
    de.style.setProperty("--vh",V.h+"px");
    de.style.setProperty("--barh",bar.offsetHeight+"px");
  }
  function placeNotes(){
    const tabs=[...doc.querySelectorAll(".tabs .tab[data-tab]")];
    const barBottom=doc.querySelector(".tabbar").getBoundingClientRect().bottom;
    const NW=182;
    /* shown while they are placed, so each label's height can be measured */
    doc.body.classList.add("t-tabs");
    let listDone=false,bottom=barBottom;
    /* labels go left to right, each on the highest lane it fits without touching the
       one before, so a crowded or wrapped bar stacks them rather than overlapping */
    const lanes=[];
    tabs.filter(t=>{const isList=/^list/.test(t.dataset.tab);if(isList&&listDone)return false;if(isList)listDone=true;return true;})
      .map(t=>({t,r:t.getBoundingClientRect()})).sort((a,b)=>a.r.left-b.r.left).forEach(({t,r})=>{
      const isList=/^list/.test(t.dataset.tab);
      const cx=r.left+r.width/2,left=Math.max(6,Math.min(V.w-NW-6,cx-NW/2));
      let lane=lanes.findIndex(end=>end+8<=left);
      if(lane<0){lane=lanes.length;lanes.push(0);}
      lanes[lane]=left+NW;
      const top=barBottom+14+lane*76;
      const note=doc.createElement("div");
      note.className="tabnote";note.setAttribute("data-t","tabs");
      note.innerHTML="<b></b><span></span>";
      note.querySelector("b").textContent=isList?"Your lists":t.textContent.trim();
      note.querySelector("span").textContent=TAB_NOTES[isList?"list":t.dataset.tab]||"";
      note.style.left=left+"px";note.style.top=top+"px";
      const stem=doc.createElement("div");
      stem.className="tabstem";
      stem.style.left=cx+"px";stem.style.top=(r.bottom-4)+"px";stem.style.height=(top-r.bottom+4)+"px";
      doc.body.appendChild(stem);doc.body.appendChild(note);
      bottom=Math.max(bottom,top+note.offsetHeight);
    });
    /* a plain band behind the labels, so the page underneath doesn't read through */
    const band=doc.createElement("div");
    band.className="tabband";band.setAttribute("data-t","tabs");
    band.style.top=barBottom+"px";band.style.height=(bottom-barBottom+14)+"px";
    doc.body.appendChild(band);
    doc.body.classList.remove("t-tabs");
  }

  function onKey(e){
    if(!root)return;
    if(e.key==="Escape"){e.preventDefault();e.stopPropagation();close();}
    else if(e.key==="ArrowRight"){e.preventDefault();if(at<STEPS.length-1)go(at+1);}
    else if(e.key==="ArrowLeft"){e.preventDefault();if(at>0)go(at-1);}
    else if(e.key==="Tab"){
      /* keep focus inside the bubble */
      const f=[...bubble.querySelectorAll("button:not([hidden])")];
      const i=f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i+(e.shiftKey?-1:1)+f.length)%f.length].focus();
    }
  }
  let resizeQueued=0;
  function onResize(){cancelAnimationFrame(resizeQueued);resizeQueued=requestAnimationFrame(()=>{if(root&&doc)layout();});}

  function close(){
    if(!root)return;
    removeEventListener("keydown",onKey,true);
    removeEventListener("resize",onResize);
    const r=root;root=null;doc=null;
    r.classList.remove("on");
    setTimeout(()=>r.remove(),260);
    if(lastFocus&&lastFocus.focus)try{lastFocus.focus();}catch(e){}
  }

  function fill(s){return s.replace(/\{home\}/g,mock.home).replace(/\{dc\}/g,mock.dc);}
  function go(i){
    if(!root||!doc||i<0||i>=STEPS.length)return;
    at=i;
    const s=STEPS[i],state=s.state||{};
    doc.body.classList.toggle("t-tree",!!state.tree);
    doc.body.classList.toggle("t-shop",!!state.shop);
    doc.body.classList.toggle("t-tabs",!!state.tabs);
    /* the page is as tall as the screen or its content, whichever is more */
    pageH=Math.max(V.h,doc.body.scrollHeight);
    frame.style.height=pageH+"px";
    bubble.classList.remove("show");
    bubble.classList.toggle("wide",!s.spot);
    bubble.querySelector(".tour-sec").textContent=s.sec;
    bubble.querySelector(".tour-n").textContent=(i+1)+" / "+STEPS.length;
    bubble.querySelector("h3").textContent=s.title;
    bubble.querySelector("p").innerHTML=fill(s.body);
    bubble.querySelector(".tour-prog i").style.width=Math.round((i+1)/STEPS.length*100)+"%";
    bubble.querySelector(".tour-back").hidden=i===0;
    bubble.querySelector(".tour-next").textContent=s.next||"Next";
    layout();
    setTimeout(()=>{if(root&&at===i){bubble.classList.add("show");bubble.querySelector(".tour-next").focus({preventScroll:true});}},i===0?60:380);
  }

  /* the outline around every element carrying a data-t name, in page pixels */
  function rectOf(name,pad){
    let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
    for(const el of doc.querySelectorAll('[data-t~="'+name+'"]')){
      const r=el.getBoundingClientRect();
      if(!r.width||!r.height)continue;
      x1=Math.min(x1,r.left);y1=Math.min(y1,r.top);x2=Math.max(x2,r.right);y2=Math.max(y2,r.bottom);
    }
    if(x1===Infinity)return null;
    return {x:x1-pad,y:y1-pad,w:x2-x1+2*pad,h:y2-y1+2*pad};
  }
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

  function layout(){
    const s=STEPS[at],SW=innerWidth,SH=innerHeight;
    const bw=bubble.offsetWidth,bh=bubble.offsetHeight;
    const target=s.spot?rectOf(s.spot,6):null;
    if(!target){
      /* the whole page, a little back from the edges, with the bubble in the middle */
      const sc=Math.min((SW-2*M)/V.w,(SH-2*M)/V.h)*.92;
      move((SW-V.w*sc)/2,(SH-V.h*sc)/2,sc);
      Object.assign(spot.style,{left:SW/2+"px",top:SH/2+"px",width:"0px",height:"0px"});
      spot.classList.add("off");
      place(Math.round((SW-bw)/2),Math.round((SH-bh)/2),"none");
      root.querySelector(".tour-badge").style.opacity="";
      return;
    }
    spot.classList.remove("off");
    const focus=(s.focus&&rectOf(s.focus,22))||{x:target.x-16,y:target.y-16,w:target.w+32,h:target.h+32};
    const order=[s.side||"right"].concat(["right","bottom","left","top"].filter(x=>x!==s.side));
    let chosen=null;
    for(const side of order){
      const A={x:M,y:M,w:SW-2*M,h:SH-2*M};
      if(side==="right")A.w-=bw+GAP;
      if(side==="left"){A.x+=bw+GAP;A.w-=bw+GAP;}
      if(side==="bottom")A.h-=bh+GAP;
      if(side==="top"){A.y+=bh+GAP;A.h-=bh+GAP;}
      if(A.w<160||A.h<100)continue;
      /* the example is the size of the window, so it is never shown smaller than
         life; a part bigger than the room left for it lines up from its top or left */
      const sc=Math.max(1,Math.min(A.w/focus.w,A.h/focus.h,s.zoom||1.25));
      let tx=focus.w*sc>A.w?A.x-focus.x*sc:A.x+A.w/2-(focus.x+focus.w/2)*sc;
      let ty=focus.h*sc>A.h?A.y-focus.y*sc:A.y+A.h/2-(focus.y+focus.h/2)*sc;
      /* keep the page filling the screen rather than sliding off to show a gap,
         and when it is smaller than the screen, keep it on it */
      const pw=V.w*sc,ph=pageH*sc;
      tx=pw>=SW?clamp(tx,SW-pw,0):clamp(tx,0,SW-pw);
      ty=ph>=SH?clamp(ty,SH-ph,0):clamp(ty,0,SH-ph);
      /* the lit part as drawn, kept just inside the screen so its outline shows on
         every side, even for something that runs edge to edge like the tab bar */
      const E=3,sx1=Math.max(E,tx+target.x*sc),sy1=Math.max(E,ty+target.y*sc);
      const sx2=Math.min(SW-E,tx+(target.x+target.w)*sc),sy2=Math.min(SH-E,ty+(target.y+target.h)*sc);
      const S={x:sx1,y:sy1,w:Math.max(0,sx2-sx1),h:Math.max(0,sy2-sy1)};
      let bx,by,fits;
      if(side==="right"){bx=S.x+S.w+GAP;by=S.y+S.h/2-bh/2;fits=bx+bw<=SW-M;}
      else if(side==="left"){bx=S.x-GAP-bw;by=S.y+S.h/2-bh/2;fits=bx>=M;}
      else if(side==="bottom"){by=S.y+S.h+GAP;bx=S.x+S.w/2-bw/2;fits=by+bh<=SH-M;}
      else{by=S.y-GAP-bh;bx=S.x+S.w/2-bw/2;fits=by>=M;}
      bx=clamp(bx,M,SW-M-bw);by=clamp(by,M,SH-M-bh);
      const c={side,tx,ty,sc,S,bx,by};
      if(fits){chosen=c;break;}
      if(!chosen)chosen=c;
    }
    if(!chosen)return;
    const {S}=chosen;
    move(chosen.tx,chosen.ty,chosen.sc);
    Object.assign(spot.style,{left:S.x+"px",top:S.y+"px",width:S.w+"px",height:S.h+"px"});
    place(Math.round(chosen.bx),Math.round(chosen.by),chosen.side);
    /* the corner tag steps aside for anything it would cover */
    const badge=root.querySelector(".tour-badge").getBoundingClientRect();
    const hits=r=>r.x<badge.right&&r.x+r.w>badge.left&&r.y<badge.bottom&&r.y+r.h>badge.top;
    root.querySelector(".tour-badge").style.opacity=hits(S)||hits({x:chosen.bx,y:chosen.by,w:bw,h:bh})?"0":"";
    /* the arrow points at the middle of the lit part, as near as the bubble allows */
    const a=bubble.querySelector(".tour-arrow");
    if(chosen.side==="right"||chosen.side==="left"){a.style.top=clamp(S.y+S.h/2-chosen.by-7,14,bh-28)+"px";a.style.left="";}
    else{a.style.left=clamp(S.x+S.w/2-chosen.bx-7,14,bw-28)+"px";a.style.top="";}
  }
  function move(tx,ty,sc){frame.style.transform="translate("+tx+"px,"+ty+"px) scale("+sc+")";}
  function place(x,y,side){bubble.style.left=x+"px";bubble.style.top=y+"px";bubble.dataset.side=side;}

  return {start,close};
})();
