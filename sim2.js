const handlers = {};
function makeEl(key) {
  return { width: 960, height: 600, style: { display: "none" }, textContent: "",
    classList: { toggle(){}, add(){} }, dataset: {},
    getContext: () => new Proxy({ canvas: {} }, { get: (t,p)=> p in t ? t[p] : ()=>{}, set: ()=>true }),
    addEventListener: (ev, fn) => { (handlers[key] ||= {})[ev] = fn; } };
}
const els = {};
global.document = { getElementById(id){ els[id] ||= makeEl(id); return els[id]; },
  querySelectorAll(sel){ if (sel===".diff-btn") return ["easy","normal","hard","nightmare"].map(id=>({dataset:{diff:id},classList:{toggle(){}},_fn:null,addEventListener(e,f){this._fn=f}})); return []; } };
global.addEventListener = (ev, fn) => { (handlers.window ||= {})[ev] = fn; };
let simTime = 0, rafCb = null;
global.requestAnimationFrame = cb => { rafCb = cb; };
global.performance = { now: () => simTime };
const vm = require("vm");
const src = require("fs").readFileSync("./game.js", "utf8");
const ctxObj = { document: global.document, addEventListener: global.addEventListener,
  requestAnimationFrame: global.requestAnimationFrame, performance: global.performance,
  Math, console, Proxy, Object, Array, JSON };
vm.createContext(ctxObj);
vm.runInContext(src + ";globalThis.__dbg=()=>({state,wave,hp:player.hp});", ctxObj);
const dbg = () => vm.runInContext("__dbg()", ctxObj);

// «Стояние в упор» — сколько секунд до смерти (с учётом secondChance на easy)
for (const id of ["easy","normal","hard","nightmare"]) {
  vm.runInContext(`setDifficulty('${id}')`, ctxObj);
  handlers["start-btn"].click();
  let deadAt = null;
  for (let f=0; f<6000; f++) {
    simTime += 16;
    vm.runInContext(`(()=>{ if(enemies.length){ const e=enemies[0]; player.x=e.x+1; player.y=e.y; mouse.left=false; keys.KeyW=keys.KeyA=keys.KeyS=keys.KeyD=false; } })()`, ctxObj);
    rafCb(simTime);
    if (dbg().state !== "playing") { deadAt = simTime; break; }
  }
  console.log(`${id.padEnd(10)} AFK-вупор смерть ≈ ${deadAt?((deadAt-3000)/1000).toFixed(1):">96"} c`);
}
