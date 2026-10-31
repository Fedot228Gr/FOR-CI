// Симуляция «умного» игрока: отступает от врагов, стреляет в ближайшего (ЛКМ-очередь)
const handlers = {};
function makeEl(key) {
  return {
    width: 960, height: 600, style: { display: "none" }, textContent: "",
    classList: { toggle() {}, add() {} }, dataset: {},
    getContext: () => new Proxy({ canvas: {} }, { get: (t, p) => (p in t ? t[p] : () => {}), set: () => true }),
    addEventListener: (ev, fn) => { (handlers[key] ||= {})[ev] = fn; },
  };
}
const els = {};
global.document = {
  getElementById(id) { els[id] ||= makeEl(id); return els[id]; },
  querySelectorAll(sel) {
    if (sel === ".diff-btn") return ["easy","normal","hard","nightmare"].map(id => ({
      dataset: { diff: id }, classList: { toggle(){} }, _fn: null,
      addEventListener(ev, fn) { this._fn = fn; } }));
    return [];
  },
};
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
vm.runInContext(src + "\n;globalThis.__dbg = () => ({state, wave, score, hp: player.hp, kills});", ctxObj);
const dbg = () => vm.runInContext("__dbg()", ctxObj);

function smartFrames(n) {
  for (let i = 0; i < n; i++) {
    simTime += 16;
    // ИИ: прицел в ближайшего врага; движение — от центра масс врагов (к пустому краю)
    vm.runInContext(`(() => {
      if (!enemies.length) { mouse.left = false; return; }
      let best=null,bd=1e9,cx=0,cy=0;
      for (const e of enemies){ const d=Math.hypot(e.x-player.x,e.y-player.y);
        if(d<bd){bd=d;best=e;} cx+=e.x; cy+=e.y; }
      mouse.x=best.x; mouse.y=best.y; mouse.left=true;
      cx/=enemies.length; cy/=enemies.length;
      // вектор убегания — от врагов; преобразуем в WASD-подобное смещение через keys
      const ax=player.x-cx, ay=player.y-cy, l=Math.hypot(ax,ay)||1;
      keys.KeyD = ax/l>0.3; keys.KeyA = ax/l<-0.3;
      keys.KeyS = ay/l>0.3; keys.KeyW = ay/l<-0.3;
    })()`, ctxObj);
    rafCb(simTime);
  }
}

for (const id of ["easy","normal","hard","nightmare"]) {
  vm.runInContext(`setDifficulty('${id}')`, ctxObj);
  handlers["start-btn"].click();
  let outcome = "TIMEOUT(4min)", chunks = 0;
  while (dbg().state === "playing" && chunks < 240) { smartFrames(60); chunks++; }
  const d = dbg();
  outcome = d.state;
  console.log(`${id.padEnd(10)} smart player -> ${String(outcome).padEnd(10)} wave=${d.wave} kills=${d.kills} score=${d.score}`);
}
