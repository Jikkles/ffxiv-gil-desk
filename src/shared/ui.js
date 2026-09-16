/* ===== v21 shared UI runtime: theme + in-game item icons =====
   Injected into every tab and the shell, so both halves of the desk agree. */

/* ---- theme ----
   Stored once for the whole desk. The shell and every tab live on the same
   origin, so localStorage is the shared channel; postMessage covers the
   already-open iframes that would otherwise not hear about a change. */
const THEME_KEY="gildesk:theme:v1";
function readTheme(){
  try{const t=localStorage.getItem(THEME_KEY);if(t==="light"||t==="dark")return t;}catch(e){}
  return "dark";
}
function applyTheme(t){
  document.documentElement.setAttribute("data-theme",t==="light"?"light":"dark");
}
function setTheme(t){
  try{localStorage.setItem(THEME_KEY,t);}catch(e){}
  applyTheme(t);
  /* tell the shell and every sibling frame */
  try{
    const msg={gildesk:"theme",theme:t};
    if(window.parent&&window.parent!==window)window.parent.postMessage(msg,"*");
    for(const f of document.querySelectorAll("iframe")){try{f.contentWindow.postMessage(msg,"*");}catch(e){}}
  }catch(e){}
}
applyTheme(readTheme());
addEventListener("message",e=>{
  if(e.data&&e.data.gildesk==="theme"){
    applyTheme(e.data.theme);
    /* the shell relays a tab's change on to the other tabs */
    if(!(window.parent&&window.parent!==window)){
      for(const f of document.querySelectorAll("iframe")){try{f.contentWindow.postMessage(e.data,"*");}catch(err){}}
    }
  }
});
addEventListener("storage",e=>{if(e.key===THEME_KEY)applyTheme(readTheme());});
/* a toggle button, wherever a page wants to mount one */
function mountThemeToggle(el){
  if(!el)return;
  el.innerHTML='<button class="themebtn" type="button" title="Switch between the dark and light desk"><span class="ti"></span><span class="tl"></span></button>';
  const b=el.querySelector("button");
  const paint=()=>{
    const light=readTheme()==="light";
    b.querySelector(".ti").innerHTML=light?"<svg viewBox=\"0 0 20 20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"10\" cy=\"10\" r=\"3.8\"/><path d=\"M10 2v2M10 16v2M2 10h2M16 10h2M4.5 4.5l1.4 1.4M14.1 14.1l1.4 1.4M15.5 4.5l-1.4 1.4M5.9 14.1l-1.4 1.4\"/></svg>":"<svg viewBox=\"0 0 20 20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M16 12.3A6.8 6.8 0 0 1 7.7 4a7.2 7.2 0 1 0 8.3 8.3z\"/></svg>";
    b.querySelector(".tl").textContent=light?"Light":"Dark";
    b.setAttribute("aria-pressed",String(light));
  };
  b.addEventListener("click",()=>{setTheme(readTheme()==="light"?"dark":"light");paint();});
  addEventListener("storage",e=>{if(e.key===THEME_KEY)paint();});
  addEventListener("message",e=>{if(e.data&&e.data.gildesk==="theme")paint();});
  paint();
}

/* ---- sidebar ----
   Folded or not is one setting for the whole desk, kept and shared exactly the
   way the theme is: localStorage for tabs opened later, postMessage for the
   frames already on screen. The button is built here rather than in each tab's
   markup, so every tab that has a .side gets one without knowing about it. */
const SIDE_KEY="gildesk:sidebar:v1";
function readSide(){
  try{return localStorage.getItem(SIDE_KEY)==="collapsed";}catch(e){return false;}
}
function applySide(c){
  document.documentElement.setAttribute("data-side",c?"collapsed":"open");
}
function setSide(c){
  try{localStorage.setItem(SIDE_KEY,c?"collapsed":"open");}catch(e){}
  applySide(c);
  try{
    const msg={gildesk:"sidebar",collapsed:!!c};
    if(window.parent&&window.parent!==window)window.parent.postMessage(msg,"*");
    for(const f of document.querySelectorAll("iframe")){try{f.contentWindow.postMessage(msg,"*");}catch(e){}}
  }catch(e){}
}
applySide(readSide());
addEventListener("message",e=>{
  if(e.data&&e.data.gildesk==="sidebar"){
    applySide(e.data.collapsed);paintSideToggle();
    /* the shell relays a tab's change on to the other tabs */
    if(!(window.parent&&window.parent!==window)){
      for(const f of document.querySelectorAll("iframe")){try{f.contentWindow.postMessage(e.data,"*");}catch(err){}}
    }
  }
});
addEventListener("storage",e=>{if(e.key===SIDE_KEY){applySide(readSide());paintSideToggle();}});
function paintSideToggle(){
  const b=document.querySelector(".sidetoggle");if(!b)return;
  const c=readSide();
  b.setAttribute("aria-expanded",String(!c));
  b.title=c?"Show the filters panel":"Hide the filters panel";
  b.setAttribute("aria-label",b.title);
}
function mountSideToggle(){
  const side=document.querySelector(".side");
  if(!side||side.querySelector(".sidetoggle"))return;
  const b=document.createElement("button");
  b.type="button";b.className="sidetoggle";
  b.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.4 4.6 7 10l5.4 5.4"/></svg>';
  b.addEventListener("click",()=>{setSide(!readSide());paintSideToggle();});
  side.insertBefore(b,side.firstChild);
  paintSideToggle();
}
if(document.readyState==="loading")addEventListener("DOMContentLoaded",mountSideToggle);
else mountSideToggle();

/* ---- the craft simulator ----
   Teamcraft opens a craft at /simulator/<item id>/<recipe id>, and a recipe id
   cannot be worked out from an item id, so RECIPE_INDEX carries them: one line
   per craftable item, "item-id-delta recipe-id", both base36, same shape as
   ICON_INDEX below. Where the game has several recipes for one item - the same
   furnishing off two jobs, say - the lowest id is the one kept, so the link is
   always the same link. Decoded lazily, and the tabs that never show a craft do
   not carry the index at all, which is what the typeof guard is for. */
let __RECIPES=null;
function recipeMap(){
  if(__RECIPES)return __RECIPES;
  __RECIPES={};
  try{
    if(typeof RECIPE_INDEX!=="string")return __RECIPES;
    let id=0;
    for(const line of RECIPE_INDEX.split("\n")){
      const sp=line.indexOf(" ");if(sp<0)continue;
      id+=parseInt(line.slice(0,sp),36);
      __RECIPES[id]=parseInt(line.slice(sp+1),36);
    }
  }catch(e){}
  return __RECIPES;
}
function teamcraftUrl(itemId){
  const r=recipeMap()[itemId];
  return r==null?null:"https://ffxivteamcraft.com/simulator/"+itemId+"/"+r;
}
/* the markup for one simulator link, or nothing at all if the item is not
   something you craft; `cls` takes "sm" for the nested material rows */
function teamcraftHTML(itemId,cls){
  const u=teamcraftUrl(itemId);
  if(!u)return "";
  return '<a class="tcbtn'+(cls?" "+cls:"")+'" href="'+u+'" target="_blank" rel="noopener"'+
    ' title="Open this craft in the Teamcraft simulator" aria-label="Open in the Teamcraft simulator"></a>';
}

/* ---- in-game item icons ----
   ICON_INDEX is "id-delta icon-id", both base36, one item per line. Decoded
   lazily: a tab that never draws an icon never pays for the map. */
let __ICONS=null;
function iconMap(){
  if(__ICONS)return __ICONS;
  __ICONS={};
  try{
    let id=0;
    for(const line of ICON_INDEX.split("\n")){
      const sp=line.indexOf(" ");if(sp<0)continue;
      id+=parseInt(line.slice(0,sp),36);
      __ICONS[id]=parseInt(line.slice(sp+1),36);
    }
  }catch(e){}
  return __ICONS;
}
/* The classic CDN is a static file and fast, but it is missing a handful of
   the newest icons; beta renders them from the game files. Fall back once,
   then to a glyph, so a dead image never leaves a hole in the row. */
function iconFallback(img){
  const ic=img.getAttribute("data-icon");
  if(ic&&img.getAttribute("data-stage")!=="beta"){
    img.setAttribute("data-stage","beta");
    const folder=String(Math.floor(+ic/1000)*1000).padStart(6,"0");
    img.src="https://beta.xivapi.com/api/1/asset/ui/icon/"+folder+"/"+String(+ic).padStart(6,"0")+".tex?format=png";
    return;
  }
  const box=img.parentNode;
  if(box){img.remove();if(!box.querySelector(".fallback")){const s=document.createElement("span");s.className="fallback";s.textContent="◇";box.appendChild(s);}}
}
/* the markup for one item icon; kind only picks the placeholder glyph */
function iconHTML(itemId){
  const ic=iconMap()[itemId];
  if(ic==null)return '<span class="iconbox"><span class="fallback">◇</span></span>';
  const folder=String(Math.floor(ic/1000)*1000).padStart(6,"0");
  const url="https://xivapi.com/i/"+folder+"/"+String(ic).padStart(6,"0")+".png";
  return '<span class="iconbox"><img loading="lazy" decoding="async" alt="" data-icon="'+ic+'" src="'+url+'" onerror="iconFallback(this)"></span>';
}

/* ---- "How this works" ----
   A tab carries its explainer as <details class="howto" data-howto="key">. It is
   moved to sit straight under the headline cards, whatever else the tab puts
   there, and whether it was left open is remembered per tab (list tabs share one). */
function mountHowTo(){
  const box=document.querySelector("details.howto"),hero=document.querySelector(".hero");
  if(!box)return;
  if(hero&&hero.nextElementSibling!==box)hero.after(box);
  const key="gildesk:howto:"+(box.dataset.howto||"tab");
  try{if(localStorage.getItem(key)==="open")box.open=true;}catch(e){}
  box.addEventListener("toggle",()=>{try{localStorage.setItem(key,box.open?"open":"closed");}catch(e){}});
  /* Show me: the Dashboard hands over to the shell's full tour, any other tab
     with a <template class="guide"> walks its own page */
  const tpl=box.querySelector("template.guide"),tour=box.dataset.guide==="tour";
  if(!tpl&&!tour)return;
  const btn=document.createElement("button");
  btn.type="button";btn.className="hw-guide";
  btn.innerHTML='<span aria-hidden="true">▶</span> Show me';
  btn.title=tour?"Take the tour of the desk":"Walk through this tab, a step at a time";
  btn.addEventListener("click",e=>{
    e.preventDefault();e.stopPropagation();
    if(tour){try{window.parent.postMessage({gildesk:"tour"},"*");}catch(err){}return;}
    Guide.start(tpl);
  });
  box.querySelector(".hw-title").after(btn);
}

/* ---- a tab's own guide ----
   The same dim-and-spotlight as the desk tour, on the live page rather than an
   example: each step lights up real controls, scrolled into view, with a speech
   bubble beside them. A step is <div data-spot="css selectors" data-title="…"
   data-side="right|left|bottom|top">body</div>; every visible match of the
   selectors is lit together (a control is lit with its field), and a step with
   nothing on screen yet, rows before prices arrive say, is passed over. Steps are
   numbered against all of them, so the total holds steady while a table loads,
   except a step marked data-only, which only applies to some states of the page
   (a list's empty message, or its rows): that one counts only while it is showing. */
const Guide=(function(){
  let steps=[],at=0,root=null,spot,bub,sideWas=null,settle=0;
  const M=16,GAP=16;
  function targets(sel){
    let els=[];try{els=[...document.querySelectorAll(sel)];}catch(e){}
    return els.map(el=>el.closest(".field,.chk,.kpi")||el)
      .filter((el,i,a)=>a.indexOf(el)===i&&el.getClientRects().length&&!el.closest(".guide-root"));
  }
  function rectOf(els){
    let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
    for(const el of els){const r=el.getBoundingClientRect();if(!r.width&&!r.height)continue;
      x1=Math.min(x1,r.left);y1=Math.min(y1,r.top);x2=Math.max(x2,r.right);y2=Math.max(y2,r.bottom);}
    return x1===Infinity?null:{x:x1-6,y:y1-6,w:x2-x1+12,h:y2-y1+12};
  }
  function start(tpl){
    if(root)return;
    const h1=document.querySelector(".hero h1");
    const name=h1?h1.childNodes[0].textContent.trim():"This tab";
    steps=[...tpl.content.querySelectorAll("[data-spot]")].map(d=>({sel:d.dataset.spot,title:d.dataset.title||"",side:d.dataset.side||"",only:d.hasAttribute("data-only"),body:d.innerHTML,sec:name}));
    if(!steps.length)return;
    /* anything in a folded sidebar needs the sidebar out while the guide runs */
    const de=document.documentElement;
    sideWas=de.getAttribute("data-side");
    if(sideWas==="collapsed")de.setAttribute("data-side","open");
    root=document.createElement("div");
    root.className="guide-root";root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");
    root.setAttribute("aria-label",name+" guide");
    root.innerHTML='<div class="guide-spot"></div><div class="guide-bub"><span class="guide-arrow"></span>'+
      '<div class="guide-top"><span class="guide-sec"></span><span class="guide-n"></span></div><h3></h3><p></p>'+
      '<div class="guide-prog"><i></i></div><div class="guide-nav"><button type="button" class="guide-skip">Close</button>'+
      '<button type="button" class="guide-back">Back</button><button type="button" class="guide-next">Next</button></div></div>';
    document.body.appendChild(root);
    spot=root.querySelector(".guide-spot");bub=root.querySelector(".guide-bub");
    root.querySelector(".guide-skip").addEventListener("click",close);
    root.querySelector(".guide-back").addEventListener("click",()=>go(at-1,-1));
    root.querySelector(".guide-next").addEventListener("click",()=>go(at+1,1));
    addEventListener("keydown",onKey,true);
    addEventListener("resize",relayout);
    addEventListener("scroll",relayout,true);
    requestAnimationFrame(()=>root&&root.classList.add("on"));
    go(0,1);
  }
  function onKey(e){
    if(!root)return;
    if(e.key==="Escape"){e.preventDefault();e.stopPropagation();close();}
    else if(e.key==="ArrowRight"){e.preventDefault();go(at+1,1);}
    else if(e.key==="ArrowLeft"){e.preventDefault();go(at-1,-1);}
    else if(e.key==="Tab"){e.preventDefault();
      const f=[...bub.querySelectorAll("button:not([hidden])")],i=f.indexOf(document.activeElement);
      f[(i+(e.shiftKey?-1:1)+f.length)%f.length].focus();}
  }
  function close(){
    if(!root)return;
    clearInterval(settle);
    removeEventListener("keydown",onKey,true);removeEventListener("resize",relayout);removeEventListener("scroll",relayout,true);
    if(sideWas==="collapsed")document.documentElement.setAttribute("data-side","collapsed");
    const r=root;root=null;r.classList.remove("on");setTimeout(()=>r.remove(),220);
  }
  /* the last step with something on screen, so Next reads Finish there */
  function lastLive(){for(let i=steps.length-1;i>=0;i--)if(targets(steps[i].sel).length)return i;return -1;}
  function go(i,dir){
    if(!root)return;
    while(i>=0&&i<steps.length&&!targets(steps[i].sel).length)i+=dir;
    if(i>=steps.length){close();return;}
    if(i<0)return;
    at=i;
    /* counted against every step bar data-only ones not showing (see above) */
    const s=steps[i],first=steps.findIndex(x=>targets(x.sel).length);
    const counted=steps.map((x,j)=>j===i||!x.only||targets(x.sel).length>0);
    const n=counted.slice(0,i+1).filter(Boolean).length,total=counted.filter(Boolean).length;
    bub.classList.remove("show");
    bub.querySelector(".guide-sec").textContent=s.sec+" guide";
    bub.querySelector(".guide-n").textContent=n+" / "+total;
    bub.querySelector("h3").textContent=s.title;
    bub.querySelector("p").innerHTML=s.body;
    bub.querySelector(".guide-prog i").style.width=Math.round(n/total*100)+"%";
    bub.querySelector(".guide-back").hidden=i<=first;
    bub.querySelector(".guide-next").textContent=i>=lastLive()?"Finish":"Next";
    const els=targets(s.sel);
    els[0].scrollIntoView({block:"center",inline:"nearest",behavior:"smooth"});
    /* wait for the scroll to come to rest, then light it up */
    clearInterval(settle);
    let last="",still=0,tries=0;
    settle=setInterval(()=>{
      const r=rectOf(els),k=r?Math.round(r.x)+","+Math.round(r.y):"";
      still=k===last?still+1:0;last=k;
      if(still>=2||++tries>20){clearInterval(settle);if(!root||at!==i)return;layout();
        bub.classList.add("show");bub.querySelector(".guide-next").focus({preventScroll:true});}
      else if(tries===1)layout();
    },60);
  }
  let queued=0;
  function relayout(){cancelAnimationFrame(queued);queued=requestAnimationFrame(()=>{if(root)layout();});}
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  function layout(){
    const s=steps[at],r=rectOf(targets(s.sel));if(!r)return;
    const W=innerWidth,H=innerHeight,E=3;
    const x1=clamp(r.x,E,W-E),y1=clamp(r.y,E,H-E),x2=clamp(r.x+r.w,E,W-E),y2=clamp(r.y+r.h,E,H-E);
    const S={x:x1,y:y1,w:Math.max(0,x2-x1),h:Math.max(0,y2-y1)};
    Object.assign(spot.style,{left:S.x+"px",top:S.y+"px",width:S.w+"px",height:S.h+"px"});
    const bw=bub.offsetWidth,bh=bub.offsetHeight;
    const order=[s.side||"right"].concat(["right","bottom","left","top"].filter(x=>x!==s.side));
    let pick=null;
    for(const side of order){
      let bx,by,fits;
      if(side==="right"){bx=S.x+S.w+GAP;by=S.y+S.h/2-bh/2;fits=bx+bw<=W-M;}
      else if(side==="left"){bx=S.x-GAP-bw;by=S.y+S.h/2-bh/2;fits=bx>=M;}
      else if(side==="bottom"){by=S.y+S.h+GAP;bx=S.x+S.w/2-bw/2;fits=by+bh<=H-M;}
      else{by=S.y-GAP-bh;bx=S.x+S.w/2-bw/2;fits=by>=M;}
      const c={side,bx:clamp(bx,M,W-M-bw),by:clamp(by,M,H-M-bh)};
      if(fits){pick=c;break;}
      if(!pick)pick=c;
    }
    bub.style.left=Math.round(pick.bx)+"px";bub.style.top=Math.round(pick.by)+"px";bub.dataset.side=pick.side;
    const a=bub.querySelector(".guide-arrow");
    if(pick.side==="right"||pick.side==="left"){a.style.top=clamp(S.y+S.h/2-pick.by-7,14,bh-28)+"px";a.style.left="";}
    else{a.style.left=clamp(S.x+S.w/2-pick.bx-7,14,bw-28)+"px";a.style.top="";}
  }
  return {start,close};
})();
if(document.readyState==="loading")addEventListener("DOMContentLoaded",mountHowTo);
else mountHowTo();
