// Полная симуляция: «идеальный игрок» (стреляет во всех врагов) и «пассивный игрок»
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
  querySelectorAll(sel) { // возвращаем список кнопок сложности со своими обработчиками
    if (sel === ".diff-btn") return ["easy","normal","hard","nightmare"].map(id => ({
      dataset: { diff: id }, classList: { toggle(){} },
      _fn: null, addEventListener(ev, fn) { this._fn = fn; },
    }));
    return [];
  },
};
global.addEventListener = (ev, fn) => { (handlers.window ||= {})[ev] = fn; };
let simTime = 0, rafCb = null;
global.requestAnimationFrame = cb => { rafCb = cb; };
global.performance = { now: () => simTime };

const src = require("fs").readFileSync("./game.js", "utf8");
// Загружаем код в общую область видимости, чтобы иметь доступ к внутренним переменным
const vm = require("vm");
const ctxObj = { document: global.document, addEventListener: global.addEventListener,
  requestAnimationFrame: global.requestAnimationFrame, performance: global.performance,
  Math, console, Proxy, Object, Array, JSON };
vm.createContext(ctxObj);
// добавляем экспорт внутренних переменных для анализа
vm.runInContext(src + "\n;globalThis.__dbg = () => ({state, wave, score, hp: player.hp, enemies: enemies.length, kills});", ctxObj);

const dbg = () => vm.runInContext("__dbg()", ctxObj);
const clickStart = () => vm.runInContext(`(() => { for (const b of document.querySelectorAll('.diff-btn')) if (b.dataset.diff==='__X__') b._fn(); })()`, ctxObj);

function frames(n, shooter) {
  for (let i = 0; i < n; i++) {
    simTime += 16;
    if (shooter) {
      // авто-наводка: ставим мышь на первого врага и стреляем
      const e = vm.runInContext("enemies[0]", ctxObj);
      if (e) vm.runInContext(`mouse.x=${e.x}; mouse.y=${e.y}; mouse.down=true;`, ctxObj);
      else vm.runInContext("mouse.down=false;", ctxObj);
    }
    rafCb(simTime);
  }
}

for (const id of ["easy", "normal", "hard", "nightmare"]) {
  vm.runInContext(`setDifficulty('${id}')`, ctxObj);
  handlers["start-btn"].click();
  let outcome = "TIMEOUT";
  for (let chunk = 0; chunk < 120; chunk++) {   // до ~2 мин игрового времени
    frames(60, true);
    const s = dbg().state;
    if (s !== "playing") { outcome = s; break; }
  }
  const d = dbg();
  console.log(`${id.padEnd(9)} skilled player -> ${outcome.padEnd(8)} wave=${d.wave} kills=${d.kills} score=${d.score}`);
}

// Пассивный игрок на лёгкой — обязан умереть (не бессмертный)
vm.runInContext(`setDifficulty('easy')`, ctxObj);
handlers["start-btn"].click();
vm.runInContext("mouse.down=false;", ctxObj);
let passive = "still alive";
for (let i = 0; i < 400 && dbg().state === "playing"; i++) frames(15, false);
console.log("passive player on easy ->", dbg().state);
