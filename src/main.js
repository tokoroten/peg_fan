import Phaser from 'phaser';
import './styles.css';

const WIDTH = 900;
const HEIGHT = 1300;
const TOTAL_LEVELS = 100;
const REWARD_COUNT = 100;
const SAVE_KEY = 'peg-fan-save-v1';
const CANNON_X = WIDTH / 2;
const CANNON_Y = 168;
const LAUNCH_SPEED = 660;
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
  clear: 'assets/audio/clear.wav',
  fail: 'assets/audio/fail.wav',
  reward: 'assets/audio/reward.wav',
};

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
  const pattern = level % 5;
  const rows = 6 + Math.min(8, Math.floor(level / 11));
  const cols = 7 + Math.min(5, Math.floor(level / 18));
  const pegs = [];
  const top = 295;
  const left = 105;
  const cellW = (WIDTH - left * 2) / (cols - 1);
  const cellH = 57 + Math.min(11, level / 12);

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (rand() < 0.08 + Math.min(0.11, level / 850)) continue;
      let px = left + x * cellW;
      let py = top + y * cellH;
      if (pattern === 1) px += Math.sin((y + level) * 0.82) * 43;
      if (pattern === 2) py += Math.cos((x + level) * 0.75) * 34;
      if (pattern === 3) px += (y % 2 ? 0.46 : -0.46) * cellW;
      if (pattern === 4) {
        const cx = WIDTH / 2;
        const angle = (x / Math.max(1, cols - 1)) * Math.PI * 2 + y * 0.42;
        const radius = 86 + y * 42;
        px = cx + Math.cos(angle) * radius;
        py = 360 + Math.sin(angle) * radius * 0.34 + y * 38;
      }
      if (px > 76 && px < WIDTH - 76 && py > 270 && py < 1045) {
        pegs.push({ x: px, y: py, type: 'blue' });
      }
    }
  }

  const targetCount = Math.min(24, 9 + Math.floor(level / 6));
  const shuffled = [...pegs].sort(() => rand() - 0.5);
  shuffled.slice(0, targetCount).forEach((peg) => { peg.type = 'orange'; });
  shuffled.slice(targetCount, targetCount + 2 + Math.floor(level / 25)).forEach((peg) => { peg.type = 'green'; });
  shuffled.slice(targetCount + 4, targetCount + 6).forEach((peg) => { peg.type = 'purple'; });
  if (level > 14) {
    shuffled.slice(targetCount + 7, targetCount + 10 + Math.floor(level / 24)).forEach((peg, index) => {
      peg.motion = {
        axis: index % 2 ? 'y' : 'x',
        amplitude: 24 + rand() * 28,
        speed: 0.7 + rand() * 0.55,
        phase: rand() * Math.PI * 2,
      };
    });
  }

  const bricks = [];
  if (level > 5) {
    const brickCount = Math.min(12, 2 + Math.floor(level / 9));
    for (let i = 0; i < brickCount; i += 1) {
      const type = i < Math.floor(brickCount * 0.34) ? 'orange' : rand() < 0.16 ? 'green' : 'blue';
      bricks.push({
        x: 145 + rand() * 610,
        y: 375 + rand() * 485,
        w: 72 + rand() * 48,
        h: 18,
        angle: (rand() - 0.5) * 0.9,
        type,
      });
    }
  }

  const rails = [];
  if (level > 11) {
    const railCount = Math.min(7, 1 + Math.floor(level / 14));
    for (let i = 0; i < railCount; i += 1) {
      rails.push({
        x: 165 + rand() * 570,
        y: 505 + rand() * 395,
        w: 118 + rand() * 86,
        h: 14,
        angle: (rand() - 0.5) * 1.5,
      });
    }
  }

  const timedBlocks = [];
  if (level > 20) {
    const blockCount = Math.min(6, 1 + Math.floor(level / 18));
    for (let i = 0; i < blockCount; i += 1) {
      timedBlocks.push({
        x: 165 + rand() * 570,
        y: 470 + rand() * 460,
        w: 86 + rand() * 76,
        h: 22,
        phase: rand() * Math.PI * 2,
        period: 2300 + rand() * 1500,
      });
    }
  }

  const spinners = [];
  if (level > 30) {
    const spinnerCount = Math.min(4, 1 + Math.floor(level / 24));
    for (let i = 0; i < spinnerCount; i += 1) {
      spinners.push({
        x: 185 + rand() * 530,
        y: 430 + rand() * 430,
        radius: 42 + rand() * 28,
        speed: (rand() < 0.5 ? -1 : 1) * (0.75 + rand() * 0.75),
        phase: rand() * Math.PI * 2,
      });
    }
  }

  const bumpers = [];
  if (level > 9) {
    const bumperCount = Math.min(5, 1 + Math.floor(level / 19));
    for (let i = 0; i < bumperCount; i += 1) {
      bumpers.push({
        x: 150 + rand() * 600,
        y: 415 + rand() * 430,
        r: 24 + rand() * 14,
      });
    }
  }

  return {
    level,
    balls: Math.max(7, 11 - Math.floor(level / 20)),
    targetCount,
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
    this.physics.world.setBounds(36, 0, WIDTH - 72, HEIGHT + 180);
    this.physics.world.setBoundsCollision(true, true, true, false);
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
    this.children.removeAll();
    this.physics.world.colliders.destroy();
    this.balls?.clear(true, true);
    this.pegGroup?.clear(true, true);
    this.brickGroup?.clear(true, true);
    this.railGroup?.clear(true, true);
    this.timedBlockGroup?.clear(true, true);
    this.bumperGroup?.clear(true, true);
    this.spinnerNodeGroup?.clear(true, true);
    this.spinnerGraphics?.destroy();
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

  startLevel(levelNumber) {
    this.view = 'game';
    this.clearScene();
    this.level = generateLevel(levelNumber);
    this.shotsLeft = this.level.balls;
    this.score = 0;
    this.targetsLeft = this.level.pegs.filter((peg) => peg.type === 'orange').length
      + this.level.bricks.filter((brick) => brick.type === 'orange').length;
    this.inFlight = 0;
    this.multiballQueued = false;
    this.rewardedContinuesUsed = 0;
    this.levelCleared = false;
    this.currentAim = { x: 0, y: 1 };

    this.addBackground(`LEVEL ${levelNumber}`);
    this.createAimControls();
    this.createGameUi();
    this.createBucket();
    this.createPegs();
    this.createBricks();
    this.createRails();
    this.createTimedBlocks();
    this.createBumpers();
    this.createSpinners();
    this.balls = this.physics.add.group();
    this.physics.add.collider(this.balls, this.pegGroup, this.hitPeg, undefined, this);
    this.physics.add.collider(this.balls, this.brickGroup, this.hitPeg, undefined, this);
    this.physics.add.collider(this.balls, this.railGroup, this.hitRail, undefined, this);
    this.physics.add.collider(this.balls, this.timedBlockGroup, this.hitRail, undefined, this);
    this.physics.add.collider(this.balls, this.bumperGroup, this.hitBumper, undefined, this);
    this.physics.add.collider(this.balls, this.spinnerNodeGroup, this.hitBumper, undefined, this);
    this.physics.add.overlap(this.balls, this.bucket, this.catchBall, undefined, this);
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

  createPegs() {
    this.pegGroup = this.physics.add.staticGroup();
    this.level.pegs.forEach((data) => {
      const color = data.type === 'orange' ? COLORS.orange : data.type === 'green' ? COLORS.green : data.type === 'purple' ? COLORS.purple : COLORS.blue;
      const peg = this.add.circle(data.x, data.y, 13, color, 1).setStrokeStyle(4, 0xffffff, 0.28);
      peg.pegType = data.type;
      peg.value = data.type === 'orange' ? 300 : data.type === 'purple' ? 500 : data.type === 'green' ? 150 : 80;
      peg.motion = data.motion;
      peg.baseX = data.x;
      peg.baseY = data.y;
      this.physics.add.existing(peg, true);
      peg.body.setCircle(13);
      this.pegGroup.add(peg);
    });
  }

  createBricks() {
    this.brickGroup = this.physics.add.staticGroup();
    this.level.bricks.forEach((data) => {
      const color = data.type === 'orange' ? COLORS.orange : data.type === 'green' ? COLORS.green : COLORS.blue;
      const brick = this.add.rectangle(data.x, data.y, data.w, data.h, color, 1).setStrokeStyle(3, 0xffffff, 0.28);
      brick.rotation = data.angle;
      brick.pegType = data.type;
      brick.value = data.type === 'orange' ? 450 : data.type === 'green' ? 220 : 120;
      this.physics.add.existing(brick, true);
      brick.body.setSize(data.w, data.h);
      brick.body.updateFromGameObject();
      this.brickGroup.add(brick);
    });
  }

  createRails() {
    this.railGroup = this.physics.add.staticGroup();
    this.level.rails.forEach((data) => {
      const rail = this.add.rectangle(data.x, data.y, data.w, data.h, 0x8ea2c7, 0.35).setStrokeStyle(2, 0xdbeafe, 0.45);
      rail.rotation = data.angle;
      this.physics.add.existing(rail, true);
      rail.body.setSize(data.w, data.h);
      rail.body.updateFromGameObject();
      this.railGroup.add(rail);
    });
  }

  createTimedBlocks() {
    this.timedBlockGroup = this.physics.add.staticGroup();
    this.level.timedBlocks.forEach((data) => {
      const block = this.add.rectangle(data.x, data.y, data.w, data.h, 0x38bdf8, 0.52).setStrokeStyle(2, 0xe0f2fe, 0.72);
      block.period = data.period;
      block.phase = data.phase;
      block.baseAlpha = 0.52;
      this.physics.add.existing(block, true);
      block.body.setSize(data.w, data.h);
      this.timedBlockGroup.add(block);
    });
  }

  createBumpers() {
    this.bumperGroup = this.physics.add.staticGroup();
    this.level.bumpers.forEach((data) => {
      const bumper = this.add.circle(data.x, data.y, data.r, 0xe7eef8, 0.18).setStrokeStyle(5, COLORS.cyan, 0.72);
      this.physics.add.existing(bumper, true);
      bumper.body.setCircle(data.r);
      this.bumperGroup.add(bumper);
    });
  }

  createSpinners() {
    this.spinnerGraphics = this.add.graphics().setDepth(3);
    this.spinnerNodeGroup = this.physics.add.staticGroup();
    this.spinnerNodes = [];
    this.level.spinners.forEach((data) => {
      const hub = this.add.circle(data.x, data.y, 12, 0xf8fafc, 0.3).setStrokeStyle(3, COLORS.gold, 0.85);
      const a = this.add.circle(data.x + data.radius, data.y, 16, 0xfef08a, 0.9).setStrokeStyle(3, 0x8b6814);
      const b = this.add.circle(data.x - data.radius, data.y, 16, 0xfef08a, 0.9).setStrokeStyle(3, 0x8b6814);
      [hub, a, b].forEach((node) => {
        this.physics.add.existing(node, true);
        node.body.setCircle(node.radius ?? 12);
        this.spinnerNodeGroup.add(node);
      });
      this.spinnerNodes.push({ ...data, hub, a, b, angle: data.phase });
    });
  }

  createBucket() {
    this.bucket = this.add.rectangle(WIDTH / 2, HEIGHT - 74, 158, 36, 0x202a3d, 1).setStrokeStyle(4, COLORS.gold);
    this.physics.add.existing(this.bucket);
    this.bucket.body.setAllowGravity(false).setImmovable(true);
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
      if (rect?.active && rect.visible !== false) rects.push({ x: rect.x, y: rect.y, w: rect.width + 16, h: rect.height + 16 });
    });
    this.railGroup?.getChildren().forEach((rect) => {
      if (rect?.active && rect.visible !== false) rects.push({ x: rect.x, y: rect.y, w: rect.width + 16, h: rect.height + 16 });
    });
    this.timedBlockGroup?.getChildren().forEach((rect) => {
      if (rect?.active && rect.visible !== false && rect.body?.enable !== false) rects.push({ x: rect.x, y: rect.y, w: rect.width + 16, h: rect.height + 16 });
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
      if (Math.abs(x - rect.x) < rect.w / 2 && Math.abs(y - rect.y) < rect.h / 2) {
        const dx = (x - rect.x) / rect.w;
        const dy = (y - rect.y) / rect.h;
        if (Math.abs(dx) > Math.abs(dy)) return { nx: Math.sign(dx) || 1, ny: 0 };
        return { nx: 0, ny: Math.sign(dy) || 1 };
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
    if (this.view !== 'game' || this.inFlight > 0 || this.shotsLeft <= 0) return;
    this.currentAim = this.calculateAim(pointer);
    const muzzle = this.getMuzzlePoint(76);
    this.spawnBall(
      muzzle.x,
      muzzle.y,
      this.currentAim.x * LAUNCH_SPEED,
      this.currentAim.y * LAUNCH_SPEED,
    );
    this.flashLaunch();
    this.playSfx('launch', { volume: 0.55 });
    this.shotsLeft -= 1;
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

  reflectBallFrom(ball, x, y, minSpeed = 520, boost = 1.04) {
    let vx = ball.body.velocity.x;
    let vy = ball.body.velocity.y;
    if (Math.hypot(vx, vy) < 80) {
      vx = this.currentAim.x * LAUNCH_SPEED;
      vy = this.currentAim.y * LAUNCH_SPEED;
    }
    let nx = ball.x - x;
    let ny = ball.y - y;
    const normalLength = Math.hypot(nx, ny) || 1;
    nx /= normalLength;
    ny /= normalLength;
    const dot = vx * nx + vy * ny;
    let rvx = (vx - 2 * dot * nx) * boost;
    let rvy = (vy - 2 * dot * ny) * boost;
    const speed = Math.hypot(rvx, rvy) || 1;
    if (speed < minSpeed) {
      const scale = minSpeed / speed;
      rvx *= scale;
      rvy *= scale;
    }
    this.time.delayedCall(0, () => {
      if (!ball.active || !ball.body) return;
      ball.body.velocity.set(rvx, rvy);
    });
  }

  hitRail(ball, obstacle) {
    this.reflectBallFrom(ball, obstacle.x, obstacle.y, 560, 1.03);
    this.playSfx('bumper', { volume: 0.42 });
  }

  spawnBall(x, y, vx, vy) {
    const ball = this.add.circle(x, y, 11, 0xffffff, 1).setStrokeStyle(3, COLORS.gold);
    this.physics.add.existing(ball);
    this.balls.add(ball);
    ball.body.setCircle(11);
    ball.body.setBounce(0.94, 0.94);
    ball.body.setDrag(3, 0);
    ball.body.setCollideWorldBounds(true);
    ball.body.velocity.set(vx, vy);
    this.inFlight += 1;
  }

  hitPeg(ball, peg) {
    if (peg.hit) return;
    peg.hit = true;
    this.reflectBallFrom(ball, peg.x, peg.y, 500, 1.02);
    this.score += peg.value;
    if (peg.pegType === 'orange') this.targetsLeft -= 1;
    if (peg.pegType === 'green') this.multiballQueued = true;
    this.playSfx(peg.pegType === 'orange' ? 'orange' : peg.pegType === 'green' ? 'green' : 'peg', { volume: peg.pegType === 'orange' ? 0.72 : 0.58 });
    this.burst(peg.x, peg.y, peg.fillColor ?? COLORS.gold);
    this.popText(peg.x, peg.y - 20, `+${peg.value}`, peg.pegType === 'orange' ? '#ffb088' : '#dbeafe');
    this.tweens.add({
      targets: peg,
      scale: 1.85,
      alpha: 0,
      duration: 190,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.pegGroup.remove(peg, true, true);
      },
    });
    if (this.multiballQueued && this.inFlight === 1) {
      this.multiballQueued = false;
      this.spawnBall(ball.x, ball.y, -ball.body.velocity.x * 0.7, ball.body.velocity.y * 0.8);
    }
    this.refreshHud();
    if (this.targetsLeft <= 0) this.clearLevel();
  }

  hitBumper(ball) {
    this.score += 35;
    this.reflectBallFrom(ball, ball.x, ball.y - 1, 620, 1.12);
    this.playSfx('bumper', { volume: 0.5 });
    this.burst(ball.x, ball.y, COLORS.cyan);
    this.refreshHud();
  }

  catchBall(objectA, objectB) {
    const ball = this.balls?.contains(objectA) ? objectA : this.balls?.contains(objectB) ? objectB : null;
    if (!ball || ball === this.bucket) return;
    if (ball.caught) return;
    ball.caught = true;
    this.shotsLeft += 1;
    this.score += 250;
    this.playSfx('catch', { volume: 0.7 });
    this.popText(this.bucket.x, this.bucket.y - 42, '+1 BALL', '#ffd35a');
    this.removeBall(ball);
    this.refreshHud();
  }

  removeBall(ball) {
    if (!ball?.active) return;
    this.inFlight = Math.max(0, this.inFlight - 1);
    this.balls?.remove(ball, false, false);
    ball.destroy();
    if (this.inFlight === 0 && this.shotsLeft <= 0 && this.targetsLeft > 0) this.failLevel();
  }

  clearLevel() {
    if (this.levelCleared) return;
    this.levelCleared = true;
    const level = this.level.level;
    if (!this.save.completedLevels.includes(level)) this.save.completedLevels.push(level);
    this.save.unlockedLevel = Math.min(TOTAL_LEVELS, Math.max(this.save.unlockedLevel, level + 1));
    this.save.galleryUnlocked = Math.max(this.save.galleryUnlocked, Math.min(REWARD_COUNT, level));
    if (level >= TOTAL_LEVELS) {
      this.save.clearedAll = true;
      this.save.galleryUnlocked = REWARD_COUNT;
    }
    saveProgress(this.save);
    this.playSfx('clear', { volume: 0.82 });
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
    const canContinue = !success && this.rewardedContinuesUsed < 1;
    const panelHeight = success ? 1060 : canContinue ? 520 : 430;
    const titleY = success ? 176 : HEIGHT / 2 - 180;
    const scoreY = success ? 238 : HEIGHT / 2 - 106;
    this.resultOverlay = this.add.container(0, 0).setDepth(50);
    this.resultOverlay.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, 720, panelHeight, 0x0e1420, 0.96).setStrokeStyle(2, success ? COLORS.gold : COLORS.red));
    this.resultOverlay.add(this.add.text(WIDTH / 2, titleY, success ? 'STAGE CLEAR' : 'OUT OF BALLS', {
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

    if (success) {
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

    const next = Math.min(TOTAL_LEVELS, level + 1);
    const y = success ? 1032 : canContinue ? HEIGHT / 2 + 178 : HEIGHT / 2 + 48;
    const retry = this.button(WIDTH / 2 - 185, y, 260, 64, success && level < TOTAL_LEVELS ? '次へ' : '再挑戦', () => this.startLevel(success && level < TOTAL_LEVELS ? next : level), { fill: 0x2c6f84 });
    const select = this.button(WIDTH / 2 + 185, y, 260, 64, '選択へ', () => this.showLevelSelect());
    const gallery = this.button(WIDTH / 2, y + 90, 300, 58, 'ギャラリー', () => this.showGallery(), { fill: 0x4a3d21, stroke: COLORS.gold });
    this.resultOverlay.add([retry.rect, retry.text, select.rect, select.text, gallery.rect, gallery.text]);
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
    if (this.bucket?.active && this.bucket.body) {
      this.bucket.x += this.bucketDirection * this.level.bucketSpeed * dt;
      if (this.bucket.x < 120 || this.bucket.x > WIDTH - 120) this.bucketDirection *= -1;
      this.bucket.body.updateFromGameObject?.();
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
      const speed = Math.hypot(ball.body.velocity.x, ball.body.velocity.y);
      if (speed < 55 && ball.y < HEIGHT - 120) {
        ball.stallTime = (ball.stallTime ?? 0) + delta;
        if (ball.stallTime > 360) {
          const nudgeX = Phaser.Math.Clamp((ball.x - WIDTH / 2) * 1.6, -260, 260);
          if (!ball.body) return;
          ball.body.velocity.set(nudgeX, 430);
          ball.stallTime = 0;
        }
      } else {
        ball.stallTime = 0;
      }
      if (speed < 80 && ball.y > 1030) {
        if (!ball.body) return;
        ball.body.velocity.set(ball.body.velocity.x * 1.04, ball.body.velocity.y + 12);
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
      peg.body.updateFromGameObject?.();
    });

    this.timedBlockGroup?.getChildren().forEach((block) => {
      if (!block?.active || !block.body) return;
      const wave = Math.sin((time / block.period) * Math.PI * 2 + block.phase);
      const enabled = wave > -0.25;
      block.setAlpha(enabled ? block.baseAlpha : 0.12);
      block.setFillStyle(enabled ? 0x38bdf8 : 0x233044, enabled ? 0.52 : 0.18);
      block.body.enable = enabled;
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
        spinner.a.body?.updateFromGameObject?.();
        spinner.b.body?.updateFromGameObject?.();
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
    default: 'arcade',
    arcade: {
      gravity: { y: 760 },
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
