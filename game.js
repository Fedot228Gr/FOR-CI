"use strict";

/* =====================================================================
   СИСТЕМА СЛОЖНОСТИ — 4 варианта
   =====================================================================
   Проблема старой версии: один жёсткий профиль на всех — быстрые и
   живучие враги, редкие аптечки, отсутствие «прощения» при получении
   урона. Пройти игру было практически невозможно.

   Решение: все ключевые параметры вынесены в объект DIFFICULTY.
   Варианты (выбираются в меню или кнопками 1–4 во время игры):

   1) "easy"     — Лёгкая: для знакомства с игрой.
   2) "normal"   — Нормальная: сбалансированный опыт (по умолчанию).
   3) "hard"     — Сложная: для опытных игроков.
   4) "nightmare"— Кошмар: хардкор, почти без права на ошибку.

   Что регулируется профилем:
   - hpPlayerMult / speedPlayerMult — здоровье и скорость игрока;
   - hpEnemyMult / speedEnemyMult / dmgEnemyMult — характеристики врагов;
   - spawnMultiplier / maxEnemiesOnScreen — плотность волн;
   - firstWaveDelay / breakBetweenWaves — темп и время на передышку;
   - medkitDropChance / ammoDropChance / medkitHeal — щедрость лута;
   - iFramesMs — кадры неуязвимости после получения урона;
   - regenPerSecond — фоновая регенерация (если игрок не получает урон);
   - scoreMultiplier — множитель очков за убийство;
   - bossExtraPhases — дополнительные фазы босса (только на кошмаре);
   - enemyShoots — стреляют ли простые враги (кошмар);
   - friendlyProjectilesSize — размер хитбокса пуль игрока (легко/норм.).

   Встроенная «помощь новичку» (лёгкая/нормальная — включён aimAssist):
   - щедрый хитбокс: увеличенный радиус пуль + допуск на «почти-попадания»;
   - авто-прицел: подсветка ближайшего врага;
   - второй шанс: на лёгкой сложности первая смерть откатывает волну,
     вместо мгновенного Game Over.

   Ключевые фиксы против «непроходимости»:
   - масштабирование волн имеет потолок к финальной волне (раньше росло
     бесконечно и уже к 8-й волне TTK врагов был меньше секунды);
   - игрок теперь быстрее всех типов врагов на любой сложности;
   - после атаки враг «выдыхает» и отпряняет (enemyRecoilMs) — окно,
     чтобы уйти; раньше касание снимало HP каждый кадр без паузы;
   - победа достижима: 10 волн и 2 босса.
   ===================================================================== */

const VICTORY_WAVE = 10; // победа после успешного прохождения 10-й волны (2 босса)

const DIFFICULTY = {
  easy: {
    id: "easy", name: "Лёгкая", desc: "Для знакомства с игрой",
    hpPlayerMult: 1.5, speedPlayerMult: 1.3,
    hpEnemyMult: 0.65, speedEnemyMult: 0.7, dmgEnemyMult: 0.6,
    spawnMultiplier: 0.6, maxEnemiesOnScreen: 8,
    firstWaveDelay: 4000, breakBetweenWaves: 6000,
    medkitDropChance: 0.35, ammoDropChance: 0.35, medkitHeal: 60,
    iFramesMs: 1200, regenPerSecond: 2, scoreMultiplier: 0.8,
    bossExtraPhases: 0, enemyShoots: false, friendlyProjectilesSize: 1.4,
    enemyRecoilMs: 900, secondChance: true, aimAssist: true,
  },
  normal: {
    id: "normal", name: "Нормальная", desc: "Сбалансированный опыт",
    hpPlayerMult: 1.0, speedPlayerMult: 1.15,
    hpEnemyMult: 1.0, speedEnemyMult: 0.9, dmgEnemyMult: 1.0,
    spawnMultiplier: 1.0, maxEnemiesOnScreen: 12,
    firstWaveDelay: 3000, breakBetweenWaves: 4500,
    medkitDropChance: 0.2, ammoDropChance: 0.25, medkitHeal: 40,
    iFramesMs: 900, regenPerSecond: 0, scoreMultiplier: 1.0,
    bossExtraPhases: 0, enemyShoots: false, friendlyProjectilesSize: 1.15,
    enemyRecoilMs: 700, secondChance: false, aimAssist: true,
  },
  hard: {
    id: "hard", name: "Сложная", desc: "Для опытных игроков",
    hpPlayerMult: 0.8, speedPlayerMult: 1.05,
    hpEnemyMult: 1.3, speedEnemyMult: 1.0, dmgEnemyMult: 1.3,
    spawnMultiplier: 1.25, maxEnemiesOnScreen: 14,
    firstWaveDelay: 2000, breakBetweenWaves: 3000,
    medkitDropChance: 0.16, ammoDropChance: 0.2, medkitHeal: 35,
    iFramesMs: 700, regenPerSecond: 0, scoreMultiplier: 1.5,
    bossExtraPhases: 0, enemyShoots: false, friendlyProjectilesSize: 1.0,
    enemyRecoilMs: 500, secondChance: false, aimAssist: false,
  },
  nightmare: {
    id: "nightmare", name: "Кошмар", desc: "Хардкор. Почти без права на ошибку",
    hpPlayerMult: 0.7, speedPlayerMult: 1.0,
    hpEnemyMult: 1.6, speedEnemyMult: 1.15, dmgEnemyMult: 1.7,
    spawnMultiplier: 1.6, maxEnemiesOnScreen: 20,
    firstWaveDelay: 1500, breakBetweenWaves: 2000,
    medkitDropChance: 0.1, ammoDropChance: 0.15, medkitHeal: 25,
    iFramesMs: 400, regenPerSecond: 0, scoreMultiplier: 2.5,
    bossExtraPhases: 1, enemyShoots: true, friendlyProjectilesSize: 1.0,
    enemyRecoilMs: 400, secondChance: false, aimAssist: false,
  },
};

// Масштабирование волны: чем дальше — тем сильнее враги.
// Потолок растёт только до финальной (VICTORY_WAVE) волны, чтобы игра была проходима.
function waveScaling(wave) {
  const t = Math.min(1, (wave - 1) / VICTORY_WAVE); // 0..1 по ходу прогресса
  return {
    hp:   1 + 0.6 * t,   // максимум ×1.6 к финалу (было без потолка ×2.35+)
    dmg:  1 + 0.4 * t,   // максимум ×1.4
    spd:  1 + 0.25 * t,  // максимум ×1.25 — игрок при этом быстрее всех врагов
  };
}

/* ------------------------------ ЯДРО --------------------------------- */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

const keys = {};
let state = "menu";            // menu | playing | gameover | victory
let diff = DIFFICULTY.normal;  // текущий профиль сложности
let selectedDiffId = "normal"; // выбор в меню

addEventListener("keydown", e => {
  keys[e.code] = true;
  if (state === "playing") {
    const map = { Digit1: "easy", Digit2: "normal", Digit3: "hard", Digit4: "nightmare" };
    if (map[e.code]) setDifficulty(map[e.code], true);
  }
});
addEventListener("keyup", e => { keys[e.code] = false; });

function setDifficulty(id, live) {
  if (!DIFFICULTY[id]) return;
  diff = DIFFICULTY[id];
  selectedDiffId = id;
  document.querySelectorAll(".diff-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.diff === id));
  if (live && state === "playing") applyDifficultyToEntities();
  updateDiffInfo();
}

function updateDiffInfo() {
  const el = document.getElementById("diff-info");
  if (el) el.textContent = `${diff.name}: ${diff.desc}`;
}

// Приведение текущих характеристик к новому профилю (при смене «на лету»)
function applyDifficultyToEntities() {
  player.maxHp = Math.round(player.baseMaxHp * diff.hpPlayerMult);
  player.hp = Math.min(player.hp, player.maxHp);
  enemies.forEach(e => {
    e.maxHp = Math.round(e.baseMaxHp); // база уже пересчитана при спавне
  });
}

/* ---------------------------- ИГРОК ---------------------------------- */

const PLAYER_BASE = { hp: 120, speed: 3.2, fireRate: 160, dmg: 18, magSize: 24 };

const player = {
  x: W / 2, y: H / 2, r: 14,
  baseMaxHp: PLAYER_BASE.hp,
  maxHp: PLAYER_BASE.hp, hp: PLAYER_BASE.hp,
  speed: PLAYER_BASE.speed,
  angle: 0, lastShot: 0, ammo: PLAYER_BASE.magSize, reloading: 0,
  iFramesUntil: 0, lastDamageAt: 0,
  usedSecondChance: false, checkpoint: null,
};

/* --------------------------- СУЩНОСТИ -------------------------------- */

let enemies = [], bullets = [], pickups = [], particles = [];
let wave = 0, waveTimer = 0, spawning = false, kills = 0, score = 0;
let bossWave = 5; // босс каждые 5 волн; победа — после босса 2-го цикла

const ENEMY_TYPES = {
  grunt:  { hp: 30,  speed: 1.4, dmg: 10, r: 12, color: "#e05a5a" },
  runner: { hp: 18,  speed: 2.6, dmg: 7,  r: 9,  color: "#e0a94b" },
  tank:   { hp: 90,  speed: 0.8, dmg: 18, r: 18, color: "#8e44ad" },
  boss:   { hp: 420, speed: 1.0, dmg: 25, r: 30, color: "#c0392b" },
};

function spawnEnemy(type) {
  const t = ENEMY_TYPES[type];
  const s = waveScaling(wave);
  const side = (Math.random() * 4) | 0;
  const x = side === 0 ? -20 : side === 1 ? W + 20 : Math.random() * W;
  const y = side === 2 ? -20 : side === 3 ? H + 20 : Math.random() * H;
  const e = {
    type, x, y, r: t.r,
    baseMaxHp: Math.round(t.hp * s.hp * diff.hpEnemyMult),
    hp: 0, maxHp: 0,
    speed: t.speed * s.spd * diff.speedEnemyMult,
    dmg: Math.round(t.dmg * s.dmg * diff.dmgEnemyMult),
    shootCd: 0, recoil: 0,
  };
  e.hp = e.maxHp = e.baseMaxHp;
  enemies.push(e);
}

function startWave() {
  wave++;
  spawning = true;
  waveTimer = 0;
  // Чекпоинт перед каждой волной (для «второго шанса» на лёгкой)
  player.checkpoint = { wave, hp: player.maxHp, ammo: PLAYER_BASE.magSize };
  if (wave % bossWave === 0) spawnEnemy("boss");
}

function updateSpawning(dt) {
  if (!spawning) return;
  waveTimer += dt;
  const isBoss = wave % bossWave === 0;
  const quota = isBoss
    ? Math.round((3 + wave) * diff.spawnMultiplier * 0.5)
    : Math.round((2 + wave * 2) * diff.spawnMultiplier);
  if (waveSpawned < quota &&
      enemies.length < diff.maxEnemiesOnScreen &&
      waveTimer > (isBoss ? 1500 : 900)) {
    waveTimer = 0;
    waveSpawned++;
    const roll = Math.random();
    const type = roll < 0.55 ? "grunt" : roll < 0.85 ? "runner" : "tank";
    spawnEnemy(type);
  }
  // волна завершена: все заспавнены и уничтожены (босс тоже должен быть убит)
  if (waveSpawned >= quota && enemies.length === 0) {
    spawning = false;
    waveCooldown = diff.breakBetweenWaves;
    if (wave === VICTORY_WAVE) state = "victory";
    else flashMessage(`Волна ${wave} пройдена!`);
  }
}
let waveSpawned = 0, waveCooldown = 0;

/* -------------------------- БОИ И УРОН ------------------------------- */

function damagePlayer(amount) {
  const now = performance.now();
  if (now < player.iFramesUntil) return false;     // кадры неуязвимости — урон мимо
  player.hp -= amount;
  player.iFramesUntil = now + diff.iFramesMs;
  player.lastDamageAt = now;
  shake = 8;
  if (player.hp <= 0) {
    if (diff.secondChance && !player.usedSecondChance && player.checkpoint) {
      // «Второй шанс»: откат к началу волны вместо Game Over
      player.usedSecondChance = true;
      player.hp = Math.round(player.checkpoint.hp * 0.6);
      player.ammo = PLAYER_BASE.magSize;
      enemies.length = 0;
      waveCooldown = diff.breakBetweenWaves;
      flashMessage("ВТОРОЙ ШАНС! Берегите здоровье!");
      return;
    }
    state = "gameover";
  }
  return true;
}

function killEnemy(e) {
  enemies.splice(enemies.indexOf(e), 1);
  kills++;
  score += Math.round(e.baseMaxHp * diff.scoreMultiplier);
  burst(e.x, e.y, e.color || "#fff", 12);
  // Дроп лута по вероятностям профиля
  const roll = Math.random();
  if (roll < diff.medkitDropChance)
    pickups.push({ kind: "med", x: e.x, y: e.y, r: 10 });
  else if (roll < diff.medkitDropChance + diff.ammoDropChance)
    pickups.push({ kind: "ammo", x: e.x, y: e.y, r: 10 });
}

/* ----------------------------- ЦИКЛ ---------------------------------- */

let shake = 0, msg = "", msgUntil = 0;
function flashMessage(text) { msg = text; msgUntil = performance.now() + 2500; }

function update(dt) {
  if (state !== "playing") return;

  // движение
  let dx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  let dy = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  if (dx || dy) {
    const l = Math.hypot(dx, dy);
    const sp = player.speed * diff.speedPlayerMult;
    player.x = Math.max(player.r, Math.min(W - player.r, player.x + dx / l * sp));
    player.y = Math.max(player.r, Math.min(H - player.r, player.y + dy / l * sp));
  }

  // регенерация (бонус лёгкой сложности, если давно не били)
  if (diff.regenPerSecond > 0 &&
      performance.now() - player.lastDamageAt > 6000 &&
      player.hp < player.maxHp) {
    player.hp = Math.min(player.maxHp, player.hp + diff.regenPerSecond * dt / 1000);
  }

  // стрельба: ЛКМ — очередь (зажать), ПКМ — одиночный точный выстрел
  const fireReady = performance.now() - player.lastShot > PLAYER_BASE.fireRate;
  if (player.ammo > 0 && ((mouse.left && fireReady) || (mouse.rightEdge && fireReady))) {
    mouse.rightEdge = false;   // ПКМ стреляет по одному на нажатие
    player.lastShot = performance.now();
    player.ammo--;
    bullets.push({ x: player.x, y: player.y,
                   vx: Math.cos(player.angle) * 9, vy: Math.sin(player.angle) * 9,
                   r: 4 * diff.friendlyProjectilesSize, dmg: PLAYER_BASE.dmg, life: 1200 });
  }
  if ((keys.KeyR || player.ammo === 0) && player.reloading === 0 && player.ammo < PLAYER_BASE.magSize)
    player.reloading = 1200;
  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) player.ammo = PLAYER_BASE.magSize;
  }

  // волны
  if (!spawning) {
    waveCooldown -= dt;
    if (waveCooldown <= 0) {
      if (wave >= VICTORY_WAVE) { state = "victory"; return; }
      startWave();
      waveSpawned = 0;
    }
  } else {
    updateSpawning(dt);
  }

  // враги
  for (const e of enemies) {
    const dist = Math.hypot(player.x - e.x, player.y - e.y);
    const a = Math.atan2(player.y - e.y, player.x - e.x);
    // «выдох» после атаки: отпрянуть на паузу — игрок получает окно для уклонения
    if (e.recoil > 0) {
      e.recoil -= dt;
      e.x -= Math.cos(a) * e.speed * 1.6;
      e.y -= Math.sin(a) * e.speed * 1.6;
    } else {
      e.x += Math.cos(a) * e.speed;
      e.y += Math.sin(a) * e.speed;
      if (dist < e.r + player.r + 4) {
        if (damagePlayer(e.dmg)) { e.recoil = diff.enemyRecoilMs; burst(e.x, e.y, "#ffdd88", 4); }
      }
    }
    // стрельба врагов — только на кошмаре
    if (diff.enemyShoots && (e.type === "runner" || e.type === "boss")) {
      e.shootCd -= dt;
      if (e.shootCd <= 0) {
        e.shootCd = 2200;
        enemyBullets.push({ x: e.x, y: e.y,
          vx: Math.cos(a) * 4.2, vy: Math.sin(a) * 4.2, r: 5, dmg: Math.round(e.dmg * 0.5), life: 3000 });
      }
    }
  }

  // пули игрока
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx; b.y += b.vy; b.life -= dt;
    let hit = false;
    for (const e of enemies) {
      // буфер ввода: увеличенный радиус засчитывает «почти-попадания»
      const grace = diff.aimAssist ? 4 : 0;
      if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.r + grace) {
        e.hp -= b.dmg; hit = true;
        if (e.hp <= 0) killEnemy(e);
        break;
      }
    }
    if (hit || b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20)
      bullets.splice(i, 1);
  }

  // пули врагов
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.x += b.vx; b.y += b.vy; b.life -= dt;
    if (Math.hypot(b.x - player.x, b.y - player.y) < player.r + b.r) {
      damagePlayer(b.dmg); enemyBullets.splice(i, 1); continue;
    }
    if (b.life <= 0) enemyBullets.splice(i, 1);
  }

  // подбор лута
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    if (Math.hypot(p.x - player.x, p.y - player.y) < p.r + player.r + 6) {
      if (p.kind === "med") player.hp = Math.min(player.maxHp, player.hp + diff.medkitHeal);
      else player.ammo = PLAYER_BASE.magSize;
      pickups.splice(i, 1);
    }
  }

  // частицы
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.x += pt.vx; pt.y += pt.vy; pt.life -= dt;
    if (pt.life <= 0) particles.splice(i, 1);
  }
  if (shake > 0) shake *= 0.85;
}
let enemyBullets = [];

function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 400, color });
  }
}

/* ----------------------------- РЕНДЕР -------------------------------- */

const mouse = { x: W / 2, y: H / 2, left: false, rightEdge: false };
canvas.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left; mouse.y = e.clientY - rect.top;
});
canvas.addEventListener("mousedown", e => {
  if (e.button === 0) mouse.left = true;
  if (e.button === 2) mouse.rightEdge = true;   // одиночный выстрел по нажатию ПКМ
});
canvas.addEventListener("contextmenu", e => e.preventDefault());
addEventListener("mouseup", e => { if (e.button === 0) mouse.left = false; });

function render() {
  ctx.save();
  if (shake > 0.5) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  ctx.fillStyle = "#111418"; ctx.fillRect(-10, -10, W + 20, H + 20);

  // лут
  for (const p of pickups) {
    ctx.fillStyle = p.kind === "med" ? "#2ecc71" : "#f1c40f";
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
  }
  // враги
  for (const e of enemies) {
    ctx.fillStyle = ENEMY_TYPES[e.type].color;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 7); ctx.fill();
    // полоска HP над врагом
    ctx.fillStyle = "#000"; ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2, 4);
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2 * (e.hp / e.maxHp), 4);
  }
  // авто-прицел: подсветка ближайшего врага (лёгкая/нормальная)
  if (diff.aimAssist && enemies.length) {
    let best = null, bd = 1e9;
    for (const e of enemies) {
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      ctx.strokeStyle = "rgba(46,204,113,.5)";
      ctx.beginPath(); ctx.arc(best.x, best.y, best.r + 6, 0, 7); ctx.stroke();
    }
  }
  // пули
  ctx.fillStyle = "#7fdcff";
  for (const b of bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); }
  ctx.fillStyle = "#ff8866";
  for (const b of enemyBullets) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); }
  // частицы
  for (const pt of particles) {
    ctx.globalAlpha = Math.max(0, pt.life / 400);
    ctx.fillStyle = pt.color; ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    ctx.globalAlpha = 1;
  }
  // игрок (мигает в i-frames)
  const inv = performance.now() < player.iFramesUntil;
  if (!inv || (performance.now() / 80 | 0) % 2 === 0) {
    ctx.fillStyle = "#4aa3ff";
    ctx.beginPath(); ctx.arc(player.x, player.y, player.r, 0, 7); ctx.fill();
    ctx.strokeStyle = "#bcdcff"; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + Math.cos(player.angle) * 22, player.y + Math.sin(player.angle) * 22);
    ctx.stroke();
  }
  ctx.restore();

  // HUD
  player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  drawHud();
}

function drawHud() {
  ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(10, 10, 240, 58);
  ctx.fillStyle = "#333"; ctx.fillRect(20, 20, 220, 14);
  ctx.fillStyle = player.hp / player.maxHp > 0.35 ? "#2ecc71" : "#e67e22";
  ctx.fillRect(20, 20, 220 * Math.max(0, player.hp / player.maxHp), 14);
  ctx.fillStyle = "#fff"; ctx.font = "13px monospace";
  ctx.fillText(`HP ${Math.ceil(player.hp)}/${player.maxHp}  Патроны: ` +
    (player.reloading > 0 ? "перезарядка…" : `${player.ammo}/${PLAYER_BASE.magSize}`), 20, 52);
  ctx.fillText(`Волна ${wave}  Счёт ${score}  (${diff.name})`, W - 240, 24);
  if (msg && performance.now() < msgUntil) {
    ctx.fillStyle = "#f1c40f"; ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center"; ctx.fillText(msg, W / 2, 90); ctx.textAlign = "left";
  }
}

/* --------------------------- ЗАПУСК ---------------------------------- */

function resetGame() {
  enemies = []; bullets = []; pickups = []; particles = []; enemyBullets = [];
  wave = 0; waveSpawned = 0; spawning = false;
  waveCooldown = diff.firstWaveDelay;
  kills = 0; score = 0; shake = 0;
  player.maxHp = Math.round(player.baseMaxHp * diff.hpPlayerMult);
  player.hp = player.maxHp;
  player.x = W / 2; player.y = H / 2;
  player.ammo = PLAYER_BASE.magSize; player.reloading = 0;
  player.iFramesUntil = 0; player.lastDamageAt = 0;
  player.usedSecondChance = false; player.checkpoint = null;
}

document.querySelectorAll(".diff-btn").forEach(b =>
  b.addEventListener("click", () => setDifficulty(b.dataset.diff)));
document.getElementById("start-btn").addEventListener("click", () => {
  resetGame(); state = "playing";
});
document.getElementById("restart-btn").addEventListener("click", () => {
  resetGame(); state = "playing";
  document.getElementById("overlay").style.display = "none";
});

let last = performance.now();
function loop(now) {
  const dt = Math.min(50, now - last); last = now;
  update(dt); render();
  if ((state === "gameover" || state === "victory") &&
      document.getElementById("overlay").style.display !== "flex") {
    const ov = document.getElementById("overlay");
    ov.style.display = "flex";
    document.getElementById("overlay-text").textContent =
      state === "victory" ? `ПОБЕДА! Счёт: ${score}` : `Игра окончена. Счёт: ${score}`;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
