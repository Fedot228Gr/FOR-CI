// Замеры TTK на 1-й волне (урон в упор, без движения) и проверка победы при идеальной игре
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
vm.runInContext(src + `;globalThis.__dbg=()=>({state,wave,hp:player.hp,maxHp:player.maxHp,enemies:enemies.length});`, ctxObj);
const dbg = () => vm.runInContext("__dbg()", ctxObj);

for (const id of ["easy","normal","hard","nightmare"]) {
  vm.runInContext(`setDifficulty('${id}')`, ctxObj);
  handlers["start-btn"].click();
  // ждём появления первого врага, ставим игрока вплотную к нему, не стреляем
  let t0=null, deadAt=null;
  for (let f=0; f<4000; f++) {
    simTime += 16;
    vm.runInContext(`(()=>{ if(enemies.length){ const e=enemies[0]; player.x=e.x+1; player.y=e.y; mouse.left=false; } })()`, ctxObj);
    rafCb(simTime);
    const d = dbg();
    if (d.state !== "playing") { deadAt = simTime; break; }
  }
  const total = deadAt ? (deadAt - 3000)/1000 : ">64s";
  console.log(`${id.padEnd(10)} TTK стояния в упор ≈ ${total}s`);
}

// Идеальная игра (aimbot + полное уклонение через телепорт от врагов) — должна побеждать везде
for (const id of ["easy","normal","hard","nightmare"]) {
  vm.runInContext(`setDifficulty('${id}')`, ctxObj);
  handlers["start-btn"].click();
  let res = "TIMEOUT";
  for (let c=0; c<240; c++) {
    for (let f=0; f<60; f++) {
      simTime += 16;
      vm.runInContext(`(()=>{
        if(!enemies.length){mouse.left=false;return;}
        let best=null,bd=1e9,cx=0,cy=0;
        for(const e of enemies){const d=Math.hypot(e.x-player.x,e.y-player.y);if(d<bd){bd=d;best=e;}cx+=e.x;cy+=e.y;}
        mouse.x=best.x;mouse.y=best.y;mouse.left=true;
        cx/=enemies.length;cy/=enemies.length;
        // агрессивное уклонение: держим дистанцию 150px от ближайшего
        const away=Math.atan2(player.y-best.y,player.x-best.x);
        keys.KeyD=Math.cos(away)>0.3;keys.KeyA=Math.cos(away)<-0.3;
        keys.KeyS=Math.sin(away)>0.3;keys.KeyW=Math.sin(away)<-0.3;
        if(bd<80){player.x+=Math.cos(away)*6;player.y+=Math.sin(away)*6;}
      })()`, ctxObj);
      rafCb(simTime);
    }
    if (dbg().state !== "playing") { res = dbg().state; break; }
  }
  console.log(`${id.padEnd(10)} ideal dodging player -> ${res}`);
}
