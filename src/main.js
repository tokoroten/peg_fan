import Phaser from 'phaser';
import './styles.css';

const WIDTH = 900;
const HEIGHT = 1300;
const TOTAL_LEVELS = 100;
const SAVE_KEY = 'peg-fan-save-v1';
const CHARACTER_ASSETS = [
  'assets/characters/character-1.svg',
  'assets/characters/character-2.svg',
  'assets/characters/character-3.svg',
  'assets/characters/character-4.svg',
  'assets/characters/character-5.svg',
];

const COLORS = {
  panel: 0x141b2a,
  panel2: 0x202a3d,
  text: '#f6f8fc',
  muted: '#aab5c8',
  gold: '#ffd35a',
  cyan: '#34d3e5',
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
  }

  create() {
    this.save = loadSave();
    this.physics.world.setBounds(36, 0, WIDTH - 72, HEIGHT + 180);
    this.physics.world.setBoundsCollision(true, true, true, false);
    this.input.on('pointerdown', () => this.launchBall());
    this.input.keyboard?.on('keydown-SPACE', () => this.launchBall());
    this.input.keyboard?.on('keydown-ESC', () => this.showMenu());
    this.showMenu();
  }

  clearScene() {
    this.children.removeAll();
    this.physics.world.colliders.destroy();
    this.balls?.clear(true, true);
    this.pegGroup?.clear(true, true);
    this.bumperGroup?.clear(true, true);
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
        .on('pointerdown', onClick);
      text.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
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
      color: COLORS.gold,
      fontStyle: '700',
    });
    this.add.text(54, 178, '狙って撃ち、オレンジペグをすべて消す。\n20ステージごとにギャラリーが解放されます。', {
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

    this.addProgressPanel();
    this.add.text(54, 1160, '操作: マウス/タッチで照準、クリックで発射、Spaceでも発射、Escでメニュー', {
      fontFamily: 'Meiryo, Verdana',
      fontSize: 20,
      color: '#95a1b8',
    });
  }

  addProgressPanel() {
    this.add.rectangle(450, 715, 792, 430, 0x111827, 0.9).setStrokeStyle(2, 0x2f3a4d);
    this.add.text(86, 534, 'PROGRESS', { fontFamily: 'Verdana', fontSize: 28, fontStyle: '700', color: COLORS.text });
    this.add.text(86, 590, `解放ステージ: ${this.save.unlockedLevel} / ${TOTAL_LEVELS}`, { fontFamily: 'Meiryo, Verdana', fontSize: 28, color: COLORS.text });
    this.add.text(86, 638, `閲覧可能イラスト: ${this.save.galleryUnlocked} / 5`, { fontFamily: 'Meiryo, Verdana', fontSize: 28, color: COLORS.text });
    const barX = 86;
    const barY = 710;
    this.add.rectangle(barX + 335, barY, 670, 28, 0x253044);
    this.add.rectangle(barX, barY, 670 * ((this.save.unlockedLevel - 1) / TOTAL_LEVELS), 28, COLORS.gold).setOrigin(0, 0.5);
    for (let i = 0; i < 5; i += 1) {
      const unlocked = i < this.save.galleryUnlocked;
      this.add.image(162 + i * 145, 875, `character-${i + 1}`).setDisplaySize(104, 150).setAlpha(unlocked ? 1 : 0.25);
      this.add.text(112 + i * 145, 970, unlocked ? 'OPEN' : `L${(i + 1) * 20}`, {
        fontFamily: 'Verdana',
        fontSize: 18,
        fontStyle: '700',
        color: unlocked ? COLORS.gold : '#69758c',
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
    this.add.text(54, 124, '20ステージごとに1枚解放。\n画像は public/assets/characters の同名ファイル差し替えで更新できます。', {
      fontFamily: 'Meiryo, Verdana',
      fontSize: 21,
      color: COLORS.muted,
      wordWrap: { width: 790 },
    });
    for (let i = 0; i < 5; i += 1) {
      const x = 155 + (i % 3) * 295;
      const y = i < 3 ? 475 : 900;
      const unlocked = i < this.save.galleryUnlocked || this.save.clearedAll;
      this.add.rectangle(x, y, 236, 340, 0x111827, 0.92).setStrokeStyle(2, unlocked ? COLORS.gold : 0x3b4658);
      this.add.image(x, y - 14, `character-${i + 1}`).setDisplaySize(200, 289).setAlpha(unlocked ? 1 : 0.18);
      if (!unlocked) {
        this.add.text(x, y, `LEVEL ${(i + 1) * 20}`, { fontFamily: 'Verdana', fontSize: 28, fontStyle: '700', color: '#768299' }).setOrigin(0.5);
      }
    }
  }

  startLevel(levelNumber) {
    this.view = 'game';
    this.clearScene();
    this.level = generateLevel(levelNumber);
    this.shotsLeft = this.level.balls;
    this.score = 0;
    this.targetsLeft = this.level.pegs.filter((peg) => peg.type === 'orange').length;
    this.inFlight = 0;
    this.multiballQueued = false;
    this.rewardedContinuesUsed = 0;
    this.levelCleared = false;

    this.addBackground(`LEVEL ${levelNumber}`);
    this.createGameUi();
    this.createBucket();
    this.createPegs();
    this.createBumpers();
    this.balls = this.physics.add.group();
    this.physics.add.collider(this.balls, this.pegGroup, this.hitPeg, undefined, this);
    this.physics.add.collider(this.balls, this.bumperGroup, this.hitBumper, undefined, this);
    this.physics.add.overlap(this.balls, this.bucket, this.catchBall, undefined, this);
    this.aimLine = this.add.line(0, 0, WIDTH / 2, 168, WIDTH / 2, 168, COLORS.gold, 0.78).setLineWidth(4, 2);
    this.cannon = this.add.triangle(WIDTH / 2, 168, -30, 24, 30, 24, 0, -42, COLORS.gold).setStrokeStyle(3, 0x7a5d10);
    this.refreshHud();
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
      this.physics.add.existing(peg, true);
      peg.body.setCircle(13);
      this.pegGroup.add(peg);
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

  launchBall() {
    if (this.view !== 'game' || this.inFlight > 0 || this.shotsLeft <= 0) return;
    const pointer = this.input.activePointer;
    const dx = Phaser.Math.Clamp(pointer.worldX - WIDTH / 2, -430, 430);
    const dy = Phaser.Math.Clamp(pointer.worldY - 168, 120, 900);
    const len = Math.max(1, Math.hypot(dx, dy));
    this.spawnBall(WIDTH / 2, 168, (dx / len) * 610, (dy / len) * 610);
    this.shotsLeft -= 1;
    this.refreshHud();
  }

  spawnBall(x, y, vx, vy) {
    const ball = this.add.circle(x, y, 11, 0xffffff, 1).setStrokeStyle(3, COLORS.gold);
    this.physics.add.existing(ball);
    ball.body.setCircle(11);
    ball.body.setBounce(0.94, 0.94);
    ball.body.setDrag(3, 0);
    ball.body.setVelocity(vx, vy);
    ball.body.setCollideWorldBounds(true);
    this.balls.add(ball);
    this.inFlight += 1;
  }

  hitPeg(ball, peg) {
    if (peg.hit) return;
    peg.hit = true;
    this.score += peg.value;
    if (peg.pegType === 'orange') this.targetsLeft -= 1;
    if (peg.pegType === 'green') this.multiballQueued = true;
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
    ball.body.velocity.scale(1.04);
    if (this.multiballQueued && this.inFlight === 1) {
      this.multiballQueued = false;
      this.spawnBall(ball.x, ball.y, -ball.body.velocity.x * 0.7, ball.body.velocity.y * 0.8);
    }
    this.refreshHud();
    if (this.targetsLeft <= 0) this.clearLevel();
  }

  hitBumper(ball) {
    this.score += 35;
    ball.body.velocity.scale(1.08);
    this.refreshHud();
  }

  catchBall(ball) {
    if (ball.caught) return;
    ball.caught = true;
    this.shotsLeft += 1;
    this.score += 250;
    this.removeBall(ball);
    this.refreshHud();
  }

  removeBall(ball) {
    this.inFlight = Math.max(0, this.inFlight - 1);
    ball.destroy();
    if (this.inFlight === 0 && this.shotsLeft <= 0 && this.targetsLeft > 0) this.failLevel();
  }

  clearLevel() {
    if (this.levelCleared) return;
    this.levelCleared = true;
    const level = this.level.level;
    if (!this.save.completedLevels.includes(level)) this.save.completedLevels.push(level);
    this.save.unlockedLevel = Math.min(TOTAL_LEVELS, Math.max(this.save.unlockedLevel, level + 1));
    this.save.galleryUnlocked = Math.max(this.save.galleryUnlocked, Math.min(5, Math.floor(level / 20)));
    if (level >= TOTAL_LEVELS) {
      this.save.clearedAll = true;
      this.save.galleryUnlocked = 5;
    }
    saveProgress(this.save);
    this.time.delayedCall(550, () => this.showResult(true));
  }

  failLevel() {
    this.time.delayedCall(450, () => this.showResult(false));
  }

  showResult(success) {
    this.view = 'result';
    this.resultOverlay?.destroy(true);
    const level = this.level.level;
    const canContinue = !success && this.rewardedContinuesUsed < 1;
    this.resultOverlay = this.add.container(0, 0).setDepth(50);
    this.resultOverlay.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, 720, canContinue ? 520 : 430, 0x0e1420, 0.96).setStrokeStyle(2, success ? COLORS.gold : COLORS.red));
    this.resultOverlay.add(this.add.text(WIDTH / 2, HEIGHT / 2 - 180, success ? 'STAGE CLEAR' : 'OUT OF BALLS', {
      fontFamily: 'Verdana',
      fontSize: 48,
      fontStyle: '700',
      color: success ? COLORS.gold : '#ff8ba6',
    }).setOrigin(0.5));
    this.resultOverlay.add(this.add.text(WIDTH / 2, HEIGHT / 2 - 106, `SCORE ${this.score}   TARGET ${this.targetsLeft}`, {
      fontFamily: 'Verdana',
      fontSize: 30,
      color: COLORS.text,
    }).setOrigin(0.5));

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
    const y = canContinue ? HEIGHT / 2 + 178 : HEIGHT / 2 + 48;
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
      color: COLORS.gold,
    }).setOrigin(0.5));
    overlay.add(this.add.text(WIDTH / 2, HEIGHT / 2 - 112, 'DUMMY PLACEMENT', {
      fontFamily: 'Verdana',
      fontSize: 24,
      color: COLORS.cyan,
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
    this.view = 'game';
    this.refreshHud();
    const toast = this.add.text(WIDTH / 2, 232, '+3 BALL CONTINUE', {
      fontFamily: 'Verdana',
      fontSize: 34,
      fontStyle: '700',
      color: COLORS.gold,
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

  update(_, delta) {
    if (this.view !== 'game') return;
    const dt = delta / 1000;
    this.bucket.x += this.bucketDirection * this.level.bucketSpeed * dt;
    if (this.bucket.x < 120 || this.bucket.x > WIDTH - 120) this.bucketDirection *= -1;
    this.bucket.body.updateFromGameObject();

    const pointer = this.input.activePointer;
    const endX = Phaser.Math.Clamp(pointer.worldX, 70, WIDTH - 70);
    const endY = Phaser.Math.Clamp(pointer.worldY, 290, HEIGHT - 170);
    this.aimLine.setTo(WIDTH / 2, 168, endX, endY);
    this.cannon.rotation = Phaser.Math.Angle.Between(WIDTH / 2, 168, endX, endY) + Math.PI / 2;

    this.balls?.getChildren().forEach((ball) => {
      if (ball.y > HEIGHT + 90) this.removeBall(ball);
      if (ball.body?.speed < 80 && ball.y > 1030) {
        ball.body.setVelocity(ball.body.velocity.x * 1.04, ball.body.velocity.y + 12);
      }
    });
  }
}

new Phaser.Game({
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
