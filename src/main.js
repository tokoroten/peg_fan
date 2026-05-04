import Phaser from 'phaser';
import './styles.css';

const WIDTH = 900;
const HEIGHT = 1300;
const TOTAL_LEVELS = 100;
const REWARD_COUNT = 100;
const SAVE_KEY = 'peg-fan-save-v1';
const EDITOR_SAVE_KEY = 'peg-fan-editor-v1';
const CANNON_X = WIDTH / 2;
const CANNON_Y = 168;
const LAUNCH_SPEED = 660;
const MATTER_LAUNCH_SPEED = 13.2;
const MIN_AIM_ANGLE = 0.28;
const MAX_AIM_ANGLE = Math.PI - 0.28;
const CHARACTER_ASSETS = [
  'assets/characters/character-1.svg',
  'assets/characters/character-2.svg',
  'assets/characters/character-3.svg',
  'assets/characters/character-4.svg',
  'assets/characters/character-5.svg',
];
const REWARD_ASSETS = Array.from({ length: REWARD_COUNT }, (_, index) => (
  index === 0 ? 'assets/premium/reward-premium-001.png' : `assets/rewards/reward-${String(index + 1).padStart(3, '0')}.svg`
));
const SOUND_ASSETS = {
  launch: 'assets/audio/launch.wav',
  peg: 'assets/audio/peg.wav',
  orange: 'assets/audio/orange.wav',
  green: 'assets/audio/green.wav',
  bumper: 'assets/audio/bumper.wav',
  catch: 'assets/audio/catch.wav',
  combo: 'assets/audio/combo.wav',
  clear: 'assets/audio/clear.wav',
  fail: 'assets/audio/fail.wav',
  reward: 'assets/audio/reward.wav',
};

const EDITOR_SHAPES = ['circle', 'spiral', 'bezier', 'wave', 'grid'];
const EDITOR_PARTS = ['mixed', 'pegs', 'bricks', 'rails', 'bumpers'];
const EDITOR_TYPES = ['auto', 'orange', 'blue', 'green', 'purple'];
const EDITOR_MODES = ['procedural', 'manual'];
const EDITOR_MANUAL_TOOLS = ['peg', 'brick', 'rail', 'bumper', 'erase'];
const EDITOR_GRID = 32;

const COLORS = {
  panel: 0x141b2a,
  panel2: 0x202a3d,
  text: '#f6f8fc',
  muted: '#aab5c8',
  gold: 0xffd35a,
  cyan: 0x34d3e5,
  orange: 0xff7a45,
  blue: 0x49a9ff,
  green: 0x52e391,
  purple: 0xc084fc,
  red: 0xff5178,
};

function loadSave() {
  const fallback = { unlockedLevel: 1, completedLevels: [], galleryUnlocked: 0, clearedAll: false };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') };
  } catch {
    return fallback;
  }
}

function saveProgress(save) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

function loadEditorState() {
  const fallback = {
    shape: 'circle',
    part: 'mixed',
    type: 'auto',
    count: 56,
    radius: 260,
    turns: 3,
    spread: 1,
    balls: 10,
    mode: 'procedural',
    manualTool: 'peg',
    manualObjects: [],
  };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(EDITOR_SAVE_KEY) || '{}') };
  } catch {
    return fallback;
  }
}

function saveEditorState(state) {
  localStorage.setItem(EDITOR_SAVE_KEY, JSON.stringify(state));
}

function clampEditorState(state) {
  return {
    ...state,
    count: Phaser.Math.Clamp(Math.round(state.count), 12, 140),
    radius: Phaser.Math.Clamp(Math.round(state.radius), 80, 380),
    turns: Phaser.Math.Clamp(Math.round(state.turns), 1, 8),
    spread: Phaser.Math.Clamp(Number(state.spread), 0.55, 1.45),
    balls: Phaser.Math.Clamp(Math.round(state.balls), 5, 18),
    mode: EDITOR_MODES.includes(state.mode) ? state.mode : 'procedural',
    manualTool: EDITOR_MANUAL_TOOLS.includes(state.manualTool) ? state.manualTool : 'peg',
    manualObjects: Array.isArray(state.manualObjects) ? state.manualObjects.slice(0, 240) : [],
  };
}

function seededRandom(seed) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function generateLevel(level) {
  const rand = seededRandom(level * 9749);
  const pegs = [];
  const bricks = [];
  const rails = [];
  const timedBlocks = [];
  const spinners = [];
  const bumpers = [];
  const archetype = (level - 1) % 8;
  const difficulty = Phaser.Math.Clamp(level / TOTAL_LEVELS, 0, 1);
  const density = 42 + Math.floor(difficulty * 42);
  const addPeg = (x, y, type = 'blue', motion = null) => {
    if (x > 72 && x < WIDTH - 72 && y > 270 && y < 1048) pegs.push({ x, y, type, motion });
  };
  const addRing = (cx, cy, rx, ry, count, offset = 0) => {
    for (let i = 0; i < count; i += 1) {
      const angle = offset + (i / count) * Math.PI * 2;
      addPeg(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry);
    }
  };
  const addSpiral = (cx, top, count, turns, maxRadius) => {
    for (let i = 0; i < count; i += 1) {
      const t = i / Math.max(1, count - 1);
      const angle = -Math.PI / 2 + t * turns * Math.PI * 2;
      const radius = 26 + maxRadius * t;
      addPeg(cx + Math.cos(angle) * radius, top + t * 610 + Math.sin(angle) * radius * 0.24);
    }
  };
  const addBezier = (p0, p1, p2, p3, count, phase = 0) => {
    for (let i = 0; i < count; i += 1) {
      const t = i / Math.max(1, count - 1);
      const u = 1 - t;
      const x = u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x;
      const y = u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y;
      addPeg(x + Math.sin(t * Math.PI * 8 + phase) * 20, y);
    }
  };
  const addWave = (y, count, amplitude, waves, phase = 0) => {
    for (let i = 0; i < count; i += 1) {
      const t = i / Math.max(1, count - 1);
      addPeg(92 + t * 716, y + Math.sin(t * Math.PI * 2 * waves + phase) * amplitude);
    }
  };

  if (archetype === 0) {
    addRing(450, 612, 248, 170, density, rand() * Math.PI);
    addRing(450, 612, 132, 92, Math.floor(density * 0.58), rand() * Math.PI);
    rails.push({ x: 450, y: 820, w: 250, h: 13, angle: 0 });
  } else if (archetype === 1) {
    addSpiral(450, 318, density + 10, 2.7 + difficulty * 2.5, 255);
    bricks.push({ x: 312, y: 760, w: 130, h: 18, angle: -0.58, type: 'blue' });
    bricks.push({ x: 588, y: 760, w: 130, h: 18, angle: 0.58, type: 'blue' });
  } else if (archetype === 2) {
    addBezier({ x: 98, y: 890 }, { x: 220, y: 310 }, { x: 685, y: 990 }, { x: 810, y: 365 }, density, level);
    addBezier({ x: 112, y: 370 }, { x: 280, y: 1010 }, { x: 626, y: 290 }, { x: 800, y: 890 }, Math.floor(density * 0.62), level * 0.7);
    spinners.push({ x: 450, y: 630, radius: 54, speed: 0.85 + difficulty * 0.7, phase: rand() * Math.PI * 2 });
  } else if (archetype === 3) {
    addWave(430, Math.floor(density * 0.5), 58, 2.5, rand() * Math.PI);
    addWave(620, Math.floor(density * 0.6), 74, 3.5, rand() * Math.PI);
    addWave(825, Math.floor(density * 0.48), 54, 2, rand() * Math.PI);
    timedBlocks.push({ x: 450, y: 710, w: 230, h: 22, phase: rand() * Math.PI * 2, period: 2600 });
  } else if (archetype === 4) {
    for (let row = 0; row < 9 + Math.floor(difficulty * 4); row += 1) {
      const cols = row % 2 ? 8 : 9;
      for (let col = 0; col < cols; col += 1) {
        if (rand() < 0.09) continue;
        addPeg(105 + col * 86 + (row % 2 ? 42 : 0), 330 + row * 58 + Math.sin(col + level) * 8);
      }
    }
    rails.push({ x: 270, y: 650, w: 190, h: 13, angle: -0.5 });
    rails.push({ x: 630, y: 650, w: 190, h: 13, angle: 0.5 });
  } else if (archetype === 5) {
    addRing(295, 560, 132, 188, Math.floor(density * 0.55), rand() * Math.PI);
    addRing(606, 650, 148, 210, Math.floor(density * 0.6), rand() * Math.PI);
    bumpers.push({ x: 450, y: 530, r: 34 }, { x: 450, y: 780, r: 30 });
    bricks.push({ x: 450, y: 655, w: 190, h: 18, angle: 0.2, type: 'orange' });
  } else if (archetype === 6) {
    addSpiral(300, 345, Math.floor(density * 0.68), 2.2 + difficulty * 1.4, 155);
    addSpiral(600, 345, Math.floor(density * 0.68), -2.2 - difficulty * 1.4, 155);
    rails.push({ x: 450, y: 875, w: 310, h: 13, angle: 0 });
    spinners.push({ x: 450, y: 615, radius: 68, speed: -1.1, phase: rand() * Math.PI * 2 });
  } else {
    addBezier({ x: 90, y: 340 }, { x: 300, y: 465 }, { x: 240, y: 880 }, { x: 450, y: 1010 }, Math.floor(density * 0.5), 0);
    addBezier({ x: 810, y: 340 }, { x: 600, y: 465 }, { x: 660, y: 880 }, { x: 450, y: 1010 }, Math.floor(density * 0.5), Math.PI);
    timedBlocks.push({ x: 450, y: 610, w: 260, h: 22, phase: rand() * Math.PI * 2, period: 2200 });
    bumpers.push({ x: 450, y: 760, r: 36 });
  }

  const extraBricks = level > 8 ? Math.min(10, 1 + Math.floor(level / 12)) : 0;
  for (let i = 0; i < extraBricks; i += 1) {
    const lane = i / Math.max(1, extraBricks - 1);
    bricks.push({
      x: 150 + lane * 600 + Math.sin(level + i) * 26,
      y: 392 + rand() * 520,
      w: 78 + rand() * 58,
      h: 18,
      angle: (rand() - 0.5) * 1.25,
      type: rand() < 0.3 ? 'orange' : rand() < 0.12 ? 'green' : 'blue',
    });
  }

  if (level > 18) {
    const railCount = Math.min(6, 1 + Math.floor(level / 18));
    for (let i = 0; i < railCount; i += 1) {
      rails.push({
        x: 170 + rand() * 560,
        y: 460 + rand() * 450,
        w: 124 + rand() * 72,
        h: 13,
        angle: (rand() - 0.5) * 1.7,
      });
    }
  }

  if (level > 24) {
    const blockCount = Math.min(5, 1 + Math.floor(level / 22));
    for (let i = 0; i < blockCount; i += 1) {
      timedBlocks.push({
        x: 170 + rand() * 560,
        y: 470 + rand() * 455,
        w: 92 + rand() * 88,
        h: 22,
        phase: rand() * Math.PI * 2,
        period: 2200 + rand() * 1600,
      });
    }
  }

  if (level > 34) {
    const spinnerCount = Math.min(4, 1 + Math.floor(level / 26));
    for (let i = 0; i < spinnerCount; i += 1) {
      spinners.push({
        x: 190 + rand() * 520,
        y: 430 + rand() * 450,
        radius: 42 + rand() * 34,
        speed: (rand() < 0.5 ? -1 : 1) * (0.7 + rand() * 0.9),
        phase: rand() * Math.PI * 2,
      });
    }
  }

  if (level > 12) {
    const bumperCount = Math.min(5, 1 + Math.floor(level / 22));
    for (let i = 0; i < bumperCount; i += 1) bumpers.push({ x: 150 + rand() * 600, y: 420 + rand() * 470, r: 24 + rand() * 14 });
  }

  const targetCount = Math.min(26, 8 + Math.floor(level / 5));
  const shuffled = [...pegs].sort(() => rand() - 0.5);
  shuffled.slice(0, targetCount).forEach((peg) => { peg.type = 'orange'; });
  shuffled.slice(targetCount, targetCount + 2 + Math.floor(level / 24)).forEach((peg) => { peg.type = 'green'; });
  shuffled.slice(targetCount + 4, targetCount + 7).forEach((peg) => { peg.type = 'purple'; });
  if (level > 14) {
    shuffled.slice(targetCount + 7, targetCount + 11 + Math.floor(level / 22)).forEach((peg, index) => {
      peg.motion = {
        axis: index % 2 ? 'y' : 'x',
        amplitude: 18 + rand() * 34,
        speed: 0.55 + rand() * 0.75,
        phase: rand() * Math.PI * 2,
      };
    });
  }
  const actualTargetCount = pegs.filter((peg) => peg.type === 'orange').length + bricks.filter((brick) => brick.type === 'orange').length;

  return {
    level,
    balls: Math.max(7, 11 - Math.floor(level / 20)),
    targetCount: actualTargetCount,
    pegs,
    bricks,
    rails,
    timedBlocks,
    spinners,
    bumpers,
    bucketSpeed: 130 + Math.min(135, level * 2.5),
    rewardIndex: Math.min(4, Math.floor((level - 1) / 20)),
  };
}

class PegFanScene extends Phaser.Scene {
  constructor() {
    super('PegFanScene');
    this.view = 'menu';
  }

  preload() {
    CHARACTER_ASSETS.forEach((path, index) => this.load.image(`character-${index + 1}`, path));
    REWARD_ASSETS.forEach((path, index) => this.load.image(`reward-${index + 1}`, path));
    Object.entries(SOUND_ASSETS).forEach(([key, path]) => this.load.audio(`sfx-${key}`, path));
  }

  create() {
    this.save = loadSave();
    this.matterBodies = [];
    this.input.setTopOnly(true);
    this.matter.world.setBounds(36, 0, WIDTH - 72, HEIGHT + 180, 64, true, true, true, false);
    this.matter.world.on('collisionstart', (event) => this.handleMatterCollision(event));
    this.input.keyboard?.on('keydown-SPACE', () => this.launchBall());
    this.input.keyboard?.on('keydown-ESC', () => this.showMenu());
    this.showMenu();
  }

  playSfx(key, config = {}) {
    try {
      this.sound.play(`sfx-${key}`, { volume: 0.72, ...config });
    } catch {
      // Browsers can block audio until the first trusted gesture; gameplay continues silently.
    }
  }

  clearScene() {
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.children.list.slice().forEach((child) => {
      child.disableInteractive?.();
      child.removeAllListeners?.();
    });
    this.matterBodies?.forEach((body) => {
      if (body) this.matter.world.remove(body, true);
    });
    this.matterBodies = [];
    this.balls?.clear(true, true);
    this.pegGroup?.clear(true, true);
    this.brickGroup?.clear(true, true);
    this.railGroup?.clear(true, true);
    this.timedBlockGroup?.clear(true, true);
    this.bumperGroup?.clear(true, true);
    this.spinnerNodeGroup?.clear(true, true);
    this.spinnerGraphics?.destroy();
    this.bucketVisual?.destroy(true);
    this.blockVisuals?.forEach((item) => item.destroy());
    this.resultOverlay?.destroy(true);
    this.rewardOverlay?.destroy(true);
    this.adOverlay?.destroy(true);
    this.children.removeAll(true);
    this.blockVisuals = [];
    this.balls = null;
    this.pegGroup = null;
    this.brickGroup = null;
    this.railGroup = null;
    this.timedBlockGroup = null;
    this.bumperGroup = null;
    this.spinnerNodeGroup = null;
    this.spinnerNodes = [];
    this.spinnerGraphics = null;
    this.bucketVisual = null;
    this.bucket = null;
    this.resultOverlay = null;
    this.rewardOverlay = null;
    this.adOverlay = null;
    this.trajectory = null;
    this.manualDragStart = null;
    this.manualDragLine = null;
  }

  addBackground(title = 'PEG FAN') {
    const g = this.add.graphics();
    g.fillGradientStyle(0x141b2a, 0x141b2a, 0x0b111b, 0x0b111b, 1);
    g.fillRect(0, 0, WIDTH, HEIGHT);
    g.fillStyle(0xffffff, 0.035);
    for (let i = 0; i < 22; i += 1) {
      g.fillCircle((i * 137) % WIDTH, 90 + ((i * 241) % 1080), 16 + (i % 5) * 10);
    }
    this.add.text(48, 42, title, {
      fontFamily: 'Verdana',
      fontSize: 50,
      fontStyle: '700',
      color: COLORS.text,
    });
  }

  button(x, y, w, h, label, onClick, opts = {}) {
    const fill = opts.disabled ? 0x2b3445 : opts.fill ?? COLORS.panel2;
    const rect = this.add.rectangle(x, y, w, h, fill, 0.96).setStrokeStyle(2, opts.stroke ?? 0x45526a);
    const text = this.add.text(x, y, label, {
      fontFamily: 'Verdana',
      fontSize: opts.size ?? 25,
      fontStyle: '700',
      color: opts.disabled ? '#778399' : '#f7f9ff',
      align: 'center',
    }).setOrigin(0.5);
    if (!opts.disabled) {
      rect.setInteractive({ useHandCursor: true })
        .on('pointerover', () => rect.setFillStyle(opts.hover ?? 0x2a3750))
        .on('pointerout', () => rect.setFillStyle(fill))
        .on('pointerdown', (pointer, localX, localY, event) => {
          event?.stopPropagation();
          onClick();
        });
      text.setInteractive({ useHandCursor: true }).on('pointerdown', (pointer, localX, localY, event) => {
        event?.stopPropagation();
        onClick();
      });
    }
    return { rect, text };
  }

  showMenu() {
    this.view = 'menu';
    this.clearScene();
    this.addBackground('PEG FAN');
    this.add.text(54, 124, '100 STAGE PEG PUZZLE', {
      fontFamily: 'Verdana',
      fontSize: 22,
      color: '#ffd35a',
      fontStyle: '700',
    });
    this.add.text(54, 178, '狙って撃ち、オレンジペグをすべて消す。\nステージクリアごとにご褒美イラストが1枚解放されます。', {
      fontFamily: 'Meiryo, Verdana',
      fontSize: 24,
      color: COLORS.muted,
      wordWrap: { width: 720 },
      lineSpacing: 8,
    });

    const startLevel = Math.min(this.save.unlockedLevel, TOTAL_LEVELS);
    this.button(220, 300, 330, 72, `LEVEL ${startLevel} から`, () => this.startLevel(startLevel), { fill: 0x2c6f84, stroke: 0x5eead4 });
    this.button(590, 300, 250, 72, 'ステージ選択', () => this.showLevelSelect());
    this.button(220, 398, 330, 72, 'ギャラリー', () => this.showGallery());
    this.button(590, 398, 250, 72, '最初から', () => this.startLevel(1), { fill: 0x4b3344 });
    this.button(450, 496, 620, 68, 'STAGE EDITOR', () => this.showStageEditor(), { fill: 0x334155, stroke: 0x93c5fd, size: 24 });
    this.button(450, 1085, 360, 46, 'DEBUG: 全解放', () => this.debugUnlockAll(), { fill: 0x2b3445, stroke: 0x64748b, size: 18 });

    this.addProgressPanel();
    this.add.text(54, 1160, '操作: マウス/タッチで照準、クリックで発射、Spaceでも発射、Escでメニュー', {
      fontFamily: 'Meiryo, Verdana',
      fontSize: 20,
      color: '#95a1b8',
    });
  }

  debugUnlockAll() {
    this.save.unlockedLevel = TOTAL_LEVELS;
    this.save.completedLevels = Array.from({ length: TOTAL_LEVELS }, (_, index) => index + 1);
    this.save.galleryUnlocked = REWARD_COUNT;
    this.save.clearedAll = true;
    saveProgress(this.save);
    this.showMenu();
  }

  addProgressPanel() {
    this.add.rectangle(450, 715, 792, 430, 0x111827, 0.9).setStrokeStyle(2, 0x2f3a4d);
    this.add.text(86, 534, 'PROGRESS', { fontFamily: 'Verdana', fontSize: 28, fontStyle: '700', color: COLORS.text });
    this.add.text(86, 590, `解放ステージ: ${this.save.unlockedLevel} / ${TOTAL_LEVELS}`, { fontFamily: 'Meiryo, Verdana', fontSize: 28, color: COLORS.text });
    this.add.text(86, 638, `閲覧可能イラスト: ${this.save.galleryUnlocked} / ${REWARD_COUNT}`, { fontFamily: 'Meiryo, Verdana', fontSize: 28, color: COLORS.text });
    const barX = 86;
    const barY = 710;
    this.add.rectangle(barX + 335, barY, 670, 28, 0x253044);
    this.add.rectangle(barX, barY, 670 * ((this.save.unlockedLevel - 1) / TOTAL_LEVELS), 28, COLORS.gold).setOrigin(0, 0.5);
    for (let i = 0; i < 5; i += 1) {
      const rewardIndex = Math.min(REWARD_COUNT - 1, Math.max(0, this.save.galleryUnlocked - 5 + i));
      const unlocked = rewardIndex < this.save.galleryUnlocked;
      this.add.image(162 + i * 145, 875, `reward-${rewardIndex + 1}`).setDisplaySize(104, 150).setAlpha(unlocked ? 1 : 0.25);
      this.add.text(112 + i * 145, 970, unlocked ? `L${rewardIndex + 1}` : `L${i + 1}`, {
        fontFamily: 'Verdana',
        fontSize: 18,
        fontStyle: '700',
        color: unlocked ? '#ffd35a' : '#69758c',
      });
    }
  }

  showLevelSelect() {
    this.view = 'select';
    this.clearScene();
    this.addBackground('STAGE SELECT');
    this.button(756, 72, 190, 52, '戻る', () => this.showMenu(), { size: 21 });
    for (let i = 1; i <= TOTAL_LEVELS; i += 1) {
      const col = (i - 1) % 10;
      const row = Math.floor((i - 1) / 10);
      const x = 83 + col * 82;
      const y = 180 + row * 88;
      const unlocked = i <= this.save.unlockedLevel;
      const completed = this.save.completedLevels.includes(i);
      this.button(x, y, 62, 58, `${i}`, () => this.startLevel(i), {
        disabled: !unlocked,
        fill: completed ? 0x63511d : 0x213047,
        stroke: completed ? COLORS.gold : 0x3f4a5d,
        size: 20,
      });
    }
  }

  showGallery() {
    this.view = 'gallery';
    this.clearScene();
    this.addBackground('GALLERY');
    this.button(756, 72, 190, 52, '戻る', () => this.showMenu(), { size: 21 });
    this.add.text(54, 124, '各ステージクリアで1枚解放。画像は public/assets/rewards の同名ファイル差し替えで更新できます。', {
      fontFamily: 'Meiryo, Verdana',
      fontSize: 21,
      color: COLORS.muted,
      wordWrap: { width: 790 },
    });
    for (let i = 0; i < REWARD_COUNT; i += 1) {
      const col = i % 10;
      const row = Math.floor(i / 10);
      const x = 82 + col * 82;
      const y = 205 + row * 96;
      const unlocked = i < this.save.galleryUnlocked || this.save.clearedAll;
      const tile = this.add.rectangle(x, y, 68, 86, 0x111827, 0.94).setStrokeStyle(2, unlocked ? COLORS.gold : 0x3b4658);
      this.add.image(x, y - 7, `reward-${i + 1}`).setDisplaySize(54, 78).setAlpha(unlocked ? 1 : 0.14);
      this.add.text(x, y + 45, `${i + 1}`, {
        fontFamily: 'Verdana',
        fontSize: 13,
        fontStyle: '700',
        color: unlocked ? '#ffd35a' : '#69758c',
      }).setOrigin(0.5);
      if (unlocked) {
        tile.setInteractive({ useHandCursor: true }).on('pointerdown', (pointer, localX, localY, event) => {
          event?.stopPropagation();
          this.showRewardViewer(i + 1, 'gallery');
        });
      }
    }
  }

  showRewardViewer(rewardNumber, returnTo = 'gallery') {
    this.view = 'reward';
    const overlay = this.add.container(0, 0).setDepth(80);
    this.rewardOverlay = overlay;
    overlay.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, 760, 1120, 0x070b12, 0.98).setStrokeStyle(2, COLORS.gold));
    overlay.add(this.add.text(WIDTH / 2, 96, `REWARD ${rewardNumber}`, {
      fontFamily: 'Verdana',
      fontSize: 44,
      fontStyle: '700',
      color: '#ffd35a',
    }).setOrigin(0.5));
    overlay.add(this.add.image(WIDTH / 2, 630, `reward-${rewardNumber}`).setDisplaySize(560, 809));
    const close = this.button(WIDTH / 2, 1188, 260, 58, returnTo === 'game' ? '続ける' : '閉じる', () => {
      overlay.destroy(true);
      if (returnTo === 'game') {
        this.view = 'result';
      } else {
        this.showGallery();
      }
    }, { fill: 0x4a3d21, stroke: COLORS.gold, size: 22 });
    overlay.add([close.rect, close.text]);
  }

  showStageEditor() {
    this.view = 'editor';
    this.clearScene();
    this.editorState = clampEditorState(this.editorState ?? loadEditorState());
    this.addBackground('STAGE EDITOR');
    this.button(756, 72, 190, 52, '戻る', () => this.showMenu(), { size: 21 });

    this.add.text(54, 118, this.editorState.mode === 'manual' ? 'MANUAL LAYOUT BUILDER' : 'PROCEDURAL LAYOUT BUILDER', {
      fontFamily: 'Verdana',
      fontSize: 22,
      color: '#93c5fd',
      fontStyle: '700',
    });
    this.add.text(54, 154, this.editorState.mode === 'manual'
      ? 'グリッドに沿ってクリック配置。ドラッグすると、ブロックやレールを綺麗な線状に並べられます。'
      : '円 / らせん / ベジェ / 波 / グリッドで自動配置。パーツ種別を変えて即プレイテストできます。', {
      fontFamily: 'Meiryo, Verdana',
      fontSize: 18,
      color: COLORS.muted,
      wordWrap: { width: 760 },
    });

    this.addEditorControls();
    this.renderEditorPreview();
  }

  addEditorControls() {
    const state = this.editorState;
    const cycle = (key, values, dir = 1) => {
      const index = values.indexOf(state[key]);
      state[key] = values[(index + dir + values.length) % values.length];
      this.updateEditorState(state);
    };
    const adjust = (key, delta) => {
      state[key] += delta;
      this.updateEditorState(state);
    };

    this.add.rectangle(450, 1035, 812, 232, 0x101827, 0.94).setStrokeStyle(2, 0x334155);
    this.add.text(72, 936, state.mode === 'manual' ? `MODE  ${state.mode.toUpperCase()}` : `SHAPE  ${state.shape.toUpperCase()}`, { fontFamily: 'Verdana', fontSize: 20, fontStyle: '700', color: COLORS.text });
    this.add.text(302, 936, state.mode === 'manual' ? `TOOL  ${state.manualTool.toUpperCase()}` : `PART  ${state.part.toUpperCase()}`, { fontFamily: 'Verdana', fontSize: 20, fontStyle: '700', color: COLORS.text });
    this.add.text(512, 936, `TYPE  ${state.type.toUpperCase()}`, { fontFamily: 'Verdana', fontSize: 20, fontStyle: '700', color: COLORS.text });

    this.button(88, 988, 86, 46, 'MODE', () => cycle('mode', EDITOR_MODES), { size: 15, fill: state.mode === 'manual' ? 0x6b4b18 : 0x1f3a5f, stroke: state.mode === 'manual' ? COLORS.gold : 0x45526a });
    this.button(190, 988, 86, 46, state.mode === 'manual' ? 'TOOL' : 'SHAPE', () => cycle(state.mode === 'manual' ? 'manualTool' : 'shape', state.mode === 'manual' ? EDITOR_MANUAL_TOOLS : EDITOR_SHAPES), { size: 15, fill: 0x1f3a5f });
    this.button(292, 988, 86, 46, 'PART', () => cycle('part', EDITOR_PARTS), { size: 15, fill: 0x1f3a5f, disabled: state.mode === 'manual' });
    this.button(394, 988, 86, 46, 'TYPE', () => cycle('type', EDITOR_TYPES), { size: 15, fill: 0x1f3a5f });
    this.button(508, 988, 118, 46, state.mode === 'manual' ? 'CLEAR' : 'RANDOM', () => (state.mode === 'manual' ? this.clearManualEditor() : this.randomizeEditor()), { size: 15, fill: 0x3f2f56, stroke: 0xc084fc });
    this.button(686, 988, 200, 46, 'TEST PLAY', () => this.startEditorTest(), { size: 18, fill: 0x2c6f84, stroke: 0x5eead4 });

    this.add.text(78, 1050, state.mode === 'manual' ? `MODE ${state.mode.toUpperCase()}` : `COUNT ${state.count}`, { fontFamily: 'Verdana', fontSize: 18, color: COLORS.text });
    this.add.text(258, 1050, state.mode === 'manual' ? `TOOL ${state.manualTool.toUpperCase()}` : `RADIUS ${state.radius}`, { fontFamily: 'Verdana', fontSize: 18, color: COLORS.text });
    this.add.text(458, 1050, state.mode === 'manual' ? `GRID ${EDITOR_GRID}` : `TURNS ${state.turns}`, { fontFamily: 'Verdana', fontSize: 18, color: COLORS.text });
    this.add.text(638, 1050, `BALLS ${state.balls}`, { fontFamily: 'Verdana', fontSize: 18, color: COLORS.text });

    this.button(95, 1102, 62, 42, state.mode === 'manual' ? 'UNDO' : '-8', () => (state.mode === 'manual' ? this.undoManualObject() : adjust('count', -8)), { size: 15 });
    this.button(170, 1102, 62, 42, state.mode === 'manual' ? 'ORNG' : '+8', () => (state.mode === 'manual' ? this.setManualType('orange') : adjust('count', 8)), { size: 15 });
    this.button(278, 1102, 62, 42, state.mode === 'manual' ? 'BLUE' : '-20', () => (state.mode === 'manual' ? this.setManualType('blue') : adjust('radius', -20)), { size: 15 });
    this.button(354, 1102, 62, 42, state.mode === 'manual' ? 'GREEN' : '+20', () => (state.mode === 'manual' ? this.setManualType('green') : adjust('radius', 20)), { size: 13 });
    this.button(476, 1102, 62, 42, state.mode === 'manual' ? 'BRICK' : '-1', () => (state.mode === 'manual' ? this.setManualTool('brick') : adjust('turns', -1)), { size: 13 });
    this.button(552, 1102, 62, 42, state.mode === 'manual' ? 'RAIL' : '+1', () => (state.mode === 'manual' ? this.setManualTool('rail') : adjust('turns', 1)), { size: 14 });
    this.button(662, 1102, 62, 42, '-1', () => adjust('balls', -1), { size: 16 });
    this.button(738, 1102, 62, 42, '+1', () => adjust('balls', 1), { size: 16 });

    this.button(232, 1170, 270, 48, 'SAVE TEMPLATE', () => this.saveEditorTemplate(), { size: 17, fill: 0x4a3d21, stroke: COLORS.gold });
    this.button(550, 1170, 270, 48, 'LOAD TEMPLATE', () => this.loadEditorTemplate(), { size: 17, fill: 0x334155, stroke: 0x93c5fd });
  }

  updateEditorState(nextState) {
    this.editorState = clampEditorState(nextState);
    saveEditorState(this.editorState);
    this.showStageEditor();
  }

  randomizeEditor() {
    const rand = seededRandom(Date.now() % 1000000);
    this.editorState = clampEditorState({
      shape: EDITOR_SHAPES[Math.floor(rand() * EDITOR_SHAPES.length)],
      part: EDITOR_PARTS[Math.floor(rand() * EDITOR_PARTS.length)],
      type: EDITOR_TYPES[Math.floor(rand() * EDITOR_TYPES.length)],
      count: 28 + Math.floor(rand() * 84),
      radius: 140 + Math.floor(rand() * 210),
      turns: 2 + Math.floor(rand() * 5),
      spread: 0.75 + rand() * 0.55,
      balls: 7 + Math.floor(rand() * 7),
    });
    saveEditorState(this.editorState);
    this.showStageEditor();
  }

  saveEditorTemplate() {
    saveEditorState(this.editorState);
    this.editorToast('TEMPLATE SAVED');
  }

  loadEditorTemplate() {
    this.editorState = clampEditorState(loadEditorState());
    this.showStageEditor();
  }

  editorToast(label) {
    const text = this.add.text(WIDTH / 2, 865, label, {
      fontFamily: 'Verdana',
      fontSize: 24,
      fontStyle: '700',
      color: '#ffd35a',
    }).setOrigin(0.5).setDepth(40);
    this.tweens.add({
      targets: text,
      y: 828,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  setManualType(type) {
    this.editorState.type = type;
    saveEditorState(this.editorState);
    this.showStageEditor();
  }

  setManualTool(tool) {
    this.editorState.manualTool = tool;
    saveEditorState(this.editorState);
    this.showStageEditor();
  }

  clearManualEditor() {
    this.editorState.manualObjects = [];
    saveEditorState(this.editorState);
    this.showStageEditor();
  }

  undoManualObject() {
    this.editorState.manualObjects = this.editorState.manualObjects.slice(0, -1);
    saveEditorState(this.editorState);
    this.showStageEditor();
  }

  editorBounds() {
    return { left: 80, right: 820, top: 258, bottom: 892 };
  }

  snapEditorPoint(pointer) {
    const bounds = this.editorBounds();
    const world = this.getPointerWorld(pointer);
    return {
      x: Phaser.Math.Clamp(Math.round(world.x / EDITOR_GRID) * EDITOR_GRID, bounds.left, bounds.right),
      y: Phaser.Math.Clamp(Math.round(world.y / EDITOR_GRID) * EDITOR_GRID, bounds.top, bounds.bottom),
    };
  }

  manualType() {
    return this.editorState.type === 'auto' ? 'blue' : this.editorState.type;
  }

  addManualObject(object) {
    const next = [...this.editorState.manualObjects, object].slice(-240);
    this.editorState.manualObjects = next;
    saveEditorState(this.editorState);
  }

  createManualSingle(point) {
    const tool = this.editorState.manualTool;
    const type = this.manualType();
    if (tool === 'peg') this.addManualObject({ kind: 'peg', x: point.x, y: point.y, type });
    if (tool === 'brick') this.addManualObject({ kind: 'brick', x: point.x, y: point.y, w: 88, h: 18, angle: 0, type });
    if (tool === 'rail') this.addManualObject({ kind: 'rail', x: point.x, y: point.y, w: 128, h: 13, angle: 0 });
    if (tool === 'bumper') this.addManualObject({ kind: 'bumper', x: point.x, y: point.y, r: 28 });
  }

  createManualLine(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy);
    if (distance < EDITOR_GRID * 0.75) {
      this.createManualSingle(start);
      return;
    }
    const tool = this.editorState.manualTool;
    const type = this.manualType();
    const angle = Math.atan2(dy, dx);
    const spacing = tool === 'peg' ? 38 : tool === 'bumper' ? 58 : tool === 'rail' ? 96 : 74;
    const count = Phaser.Math.Clamp(Math.floor(distance / spacing) + 1, 2, 48);
    const objects = [];
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : i / (count - 1);
      const x = Math.round((start.x + dx * t) / EDITOR_GRID) * EDITOR_GRID;
      const y = Math.round((start.y + dy * t) / EDITOR_GRID) * EDITOR_GRID;
      if (tool === 'peg') objects.push({ kind: 'peg', x, y, type });
      if (tool === 'brick') objects.push({ kind: 'brick', x, y, w: 82, h: 18, angle, type });
      if (tool === 'rail') objects.push({ kind: 'rail', x, y, w: 120, h: 13, angle });
      if (tool === 'bumper') objects.push({ kind: 'bumper', x, y, r: 28 });
    }
    this.editorState.manualObjects = [...this.editorState.manualObjects, ...objects].slice(-240);
    saveEditorState(this.editorState);
  }

  eraseManualNear(point, radius = 38) {
    this.editorState.manualObjects = this.editorState.manualObjects.filter((object) => Math.hypot(object.x - point.x, object.y - point.y) > radius);
    saveEditorState(this.editorState);
  }

  eraseManualLine(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(2, Math.ceil(distance / EDITOR_GRID));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      this.eraseManualNear({ x: start.x + dx * t, y: start.y + dy * t }, 34);
    }
  }

  handleManualPointerDown(pointer) {
    if (this.editorState.mode !== 'manual') return;
    this.manualDragStart = this.snapEditorPoint(pointer);
    this.manualDragLine?.destroy();
    this.manualDragLine = this.add.line(0, 0, this.manualDragStart.x, this.manualDragStart.y, this.manualDragStart.x, this.manualDragStart.y, COLORS.gold, 0.8)
      .setOrigin(0)
      .setLineWidth(4)
      .setDepth(8);
  }

  handleManualPointerMove(pointer) {
    if (!this.manualDragStart || this.editorState.mode !== 'manual') return;
    const point = this.snapEditorPoint(pointer);
    this.manualDragLine?.setTo(this.manualDragStart.x, this.manualDragStart.y, point.x, point.y);
  }

  handleManualPointerUp(pointer) {
    if (!this.manualDragStart || this.editorState.mode !== 'manual') return;
    const start = this.manualDragStart;
    const end = this.snapEditorPoint(pointer);
    this.manualDragStart = null;
    this.manualDragLine?.destroy();
    this.manualDragLine = null;
    if (this.editorState.manualTool === 'erase') {
      this.eraseManualLine(start, end);
    } else {
      this.createManualLine(start, end);
    }
    this.showStageEditor();
  }

  renderManualGrid() {
    const bounds = this.editorBounds();
    const grid = this.add.graphics().setDepth(2);
    grid.lineStyle(1, 0x334155, 0.32);
    for (let x = bounds.left; x <= bounds.right; x += EDITOR_GRID) grid.lineBetween(x, bounds.top, x, bounds.bottom);
    for (let y = bounds.top; y <= bounds.bottom; y += EDITOR_GRID) grid.lineBetween(bounds.left, y, bounds.right, y);
    grid.lineStyle(2, COLORS.gold, 0.32);
    grid.strokeRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
    const zone = this.add.zone(
      (bounds.left + bounds.right) / 2,
      (bounds.top + bounds.bottom) / 2,
      bounds.right - bounds.left,
      bounds.bottom - bounds.top,
    ).setInteractive({ useHandCursor: true }).setDepth(6);
    zone.on('pointerdown', (pointer, localX, localY, event) => {
      event?.stopPropagation();
      this.handleManualPointerDown(pointer);
    });
    zone.on('pointermove', (pointer) => this.handleManualPointerMove(pointer));
    zone.on('pointerup', (pointer, localX, localY, event) => {
      event?.stopPropagation();
      this.handleManualPointerUp(pointer);
    });
  }

  buildManualLevel() {
    const pegs = [];
    const bricks = [];
    const rails = [];
    const bumpers = [];
    this.editorState.manualObjects.forEach((object) => {
      if (object.kind === 'peg') pegs.push({ x: object.x, y: object.y, type: object.type ?? 'blue' });
      if (object.kind === 'brick') bricks.push({ x: object.x, y: object.y, w: object.w ?? 88, h: object.h ?? 18, angle: object.angle ?? 0, type: object.type ?? 'blue' });
      if (object.kind === 'rail') rails.push({ x: object.x, y: object.y, w: object.w ?? 128, h: object.h ?? 13, angle: object.angle ?? 0 });
      if (object.kind === 'bumper') bumpers.push({ x: object.x, y: object.y, r: object.r ?? 28 });
    });
    if (!pegs.some((peg) => peg.type === 'orange') && !bricks.some((brick) => brick.type === 'orange')) {
      if (pegs.length) pegs[0].type = 'orange';
      else if (bricks.length) bricks[0].type = 'orange';
    }
    return {
      level: 1,
      editorTest: true,
      balls: this.editorState.balls,
      targetCount: pegs.filter((peg) => peg.type === 'orange').length + bricks.filter((brick) => brick.type === 'orange').length,
      pegs,
      bricks,
      rails,
      timedBlocks: [],
      spinners: [],
      bumpers,
      bucketSpeed: 150,
      rewardIndex: 0,
    };
  }

  getEditorPoints() {
    const s = this.editorState;
    const points = [];
    const count = s.count;
    const centerX = WIDTH / 2;
    const centerY = 610;
    for (let i = 0; i < count; i += 1) {
      const t = count <= 1 ? 0 : i / (count - 1);
      let x = centerX;
      let y = centerY;
      let angle = 0;
      if (s.shape === 'circle') {
        angle = (i / count) * Math.PI * 2;
        const ring = i % 2 ? 0.72 : 1;
        x = centerX + Math.cos(angle) * s.radius * ring;
        y = centerY + Math.sin(angle) * s.radius * 0.72 * ring;
      } else if (s.shape === 'spiral') {
        angle = t * s.turns * Math.PI * 2 - Math.PI / 2;
        const radius = 28 + t * s.radius;
        x = centerX + Math.cos(angle) * radius;
        y = 360 + t * 570 + Math.sin(angle) * radius * 0.28;
      } else if (s.shape === 'bezier') {
        const p0 = { x: 112, y: 910 };
        const p1 = { x: 240, y: 280 };
        const p2 = { x: 670, y: 990 };
        const p3 = { x: 790, y: 360 };
        const u = 1 - t;
        x = u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x;
        y = u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y;
        const tx = 3 * u ** 2 * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t ** 2 * (p3.x - p2.x);
        const ty = 3 * u ** 2 * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t ** 2 * (p3.y - p2.y);
        angle = Math.atan2(ty, tx);
      } else if (s.shape === 'wave') {
        x = 95 + t * 710;
        y = 610 + Math.sin(t * Math.PI * 2 * s.turns) * s.radius * 0.6;
        angle = Math.atan2(Math.cos(t * Math.PI * 2 * s.turns), 1);
      } else {
        const cols = Math.max(5, Math.round(Math.sqrt(count * 1.35)));
        const row = Math.floor(i / cols);
        const col = i % cols;
        x = 130 + col * Math.min(86, (WIDTH - 260) / Math.max(1, cols - 1));
        y = 330 + row * 58;
        x += row % 2 ? 30 : 0;
        angle = (row % 2 ? 0.18 : -0.18);
      }
      if (x > 72 && x < WIDTH - 72 && y > 270 && y < 1048) points.push({ x, y, angle, index: i });
    }
    return points;
  }

  editorPegType(index) {
    if (this.editorState.type !== 'auto') return this.editorState.type;
    if (index % 7 === 0) return 'orange';
    if (index % 19 === 0) return 'green';
    if (index % 13 === 0) return 'purple';
    return 'blue';
  }

  buildEditorLevel() {
    const s = this.editorState;
    if (s.mode === 'manual') return this.buildManualLevel();
    const points = this.getEditorPoints();
    const pegs = [];
    const bricks = [];
    const rails = [];
    const timedBlocks = [];
    const bumpers = [];
    const spinners = [];
    const usePegs = s.part === 'mixed' || s.part === 'pegs';
    const useBricks = s.part === 'mixed' || s.part === 'bricks';
    const useRails = s.part === 'mixed' || s.part === 'rails';
    const useBumpers = s.part === 'mixed' || s.part === 'bumpers';

    points.forEach((point, index) => {
      if (usePegs && (s.part !== 'mixed' || index % 3 !== 1)) {
        pegs.push({ x: point.x, y: point.y, type: this.editorPegType(index) });
      }
      if (useBricks && index % (s.part === 'bricks' ? 2 : 9) === 0) {
        bricks.push({
          x: point.x,
          y: point.y,
          w: 72 + (index % 4) * 16,
          h: 18,
          angle: point.angle,
          type: this.editorPegType(index + 2),
        });
      }
      if (useRails && index % (s.part === 'rails' ? 3 : 13) === 0) {
        rails.push({ x: point.x, y: point.y, w: 116, h: 13, angle: point.angle + Math.PI / 2 });
      }
      if (useBumpers && index % (s.part === 'bumpers' ? 4 : 17) === 0) {
        bumpers.push({ x: point.x, y: point.y, r: 24 + (index % 3) * 4 });
      }
    });

    if (!pegs.some((peg) => peg.type === 'orange') && pegs.length) pegs[0].type = 'orange';
    if (s.part === 'mixed') {
      timedBlocks.push({ x: 450, y: 830, w: 210, h: 22, phase: 0, period: 2800 });
      spinners.push({ x: 450, y: 560, radius: 58, speed: 0.9, phase: 0 });
    }
    return {
      level: 1,
      editorTest: true,
      balls: s.balls,
      targetCount: pegs.filter((peg) => peg.type === 'orange').length + bricks.filter((brick) => brick.type === 'orange').length,
      pegs,
      bricks,
      rails,
      timedBlocks,
      spinners,
      bumpers,
      bucketSpeed: 150,
      rewardIndex: 0,
    };
  }

  renderEditorPreview() {
    const level = this.buildEditorLevel();
    const panel = this.add.rectangle(WIDTH / 2, 548, 812, 690, 0x0b111b, 0.78).setStrokeStyle(2, 0x243044);
    panel.setDepth(1);
    if (this.editorState.mode === 'manual') this.renderManualGrid();
    this.add.rectangle(WIDTH / 2, 238, 42, 42, 0x1f2a3c, 1).setStrokeStyle(3, COLORS.gold).setDepth(2);
    this.add.line(0, 0, 80, 258, 820, 258, 0x334155, 0.75).setOrigin(0).setDepth(2);
    this.add.line(0, 0, 80, 1068, 820, 1068, 0x334155, 0.75).setOrigin(0).setDepth(2);

    level.pegs.forEach((peg) => {
      const color = peg.type === 'orange' ? COLORS.orange : peg.type === 'green' ? COLORS.green : peg.type === 'purple' ? COLORS.purple : COLORS.blue;
      this.add.circle(peg.x, peg.y, 11, color, 1).setStrokeStyle(3, 0xffffff, 0.26).setDepth(3);
    });
    level.bricks.forEach((brick) => {
      const color = brick.type === 'orange' ? COLORS.orange : brick.type === 'green' ? COLORS.green : COLORS.blue;
      const rect = this.add.rectangle(brick.x, brick.y, brick.w, brick.h, color, 0.9).setStrokeStyle(2, 0xffffff, 0.25).setDepth(3);
      rect.rotation = brick.angle;
    });
    level.rails.forEach((rail) => {
      const rect = this.add.rectangle(rail.x, rail.y, rail.w, rail.h, 0x8ea2c7, 0.36).setStrokeStyle(2, 0xdbeafe, 0.45).setDepth(3);
      rect.rotation = rail.angle;
    });
    level.timedBlocks.forEach((block) => {
      this.add.rectangle(block.x, block.y, block.w, block.h, 0x38bdf8, 0.5).setStrokeStyle(2, 0xe0f2fe, 0.7).setDepth(3);
    });
    level.bumpers.forEach((bumper) => {
      this.add.circle(bumper.x, bumper.y, bumper.r, 0xe7eef8, 0.16).setStrokeStyle(4, COLORS.cyan, 0.72).setDepth(3);
    });
    level.spinners.forEach((spinner) => {
      const line = this.add.line(0, 0, spinner.x - spinner.radius, spinner.y, spinner.x + spinner.radius, spinner.y, COLORS.gold, 0.58).setOrigin(0).setLineWidth(5).setDepth(3);
      line.rotation = spinner.phase;
      this.add.circle(spinner.x, spinner.y, 10, 0xf8fafc, 0.3).setStrokeStyle(3, COLORS.gold).setDepth(4);
    });
    this.add.text(78, 852, `OBJECTS ${level.pegs.length + level.bricks.length + level.rails.length + level.bumpers.length + level.timedBlocks.length + level.spinners.length}   ORANGE ${level.targetCount}`, {
      fontFamily: 'Verdana',
      fontSize: 20,
      fontStyle: '700',
      color: COLORS.text,
    }).setDepth(4);
    if (this.editorState.mode === 'manual') {
      this.add.text(78, 882, 'CLICK: PLACE   DRAG: LINE   TOOL=ERASE: DELETE', {
        fontFamily: 'Verdana',
        fontSize: 15,
        fontStyle: '700',
        color: '#93c5fd',
      }).setDepth(4);
    }
  }

  startEditorTest() {
    const level = this.buildEditorLevel();
    if (level.targetCount < 1) {
      this.editorToast('ADD ORANGE TARGET');
      return;
    }
    this.startLevel(1, level);
  }

  startLevel(levelNumber, levelOverride = null) {
    this.view = 'game';
    this.clearScene();
    this.level = levelOverride ?? generateLevel(levelNumber);
    this.blockVisuals = [];
    this.shotsLeft = this.level.balls;
    this.score = 0;
    this.targetsLeft = this.level.pegs.filter((peg) => peg.type === 'orange').length
      + this.level.bricks.filter((brick) => brick.type === 'orange').length;
    this.inFlight = 0;
    this.multiballQueued = false;
    this.rewardedContinuesUsed = 0;
    this.levelCleared = false;
    this.orangeClearPending = false;
    this.orangeClearAnnounced = false;
    this.shotCombo = 0;
    this.currentAim = { x: 0, y: 1 };

    this.addBackground(this.level.editorTest ? 'EDITOR TEST' : `LEVEL ${levelNumber}`);
    this.createAimControls();
    this.createGameUi();
    this.createBucket();
    this.createPegs();
    this.createBricks();
    this.createRails();
    this.createTimedBlocks();
    this.createBumpers();
    this.createSpinners();
    this.balls = this.add.group();
    this.trajectory = this.add.graphics().setDepth(4);
    this.createCannon();
    this.refreshHud();
  }

  createAimControls() {
    this.aimZone = this.add.zone(WIDTH / 2, HEIGHT / 2 + 112, WIDTH - 84, HEIGHT - 300)
      .setInteractive({ useHandCursor: true });
    this.aimZone.on('pointerdown', (pointer) => this.launchBall(pointer));
    this.aimZone.on('pointermove', (pointer) => this.updateAimFromPointer(pointer));
  }

  createCannon() {
    this.cannonBase = this.add.circle(CANNON_X, CANNON_Y, 34, 0x1f2a3c, 1)
      .setStrokeStyle(5, COLORS.gold, 0.9)
      .setDepth(10);
    this.cannonBarrelShadow = this.add.rectangle(CANNON_X, CANNON_Y, 25, 82, 0x070b12, 0.45)
      .setOrigin(0.5, 0.18)
      .setDepth(9);
    this.cannonBarrel = this.add.rectangle(CANNON_X, CANNON_Y, 22, 78, COLORS.gold, 1)
      .setOrigin(0.5, 0.18)
      .setStrokeStyle(4, 0x8b6814, 0.95)
      .setDepth(11);
    this.cannonMuzzle = this.add.circle(CANNON_X, CANNON_Y, 13, 0xfff2a6, 1)
      .setStrokeStyle(3, 0x8b6814, 1)
      .setDepth(12);
    this.cannonCore = this.add.circle(CANNON_X, CANNON_Y, 15, 0x101827, 1)
      .setStrokeStyle(3, 0x59677f, 0.9)
      .setDepth(13);
  }

  createGameUi() {
    this.scoreText = this.add.text(48, 112, '', { fontFamily: 'Verdana', fontSize: 24, fontStyle: '700', color: COLORS.text });
    this.goalText = this.add.text(48, 150, '', { fontFamily: 'Meiryo, Verdana', fontSize: 22, color: COLORS.muted });
    this.button(778, 70, 164, 50, 'メニュー', () => this.showMenu(), { size: 20 });
  }

  trackMatterBody(gameObject, bodyRole, extra = {}) {
    gameObject.bodyRole = bodyRole;
    Object.assign(gameObject, extra);
    if (gameObject.body) {
      gameObject.body.gameObject = gameObject;
      gameObject.body.label = bodyRole;
      gameObject.body.plugin = { ...(gameObject.body.plugin ?? {}), gameObject };
      this.matterBodies.push(gameObject.body);
    }
    return gameObject;
  }

  makeMatterCircle(gameObject, radius, bodyRole, options = {}, extra = {}) {
    this.matter.add.gameObject(gameObject, {
      shape: { type: 'circle', radius },
      frictionAir: 0.002,
      ...options,
    });
    return this.trackMatterBody(gameObject, bodyRole, extra);
  }

  makeMatterRectangle(gameObject, width, height, bodyRole, options = {}, extra = {}) {
    this.matter.add.gameObject(gameObject, {
      shape: { type: 'rectangle', width, height },
      ...options,
    });
    return this.trackMatterBody(gameObject, bodyRole, extra);
  }

  setBodyVelocity(gameObject, x, y) {
    if (!gameObject?.body) return;
    if (gameObject.setVelocity) gameObject.setVelocity(x, y);
    else this.matter.setVelocity(gameObject.body, x, y);
  }

  destroyMatterObject(gameObject, group) {
    if (!gameObject) return;
    if (gameObject.body) {
      this.matter.world.remove(gameObject.body, true);
      this.matterBodies = this.matterBodies.filter((body) => body !== gameObject.body);
    }
    group?.remove(gameObject, false, false);
    gameObject.destroy();
  }

  handleMatterCollision(event) {
    event.pairs.forEach((pair) => {
      const a = pair.bodyA?.gameObject;
      const b = pair.bodyB?.gameObject;
      if (!a || !b) return;
      const ball = a.bodyRole === 'ball' ? a : b.bodyRole === 'ball' ? b : null;
      const other = ball === a ? b : a;
      if (!ball || !other || ball.caught) return;

      if (other.bodyRole === 'peg' || other.bodyRole === 'brick') {
        this.hitPeg(ball, other);
      } else if (other.bodyRole === 'bumper' || other.bodyRole === 'spinner') {
        this.hitBumper(ball);
      } else if (other.bodyRole === 'rail' || other.bodyRole === 'timedBlock') {
        this.hitRail(ball, other);
      }
    });
  }

  createPegs() {
    this.pegGroup = this.add.group();
    this.level.pegs.forEach((data) => {
      const color = data.type === 'orange' ? COLORS.orange : data.type === 'green' ? COLORS.green : data.type === 'purple' ? COLORS.purple : COLORS.blue;
      const peg = this.add.circle(data.x, data.y, 13, color, 1).setStrokeStyle(4, 0xffffff, 0.28);
      peg.pegType = data.type;
      peg.value = data.type === 'orange' ? 300 : data.type === 'purple' ? 500 : data.type === 'green' ? 150 : 80;
      peg.motion = data.motion;
      peg.baseX = data.x;
      peg.baseY = data.y;
      this.makeMatterCircle(peg, 13, 'peg', {
        isStatic: true,
        restitution: 1,
        friction: 0,
      });
      this.pegGroup.add(peg);
    });
  }

  createBricks() {
    this.brickGroup = this.add.group();
    this.level.bricks.forEach((data) => {
      const color = data.type === 'orange' ? COLORS.orange : data.type === 'green' ? COLORS.green : COLORS.blue;
      const visual = this.add.rectangle(data.x, data.y, data.w, data.h, color, 1).setStrokeStyle(3, 0xffffff, 0.28);
      visual.rotation = data.angle;
      this.makeMatterRectangle(visual, data.w, data.h, 'brick', {
        isStatic: true,
        angle: data.angle,
        restitution: 1,
        friction: 0,
      }, {
        pegType: data.type,
        value: data.type === 'orange' ? 450 : data.type === 'green' ? 220 : 120,
      });
      this.brickGroup.add(visual);
    });
  }

  createRails() {
    this.railGroup = this.add.group();
    this.level.rails.forEach((data) => {
      const visual = this.add.rectangle(data.x, data.y, data.w, data.h, 0x8ea2c7, 0.35).setStrokeStyle(2, 0xdbeafe, 0.45);
      visual.rotation = data.angle;
      this.makeMatterRectangle(visual, data.w, data.h, 'rail', {
        isStatic: true,
        angle: data.angle,
        restitution: 1,
        friction: 0,
      });
      this.railGroup.add(visual);
    });
  }

  createTimedBlocks() {
    this.timedBlockGroup = this.add.group();
    this.level.timedBlocks.forEach((data) => {
      const block = this.add.rectangle(data.x, data.y, data.w, data.h, 0x38bdf8, 0.52).setStrokeStyle(2, 0xe0f2fe, 0.72);
      block.period = data.period;
      block.phase = data.phase;
      block.baseAlpha = 0.52;
      this.makeMatterRectangle(block, data.w, data.h, 'timedBlock', {
        isStatic: true,
        restitution: 1,
        friction: 0,
      });
      this.timedBlockGroup.add(block);
    });
  }

  createBumpers() {
    this.bumperGroup = this.add.group();
    this.level.bumpers.forEach((data) => {
      const bumper = this.add.circle(data.x, data.y, data.r, 0xe7eef8, 0.18).setStrokeStyle(5, COLORS.cyan, 0.72);
      this.makeMatterCircle(bumper, data.r, 'bumper', {
        isStatic: true,
        restitution: 1.15,
        friction: 0,
      });
      this.bumperGroup.add(bumper);
    });
  }

  createSpinners() {
    this.spinnerGraphics = this.add.graphics().setDepth(3);
    this.spinnerNodeGroup = this.add.group();
    this.spinnerNodes = [];
    this.level.spinners.forEach((data) => {
      const hub = this.add.circle(data.x, data.y, 12, 0xf8fafc, 0.3).setStrokeStyle(3, COLORS.gold, 0.85);
      const a = this.add.circle(data.x + data.radius, data.y, 16, 0xfef08a, 0.9).setStrokeStyle(3, 0x8b6814);
      const b = this.add.circle(data.x - data.radius, data.y, 16, 0xfef08a, 0.9).setStrokeStyle(3, 0x8b6814);
      [hub, a, b].forEach((node) => {
        this.makeMatterCircle(node, node.radius ?? 12, 'spinner', {
          isStatic: true,
          restitution: 1.2,
          friction: 0,
        });
        this.spinnerNodeGroup.add(node);
      });
      this.spinnerNodes.push({ ...data, hub, a, b, angle: data.phase });
    });
  }

  createBucket() {
    this.add.rectangle(WIDTH / 2, HEIGHT - 74, WIDTH - 130, 4, 0x6b7280, 0.28).setDepth(1);
    this.bucketVisual = this.add.container(WIDTH / 2, HEIGHT - 74).setDepth(8);
    this.bucketVisual.add(this.add.rectangle(0, 0, 172, 44, 0x121b2b, 1).setStrokeStyle(4, COLORS.gold, 1));
    this.bucketVisual.add(this.add.rectangle(0, -16, 138, 12, 0xffd35a, 0.9));
    this.bucketVisual.add(this.add.text(0, 4, 'FREE BALL', {
      fontFamily: 'Verdana',
      fontSize: 18,
      fontStyle: '700',
      color: '#ffd35a',
    }).setOrigin(0.5));
    this.bucket = this.add.zone(WIDTH / 2, HEIGHT - 94, 164, 92);
    this.bucketDirection = 1;
  }

  refreshHud() {
    this.scoreText.setText(`SCORE ${this.score}   BALL ${this.shotsLeft}   TARGET ${this.targetsLeft}`);
    this.goalText.setText('オレンジペグをすべて消す');
  }

  getPointerWorld(pointer = this.input.activePointer) {
    const camera = this.cameras.main;
    if (pointer?.positionToCamera) {
      return pointer.positionToCamera(camera);
    }
    return { x: pointer?.worldX ?? CANNON_X, y: pointer?.worldY ?? CANNON_Y + 260 };
  }

  calculateAim(pointer = this.input.activePointer) {
    const world = this.getPointerWorld(pointer);
    const dx = Phaser.Math.Clamp(world.x - CANNON_X, -560, 560);
    const dy = Phaser.Math.Clamp(world.y - CANNON_Y, 80, 980);
    let angle = Math.atan2(dy, dx);
    angle = Phaser.Math.Clamp(angle, MIN_AIM_ANGLE, MAX_AIM_ANGLE);
    return {
      x: Math.cos(angle),
      y: Math.sin(angle),
      angle,
    };
  }

  updateAimFromPointer(pointer = this.input.activePointer) {
    if (this.view !== 'game') return;
    this.currentAim = this.calculateAim(pointer);
  }

  getMuzzlePoint(distance = 72) {
    return {
      x: CANNON_X + this.currentAim.x * distance,
      y: CANNON_Y + this.currentAim.y * distance,
    };
  }

  drawTrajectory() {
    if (!this.trajectory || !this.currentAim) return;
    this.trajectory.clear();
    if (this.inFlight > 0 || this.shotsLeft <= 0) return;
    this.trajectory.fillStyle(COLORS.gold, 0.54);
    const muzzle = this.getMuzzlePoint(74);
    let x = muzzle.x;
    let y = muzzle.y;
    let vx = this.currentAim.x * LAUNCH_SPEED;
    let vy = this.currentAim.y * LAUNCH_SPEED;
    const gravity = 760;
    const step = 1 / 18;
    const predictors = this.getTrajectoryPredictors();
    for (let i = 1; i <= 26; i += 1) {
      x += vx * step;
      y += vy * step;
      vy += gravity * step;
      if (x < 47 || x > WIDTH - 47) {
        vx *= -0.94;
        x = Phaser.Math.Clamp(x, 47, WIDTH - 47);
      }
      const hit = this.findTrajectoryHit(x, y, predictors);
      if (hit) {
        const reflected = this.reflectVelocity(vx, vy, hit.nx, hit.ny, 0.88);
        vx = reflected.x;
        vy = reflected.y;
        x += hit.nx * 8;
        y += hit.ny * 8;
      }
      if (y > HEIGHT - 86) break;
      const alpha = Phaser.Math.Clamp(0.62 - i * 0.017, 0.12, 0.62);
      this.trajectory.fillStyle(COLORS.gold, alpha);
      this.trajectory.fillCircle(x, y, Math.max(2.4, 6 - i * 0.1));
    }
  }

  getTrajectoryPredictors() {
    const circles = [];
    const rects = [];
    const addCircle = (item, radius = 16) => {
      if (item?.active && item.visible !== false) circles.push({ x: item.x, y: item.y, r: radius });
    };
    this.pegGroup?.getChildren().forEach((peg) => addCircle(peg, 18));
    this.bumperGroup?.getChildren().forEach((bumper) => addCircle(bumper, (bumper.radius ?? 24) + 6));
    this.spinnerNodeGroup?.getChildren().forEach((node) => addCircle(node, (node.radius ?? 14) + 6));
    this.brickGroup?.getChildren().forEach((rect) => {
      if (rect?.active && rect.visible !== false) rects.push({ x: rect.x, y: rect.y, w: rect.width + 18, h: rect.height + 18, angle: rect.rotation });
    });
    this.railGroup?.getChildren().forEach((rect) => {
      if (rect?.active && rect.visible !== false) rects.push({ x: rect.x, y: rect.y, w: rect.width + 18, h: rect.height + 18, angle: rect.rotation });
    });
    this.timedBlockGroup?.getChildren().forEach((rect) => {
      if (rect?.active && rect.visible !== false && rect.body?.collisionFilter?.mask !== 0) rects.push({ x: rect.x, y: rect.y, w: rect.width + 16, h: rect.height + 16 });
    });
    return { circles, rects };
  }

  findTrajectoryHit(x, y, predictors) {
    for (const circle of predictors.circles) {
      const dx = x - circle.x;
      const dy = y - circle.y;
      const d = Math.hypot(dx, dy);
      if (d < circle.r) return { nx: dx / (d || 1), ny: dy / (d || 1) };
    }
    for (const rect of predictors.rects) {
      const angle = rect.angle ?? 0;
      const cos = Math.cos(-angle);
      const sin = Math.sin(-angle);
      const dx = x - rect.x;
      const dy = y - rect.y;
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if (Math.abs(lx) < rect.w / 2 && Math.abs(ly) < rect.h / 2) {
        const localNx = Math.abs(lx / rect.w) > Math.abs(ly / rect.h) ? Math.sign(lx) || 1 : 0;
        const localNy = localNx === 0 ? Math.sign(ly) || 1 : 0;
        const worldCos = Math.cos(angle);
        const worldSin = Math.sin(angle);
        return {
          nx: localNx * worldCos - localNy * worldSin,
          ny: localNx * worldSin + localNy * worldCos,
        };
      }
    }
    return null;
  }

  reflectVelocity(vx, vy, nx, ny, bounce = 1) {
    const dot = vx * nx + vy * ny;
    return {
      x: (vx - 2 * dot * nx) * bounce,
      y: (vy - 2 * dot * ny) * bounce,
    };
  }

  launchBall(pointer = this.input.activePointer) {
    if (this.view !== 'game' || this.inFlight > 0 || this.shotsLeft <= 0 || this.orangeClearPending) return;
    this.currentAim = this.calculateAim(pointer);
    const muzzle = this.getMuzzlePoint(76);
    this.spawnBall(
      muzzle.x,
      muzzle.y,
      this.currentAim.x * MATTER_LAUNCH_SPEED,
      this.currentAim.y * MATTER_LAUNCH_SPEED,
    );
    this.flashLaunch();
    this.playSfx('launch', { volume: 0.55 });
    this.shotsLeft -= 1;
    this.shotCombo = 0;
    this.refreshHud();
  }

  flashLaunch() {
    const ring = this.add.circle(
      CANNON_X + this.currentAim.x * 76,
      CANNON_Y + this.currentAim.y * 76,
      14,
      COLORS.gold,
      0.34,
    ).setStrokeStyle(3, COLORS.gold, 0.8);
    this.tweens.add({
      targets: ring,
      scale: 2.4,
      alpha: 0,
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  burst(x, y, color = COLORS.gold) {
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const dot = this.add.circle(x, y, 4, color, 0.86);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * 34,
        y: y + Math.sin(angle) * 34,
        alpha: 0,
        scale: 0.35,
        duration: 310,
        ease: 'Cubic.easeOut',
        onComplete: () => dot.destroy(),
      });
    }
  }

  popText(x, y, label, color = '#ffd35a') {
    const text = this.add.text(x, y, label, {
      fontFamily: 'Verdana',
      fontSize: 22,
      fontStyle: '700',
      color,
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({
      targets: text,
      y: y - 38,
      alpha: 0,
      duration: 650,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  hitRail(ball, obstacle) {
    if (ball.body) this.setBodyVelocity(ball, ball.body.velocity.x * 1.02, ball.body.velocity.y * 1.02);
    this.playSfx('bumper', { volume: 0.42 });
  }

  spawnBall(x, y, vx, vy) {
    const ball = this.add.circle(x, y, 11, 0xffffff, 1).setStrokeStyle(3, COLORS.gold);
    this.makeMatterCircle(ball, 11, 'ball', {
      restitution: 0.96,
      friction: 0,
      frictionAir: 0.0015,
      density: 0.001,
      label: 'ball',
    });
    this.balls.add(ball);
    ball.setVelocity(vx, vy);
    this.inFlight += 1;
  }

  hitPeg(ball, peg) {
    if (peg.hit) return;
    peg.hit = true;
    this.shotCombo = (this.shotCombo ?? 0) + 1;
    if (ball.body) this.setBodyVelocity(ball, ball.body.velocity.x * 1.03, ball.body.velocity.y * 1.03);
    const comboBonus = this.shotCombo > 2 ? Math.min(450, (this.shotCombo - 2) * 35) : 0;
    const gained = peg.value + comboBonus;
    this.score += gained;
    if (peg.pegType === 'orange') this.targetsLeft -= 1;
    if (peg.pegType === 'green' && !this.orangeClearPending) this.multiballQueued = true;
    const hitSound = this.shotCombo >= 6 ? 'combo' : peg.pegType === 'orange' ? 'orange' : peg.pegType === 'green' ? 'green' : 'peg';
    this.playSfx(hitSound, {
      volume: peg.pegType === 'orange' ? 0.74 : 0.58,
      rate: Phaser.Math.Clamp(0.92 + this.shotCombo * 0.045, 0.92, 1.45),
    });
    this.burst(peg.x, peg.y, peg.fillColor ?? COLORS.gold);
    this.popText(peg.x, peg.y - 20, this.shotCombo > 2 ? `+${gained} x${this.shotCombo}` : `+${gained}`, peg.pegType === 'orange' ? '#ffb088' : '#dbeafe');
    this.tweens.add({
      targets: peg,
      scale: 1.85,
      alpha: 0,
      duration: 190,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.destroyMatterObject(peg, peg.bodyRole === 'brick' ? this.brickGroup : this.pegGroup);
      },
    });
    if (this.multiballQueued && this.inFlight === 1) {
      this.multiballQueued = false;
      this.spawnBall(ball.x, ball.y, -ball.body.velocity.x * 0.7, ball.body.velocity.y * 0.8);
    }
    this.refreshHud();
    if (this.targetsLeft <= 0) this.beginOrangeClear();
  }

  hitBumper(ball) {
    this.score += 35;
    if (ball.body) this.setBodyVelocity(ball, ball.body.velocity.x * 1.12, ball.body.velocity.y * 1.12);
    this.playSfx('bumper', { volume: 0.5 });
    this.burst(ball.x, ball.y, COLORS.cyan);
    this.refreshHud();
  }

  isBallInBucket(ball) {
    if (!ball?.active || !this.bucket?.active || !ball.body) return false;
    const halfW = this.bucket.width / 2;
    const halfH = this.bucket.height / 2;
    const withinX = Math.abs(ball.x - this.bucket.x) <= halfW;
    const withinY = Math.abs(ball.y - this.bucket.y) <= halfH;
    const descending = ball.body.velocity.y > 0;
    return withinX && withinY && descending;
  }

  catchBall(ball) {
    if (!ball || ball === this.bucket) return;
    if (ball.caught) return;
    ball.caught = true;
    if (!this.orangeClearPending) this.shotsLeft += 1;
    this.score += 250;
    this.playSfx('catch', { volume: 0.7 });
    this.popText(this.bucket.x, this.bucket.y - 42, this.orangeClearPending ? '+250' : '+1 BALL', '#ffd35a');
    this.removeBall(ball);
    this.refreshHud();
  }

  removeBall(ball) {
    if (!ball?.active) return;
    this.inFlight = Math.max(0, this.inFlight - 1);
    this.balls?.remove(ball, false, false);
    if (ball.body) {
      this.matter.world.remove(ball.body, true);
      this.matterBodies = this.matterBodies.filter((body) => body !== ball.body);
    }
    ball.destroy();
    if (this.orangeClearPending && this.inFlight === 0) {
      this.shotCombo = 0;
      this.finishPendingClear();
      return;
    }
    if (this.inFlight === 0) this.shotCombo = 0;
    if (this.inFlight === 0 && this.shotsLeft <= 0 && this.targetsLeft > 0) this.failLevel();
  }

  beginOrangeClear() {
    if (this.orangeClearPending || this.levelCleared) return;
    this.orangeClearPending = true;
    this.orangeClearAnnounced = true;
    this.playSfx('clear', { volume: 0.86 });
    this.refreshHud();
    const banner = this.add.container(WIDTH / 2, 238).setDepth(35);
    banner.add(this.add.rectangle(0, 0, 520, 92, 0x141b2a, 0.88).setStrokeStyle(3, COLORS.gold, 0.95));
    banner.add(this.add.text(0, -18, 'ORANGE CLEAR', {
      fontFamily: 'Verdana',
      fontSize: 36,
      fontStyle: '700',
      color: '#ffd35a',
    }).setOrigin(0.5));
    banner.add(this.add.text(0, 25, 'LAST BALL SCORING', {
      fontFamily: 'Verdana',
      fontSize: 17,
      fontStyle: '700',
      color: '#dbeafe',
    }).setOrigin(0.5));
    this.tweens.add({
      targets: banner,
      y: 196,
      alpha: 0,
      duration: 1300,
      ease: 'Cubic.easeOut',
      onComplete: () => banner.destroy(true),
    });
    for (let i = 0; i < 12; i += 1) {
      this.time.delayedCall(i * 45, () => this.burst(CANNON_X + Math.cos(i) * 80, CANNON_Y + Math.sin(i) * 48, COLORS.gold));
    }
    if (this.inFlight === 0) this.finishPendingClear();
  }

  finishPendingClear() {
    if (!this.orangeClearPending || this.levelCleared) return;
    this.clearLevel();
  }

  clearLevel() {
    if (this.levelCleared) return;
    this.levelCleared = true;
    const level = this.level.level;
    if (!this.level.editorTest) {
      if (!this.save.completedLevels.includes(level)) this.save.completedLevels.push(level);
      this.save.unlockedLevel = Math.min(TOTAL_LEVELS, Math.max(this.save.unlockedLevel, level + 1));
      this.save.galleryUnlocked = Math.max(this.save.galleryUnlocked, Math.min(REWARD_COUNT, level));
      if (level >= TOTAL_LEVELS) {
        this.save.clearedAll = true;
        this.save.galleryUnlocked = REWARD_COUNT;
      }
      saveProgress(this.save);
    }
    if (!this.orangeClearAnnounced) this.playSfx('clear', { volume: 0.82 });
    this.time.delayedCall(550, () => this.showResult(true));
  }

  failLevel() {
    this.playSfx('fail', { volume: 0.72 });
    this.time.delayedCall(450, () => this.showResult(false));
  }

  showResult(success) {
    this.view = 'result';
    this.resultOverlay?.destroy(true);
    const level = this.level.level;
    const isEditorTest = Boolean(this.level.editorTest);
    const canContinue = !success && this.rewardedContinuesUsed < 1 && !isEditorTest;
    const panelHeight = isEditorTest ? 460 : success ? 1060 : canContinue ? 520 : 430;
    const titleY = success ? 176 : HEIGHT / 2 - 180;
    const scoreY = success ? 238 : HEIGHT / 2 - 106;
    this.resultOverlay = this.add.container(0, 0).setDepth(50);
    this.resultOverlay.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, 720, panelHeight, 0x0e1420, 0.96).setStrokeStyle(2, success ? COLORS.gold : COLORS.red));
    this.resultOverlay.add(this.add.text(WIDTH / 2, titleY, isEditorTest && success ? 'EDITOR TEST CLEAR' : success ? 'STAGE CLEAR' : 'OUT OF BALLS', {
      fontFamily: 'Verdana',
      fontSize: 48,
      fontStyle: '700',
      color: success ? '#ffd35a' : '#ff8ba6',
    }).setOrigin(0.5));
    this.resultOverlay.add(this.add.text(WIDTH / 2, scoreY, `SCORE ${this.score}   TARGET ${this.targetsLeft}`, {
      fontFamily: 'Verdana',
      fontSize: 30,
      color: COLORS.text,
    }).setOrigin(0.5));

    if (success && !isEditorTest) {
      const rewardNumber = Phaser.Math.Clamp(level, 1, REWARD_COUNT);
      this.resultOverlay.add(this.add.text(WIDTH / 2, 300, `LEVEL ${rewardNumber} REWARD UNLOCKED`, {
        fontFamily: 'Verdana',
        fontSize: 22,
        fontStyle: '700',
        color: '#ffd35a',
      }).setOrigin(0.5));
      this.resultOverlay.add(this.add.image(WIDTH / 2, 626, `reward-${rewardNumber}`).setDisplaySize(390, 563));
      const expand = this.button(WIDTH / 2, 938, 320, 54, 'ご褒美を見る', () => {
        this.playSfx('reward', { volume: 0.78 });
        this.showRewardViewer(rewardNumber, 'game');
      }, { fill: 0x4a3d21, stroke: COLORS.gold, size: 21 });
      this.resultOverlay.add([expand.rect, expand.text]);
    }

    if (isEditorTest) {
      this.resultOverlay.add(this.add.text(WIDTH / 2, 312, 'この配置をベースに、形状やパーツ種別を変えて量産できます。', {
        fontFamily: 'Meiryo, Verdana',
        fontSize: 22,
        color: COLORS.muted,
        align: 'center',
        wordWrap: { width: 610 },
      }).setOrigin(0.5));
    }

    if (canContinue) {
      this.resultOverlay.add(this.add.text(WIDTH / 2, HEIGHT / 2 - 54, 'ダミー動画広告を最後まで見ると、弾を3発補充して続行できます。', {
        fontFamily: 'Meiryo, Verdana',
        fontSize: 22,
        color: COLORS.muted,
        align: 'center',
        wordWrap: { width: 610 },
      }).setOrigin(0.5));
      const adButton = this.button(WIDTH / 2, HEIGHT / 2 + 38, 440, 68, '動画広告で +3 BALL', () => this.showRewardedAd(), {
        fill: 0x6b4b18,
        stroke: COLORS.gold,
        size: 24,
      });
      this.resultOverlay.add([adButton.rect, adButton.text]);
      this.resultOverlay.add(this.add.text(WIDTH / 2, HEIGHT / 2 + 92, 'PLACEMENT: rewarded_continue_dummy', {
        fontFamily: 'Verdana',
        fontSize: 16,
        color: '#7f8aa0',
      }).setOrigin(0.5));
    }

    if (isEditorTest) {
      const retry = this.button(WIDTH / 2 - 185, HEIGHT / 2 + 92, 260, 64, 'RETEST', () => this.startEditorTest(), { fill: 0x2c6f84 });
      const edit = this.button(WIDTH / 2 + 185, HEIGHT / 2 + 92, 260, 64, 'EDITOR', () => this.showStageEditor(), { fill: 0x334155, stroke: 0x93c5fd });
      this.resultOverlay.add([retry.rect, retry.text, edit.rect, edit.text]);
    } else {
      const next = Math.min(TOTAL_LEVELS, level + 1);
      const y = success ? 1032 : canContinue ? HEIGHT / 2 + 178 : HEIGHT / 2 + 48;
      const retry = this.button(WIDTH / 2 - 185, y, 260, 64, success && level < TOTAL_LEVELS ? '次へ' : '再挑戦', () => this.startLevel(success && level < TOTAL_LEVELS ? next : level), { fill: 0x2c6f84 });
      const select = this.button(WIDTH / 2 + 185, y, 260, 64, '選択へ', () => this.showLevelSelect());
      const gallery = this.button(WIDTH / 2, y + 90, 300, 58, 'ギャラリー', () => this.showGallery(), { fill: 0x4a3d21, stroke: COLORS.gold });
      this.resultOverlay.add([retry.rect, retry.text, select.rect, select.text, gallery.rect, gallery.text]);
    }
  }

  showRewardedAd() {
    this.view = 'ad';
    this.resultOverlay?.destroy(true);
    const overlay = this.add.container(0, 0).setDepth(70);
    this.adOverlay = overlay;
    overlay.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, 720, 500, 0x080d15, 0.98).setStrokeStyle(2, COLORS.gold));
    overlay.add(this.add.text(WIDTH / 2, HEIGHT / 2 - 178, 'REWARDED AD', {
      fontFamily: 'Verdana',
      fontSize: 48,
      fontStyle: '700',
      color: '#ffd35a',
    }).setOrigin(0.5));
    overlay.add(this.add.text(WIDTH / 2, HEIGHT / 2 - 112, 'DUMMY PLACEMENT', {
      fontFamily: 'Verdana',
      fontSize: 24,
      color: '#34d3e5',
    }).setOrigin(0.5));
    overlay.add(this.add.text(WIDTH / 2, HEIGHT / 2 - 48, 'ここに動画広告SDKのリワード広告を差し込みます。', {
      fontFamily: 'Meiryo, Verdana',
      fontSize: 23,
      color: COLORS.text,
      align: 'center',
      wordWrap: { width: 590 },
    }).setOrigin(0.5));
    const barBack = this.add.rectangle(WIDTH / 2, HEIGHT / 2 + 60, 520, 26, 0x273246, 1);
    const bar = this.add.rectangle(WIDTH / 2 - 260, HEIGHT / 2 + 60, 0, 26, COLORS.gold, 1).setOrigin(0, 0.5);
    const countdown = this.add.text(WIDTH / 2, HEIGHT / 2 + 112, '視聴中 3.0s', {
      fontFamily: 'Meiryo, Verdana',
      fontSize: 22,
      color: COLORS.muted,
    }).setOrigin(0.5);
    overlay.add([barBack, bar, countdown]);

    const duration = 3000;
    this.tweens.add({
      targets: bar,
      displayWidth: 520,
      duration,
      ease: 'Linear',
      onUpdate: (tween) => {
        const left = Math.max(0, (duration * (1 - tween.progress)) / 1000);
        countdown.setText(`視聴中 ${left.toFixed(1)}s`);
      },
      onComplete: () => this.grantRewardedBalls(),
    });
  }

  grantRewardedBalls() {
    this.adOverlay?.destroy(true);
    this.rewardedContinuesUsed += 1;
    this.shotsLeft += 3;
    this.score += 100;
    this.playSfx('reward', { volume: 0.76 });
    this.view = 'game';
    this.refreshHud();
    const toast = this.add.text(WIDTH / 2, 232, '+3 BALL CONTINUE', {
      fontFamily: 'Verdana',
      fontSize: 34,
      fontStyle: '700',
      color: '#ffd35a',
    }).setOrigin(0.5).setDepth(60);
    this.tweens.add({
      targets: toast,
      y: 190,
      alpha: 0,
      duration: 1200,
      ease: 'Cubic.easeOut',
      onComplete: () => toast.destroy(),
    });
  }

  update(time, delta) {
    if (this.view !== 'game') return;
    const dt = delta / 1000;
    if (this.bucket?.active) {
      this.bucket.x += this.bucketDirection * this.level.bucketSpeed * dt;
      if (this.bucket.x < 120 || this.bucket.x > WIDTH - 120) this.bucketDirection *= -1;
      this.bucketVisual?.setPosition(this.bucket.x, this.bucket.y);
    }
    this.updateStageGimmicks(time);

    this.updateAimFromPointer();
    const muzzle = this.getMuzzlePoint(78);
    const barrelRotation = this.currentAim.angle - Math.PI / 2;
    this.cannonBarrel.rotation = barrelRotation;
    this.cannonBarrelShadow.rotation = barrelRotation;
    this.cannonMuzzle.setPosition(muzzle.x, muzzle.y);
    this.drawTrajectory();

    this.balls?.getChildren().slice().forEach((ball) => {
      if (!ball?.active || !ball.body) {
        this.balls?.remove(ball, false, false);
        return;
      }
      if (ball.y > HEIGHT + 90) {
        this.removeBall(ball);
        return;
      }
      if (this.isBallInBucket(ball)) {
        this.catchBall(ball);
        return;
      }
      const speed = Math.hypot(ball.body.velocity.x, ball.body.velocity.y);
      if (speed < 0.6 && ball.y < HEIGHT - 120) {
        ball.stallTime = (ball.stallTime ?? 0) + delta;
        if (ball.stallTime > 360) {
          const nudgeX = Phaser.Math.Clamp((ball.x - WIDTH / 2) * 1.6, -260, 260);
          if (!ball.body) return;
          this.setBodyVelocity(ball, nudgeX / 60, 7.2);
          ball.stallTime = 0;
        }
      } else {
        ball.stallTime = 0;
      }
      if (speed < 1.0 && ball.y > 1030) {
        if (!ball.body) return;
        this.setBodyVelocity(ball, ball.body.velocity.x * 1.04, ball.body.velocity.y + 0.2);
      }
    });
  }

  updateStageGimmicks(time) {
    const seconds = time / 1000;
    this.pegGroup?.getChildren().forEach((peg) => {
      if (!peg?.active || !peg.motion || !peg.body) return;
      const offset = Math.sin(seconds * peg.motion.speed + peg.motion.phase) * peg.motion.amplitude;
      if (peg.motion.axis === 'x') {
        peg.x = peg.baseX + offset;
      } else {
        peg.y = peg.baseY + offset;
      }
      if (peg.body) this.matter.body.setPosition(peg.body, { x: peg.x, y: peg.y });
    });

    this.timedBlockGroup?.getChildren().forEach((block) => {
      if (!block?.active || !block.body) return;
      const wave = Math.sin((time / block.period) * Math.PI * 2 + block.phase);
      const enabled = wave > -0.25;
      block.setAlpha(enabled ? block.baseAlpha : 0.12);
      block.setFillStyle(enabled ? 0x38bdf8 : 0x233044, enabled ? 0.52 : 0.18);
      if (block.body) {
        block.body.isSensor = !enabled;
        block.body.collisionFilter.mask = enabled ? 0xffffffff : 0;
      }
    });

    if (this.spinnerGraphics) {
      this.spinnerGraphics.clear();
      this.spinnerGraphics.lineStyle(5, COLORS.gold, 0.55);
      this.spinnerNodes?.forEach((spinner) => {
        spinner.angle += spinner.speed * (1 / 60);
        const ax = spinner.x + Math.cos(spinner.angle) * spinner.radius;
        const ay = spinner.y + Math.sin(spinner.angle) * spinner.radius;
        const bx = spinner.x + Math.cos(spinner.angle + Math.PI) * spinner.radius;
        const by = spinner.y + Math.sin(spinner.angle + Math.PI) * spinner.radius;
        spinner.a.setPosition(ax, ay);
        spinner.b.setPosition(bx, by);
        if (spinner.a.body) this.matter.body.setPosition(spinner.a.body, { x: ax, y: ay });
        if (spinner.b.body) this.matter.body.setPosition(spinner.b.body, { x: bx, y: by });
        this.spinnerGraphics.lineBetween(ax, ay, bx, by);
      });
    }
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#101521',
  physics: {
    default: 'matter',
    matter: {
      gravity: { y: 1.05 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [PegFanScene],
});

window.pegFanGame = game;
