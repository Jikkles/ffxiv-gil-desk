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
function iconUrl(itemId){
  const ic=iconMap()[itemId];
  if(ic==null)return null;
  const folder=String(Math.floor(ic/1000)*1000).padStart(6,"0");
  return "https://xivapi.com/i/"+folder+"/"+String(ic).padStart(6,"0")+".png";
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
}
if(document.readyState==="loading")addEventListener("DOMContentLoaded",mountHowTo);
else mountHowTo();
