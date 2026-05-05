import Phaser from 'phaser';
import './styles.css';

const WIDTH = 900;
const HEIGHT = 1300;
const TOTAL_LEVELS = 100;
const REWARD_COUNT = 100;
const SAVE_KEY = 'peg-fan-save-v1';
const EDITOR_SAVE_KEY = 'peg-fan-editor-v1';
const EDITOR_STAGE_SLOTS_KEY = 'peg-fan-editor-stage-slots-v1';
const STAGE_OVERRIDE_KEY_PREFIX = 'peg-fan-stage-override-v1-';
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
const EDITOR_MODES = ['concept', 'procedural', 'manual'];
const EDITOR_MANUAL_TOOLS = ['peg', 'brick', 'rail', 'bumper', 'timed', 'spinner', 'erase'];
const EDITOR_CONCEPTS = [
  { key: 'open arcs', label: 'OPEN ARCS', description: '角度学習用の開いた弧と下段セーフティレール。' },
  { key: 'cross lanes', label: 'CROSS LANES', description: '左右から交差するレーンと斜め反射。' },
  { key: 'spiral core', label: 'SPIRAL CORE', description: '中央へ吸い込ませる螺旋と回転ギミック。' },
  { key: 'timed waves', label: 'TIMED WAVES', description: '波形配置と時間で消えるブロック。' },
  { key: 'maze gates', label: 'MAZE GATES', description: '隙間を通すゲート型ペグ迷路。' },
  { key: 'twin orbits', label: 'TWIN ORBITS', description: '2つの軌道、中央ターゲット、バンパー。' },
  { key: 'moving ribbons', label: 'MOVING RIBBONS', description: '動くペグ列とタイミング要求。' },
  { key: 'rail gauntlet', label: 'RAIL GAUNTLET', description: '連続レール反射を使う耐久配置。' },
  { key: 'clockwork rings', label: 'CLOCKWORK', description: '同心円と回転体でリズムを作る配置。' },
  { key: 'final exam', label: 'FINAL EXAM', description: '複数ギミックを組み合わせた最終試験。' },
];
const EDITOR_CONCEPT_DESCRIPTIONS = [
  'Open arcs teach bank angles and safe lower rebounds.',
  'Crossing lanes ask for diagonal reflection shots.',
  'Spirals pull the ball toward a dense central route.',
  'Wave patterns mix with timed disappearing blocks.',
  'Gate gaps turn the board into a readable peg maze.',
  'Twin rings, center targets, and bumpers create orbit shots.',
  'Moving peg ribbons reward timing and delayed shots.',
  'Rail chains push the player into controlled ricochets.',
  'Concentric rings and spinners create rhythm shots.',
  'A combined test of arcs, gates, motion, rails, and timing.',
];
const EDITOR_GRID = 32;
const EDITOR_SLOT_COUNT = 6;
const EDITOR_STAGE_COUNT = 100;
const MANUAL_BRICK_THICKNESS = 18;
const MANUAL_RAIL_THICKNESS = 13;

const COLORS = {
  panel: 0x141b2a,
  panel2: 0x202a3d,
  ink: 0x08111f,
  line: 0x31425f,
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
    mode: 'concept',
    conceptIndex: 0,
    conceptAct: 0,
    slotIndex: 0,
    stageEditLevel: 1,
    manualTool: 'peg',
    gridSnap: false,
    selectedManualIndex: -1,
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

function loadEditorSlots() {
  const fallback = Array.from({ length: EDITOR_SLOT_COUNT }, () => null);
  try {
    const parsed = JSON.parse(localStorage.getItem(EDITOR_STAGE_SLOTS_KEY) || '[]');
    return fallback.map((slot, index) => parsed[index] ?? slot);
  } catch {
    return fallback;
  }
}

function saveEditorSlots(slots) {
  localStorage.setItem(EDITOR_STAGE_SLOTS_KEY, JSON.stringify(slots.slice(0, EDITOR_SLOT_COUNT)));
}

function clampEditorState(state) {
  return {
    ...state,
    shape: EDITOR_SHAPES.includes(state.shape) ? state.shape : 'circle',
    part: EDITOR_PARTS.includes(state.part) ? state.part : 'mixed',
    type: EDITOR_TYPES.includes(state.type) ? state.type : 'auto',
    count: Phaser.Math.Clamp(Math.round(state.count), 12, 140),
    radius: Phaser.Math.Clamp(Math.round(state.radius), 80, 380),
    turns: Phaser.Math.Clamp(Math.round(state.turns), 1, 8),
    spread: Phaser.Math.Clamp(Number(state.spread), 0.55, 1.45),
    balls: Phaser.Math.Clamp(Math.round(state.balls), 5, 18),
    mode: EDITOR_MODES.includes(state.mode) ? state.mode : 'procedural',
    conceptIndex: Phaser.Math.Clamp(Math.round(state.conceptIndex ?? 0), 0, EDITOR_CONCEPTS.length - 1),
    conceptAct: Phaser.Math.Clamp(Math.round(state.conceptAct ?? 0), 0, 9),
    slotIndex: Phaser.Math.Clamp(Math.round(state.slotIndex ?? 0), 0, EDITOR_SLOT_COUNT - 1),
    stageEditLevel: Phaser.Math.Clamp(Math.round(state.stageEditLevel ?? 1), 1, EDITOR_STAGE_COUNT),
    manualTool: EDITOR_MANUAL_TOOLS.includes(state.manualTool) ? state.manualTool : 'peg',
    gridSnap: Boolean(state.gridSnap),
    selectedManualIndex: Phaser.Math.Clamp(Math.round(state.selectedManualIndex ?? -1), -1, Math.max(-1, (state.manualObjects?.length ?? 0) - 1)),
    manualObjects: Array.isArray(state.manualObjects) ? state.manualObjects.slice(0, 240) : [],
  };
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function centerOfPoints(points) {
  return points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
}

function rotatePointAround(point, center, angle) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

function stageOverrideKey(level) {
  return `${STAGE_OVERRIDE_KEY_PREFIX}${String(level).padStart(3, '0')}`;
}

function normalizeLevelForPlay(level, fallbackLevel = 1) {
  const safe = clonePlain(level ?? {});
  safe.level = fallbackLevel;
  safe.pegs = Array.isArray(safe.pegs) ? safe.pegs : [];
  safe.bricks = Array.isArray(safe.bricks) ? safe.bricks : [];
  safe.rails = Array.isArray(safe.rails) ? safe.rails : [];
  safe.timedBlocks = Array.isArray(safe.timedBlocks) ? safe.timedBlocks : [];
  safe.spinners = Array.isArray(safe.spinners) ? safe.spinners : [];
  safe.bumpers = Array.isArray(safe.bumpers) ? safe.bumpers : [];
  safe.balls = Phaser.Math.Clamp(Math.round(safe.balls ?? (11 - Math.floor(fallbackLevel / 22))), 5, 18);
  safe.targetCount = safe.pegs.filter((peg) => peg.type === 'orange').length
    + safe.bricks.filter((brick) => brick.type === 'orange').length;
  safe.bucketSpeed = safe.bucketSpeed ?? (130 + Math.min(135, fallbackLevel * 2.5));
  safe.rewardIndex = safe.rewardIndex ?? Math.min(4, Math.floor((fallbackLevel - 1) / 20));
  return safe;
}

function auditLevelData(level) {
  const objects = (level.pegs?.length ?? 0)
    + (level.bricks?.length ?? 0)
    + (level.rails?.length ?? 0)
    + (level.timedBlocks?.length ?? 0)
    + (level.spinners?.length ?? 0)
    + (level.bumpers?.length ?? 0);
  const targetCount = level.targetCount ?? 0;
  const flags = [];
  if (targetCount < 1) flags.push('NO_ORANGE');
  if (targetCount > 32) flags.push('TOO_MANY_TARGETS');
  if ((level.pegs?.length ?? 0) + (level.bricks?.length ?? 0) < 18) flags.push('TOO_SPARSE');
  if (objects > 145) flags.push('TOO_DENSE');
  if ((level.balls ?? 0) < 6) flags.push('LOW_BALLS');
  if (!level.concept && !level.editorTest) flags.push('NO_CONCEPT');
  return {
    level: level.level,
    concept: level.concept ?? 'custom',
    objects,
    targetCount,
    balls: level.balls,
    moving: (level.pegs ?? []).filter((peg) => peg.motion).length,
    hazards: (level.timedBlocks?.length ?? 0) + (level.spinners?.length ?? 0) + (level.rails?.length ?? 0),
    flags,
  };
}

function quadFromCenter(x, y, width, height, angle = 0, skew = 0, taper = 0) {
  const halfW = Math.max(4, width) / 2;
  const halfH = Math.max(4, height) / 2;
  const topW = halfW * Phaser.Math.Clamp(1 - taper, 0.25, 1.75);
  const bottomW = halfW * Phaser.Math.Clamp(1 + taper, 0.25, 1.75);
  const local = [
    { x: -topW + skew, y: -halfH },
    { x: topW + skew, y: -halfH },
    { x: bottomW - skew, y: halfH },
    { x: -bottomW - skew, y: halfH },
  ];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return local.map((point) => ({
    x: x + point.x * cos - point.y * sin,
    y: y + point.x * sin + point.y * cos,
  }));
}

function segmentQuad(start, end, thickness, overlap = 0) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy * thickness / 2;
  const ny = ux * thickness / 2;
  const sx = start.x - ux * overlap;
  const sy = start.y - uy * overlap;
  const ex = end.x + ux * overlap;
  const ey = end.y + uy * overlap;
  return [
    { x: sx + nx, y: sy + ny },
    { x: ex + nx, y: ey + ny },
    { x: ex - nx, y: ey - ny },
    { x: sx - nx, y: sy - ny },
  ];
}

function normalizeQuad(data) {
  if (Array.isArray(data?.vertices) && data.vertices.length >= 4) {
    return data.vertices.slice(0, 4).map((point) => ({ x: Number(point.x), y: Number(point.y) }));
  }
  return quadFromCenter(data.x, data.y, data.w ?? 80, data.h ?? 16, data.angle ?? 0, data.skew ?? 0, data.taper ?? 0);
}

function edgeDistance(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = Phaser.Math.Clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq, 0, 1);
  const px = a.x + dx * t;
  const py = a.y + dy * t;
  return { distance: Math.hypot(point.x - px, point.y - py), px, py };
}

function pointInPolygon(point, vertices) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
    const a = vertices[i];
    const b = vertices[j];
    if (((a.y > point.y) !== (b.y > point.y)) && (point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1) + a.x)) inside = !inside;
  }
  return inside;
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
  const chapter = Math.floor((level - 1) / 10);
  const act = (level - 1) % 10;
  const variant = act / 9;
  const difficulty = Phaser.Math.Clamp(level / TOTAL_LEVELS, 0, 1);
  const countScale = 0.9 + difficulty * 0.42;
  const board = { left: 88, right: 812, top: 300, bottom: 1010 };
  const addPeg = (x, y, type = 'blue', motion = null) => {
    if (x > 72 && x < WIDTH - 72 && y > 270 && y < 1048) pegs.push({ x, y, type, motion });
  };
  const addTarget = (x, y, motion = null) => addPeg(x, y, 'orange', motion);
  const addRing = (cx, cy, rx, ry, count, offset = 0, typeFn = null) => {
    for (let i = 0; i < count; i += 1) {
      const angle = offset + (i / count) * Math.PI * 2;
      addPeg(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry, typeFn ? typeFn(i, angle) : 'blue');
    }
  };
  const addArc = (cx, cy, rx, ry, start, end, count, typeFn = null) => {
    for (let i = 0; i < count; i += 1) {
      const t = count <= 1 ? 0 : i / (count - 1);
      const angle = start + (end - start) * t;
      addPeg(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry, typeFn ? typeFn(i, t) : 'blue');
    }
  };
  const addLine = (a, b, count, typeFn = null, wave = 0) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    for (let i = 0; i < count; i += 1) {
      const t = count <= 1 ? 0 : i / (count - 1);
      const wobble = Math.sin(t * Math.PI * 2) * wave;
      addPeg(a.x + dx * t + nx * wobble, a.y + dy * t + ny * wobble, typeFn ? typeFn(i, t) : 'blue');
    }
  };
  const addSpiral = (cx, top, count, turns, maxRadius, typeFn = null) => {
    for (let i = 0; i < count; i += 1) {
      const t = i / Math.max(1, count - 1);
      const angle = -Math.PI / 2 + t * turns * Math.PI * 2;
      const radius = 26 + maxRadius * t;
      addPeg(cx + Math.cos(angle) * radius, top + t * 610 + Math.sin(angle) * radius * 0.24, typeFn ? typeFn(i, t) : 'blue');
    }
  };
  const addBezier = (p0, p1, p2, p3, count, phase = 0, typeFn = null) => {
    for (let i = 0; i < count; i += 1) {
      const t = i / Math.max(1, count - 1);
      const u = 1 - t;
      const x = u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x;
      const y = u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y;
      addPeg(x + Math.sin(t * Math.PI * 8 + phase) * 20, y, typeFn ? typeFn(i, t) : 'blue');
    }
  };
  const addWave = (y, count, amplitude, waves, phase = 0, typeFn = null) => {
    for (let i = 0; i < count; i += 1) {
      const t = i / Math.max(1, count - 1);
      addPeg(92 + t * 716, y + Math.sin(t * Math.PI * 2 * waves + phase) * amplitude, typeFn ? typeFn(i, t) : 'blue');
    }
  };
  const addBrick = (x, y, w, h, angle = 0, type = 'blue', skew = 0, taper = 0) => {
    bricks.push({ x, y, w, h, angle, type, skew, taper });
  };
  const addRail = (x, y, w, h = 13, angle = 0) => rails.push({ x, y, w, h, angle });
  const addSegmentBrick = (a, b, type = 'blue', thickness = 18, overlap = 3) => bricks.push({ vertices: segmentQuad(a, b, thickness, overlap), type });
  const targetEvery = (step, offset = 0) => (i) => (i % step === offset ? 'orange' : 'blue');
  const markSpecials = () => {
    const blues = pegs.filter((peg) => peg.type === 'blue');
    blues.filter((_, index) => index % 17 === 5).slice(0, 2 + Math.floor(level / 22)).forEach((peg) => { peg.type = 'green'; });
    blues.filter((_, index) => index % 23 === 9).slice(0, 1 + Math.floor(level / 32)).forEach((peg) => { peg.type = 'purple'; });
  };
  const addMotion = (startIndex, count, axis = 'x') => {
    pegs.slice(startIndex, startIndex + count).forEach((peg, index) => {
      peg.motion = {
        axis: index % 2 ? axis : (axis === 'x' ? 'y' : 'x'),
        amplitude: 18 + difficulty * 28 + (index % 3) * 7,
        speed: 0.48 + difficulty * 0.68,
        phase: (index / Math.max(1, count)) * Math.PI * 2,
      };
    });
  };
  const addTutorialBank = (a) => {
    const spread = 190 + a * 8;
    const centerY = 560 + a * 10;
    addArc(450, centerY, spread, 92 + a * 4, Math.PI * 0.13, Math.PI * 0.87, 13 + a, (i) => (i === 2 || i === 7 || i === 11 ? 'orange' : 'blue'));
    addLine({ x: 190, y: 735 + a * 8 }, { x: 710, y: 735 + a * 8 }, 7 + Math.floor(a / 3), (i) => (i === 1 || i === 5 ? 'orange' : 'blue'), 8 + a);
    addRail(450, 835, 230 + a * 14, 13, 0);
  };
  const addTutorialPocket = (a) => {
    addArc(312, 555, 128 + a * 4, 138, Math.PI * 0.5, Math.PI * 1.55, 12 + a, (i) => (i % 5 === 1 ? 'orange' : 'blue'));
    addArc(588, 555, 128 + a * 4, 138, Math.PI * 1.45, Math.PI * 2.5, 12 + a, (i) => (i % 5 === 2 ? 'orange' : 'blue'));
    addLine({ x: 305, y: 815 }, { x: 595, y: 815 }, 7 + Math.floor(a / 2), (i) => (i === 3 ? 'orange' : 'blue'), 12);
    if (a >= 3) bumpers.push({ x: 450, y: 665, r: 26 + a * 0.8 });
    addRail(280, 880, 170 + a * 8, 13, -0.22);
    addRail(620, 880, 170 + a * 8, 13, 0.22);
  };
  const addLaneLesson = (a) => {
    const count = 12 + a;
    addLine({ x: 140, y: 355 }, { x: 382, y: 900 }, count, (i) => (i % 5 === 1 ? 'orange' : 'blue'), 10 + a);
    addLine({ x: 760, y: 355 }, { x: 518, y: 900 }, count, (i) => (i % 5 === 3 ? 'orange' : 'blue'), -10 - a);
    addRail(288, 658, 186 + a * 5, 13, -0.56);
    addRail(612, 658, 186 + a * 5, 13, 0.56);
    if (a >= 4) addSegmentBrick({ x: 365, y: 805 }, { x: 535, y: 805 }, a >= 8 ? 'orange' : 'blue', 18, 3);
  };
  const addGateLesson = (a) => {
    const rows = 4 + Math.floor(a / 2);
    for (let row = 0; row < rows; row += 1) {
      const y = 360 + row * 86;
      const gap = 3 + ((row + a) % 3);
      for (let col = 0; col < 8; col += 1) {
        if (col === gap || col === gap + 1) continue;
        addPeg(124 + col * 92 + (row % 2 ? 36 : 0), y, (row + col + a) % 4 === 0 ? 'orange' : 'blue');
      }
    }
    addLine({ x: 240, y: 840 }, { x: 660, y: 840 }, 8 + Math.floor(a / 2), (i) => (i % 4 === 2 ? 'orange' : 'blue'), 14);
    addRail(450, 915, 310, 13, 0);
    if (a >= 6) timedBlocks.push({ x: 450, y: 680, w: 180, h: 22, phase: Math.PI / 2, period: 3000 });
  };

  switch (chapter) {
    case 0: {
      if (act <= 4) addTutorialBank(act);
      else addTutorialPocket(act - 5);
      break;
    }
    case 1: {
      if (act <= 4) addLaneLesson(act);
      else addGateLesson(act - 5);
      break;
    }
    case 2: {
      addSpiral(450, 322, 46 + Math.floor(act * 3 * countScale), 2.4 + act * 0.18, 235, targetEvery(5, act % 5));
      addRing(450, 640, 120 + act * 6, 82 + act * 3, 18 + act, Math.PI / 7, targetEvery(6, 2));
      addRail(450, 900, 330, 13, 0);
      if (act > 3) spinners.push({ x: 450, y: 635, radius: 52 + act * 2, speed: 0.65 + act * 0.06, phase: rand() * Math.PI * 2 });
      break;
    }
    case 3: {
      addWave(390, 20 + act * 2, 44 + act * 3, 2 + act * 0.15, 0, targetEvery(4, 0));
      addWave(590, 22 + act * 2, 56 + act * 2, 2.6 + act * 0.18, Math.PI / 2, targetEvery(5, 2));
      addWave(805, 18 + act, 48 + act * 3, 1.8 + act * 0.12, Math.PI, targetEvery(4, 1));
      timedBlocks.push({ x: 450, y: 700, w: 250, h: 22, phase: act * 0.4, period: 2800 - act * 80 });
      if (act > 4) timedBlocks.push({ x: 260, y: 530, w: 140, h: 22, phase: Math.PI, period: 2600 });
      break;
    }
    case 4: {
      const rows = 8 + Math.floor(act / 2);
      for (let row = 0; row < rows; row += 1) {
        const y = 338 + row * 67;
        const gap = (act + row) % 4;
        for (let col = 0; col < 9; col += 1) {
          if (Math.abs(col - (4 + (gap - 1.5))) < 0.7) continue;
          addPeg(110 + col * 86 + (row % 2 ? 38 : 0), y, (row + col + act) % 5 === 0 ? 'orange' : 'blue');
        }
      }
      addRail(260, 660, 190, 13, -0.52);
      addRail(640, 660, 190, 13, 0.52);
      break;
    }
    case 5: {
      addRing(295, 570, 122 + act * 5, 178, 26 + act, 0, targetEvery(5, 0));
      addRing(606, 650, 138 + act * 5, 202, 28 + act, Math.PI / 5, targetEvery(5, 2));
      addSegmentBrick({ x: 350, y: 655 }, { x: 550, y: 655 }, 'orange', 20, 2);
      bumpers.push({ x: 450, y: 520, r: 32 }, { x: 450, y: 790, r: 30 + act * 0.5 });
      if (act > 5) spinners.push({ x: 450, y: 660, radius: 56, speed: -0.95, phase: rand() * Math.PI * 2 });
      break;
    }
    case 6: {
      addBezier({ x: 94, y: 360 }, { x: 300, y: 455 }, { x: 245, y: 890 }, { x: 450, y: 1000 }, 24 + act * 2, 0, targetEvery(4, 1));
      addBezier({ x: 806, y: 360 }, { x: 600, y: 455 }, { x: 655, y: 890 }, { x: 450, y: 1000 }, 24 + act * 2, Math.PI, targetEvery(4, 2));
      timedBlocks.push({ x: 450, y: 610, w: 260, h: 22, phase: rand() * Math.PI * 2, period: 2300 - act * 40 });
      bumpers.push({ x: 450, y: 760, r: 35 });
      addMotion(8, 8 + Math.floor(act / 2), 'x');
      break;
    }
    case 7: {
      for (let i = 0; i < 5; i += 1) {
        const x = 170 + i * 140;
        addLine({ x, y: 330 }, { x: x + (i % 2 ? -60 : 60), y: 930 }, 10 + act, targetEvery(4, i % 3), 8);
      }
      for (let i = 0; i < 4 + Math.floor(act / 2); i += 1) addRail(230 + i * 120, 500 + (i % 3) * 145, 150, 13, i % 2 ? 0.72 : -0.72);
      if (act > 3) timedBlocks.push({ x: 450, y: 790, w: 190, h: 22, phase: Math.PI / 2, period: 2200 });
      break;
    }
    case 8: {
      addRing(450, 620, 250, 175, 42 + act * 2, 0, targetEvery(6, 0));
      addRing(450, 620, 166, 116, 30 + act, Math.PI / 9, targetEvery(5, 1));
      addRing(450, 620, 80, 56, 14 + act, Math.PI / 4, targetEvery(4, 2));
      spinners.push({ x: 450, y: 620, radius: 70 + act * 2, speed: 1.05 + act * 0.05, phase: rand() * Math.PI * 2 });
      if (act > 4) addRail(450, 900, 340, 13, 0);
      break;
    }
    default: {
      addLine({ x: board.left, y: 360 }, { x: board.right, y: 360 }, 11, targetEvery(3, 0), 24);
      addBezier({ x: 110, y: 460 }, { x: 320, y: 310 }, { x: 580, y: 910 }, { x: 790, y: 760 }, 34, level, targetEvery(5, 2));
      addBezier({ x: 790, y: 460 }, { x: 580, y: 310 }, { x: 320, y: 910 }, { x: 110, y: 760 }, 34, level * 0.7, targetEvery(5, 3));
      addRing(450, 785, 210, 92, 28, Math.PI / 8, targetEvery(4, act % 4));
      addSegmentBrick({ x: 260, y: 640 }, { x: 640, y: 640 }, 'orange', 20, 3);
      timedBlocks.push({ x: 450, y: 545, w: 260, h: 22, phase: 0, period: 2100 });
      spinners.push({ x: 300, y: 735, radius: 56, speed: -1.15, phase: rand() * Math.PI * 2 });
      spinners.push({ x: 600, y: 735, radius: 56, speed: 1.15, phase: rand() * Math.PI * 2 });
      bumpers.push({ x: 450, y: 900, r: 36 });
      addMotion(12, 12, 'y');
      break;
    }
  }

  markSpecials();
  if (chapter >= 3) addMotion(Math.max(0, pegs.length - 10 - act), Math.min(8 + Math.floor(act / 2), pegs.length), chapter % 2 ? 'y' : 'x');
  if (!pegs.some((peg) => peg.type === 'orange') && !bricks.some((brick) => brick.type === 'orange')) {
    pegs.filter((peg) => peg.type === 'blue').slice(0, 8 + Math.floor(level / 10)).forEach((peg) => { peg.type = 'orange'; });
  }
  const actualTargetCount = pegs.filter((peg) => peg.type === 'orange').length + bricks.filter((brick) => brick.type === 'orange').length;

  return {
    level,
    concept: [
      'open arcs',
      'cross lanes',
      'spiral core',
      'timed waves',
      'maze gates',
      'twin orbits',
      'moving ribbons',
      'rail gauntlet',
      'clockwork rings',
      'final exam',
    ][chapter],
    balls: Math.max(7, 11 - Math.floor(level / 22)),
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
    for (let level = 1; level <= TOTAL_LEVELS; level += 1) {
      this.load.json(`stage-${level}`, `assets/stages/stage-${String(level).padStart(3, '0')}.json`);
    }
  }

  create() {
    this.save = loadSave();
    this.matterBodies = [];
    this.editorHistory = [];
    this.editorRedo = [];
    this.input.setTopOnly(true);
    this.matter.world.setBounds(36, 0, WIDTH - 72, HEIGHT + 180, 64, true, true, true, false);
    this.matter.world.on('collisionstart', (event) => this.handleMatterCollision(event));
    this.input.keyboard?.on('keydown-SPACE', () => this.launchBall());
    this.input.keyboard?.on('keydown-ESC', () => this.showMenu());
    this.input.keyboard?.on('keydown-Z', (event) => this.handleEditorUndoShortcut(event));
    this.showMenu();
  }

  playSfx(key, config = {}) {
    try {
      this.sound.play(`sfx-${key}`, { volume: 0.72, ...config });
    } catch {
      // Browsers can block audio until the first trusted gesture; gameplay continues silently.
    }
  }

  playHitNote(key, combo, config = {}) {
    const scale = [0, 180, 360, 500, 700, 860, 1040, 1200];
    const detune = scale[Math.min(scale.length - 1, Math.max(0, combo - 1))];
    this.playSfx(key, {
      detune,
      rate: Phaser.Math.Clamp(0.96 + combo * 0.025, 0.96, 1.28),
      ...config,
    });
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
    g.fillGradientStyle(0x142033, 0x10243a, 0x07101d, 0x0b1020, 1);
    g.fillRect(0, 0, WIDTH, HEIGHT);
    g.lineStyle(1, 0xffffff, 0.035);
    for (let y = 128; y < HEIGHT; y += 72) g.lineBetween(42, y, WIDTH - 42, y + 28);
    g.lineStyle(2, COLORS.gold, 0.16);
    g.lineBetween(46, 112, WIDTH - 46, 112);
    g.lineStyle(2, COLORS.cyan, 0.11);
    g.lineBetween(46, HEIGHT - 84, WIDTH - 46, HEIGHT - 84);
    for (let i = 0; i < 36; i += 1) {
      const x = 70 + ((i * 211) % 760);
      const y = 180 + ((i * 157) % 980);
      g.fillStyle(i % 5 === 0 ? COLORS.gold : 0xffffff, i % 5 === 0 ? 0.18 : 0.07);
      g.fillRect(x, y, i % 5 === 0 ? 4 : 2, i % 5 === 0 ? 4 : 2);
    }
    this.add.text(48, 42, title, {
      fontFamily: 'Trebuchet MS, Verdana',
      fontSize: 48,
      fontStyle: '700',
      color: COLORS.text,
      shadow: { offsetX: 0, offsetY: 4, color: '#000000', blur: 8, fill: true },
    });
  }

  addPanel(x, y, w, h, opts = {}) {
    const shadow = this.add.rectangle(x + 6, y + 8, w, h, 0x020611, 0.32);
    const panel = this.add.rectangle(x, y, w, h, opts.fill ?? 0x0d1727, opts.alpha ?? 0.92)
      .setStrokeStyle(opts.strokeWidth ?? 2, opts.stroke ?? COLORS.line, opts.strokeAlpha ?? 0.86);
    const gloss = this.add.rectangle(x, y - h / 2 + 2, w - 10, 2, opts.accent ?? COLORS.gold, opts.accentAlpha ?? 0.18);
    return { shadow, panel, gloss };
  }

  addLabel(x, y, label, opts = {}) {
    return this.add.text(x, y, label, {
      fontFamily: opts.family ?? 'Meiryo, Trebuchet MS, Verdana',
      fontSize: opts.size ?? 20,
      fontStyle: opts.style ?? '700',
      color: opts.color ?? COLORS.text,
      align: opts.align ?? 'left',
      lineSpacing: opts.lineSpacing ?? 4,
      wordWrap: opts.wordWrap,
      shadow: opts.shadow === false ? undefined : { offsetX: 0, offsetY: 2, color: '#000000', blur: 4, fill: true },
    });
  }

  addStatPill(x, y, w, label, value, color = COLORS.gold) {
    this.add.rectangle(x, y, w, 54, 0x0b1220, 0.86).setStrokeStyle(2, color, 0.55);
    this.addLabel(x - w / 2 + 18, y - 14, label, { family: 'Verdana', size: 12, color: '#9fb0cb', shadow: false });
    this.addLabel(x - w / 2 + 18, y + 2, String(value), { family: 'Verdana', size: 22, color: '#ffffff', shadow: false });
  }

  addIconGem(x, y, color, radius = 11) {
    this.add.circle(x, y, radius + 5, 0xffffff, 0.08);
    this.add.circle(x, y, radius, color, 1).setStrokeStyle(3, 0xffffff, 0.35);
    this.add.circle(x - radius * 0.25, y - radius * 0.28, radius * 0.34, 0xffffff, 0.28);
  }

  colorForType(type) {
    if (type === 'orange') return COLORS.orange;
    if (type === 'green') return COLORS.green;
    if (type === 'purple') return COLORS.purple;
    return COLORS.blue;
  }

  titleCase(value) {
    return String(value).replace(/_/g, ' ').toUpperCase();
  }

  button(x, y, w, h, label, onClick, opts = {}) {
    const fill = opts.disabled ? 0x212b3c : opts.fill ?? COLORS.panel2;
    const stroke = opts.stroke ?? (opts.primary ? COLORS.gold : 0x52617b);
    const shadow = this.add.rectangle(x + 4, y + 5, w, h, 0x020611, 0.34);
    const rect = this.add.rectangle(x, y, w, h, fill, 0.98).setStrokeStyle(2, stroke, opts.disabled ? 0.35 : 0.9);
    const shine = this.add.rectangle(x, y - h / 2 + 4, w - 12, 3, 0xffffff, opts.disabled ? 0.03 : 0.13);
    const text = this.add.text(x, y + 1, label, {
      fontFamily: 'Meiryo, Trebuchet MS, Verdana',
      fontSize: opts.size ?? 22,
      fontStyle: '700',
      color: opts.disabled ? '#778399' : '#f7f9ff',
      align: 'center',
      shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 4, fill: true },
    }).setOrigin(0.5);
    if (opts.depth !== undefined) {
      shadow.setDepth(opts.depth);
      rect.setDepth(opts.depth + 0.1);
      shine.setDepth(opts.depth + 0.2);
      text.setDepth(opts.depth + 0.3);
    }
    if (!opts.disabled) {
      const setHover = (isHover) => {
        rect.setFillStyle(isHover ? (opts.hover ?? 0x31425f) : fill);
        rect.setScale(isHover ? 1.015 : 1);
        shine.setAlpha(isHover ? 0.22 : 0.13);
      };
      [rect, text, shine].forEach((item) => {
        item.setInteractive({ useHandCursor: true })
          .on('pointerover', () => setHover(true))
          .on('pointerout', () => setHover(false))
          .on('pointerdown', (pointer, localX, localY, event) => {
            event?.stopPropagation();
            this.playSfx('peg', { volume: 0.16, detune: -600 });
            onClick();
          });
      });
    }
    return { shadow, rect, shine, text };
  }

  showMenu() {
    this.view = 'menu';
    this.clearScene();
    this.addBackground('PEG FAN');
    this.addLabel(54, 122, '100 STAGE PEG PUZZLE', { family: 'Verdana', size: 22, color: '#ffd35a' });
    this.addLabel(54, 168, '狙って撃ち、オレンジペグをすべて消す。\nステージをクリアすると、ご褒美イラストが1枚ずつ解放されます。', {
      size: 23,
      color: COLORS.muted,
      wordWrap: { width: 720 },
      lineSpacing: 7,
      style: '600',
    });
    this.addPanel(450, 394, 800, 302, { fill: 0x0b1424, stroke: 0x415472, accent: COLORS.cyan });
    this.addIconGem(826, 218, COLORS.orange, 16);
    this.addIconGem(796, 286, COLORS.blue, 14);
    this.addIconGem(836, 354, COLORS.green, 12);

    const startLevel = Math.min(this.save.unlockedLevel, TOTAL_LEVELS);
    this.button(250, 312, 360, 76, `LEVEL ${startLevel} から再開`, () => this.startLevel(startLevel), { fill: 0x286d72, stroke: 0x5eead4, primary: true, size: 23 });
    this.button(650, 312, 240, 76, 'ステージ選択', () => this.showLevelSelect(), { size: 21 });
    this.button(250, 414, 360, 72, 'ギャラリー', () => this.showGallery(), { fill: 0x4a3d21, stroke: COLORS.gold, size: 22 });
    this.button(650, 414, 240, 72, '最初から', () => this.startLevel(1), { fill: 0x4b3344, stroke: 0x9f6b8b, size: 21 });
    this.button(450, 516, 640, 68, 'ステージエディタ', () => this.showStageEditor(), { fill: 0x334155, stroke: 0x93c5fd, size: 23 });
    this.button(450, 1085, 360, 46, 'DEBUG: 全解放', () => this.debugUnlockAll(), { fill: 0x2b3445, stroke: 0x64748b, size: 17 });

    this.addProgressPanel();
    this.addLabel(54, 1160, '操作: マウス/タッチで照準、クリックで発射、Spaceでも発射、Escでメニュー', { size: 18, color: '#95a1b8', style: '600' });
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
    this.addPanel(450, 800, 792, 466, { fill: 0x0e1728, stroke: 0x2f3a4d, accent: COLORS.gold });
    this.addLabel(86, 584, 'PROGRESS', { family: 'Verdana', size: 27 });
    this.addStatPill(210, 666, 250, 'UNLOCKED', `${this.save.unlockedLevel} / ${TOTAL_LEVELS}`, COLORS.gold);
    this.addStatPill(500, 666, 250, 'GALLERY', `${this.save.galleryUnlocked} / ${REWARD_COUNT}`, COLORS.cyan);
    const barX = 86;
    const barY = 750;
    this.add.rectangle(barX + 335, barY, 670, 24, 0x253044).setStrokeStyle(1, 0x42516a, 0.55);
    this.add.rectangle(barX, barY, Math.max(10, 670 * ((this.save.unlockedLevel - 1) / TOTAL_LEVELS)), 24, COLORS.gold).setOrigin(0, 0.5);
    this.addLabel(86, 786, 'RECENT REWARDS', { family: 'Verdana', size: 17, color: '#9fb0cb', shadow: false });
    for (let i = 0; i < 5; i += 1) {
      const rewardIndex = Math.min(REWARD_COUNT - 1, Math.max(0, this.save.galleryUnlocked - 5 + i));
      const unlocked = rewardIndex < this.save.galleryUnlocked;
      const x = 162 + i * 145;
      this.add.rectangle(x, 925, 116, 164, 0x08111f, 0.84).setStrokeStyle(2, unlocked ? COLORS.gold : 0x3b4658, unlocked ? 0.68 : 0.35);
      this.add.image(x, 910, `reward-${rewardIndex + 1}`).setDisplaySize(92, 133).setAlpha(unlocked ? 1 : 0.2);
      this.addLabel(x - 40, 1008, unlocked ? `L${rewardIndex + 1}` : 'LOCKED', {
        family: 'Verdana',
        size: unlocked ? 16 : 12,
        color: unlocked ? '#ffd35a' : '#69758c',
        shadow: false,
      });
    }
  }

  showLevelSelect() {
    this.view = 'select';
    this.clearScene();
    this.addBackground('STAGE SELECT');
    this.button(756, 72, 190, 52, '戻る', () => this.showMenu(), { size: 20 });
    this.addLabel(54, 124, 'クリア済みはゴールド、未解放はロック表示です。', { size: 19, color: COLORS.muted, style: '600' });
    this.addPanel(450, 684, 812, 974, { fill: 0x0b1424, stroke: 0x2b3c58, accent: COLORS.cyan, accentAlpha: 0.12 });
    for (let i = 1; i <= TOTAL_LEVELS; i += 1) {
      const col = (i - 1) % 10;
      const row = Math.floor((i - 1) / 10);
      const x = 83 + col * 82;
      const y = 198 + row * 88;
      const unlocked = i <= this.save.unlockedLevel;
      const completed = this.save.completedLevels.includes(i);
      this.button(x, y, 62, 58, `${i}`, () => this.startLevel(i), {
        disabled: !unlocked,
        fill: completed ? 0x5f4b19 : 0x213047,
        stroke: completed ? COLORS.gold : 0x3f4a5d,
        size: 18,
      });
    }
  }

  showGallery() {
    this.view = 'gallery';
    this.clearScene();
    this.addBackground('GALLERY');
    this.button(756, 72, 190, 52, '戻る', () => this.showMenu(), { size: 20 });
    this.addLabel(54, 124, '各ステージクリアで1枚解放。画像は public/assets/rewards の同名ファイル差し替えで更新できます。', {
      size: 19,
      color: COLORS.muted,
      wordWrap: { width: 790 },
      style: '600',
    });
    this.addPanel(450, 715, 812, 990, { fill: 0x0b1424, stroke: 0x2b3c58, accent: COLORS.gold, accentAlpha: 0.12 });
    for (let i = 0; i < REWARD_COUNT; i += 1) {
      const col = i % 10;
      const row = Math.floor(i / 10);
      const x = 82 + col * 82;
      const y = 230 + row * 88;
      const unlocked = i < this.save.galleryUnlocked || this.save.clearedAll;
      const tile = this.add.rectangle(x, y, 68, 86, 0x111827, 0.94).setStrokeStyle(2, unlocked ? COLORS.gold : 0x3b4658, unlocked ? 0.8 : 0.45);
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
    overlay.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x050914, 0.72));
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
    overlay.add(Object.values(close));
  }

  showStageEditor() {
    this.view = 'editor';
    this.clearScene();
    this.editorState = clampEditorState(this.editorState ?? loadEditorState());
    this.addBackground('STAGE EDITOR');
    this.button(756, 72, 190, 52, '戻る', () => this.showMenu(), { size: 20 });

    const header = this.editorState.mode === 'manual'
      ? 'MANUAL LAYOUT BUILDER'
      : this.editorState.mode === 'concept'
        ? 'CONCEPT BLUEPRINT BUILDER'
        : 'PROCEDURAL LAYOUT BUILDER';
    const description = this.editorState.mode === 'manual'
      ? '自由配置が基本です。SNAP ON の時だけ、グリッドが入力補助として働きます。ドラッグで連続ブロックやレールを作成できます。'
      : this.editorState.mode === 'concept'
        ? `${EDITOR_CONCEPT_DESCRIPTIONS[this.editorState.conceptIndex]} VARIANT ${this.editorState.conceptAct + 1}/10 can be tested directly or baked into manual editing.`
        : '円 / らせん / ベジェ / 波 / グリッドで自動配置。brick / rail は連続した4頂点ブロックとして生成されます。';
    this.addLabel(54, 118, header, {
      family: 'Verdana',
      size: 22,
      color: '#93c5fd',
    });
    this.addLabel(54, 154, description, {
      size: 17,
      color: COLORS.muted,
      wordWrap: { width: 760 },
      style: '600',
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
    const adjustConcept = (key, delta) => {
      state[key] += delta;
      this.updateEditorState(state);
    };
    const secondaryLabel = state.mode === 'manual' ? 'TOOL' : state.mode === 'concept' ? 'CONCEPT' : 'SHAPE';
    const secondaryAction = () => {
      if (state.mode === 'manual') cycle('manualTool', EDITOR_MANUAL_TOOLS);
      else if (state.mode === 'concept') adjustConcept('conceptIndex', 1);
      else cycle('shape', EDITOR_SHAPES);
    };
    const tertiaryLabel = state.mode === 'manual' ? 'SNAP' : state.mode === 'concept' ? 'VARIANT' : 'PART';
    const tertiaryAction = () => {
      if (state.mode === 'manual') this.toggleGridSnap();
      else if (state.mode === 'concept') adjustConcept('conceptAct', 1);
      else cycle('part', EDITOR_PARTS);
    };
    const quaternaryLabel = state.mode === 'concept' ? 'BAKE' : 'TYPE';
    const quaternaryAction = () => (state.mode === 'concept' ? this.bakeConceptToManual() : cycle('type', EDITOR_TYPES));
    const randomLabel = state.mode === 'manual' ? 'CLEAR' : 'RANDOM';
    const randomAction = () => (state.mode === 'manual' ? this.clearManualEditor() : this.randomizeEditor());

    this.addPanel(450, 1035, 812, 232, { fill: 0x0f1828, stroke: 0x334155, accent: COLORS.cyan, accentAlpha: 0.16 });
    if (state.mode === 'concept') {
      this.addStatPill(200, 936, 260, 'CONCEPT', EDITOR_CONCEPTS[state.conceptIndex].label, COLORS.cyan);
      this.addStatPill(460, 936, 180, 'VARIANT', `${state.conceptAct + 1} / 10`, COLORS.gold);
      this.addStatPill(660, 936, 170, 'SOURCE', `L${this.conceptLevelNumber()}`, COLORS.green);
    } else {
      this.addStatPill(166, 936, 190, state.mode === 'manual' ? 'MODE' : 'SHAPE', state.mode === 'manual' ? this.titleCase(state.mode) : this.titleCase(state.shape), COLORS.cyan);
      this.addStatPill(386, 936, 190, state.mode === 'manual' ? 'TOOL' : 'PART', state.mode === 'manual' ? this.titleCase(state.manualTool) : this.titleCase(state.part), COLORS.gold);
      this.addStatPill(606, 936, 190, 'TYPE', this.titleCase(state.type), this.colorForType(state.type));
    }

    this.button(88, 1000, 86, 44, 'MODE', () => cycle('mode', EDITOR_MODES), { size: 14, fill: state.mode === 'manual' ? 0x6b4b18 : 0x1f3a5f, stroke: state.mode === 'manual' ? COLORS.gold : 0x45526a });
    this.button(190, 1000, 86, 44, secondaryLabel, secondaryAction, { size: state.mode === 'concept' ? 11 : 14, fill: 0x1f3a5f });
    this.button(292, 1000, 86, 44, tertiaryLabel, tertiaryAction, { size: state.mode === 'concept' ? 11 : 14, fill: state.mode === 'manual' && state.gridSnap ? 0x6b4b18 : 0x1f3a5f, stroke: state.mode === 'manual' && state.gridSnap ? COLORS.gold : 0x45526a });
    this.button(394, 1000, 86, 44, quaternaryLabel, quaternaryAction, { size: 14, fill: state.mode === 'concept' ? 0x4a3d21 : 0x1f3a5f, stroke: state.mode === 'concept' ? COLORS.gold : 0x45526a });
    this.button(508, 1000, 118, 44, randomLabel, randomAction, { size: 14, fill: 0x3f2f56, stroke: 0xc084fc });
    this.button(686, 1000, 200, 44, 'TEST PLAY', () => this.startEditorTest(), { size: 17, fill: 0x2c6f84, stroke: 0x5eead4, primary: true });

    this.addLabel(78, 1052, state.mode === 'manual' ? `MODE ${this.titleCase(state.mode)}` : state.mode === 'concept' ? `CONCEPT ${state.conceptIndex + 1}` : `COUNT ${state.count}`, { family: 'Verdana', size: 16, color: COLORS.text, shadow: false });
    this.addLabel(258, 1052, state.mode === 'manual' ? `TOOL ${this.titleCase(state.manualTool)}` : state.mode === 'concept' ? `VARIANT ${state.conceptAct + 1}` : `RADIUS ${state.radius}`, { family: 'Verdana', size: 16, color: COLORS.text, shadow: false });
    this.addLabel(458, 1052, state.mode === 'manual' ? `SNAP ${state.gridSnap ? 'ON' : 'OFF'}` : state.mode === 'concept' ? 'BAKE TO MANUAL' : `TURNS ${state.turns}`, { family: 'Verdana', size: 16, color: COLORS.text, shadow: false });
    this.addLabel(638, 1052, `BALLS ${state.balls}`, { family: 'Verdana', size: 16, color: COLORS.text, shadow: false });

    this.button(95, 1102, 62, 42, state.mode === 'manual' ? 'UNDO' : state.mode === 'concept' ? '-C' : '-8', () => (state.mode === 'manual' ? this.undoEditorHistory() : state.mode === 'concept' ? adjustConcept('conceptIndex', -1) : adjust('count', -8)), { size: 14 });
    this.button(170, 1102, 62, 42, state.mode === 'manual' ? 'SEL-' : state.mode === 'concept' ? '+C' : '+8', () => (state.mode === 'manual' ? this.cycleManualSelection(-1) : state.mode === 'concept' ? adjustConcept('conceptIndex', 1) : adjust('count', 8)), { size: 13, fill: state.mode === 'manual' ? 0x263449 : COLORS.panel2, stroke: state.mode === 'manual' ? 0x93c5fd : 0x52617b });
    this.button(278, 1102, 62, 42, state.mode === 'manual' ? 'SEL+' : state.mode === 'concept' ? '-V' : '-20', () => (state.mode === 'manual' ? this.cycleManualSelection(1) : state.mode === 'concept' ? adjustConcept('conceptAct', -1) : adjust('radius', -20)), { size: 13, fill: state.mode === 'manual' ? 0x263449 : COLORS.panel2, stroke: state.mode === 'manual' ? 0x93c5fd : 0x52617b });
    this.button(354, 1102, 62, 42, state.mode === 'manual' ? 'TYPE' : state.mode === 'concept' ? '+V' : '+20', () => (state.mode === 'manual' ? this.cycleSelectedManualType() : state.mode === 'concept' ? adjustConcept('conceptAct', 1) : adjust('radius', 20)), { size: 12, fill: state.mode === 'manual' ? 0x1f3a5f : COLORS.panel2, stroke: state.mode === 'manual' ? COLORS.blue : 0x52617b });
    this.button(476, 1102, 62, 42, state.mode === 'manual' ? 'PROP-' : state.mode === 'concept' ? 'BAKE' : '-1', () => (state.mode === 'manual' ? this.adjustSelectedManualProperty(-1) : state.mode === 'concept' ? this.bakeConceptToManual() : adjust('turns', -1)), { size: state.mode === 'concept' ? 11 : 10, fill: state.mode === 'concept' ? 0x4a3d21 : COLORS.panel2, stroke: state.mode === 'concept' ? COLORS.gold : 0x52617b });
    this.button(552, 1102, 62, 42, state.mode === 'manual' ? 'PROP+' : state.mode === 'concept' ? 'PLAY' : '+1', () => (state.mode === 'manual' ? this.adjustSelectedManualProperty(1) : state.mode === 'concept' ? this.startEditorTest() : adjust('turns', 1)), { size: state.mode === 'manual' ? 10 : 13 });
    this.button(662, 1102, 62, 42, state.mode === 'manual' ? 'DEL' : '-1', () => (state.mode === 'manual' ? this.deleteSelectedManualObject() : adjust('balls', -1)), { size: 14, fill: state.mode === 'manual' ? 0x4b2030 : COLORS.panel2, stroke: state.mode === 'manual' ? COLORS.red : 0x52617b });
    this.button(738, 1102, 62, 42, '+1', () => adjust('balls', 1), { size: 16 });

    this.button(122, 1170, 110, 48, `SLOT ${state.slotIndex + 1}`, () => this.cycleEditorSlot(1), { size: 15, fill: 0x263449, stroke: 0x93c5fd });
    this.button(258, 1170, 130, 48, 'SAVE', () => this.saveEditorSlot(), { size: 16, fill: 0x4a3d21, stroke: COLORS.gold });
    this.button(398, 1170, 130, 48, 'LOAD', () => this.loadEditorSlot(), { size: 16, fill: 0x334155, stroke: 0x93c5fd });
    this.button(558, 1170, 140, 48, 'EXPORT', () => this.exportEditorJson(), { size: 15, fill: 0x1f3a5f, stroke: COLORS.cyan });
    this.button(718, 1170, 140, 48, 'IMPORT', () => this.importEditorJson(), { size: 15, fill: 0x3f2f56, stroke: 0xc084fc });

    this.button(118, 1230, 108, 42, `LV ${String(state.stageEditLevel).padStart(3, '0')}`, () => this.cycleEditorStage(1), { size: 14, fill: 0x263449, stroke: 0x93c5fd });
    this.button(220, 1230, 64, 42, '-LV', () => this.cycleEditorStage(-1), { size: 13 });
    this.button(296, 1230, 64, 42, '+LV', () => this.cycleEditorStage(1), { size: 13 });
    this.button(414, 1230, 122, 42, 'LOAD LV', () => this.loadEditorStageNumber(), { size: 13, fill: 0x334155, stroke: 0x93c5fd });
    this.button(548, 1230, 122, 42, 'SAVE LV', () => this.saveEditorStageNumber(), { size: 13, fill: 0x4a3d21, stroke: COLORS.gold });
    this.button(682, 1230, 96, 42, 'AUDIT', () => this.showStageAudit(), { size: 13, fill: 0x1f3a5f, stroke: COLORS.cyan });
    this.button(790, 1230, 92, 42, 'BUNDLE', () => this.exportAllPlayableStages(), { size: 12, fill: 0x3f2f56, stroke: 0xc084fc });
  }

  updateEditorState(nextState) {
    this.editorState = clampEditorState(nextState);
    saveEditorState(this.editorState);
    this.showStageEditor();
  }

  randomizeEditor() {
    const rand = seededRandom(Date.now() % 1000000);
    if (this.editorState.mode === 'concept') {
      this.editorState = clampEditorState({
        ...this.editorState,
        conceptIndex: Math.floor(rand() * EDITOR_CONCEPTS.length),
        conceptAct: Math.floor(rand() * 10),
        balls: 7 + Math.floor(rand() * 7),
      });
    } else {
      this.editorState = clampEditorState({
        ...this.editorState,
        shape: EDITOR_SHAPES[Math.floor(rand() * EDITOR_SHAPES.length)],
        part: EDITOR_PARTS[Math.floor(rand() * EDITOR_PARTS.length)],
        type: EDITOR_TYPES[Math.floor(rand() * EDITOR_TYPES.length)],
        count: 28 + Math.floor(rand() * 84),
        radius: 140 + Math.floor(rand() * 210),
        turns: 2 + Math.floor(rand() * 5),
        spread: 0.75 + rand() * 0.55,
        balls: 7 + Math.floor(rand() * 7),
      });
    }
    saveEditorState(this.editorState);
    this.showStageEditor();
  }

  conceptLevelNumber() {
    const state = this.editorState ?? loadEditorState();
    return state.conceptIndex * 10 + state.conceptAct + 1;
  }

  buildConceptLevel() {
    const level = generateLevel(this.conceptLevelNumber());
    return {
      ...level,
      level: 1,
      editorTest: true,
      balls: this.editorState.balls,
      rewardIndex: 0,
    };
  }

  bakeConceptToManual() {
    const level = this.buildConceptLevel();
    const manualObjects = this.levelToManualObjects(level);
    this.editorState = clampEditorState({
      ...this.editorState,
      mode: 'manual',
      manualTool: 'peg',
      manualObjects,
    });
    this.editorHistory = [];
    this.editorRedo = [];
    saveEditorState(this.editorState);
    this.showStageEditor();
    this.editorToast('CONCEPT BAKED');
  }

  levelToManualObjects(level) {
    return [
      ...(level.pegs ?? []).map((peg) => ({ kind: 'peg', x: peg.x, y: peg.y, type: peg.type ?? 'blue', motion: peg.motion ?? null })),
      ...(level.bricks ?? []).map((brick) => ({ kind: 'brick', vertices: normalizeQuad(brick), type: brick.type ?? 'blue' })),
      ...(level.rails ?? []).map((rail) => ({ kind: 'rail', vertices: normalizeQuad(rail) })),
      ...(level.bumpers ?? []).map((bumper) => ({ kind: 'bumper', x: bumper.x, y: bumper.y, r: bumper.r ?? 28 })),
      ...(level.timedBlocks ?? []).map((block) => ({ kind: 'timed', x: block.x, y: block.y, w: block.w, h: block.h, phase: block.phase ?? 0, period: block.period ?? 2600 })),
      ...(level.spinners ?? []).map((spinner) => ({ kind: 'spinner', x: spinner.x, y: spinner.y, radius: spinner.radius ?? 56, speed: spinner.speed ?? 0.9, phase: spinner.phase ?? 0 })),
    ];
  }

  serializeEditorProject() {
    const state = this.cloneEditorState();
    const level = this.buildEditorLevel();
    return {
      format: 'peg-fan-stage',
      version: 1,
      savedAt: new Date().toISOString(),
      name: `Slot ${state.slotIndex + 1}`,
      state,
      level,
    };
  }

  serializePlayableStageFile(levelNumber) {
    const level = this.getPlayableLevel(levelNumber);
    return normalizeLevelForPlay({ ...level, editorTest: false }, levelNumber);
  }

  serializeAllPlayableStagesBundle() {
    const files = {};
    const overrides = [];
    for (let level = 1; level <= TOTAL_LEVELS; level += 1) {
      const fileName = `stage-${String(level).padStart(3, '0')}.json`;
      files[`public/assets/stages/${fileName}`] = this.serializePlayableStageFile(level);
      if (localStorage.getItem(stageOverrideKey(level))) overrides.push(level);
    }
    return {
      format: 'peg-fan-stage-bundle',
      version: 1,
      exportedAt: new Date().toISOString(),
      stageCount: TOTAL_LEVELS,
      overrideLevels: overrides,
      files,
    };
  }

  applyEditorProject(project) {
    if (!project || typeof project !== 'object') throw new Error('Invalid stage JSON');
    const state = project.state
      ? clampEditorState(project.state)
      : project.level
        ? clampEditorState({ ...loadEditorState(), mode: 'manual', manualObjects: this.levelToManualObjects(project.level), balls: project.level.balls ?? 10 })
        : null;
    if (!state) throw new Error('Stage JSON has no state or level');
    this.editorState = state;
    this.editorHistory = [];
    this.editorRedo = [];
    saveEditorState(this.editorState);
    this.showStageEditor();
  }

  cycleEditorSlot(dir = 1) {
    this.editorState.slotIndex = (this.editorState.slotIndex + dir + EDITOR_SLOT_COUNT) % EDITOR_SLOT_COUNT;
    saveEditorState(this.editorState);
    this.showStageEditor();
  }

  saveEditorSlot() {
    const slots = loadEditorSlots();
    const project = this.serializeEditorProject();
    project.name = `Slot ${this.editorState.slotIndex + 1} ${project.level.concept ? project.level.concept : this.editorState.mode}`;
    slots[this.editorState.slotIndex] = project;
    saveEditorSlots(slots);
    this.editorToast(`SAVED SLOT ${this.editorState.slotIndex + 1}`);
  }

  loadEditorSlot() {
    const slot = loadEditorSlots()[this.editorState.slotIndex];
    if (!slot) {
      this.editorToast(`EMPTY SLOT ${this.editorState.slotIndex + 1}`);
      return;
    }
    this.applyEditorProject(slot);
    this.editorToast(`LOADED SLOT ${this.editorState.slotIndex + 1}`);
  }

  cycleEditorStage(dir = 1) {
    const next = ((this.editorState.stageEditLevel - 1 + dir + EDITOR_STAGE_COUNT) % EDITOR_STAGE_COUNT) + 1;
    this.editorState = clampEditorState({ ...this.editorState, stageEditLevel: next });
    saveEditorState(this.editorState);
    this.showStageEditor();
  }

  loadStageOverride(levelNumber) {
    try {
      const parsed = JSON.parse(localStorage.getItem(stageOverrideKey(levelNumber)) || 'null');
      const level = parsed?.level ?? parsed;
      return level ? normalizeLevelForPlay(level, levelNumber) : null;
    } catch {
      return null;
    }
  }

  loadFixedStage(levelNumber) {
    const cached = this.cache.json.get(`stage-${levelNumber}`);
    return cached ? normalizeLevelForPlay(cached, levelNumber) : null;
  }

  getPlayableLevel(levelNumber) {
    return this.loadStageOverride(levelNumber)
      ?? this.loadFixedStage(levelNumber)
      ?? normalizeLevelForPlay(generateLevel(levelNumber), levelNumber);
  }

  loadEditorStageNumber() {
    const levelNumber = this.editorState.stageEditLevel;
    const level = this.getPlayableLevel(levelNumber);
    this.applyEditorProject({
      state: {
        ...this.editorState,
        mode: 'manual',
        manualObjects: this.levelToManualObjects(level),
        selectedManualIndex: -1,
        balls: level.balls,
      },
      level,
    });
    this.editorState.stageEditLevel = levelNumber;
    saveEditorState(this.editorState);
    this.editorToast(`LOADED LEVEL ${levelNumber}`);
  }

  saveEditorStageNumber() {
    const levelNumber = this.editorState.stageEditLevel;
    const project = this.serializeEditorProject();
    project.name = `Stage ${String(levelNumber).padStart(3, '0')}`;
    project.level = normalizeLevelForPlay({ ...project.level, editorTest: false }, levelNumber);
    localStorage.setItem(stageOverrideKey(levelNumber), JSON.stringify(project));
    this.editorToast(`SAVED LEVEL ${levelNumber}`);
  }

  exportAllPlayableStages() {
    const bundle = this.serializeAllPlayableStagesBundle();
    const text = JSON.stringify(bundle, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `peg-fan-production-stages-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    this.editorToast(`EXPORTED ${bundle.stageCount} STAGES`);
  }

  collectStageAudits() {
    return Array.from({ length: TOTAL_LEVELS }, (_, index) => {
      const levelNumber = index + 1;
      return auditLevelData(this.getPlayableLevel(levelNumber));
    });
  }

  showStageAudit() {
    const audits = this.collectStageAudits();
    const flagged = audits.filter((audit) => audit.flags.length);
    const avgTargets = audits.reduce((sum, audit) => sum + audit.targetCount, 0) / audits.length;
    const avgObjects = audits.reduce((sum, audit) => sum + audit.objects, 0) / audits.length;
    const overlay = this.add.container(0, 0).setDepth(80);
    overlay.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, 760, 850, 0x0b111b, 0.97).setStrokeStyle(2, COLORS.cyan));
    overlay.add(this.add.text(WIDTH / 2, 260, 'STAGE AUDIT', {
      fontFamily: 'Verdana',
      fontSize: 42,
      fontStyle: '700',
      color: '#34d3e5',
    }).setOrigin(0.5));
    overlay.add(this.add.text(WIDTH / 2, 328, `AVG OBJECTS ${avgObjects.toFixed(1)}   AVG ORANGE ${avgTargets.toFixed(1)}   FLAGGED ${flagged.length}`, {
      fontFamily: 'Verdana',
      fontSize: 20,
      color: COLORS.text,
    }).setOrigin(0.5));
    const lines = (flagged.length ? flagged : audits.slice(0, 12)).slice(0, 18).map((audit) => (
      `L${String(audit.level).padStart(3, '0')} ${audit.concept}  OBJ ${audit.objects}  ORG ${audit.targetCount}  BALL ${audit.balls}  ${audit.flags.join(',') || 'OK'}`
    ));
    overlay.add(this.add.text(110, 386, lines.join('\n'), {
      fontFamily: 'Consolas, Verdana',
      fontSize: 17,
      lineSpacing: 8,
      color: flagged.length ? '#ffd35a' : '#dbeafe',
    }));
    const close = this.button(WIDTH / 2, 1036, 240, 56, 'CLOSE', () => overlay.destroy(true), { fill: 0x263449, stroke: COLORS.cyan, size: 19 });
    overlay.add(Object.values(close));
  }

  exportEditorJson() {
    const project = this.serializeEditorProject();
    const text = JSON.stringify(project, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `peg-fan-stage-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    this.editorToast('JSON EXPORTED');
  }

  importEditorJson() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result ?? '{}'));
          if (parsed.format === 'peg-fan-stage-bundle' && parsed.files) {
            Object.entries(parsed.files).forEach(([filePath, level]) => {
              const match = String(filePath).match(/stage-(\d{3})\.json$/);
              const levelNumber = match ? Number(match[1]) : Number(level?.level);
              if (levelNumber >= 1 && levelNumber <= TOTAL_LEVELS) {
                localStorage.setItem(stageOverrideKey(levelNumber), JSON.stringify({
                  format: 'peg-fan-stage',
                  version: 1,
                  importedAt: new Date().toISOString(),
                  name: `Imported Stage ${String(levelNumber).padStart(3, '0')}`,
                  level: normalizeLevelForPlay(level, levelNumber),
                }));
              }
            });
            this.editorToast('BUNDLE IMPORTED');
          } else {
            this.applyEditorProject(parsed);
            this.editorToast('JSON IMPORTED');
          }
        } catch (error) {
          this.editorToast('IMPORT FAILED');
        }
      };
      reader.readAsText(file);
    };
    input.click();
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

  cloneManualObjects(objects = this.editorState?.manualObjects ?? []) {
    return clonePlain(objects);
  }

  cloneEditorState(state = this.editorState) {
    return clonePlain(clampEditorState(state));
  }

  manualObjectsEqual(a, b) {
    if (a.length !== b.length) return false;
    return JSON.stringify(a) === JSON.stringify(b);
  }

  setManualObjects(nextObjects, { record = true } = {}) {
    const current = this.cloneManualObjects();
    const next = this.cloneManualObjects(nextObjects).slice(-240);
    if (this.manualObjectsEqual(current, next)) return false;
    if (record) {
      this.editorHistory = [...(this.editorHistory ?? []), current].slice(-80);
      this.editorRedo = [];
    }
    this.editorState.manualObjects = next;
    this.editorState.selectedManualIndex = Phaser.Math.Clamp(this.editorState.selectedManualIndex ?? -1, -1, next.length - 1);
    saveEditorState(this.editorState);
    return true;
  }

  undoEditorHistory() {
    if (this.view !== 'editor' || this.editorState?.mode !== 'manual') return;
    if (!this.editorHistory?.length) {
      this.editorToast('NO UNDO');
      return;
    }
    const current = this.cloneManualObjects();
    const previous = this.editorHistory.pop();
    this.editorRedo = [...(this.editorRedo ?? []), current].slice(-80);
    this.setManualObjects(previous, { record: false });
    this.showStageEditor();
  }

  redoEditorHistory() {
    if (this.view !== 'editor' || this.editorState?.mode !== 'manual') return;
    if (!this.editorRedo?.length) {
      this.editorToast('NO REDO');
      return;
    }
    const current = this.cloneManualObjects();
    const next = this.editorRedo.pop();
    this.editorHistory = [...(this.editorHistory ?? []), current].slice(-80);
    this.setManualObjects(next, { record: false });
    this.showStageEditor();
  }

  handleEditorUndoShortcut(event) {
    const isModifier = event?.ctrlKey || event?.metaKey;
    if (!isModifier || this.view !== 'editor' || this.editorState?.mode !== 'manual') return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (event.shiftKey) this.redoEditorHistory();
    else this.undoEditorHistory();
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

  getManualObjectAt(point, radius = 34) {
    const objects = this.editorState.manualObjects ?? [];
    let bestIndex = -1;
    let bestDistance = radius;
    objects.forEach((object, index) => {
      const center = this.objectCenter(object);
      const distance = Math.hypot(center.x - point.x, center.y - point.y);
      const allowance = object.kind === 'brick' || object.kind === 'rail' ? radius + 20 : radius + (object.r ?? 0) * 0.35;
      if (distance <= allowance && distance < bestDistance + 20) {
        bestIndex = index;
        bestDistance = distance;
      }
    });
    return bestIndex;
  }

  selectManualObject(index) {
    this.editorState.selectedManualIndex = Phaser.Math.Clamp(index, -1, (this.editorState.manualObjects?.length ?? 0) - 1);
    saveEditorState(this.editorState);
    this.showStageEditor();
  }

  cycleManualSelection(dir = 1) {
    const count = this.editorState.manualObjects?.length ?? 0;
    if (!count) {
      this.editorToast('NO OBJECTS');
      return;
    }
    const current = this.editorState.selectedManualIndex ?? -1;
    this.selectManualObject((current + dir + count) % count);
  }

  updateSelectedManualObject(updater) {
    const index = this.editorState.selectedManualIndex ?? -1;
    const objects = this.cloneManualObjects();
    if (index < 0 || index >= objects.length) {
      this.editorToast('SELECT OBJECT');
      return;
    }
    objects[index] = updater(objects[index]);
    this.setManualObjects(objects);
    this.editorState.selectedManualIndex = index;
    saveEditorState(this.editorState);
    this.showStageEditor();
  }

  cycleSelectedManualType() {
    const types = ['orange', 'blue', 'green', 'purple'];
    this.updateSelectedManualObject((object) => {
      if (object.kind !== 'peg' && object.kind !== 'brick') return object;
      const current = types.indexOf(object.type ?? 'blue');
      return { ...object, type: types[(current + 1 + types.length) % types.length] };
    });
  }

  scaleManualVertices(object, factor) {
    const center = this.objectCenter(object);
    return {
      ...object,
      vertices: normalizeQuad(object).map((point) => ({
        x: center.x + (point.x - center.x) * factor,
        y: center.y + (point.y - center.y) * factor,
      })),
    };
  }

  adjustSelectedManualProperty(dir = 1) {
    this.updateSelectedManualObject((object) => {
      const factor = dir > 0 ? 1.08 : 0.92;
      if (object.kind === 'brick' || object.kind === 'rail') return this.scaleManualVertices(object, factor);
      if (object.kind === 'bumper') return { ...object, r: Phaser.Math.Clamp((object.r ?? 28) + dir * 4, 16, 70) };
      if (object.kind === 'timed') return { ...object, w: Phaser.Math.Clamp((object.w ?? 140) + dir * 18, 60, 280) };
      if (object.kind === 'spinner') return { ...object, radius: Phaser.Math.Clamp((object.radius ?? 48) + dir * 8, 28, 130) };
      return object;
    });
  }

  moveSelectedManualObject(dx, dy) {
    this.updateSelectedManualObject((object) => {
      if (Array.isArray(object.vertices)) {
        return { ...object, vertices: normalizeQuad(object).map((point) => ({ x: point.x + dx, y: point.y + dy })) };
      }
      return { ...object, x: object.x + dx, y: object.y + dy };
    });
  }

  rotateSelectedManualObject(dir = 1) {
    this.updateSelectedManualObject((object) => {
      if (!Array.isArray(object.vertices)) return object;
      const center = this.objectCenter(object);
      return {
        ...object,
        vertices: normalizeQuad(object).map((point) => rotatePointAround(point, center, dir * 0.12)),
      };
    });
  }

  selectedManualSummary(object) {
    if (!object) return ['NO SELECTION', 'Click an object or use SEL+'];
    const center = this.objectCenter(object);
    const base = [`${object.kind.toUpperCase()}  X ${Math.round(center.x)}  Y ${Math.round(center.y)}`];
    if (object.kind === 'peg' || object.kind === 'brick') base.push(`TYPE ${(object.type ?? 'blue').toUpperCase()}`);
    if (object.kind === 'bumper') base.push(`RADIUS ${Math.round(object.r ?? 28)}`);
    if (object.kind === 'timed') base.push(`WIDTH ${Math.round(object.w ?? 140)}  PERIOD ${Math.round(object.period ?? 2600)}`);
    if (object.kind === 'spinner') base.push(`RADIUS ${Math.round(object.radius ?? 48)}  SPEED ${(object.speed ?? 0.9).toFixed(1)}`);
    if (object.kind === 'brick' || object.kind === 'rail') base.push('ROTATE and SIZE edit all vertices');
    return base;
  }

  renderSelectedPropertyPanel(selected) {
    this.add.rectangle(692, 384, 250, 246, 0x07101d, 0.92).setStrokeStyle(2, COLORS.gold, selected ? 0.82 : 0x2d3d58).setDepth(8);
    this.add.text(584, 278, 'PROPERTY', {
      fontFamily: 'Verdana',
      fontSize: 15,
      fontStyle: '700',
      color: '#ffd35a',
    }).setDepth(9);
    this.add.text(584, 306, this.selectedManualSummary(selected).join('\n'), {
      fontFamily: 'Consolas, Verdana',
      fontSize: 13,
      lineSpacing: 5,
      color: selected ? COLORS.text : COLORS.muted,
    }).setDepth(9);
    this.button(608, 406, 54, 34, 'X-', () => this.moveSelectedManualObject(-8, 0), { size: 12, fill: 0x263449, depth: 10 });
    this.button(672, 406, 54, 34, 'X+', () => this.moveSelectedManualObject(8, 0), { size: 12, fill: 0x263449, depth: 10 });
    this.button(736, 406, 54, 34, 'Y-', () => this.moveSelectedManualObject(0, -8), { size: 12, fill: 0x263449, depth: 10 });
    this.button(800, 406, 54, 34, 'Y+', () => this.moveSelectedManualObject(0, 8), { size: 12, fill: 0x263449, depth: 10 });
    this.button(632, 450, 76, 34, 'ROT-', () => this.rotateSelectedManualObject(-1), { size: 11, fill: 0x1f3a5f, depth: 10 });
    this.button(720, 450, 76, 34, 'ROT+', () => this.rotateSelectedManualObject(1), { size: 11, fill: 0x1f3a5f, depth: 10 });
    this.button(808, 450, 76, 34, 'TYPE', () => this.cycleSelectedManualType(), { size: 11, fill: 0x1f3a5f, stroke: COLORS.blue, depth: 10 });
    this.button(650, 494, 96, 34, 'SIZE-', () => this.adjustSelectedManualProperty(-1), { size: 11, fill: 0x4a3d21, stroke: COLORS.gold, depth: 10 });
    this.button(762, 494, 96, 34, 'SIZE+', () => this.adjustSelectedManualProperty(1), { size: 11, fill: 0x4a3d21, stroke: COLORS.gold, depth: 10 });
  }

  deleteSelectedManualObject() {
    const index = this.editorState.selectedManualIndex ?? -1;
    if (index < 0 || index >= (this.editorState.manualObjects?.length ?? 0)) {
      this.editorToast('SELECT OBJECT');
      return;
    }
    const objects = this.cloneManualObjects();
    objects.splice(index, 1);
    this.editorState.selectedManualIndex = Math.min(index, objects.length - 1);
    this.setManualObjects(objects);
    saveEditorState(this.editorState);
    this.showStageEditor();
  }

  toggleGridSnap() {
    this.editorState.gridSnap = !this.editorState.gridSnap;
    saveEditorState(this.editorState);
    this.showStageEditor();
  }

  clearManualEditor() {
    this.setManualObjects([]);
    this.showStageEditor();
  }

  editorBounds() {
    return { left: 80, right: 820, top: 258, bottom: 892 };
  }

  snapEditorPoint(pointer) {
    const bounds = this.editorBounds();
    const world = this.getPointerWorld(pointer);
    const x = this.editorState.gridSnap ? Math.round(world.x / EDITOR_GRID) * EDITOR_GRID : world.x;
    const y = this.editorState.gridSnap ? Math.round(world.y / EDITOR_GRID) * EDITOR_GRID : world.y;
    return {
      x: Phaser.Math.Clamp(x, bounds.left, bounds.right),
      y: Phaser.Math.Clamp(y, bounds.top, bounds.bottom),
    };
  }

  manualType() {
    return this.editorState.type === 'auto' ? 'blue' : this.editorState.type;
  }

  addManualObject(object) {
    this.setManualObjects([...this.editorState.manualObjects, object]);
  }

  createManualSingle(point) {
    const tool = this.editorState.manualTool;
    const type = this.manualType();
    if (tool === 'peg') this.addManualObject({ kind: 'peg', x: point.x, y: point.y, type });
    if (tool === 'brick') this.addManualObject({ kind: 'brick', vertices: quadFromCenter(point.x, point.y, 88, MANUAL_BRICK_THICKNESS, 0), type });
    if (tool === 'rail') this.addManualObject({ kind: 'rail', vertices: quadFromCenter(point.x, point.y, 128, MANUAL_RAIL_THICKNESS, 0) });
    if (tool === 'bumper') this.addManualObject({ kind: 'bumper', x: point.x, y: point.y, r: 28 });
    if (tool === 'timed') this.addManualObject({ kind: 'timed', x: point.x, y: point.y, w: 180, h: 22, phase: 0, period: 2600 });
    if (tool === 'spinner') this.addManualObject({ kind: 'spinner', x: point.x, y: point.y, radius: 58, speed: 0.9, phase: 0 });
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
    const spacing = tool === 'peg' ? 38 : tool === 'bumper' ? 58 : tool === 'spinner' ? 120 : tool === 'timed' ? 150 : tool === 'rail' ? 96 : 74;
    const objects = [];
    if (tool === 'brick') {
      objects.push({ kind: 'brick', vertices: segmentQuad(start, end, MANUAL_BRICK_THICKNESS, 3), type });
      this.setManualObjects([...this.editorState.manualObjects, ...objects]);
      return;
    }
    if (tool === 'rail') {
      objects.push({ kind: 'rail', vertices: segmentQuad(start, end, MANUAL_RAIL_THICKNESS, 3) });
      this.setManualObjects([...this.editorState.manualObjects, ...objects]);
      return;
    }
    const count = Phaser.Math.Clamp(Math.floor(distance / spacing) + 1, 2, 48);
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : i / (count - 1);
      const rawX = start.x + dx * t;
      const rawY = start.y + dy * t;
      const x = this.editorState.gridSnap ? Math.round(rawX / EDITOR_GRID) * EDITOR_GRID : rawX;
      const y = this.editorState.gridSnap ? Math.round(rawY / EDITOR_GRID) * EDITOR_GRID : rawY;
      if (tool === 'peg') objects.push({ kind: 'peg', x, y, type });
      if (tool === 'bumper') objects.push({ kind: 'bumper', x, y, r: 28 });
      if (tool === 'timed') objects.push({ kind: 'timed', x, y, w: 140, h: 22, phase: i * 0.4, period: 2600 });
      if (tool === 'spinner') objects.push({ kind: 'spinner', x, y, radius: 48, speed: i % 2 ? -0.9 : 0.9, phase: i * 0.7 });
    }
    this.setManualObjects([...this.editorState.manualObjects, ...objects]);
  }

  eraseManualNear(point, radius = 38) {
    this.setManualObjects(this.editorState.manualObjects.filter((object) => {
      const center = this.objectCenter(object);
      return Math.hypot(center.x - point.x, center.y - point.y) > radius;
    }));
  }

  eraseManualLine(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(2, Math.ceil(distance / EDITOR_GRID));
    const erasePoints = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      erasePoints.push({ x: start.x + dx * t, y: start.y + dy * t });
    }
    this.setManualObjects(this.editorState.manualObjects.filter((object) => (
      erasePoints.every((point) => {
        const center = this.objectCenter(object);
        return Math.hypot(center.x - point.x, center.y - point.y) > 34;
      })
    )));
  }

  handleManualPointerDown(pointer) {
    if (this.editorState.mode !== 'manual') return;
    const point = this.snapEditorPoint(pointer);
    if (this.editorState.manualTool !== 'erase') {
      const selected = this.getManualObjectAt(point);
      if (selected >= 0) {
        this.selectManualObject(selected);
        this.manualDragStart = null;
        return;
      }
    }
    this.manualDragStart = point;
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
    grid.lineStyle(1, 0x334155, this.editorState.gridSnap ? 0.34 : 0.14);
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

  objectCenter(object) {
    if (Array.isArray(object.vertices) && object.vertices.length >= 4) return centerOfPoints(object.vertices);
    return { x: object.x, y: object.y };
  }

  buildManualLevel() {
    const pegs = [];
    const bricks = [];
    const rails = [];
    const bumpers = [];
    const timedBlocks = [];
    const spinners = [];
    this.editorState.manualObjects.forEach((object) => {
      if (object.kind === 'peg') pegs.push({ x: object.x, y: object.y, type: object.type ?? 'blue', motion: object.motion ?? null });
      if (object.kind === 'brick') bricks.push({ ...object, vertices: normalizeQuad(object), type: object.type ?? 'blue' });
      if (object.kind === 'rail') rails.push({ ...object, vertices: normalizeQuad(object) });
      if (object.kind === 'bumper') bumpers.push({ x: object.x, y: object.y, r: object.r ?? 28 });
      if (object.kind === 'timed') timedBlocks.push({ x: object.x, y: object.y, w: object.w ?? 160, h: object.h ?? 22, phase: object.phase ?? 0, period: object.period ?? 2600 });
      if (object.kind === 'spinner') spinners.push({ x: object.x, y: object.y, radius: object.radius ?? 56, speed: object.speed ?? 0.9, phase: object.phase ?? 0 });
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
      timedBlocks,
      spinners,
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
        const ring = (s.part === 'bricks' || s.part === 'rails') ? 1 : (i % 2 ? 0.72 : 1);
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
    if (s.mode === 'concept') return this.buildConceptLevel();
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
    const addSegmentParts = (kind, step, thickness, overlap) => {
      if (points.length < 2) return;
      const closed = s.shape === 'circle';
      const limit = closed ? points.length : points.length - 1;
      for (let index = 0; index < limit; index += step) {
        const a = points[index];
        const b = points[(index + 1) % points.length];
        if (!b || Math.hypot(b.x - a.x, b.y - a.y) > 180) continue;
        const vertices = segmentQuad(a, b, thickness, overlap);
        if (kind === 'brick') bricks.push({ vertices, type: this.editorPegType(index + 2) });
        else rails.push({ vertices });
      }
    };

    if (useBricks) addSegmentParts('brick', s.part === 'bricks' ? 1 : 9, 19, s.part === 'bricks' ? 4 : 2);
    if (useRails) addSegmentParts('rail', s.part === 'rails' ? 1 : 13, 13, s.part === 'rails' ? 4 : 2);

    points.forEach((point, index) => {
      if (usePegs && (s.part !== 'mixed' || index % 3 !== 1)) {
        pegs.push({ x: point.x, y: point.y, type: this.editorPegType(index) });
      }
      if (useBumpers && index % (s.part === 'bumpers' ? 4 : 17) === 0) {
        bumpers.push({ x: point.x, y: point.y, r: 24 + (index % 3) * 4 });
      }
    });

    if (!pegs.some((peg) => peg.type === 'orange') && !bricks.some((brick) => brick.type === 'orange')) {
      if (pegs.length) pegs[0].type = 'orange';
      else if (bricks.length) bricks[0].type = 'orange';
    }
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

  addQuadVisual(data, fillColor, fillAlpha = 1, strokeColor = 0xffffff, strokeAlpha = 0.28, strokeWidth = 3) {
    const vertices = normalizeQuad(data);
    const center = centerOfPoints(vertices);
    const local = vertices.flatMap((point) => [point.x - center.x, point.y - center.y]);
    const visual = this.add.polygon(center.x, center.y, local, fillColor, fillAlpha)
      .setStrokeStyle(strokeWidth, strokeColor, strokeAlpha);
    visual.quadVertices = vertices;
    return visual;
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
      this.addQuadVisual(brick, color, 0.9, 0xffffff, 0.25, 2).setDepth(3);
    });
    level.rails.forEach((rail) => {
      this.addQuadVisual(rail, 0x8ea2c7, 0.36, 0xdbeafe, 0.45, 2).setDepth(3);
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
    if (this.editorState.mode === 'manual') {
      const selected = this.editorState.manualObjects?.[this.editorState.selectedManualIndex];
      if (selected) {
        const center = this.objectCenter(selected);
        const marker = this.add.graphics().setDepth(7);
        marker.lineStyle(3, COLORS.gold, 0.98);
        if (Array.isArray(selected.vertices)) {
          const points = normalizeQuad(selected);
          marker.beginPath();
          marker.moveTo(points[0].x, points[0].y);
          points.slice(1).forEach((point) => marker.lineTo(point.x, point.y));
          marker.closePath();
          marker.strokePath();
        } else {
          marker.strokeCircle(center.x, center.y, (selected.r ?? 22) + 12);
        }
        marker.lineStyle(2, COLORS.cyan, 0.8);
        marker.strokeCircle(center.x, center.y, 5);
      }
      this.renderSelectedPropertyPanel(selected);
    }
    this.add.text(78, 282, `OBJECTS ${level.pegs.length + level.bricks.length + level.rails.length + level.bumpers.length + level.timedBlocks.length + level.spinners.length}   ORANGE ${level.targetCount}`, {
      fontFamily: 'Verdana',
      fontSize: 18,
      fontStyle: '700',
      color: COLORS.text,
    }).setDepth(4);
    if (this.editorState.mode === 'manual') {
      const selected = this.editorState.selectedManualIndex >= 0 ? `   SELECTED #${this.editorState.selectedManualIndex + 1}` : '';
      this.add.text(78, 858, `CLICK: SELECT/PLACE   DRAG: LINE   PROP: SIZE   TYPE: COLOR${selected}`, {
        fontFamily: 'Verdana',
        fontSize: 13,
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
    this.level = levelOverride ?? this.getPlayableLevel(levelNumber);
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
    this.lastOrangeAnnounced = false;
    this.clearBonusAwarded = false;
    this.orangeClearCombo = 0;
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
    this.addPanel(252, 146, 428, 86, { fill: 0x0a1322, stroke: 0x2d3d58, accent: COLORS.gold, accentAlpha: 0.12 });
    this.scoreText = this.add.text(58, 124, '', {
      fontFamily: 'Verdana',
      fontSize: 23,
      fontStyle: '700',
      color: COLORS.text,
      shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 4, fill: true },
    });
    this.goalText = this.add.text(58, 162, '', {
      fontFamily: 'Meiryo, Verdana',
      fontSize: 19,
      color: COLORS.muted,
    });
    this.button(778, 70, 164, 50, 'メニュー', () => this.showMenu(), { size: 19 });
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

  makeMatterPolygon(gameObject, vertices, bodyRole, options = {}, extra = {}) {
    const center = centerOfPoints(vertices);
    const body = this.matter.add.fromVertices(center.x, center.y, vertices, {
      ...options,
    }, true, 0.01, 10);
    body.destroy = () => {
      if (this.matter.world.has(body)) this.matter.world.remove(body, true);
    };
    gameObject.body = body;
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
      const vertices = normalizeQuad(data);
      const visual = this.addQuadVisual({ vertices }, color, 1, 0xffffff, 0.28, 3);
      this.makeMatterPolygon(visual, vertices, 'brick', {
        isStatic: true,
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
      const vertices = normalizeQuad(data);
      const visual = this.addQuadVisual({ vertices }, 0x8ea2c7, 0.35, 0xdbeafe, 0.45, 2);
      this.makeMatterPolygon(visual, vertices, 'rail', {
        isStatic: true,
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
    this.scoreText.setText(`SCORE ${this.score}   BALL ${this.shotsLeft}`);
    this.goalText.setText(`TARGET ${this.targetsLeft}`);
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
    const polygons = [];
    const addCircle = (item, radius = 16) => {
      if (item?.active && item.visible !== false) circles.push({ x: item.x, y: item.y, r: radius });
    };
    this.pegGroup?.getChildren().forEach((peg) => addCircle(peg, 18));
    this.bumperGroup?.getChildren().forEach((bumper) => addCircle(bumper, (bumper.radius ?? 24) + 6));
    this.spinnerNodeGroup?.getChildren().forEach((node) => addCircle(node, (node.radius ?? 14) + 6));
    this.brickGroup?.getChildren().forEach((rect) => {
      if (rect?.active && rect.visible !== false && Array.isArray(rect.quadVertices)) polygons.push({ vertices: rect.quadVertices, inflate: 9 });
    });
    this.railGroup?.getChildren().forEach((rect) => {
      if (rect?.active && rect.visible !== false && Array.isArray(rect.quadVertices)) polygons.push({ vertices: rect.quadVertices, inflate: 9 });
    });
    this.timedBlockGroup?.getChildren().forEach((rect) => {
      if (rect?.active && rect.visible !== false && rect.body?.collisionFilter?.mask !== 0) rects.push({ x: rect.x, y: rect.y, w: rect.width + 16, h: rect.height + 16 });
    });
    return { circles, rects, polygons };
  }

  findTrajectoryHit(x, y, predictors) {
    for (const circle of predictors.circles) {
      const dx = x - circle.x;
      const dy = y - circle.y;
      const d = Math.hypot(dx, dy);
      if (d < circle.r) return { nx: dx / (d || 1), ny: dy / (d || 1) };
    }
    for (const polygon of predictors.polygons ?? []) {
      const vertices = polygon.vertices;
      if (!Array.isArray(vertices) || vertices.length < 3) continue;
      const point = { x, y };
      let closest = { distance: Infinity, nx: 0, ny: -1 };
      for (let i = 0; i < vertices.length; i += 1) {
        const a = vertices[i];
        const b = vertices[(i + 1) % vertices.length];
        const edge = edgeDistance(point, a, b);
        if (edge.distance < closest.distance) {
          const dx = x - edge.px;
          const dy = y - edge.py;
          const d = Math.hypot(dx, dy) || 1;
          closest = { distance: edge.distance, nx: dx / d, ny: dy / d };
        }
      }
      if (pointInPolygon(point, vertices) || closest.distance <= (polygon.inflate ?? 0)) return { nx: closest.nx, ny: closest.ny };
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

  showComboBanner(combo) {
    if (combo < 4 || combo % 2 !== 0) return;
    const text = this.add.text(WIDTH / 2, 314, `${combo} HIT FEVER`, {
      fontFamily: 'Verdana',
      fontSize: 34,
      fontStyle: '700',
      color: '#ffd35a',
      stroke: '#0b111b',
      strokeThickness: 7,
    }).setOrigin(0.5).setDepth(36).setScale(0.7);
    this.tweens.add({
      targets: text,
      scale: 1.1,
      y: 286,
      alpha: 0,
      duration: 760,
      ease: 'Back.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  showLastOrangeBanner(targets) {
    if (this.lastOrangeAnnounced || this.targetsLeft !== 1 || this.orangeClearPending) return;
    this.lastOrangeAnnounced = true;
    this.playSfx('combo', { volume: 0.78, detune: 900 });
    const banner = this.add.container(WIDTH / 2, 246).setDepth(37);
    banner.add(this.add.rectangle(0, 0, 430, 72, 0x170f07, 0.9).setStrokeStyle(3, COLORS.orange, 0.96));
    banner.add(this.add.text(0, -2, 'LAST ORANGE', {
      fontFamily: 'Verdana',
      fontSize: 34,
      fontStyle: '700',
      color: '#ffb088',
      stroke: '#080b12',
      strokeThickness: 6,
    }).setOrigin(0.5));
    this.tweens.add({
      targets: banner,
      scale: { from: 0.86, to: 1.06 },
      alpha: { from: 1, to: 0 },
      duration: 1000,
      ease: 'Cubic.easeOut',
      onComplete: () => banner.destroy(true),
    });
    targets.forEach((target) => {
      const ring = this.add.circle(target.x, target.y, 32, COLORS.orange, 0).setStrokeStyle(4, COLORS.gold, 0.9).setDepth(9);
      this.tweens.add({
        targets: ring,
        scale: 1.8,
        alpha: 0,
        duration: 900,
        ease: 'Cubic.easeOut',
        onComplete: () => ring.destroy(),
      });
    });
  }

  pulseRemainingOrange() {
    if (this.targetsLeft > 3 || this.orangeClearPending) return;
    const targets = [
      ...this.pegGroup.getChildren().filter((peg) => peg.active && peg.pegType === 'orange' && !peg.hit),
      ...this.brickGroup.getChildren().filter((brick) => brick.active && brick.pegType === 'orange' && !brick.hit),
    ];
    this.showLastOrangeBanner(targets);
    targets.forEach((target) => {
      this.tweens.add({
        targets: target,
        scale: { from: 1.18, to: 1 },
        duration: 420,
        ease: 'Sine.easeInOut',
      });
      this.burst(target.x, target.y, COLORS.orange);
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
    this.playHitNote(hitSound, this.shotCombo, {
      volume: peg.pegType === 'orange' ? 0.74 : 0.58,
    });
    this.showComboBanner(this.shotCombo);
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
    if (peg.pegType === 'orange') this.pulseRemainingOrange();
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
    this.orangeClearCombo = this.shotCombo;
    this.playSfx('clear', { volume: 0.86 });
    this.refreshHud();
    const flash = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, COLORS.gold, 0.18).setDepth(34);
    this.tweens.add({ targets: flash, alpha: 0, duration: 420, onComplete: () => flash.destroy() });
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

  awardClearBonus() {
    if (this.clearBonusAwarded) return 0;
    this.clearBonusAwarded = true;
    const ballBonus = Math.max(0, this.shotsLeft) * 1000;
    const styleBonus = Math.min(5000, Math.max(0, ((this.orangeClearCombo ?? this.shotCombo) - 4) * 250));
    const total = ballBonus + styleBonus;
    if (total <= 0) return 0;
    this.score += total;
    this.refreshHud();
    const panel = this.add.container(WIDTH / 2, 378).setDepth(38);
    panel.add(this.add.rectangle(0, 0, 470, 116, 0x0b111b, 0.9).setStrokeStyle(3, COLORS.gold, 0.9));
    panel.add(this.add.text(0, -30, 'CLEAR BONUS', {
      fontFamily: 'Verdana',
      fontSize: 25,
      fontStyle: '700',
      color: '#ffd35a',
    }).setOrigin(0.5));
    panel.add(this.add.text(0, 12, `BALL ${ballBonus}   STYLE ${styleBonus}`, {
      fontFamily: 'Verdana',
      fontSize: 18,
      color: '#dbeafe',
    }).setOrigin(0.5));
    panel.add(this.add.text(0, 42, `+${total}`, {
      fontFamily: 'Verdana',
      fontSize: 30,
      fontStyle: '700',
      color: '#ffffff',
    }).setOrigin(0.5));
    this.tweens.add({
      targets: panel,
      y: 330,
      alpha: 0,
      duration: 1150,
      ease: 'Cubic.easeOut',
      onComplete: () => panel.destroy(true),
    });
    return total;
  }

  clearLevel() {
    if (this.levelCleared) return;
    this.levelCleared = true;
    const level = this.level.level;
    const clearBonus = this.awardClearBonus();
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
    this.time.delayedCall(clearBonus > 0 ? 1050 : 550, () => this.showResult(true));
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
    const panelHeight = isEditorTest ? 460 : success ? 1060 : canContinue ? 600 : 430;
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
      this.resultOverlay.add(Object.values(expand));
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
      this.resultOverlay.add(Object.values(adButton));
      this.resultOverlay.add(this.add.text(WIDTH / 2, HEIGHT / 2 + 92, 'PLACEMENT: rewarded_continue_dummy', {
        fontFamily: 'Verdana',
        fontSize: 16,
        color: '#7f8aa0',
      }).setOrigin(0.5));
    }

    if (isEditorTest) {
      const retry = this.button(WIDTH / 2 - 185, HEIGHT / 2 + 92, 260, 64, 'RETEST', () => this.startEditorTest(), { fill: 0x2c6f84 });
      const edit = this.button(WIDTH / 2 + 185, HEIGHT / 2 + 92, 260, 64, 'EDITOR', () => this.showStageEditor(), { fill: 0x334155, stroke: 0x93c5fd });
      this.resultOverlay.add([...Object.values(retry), ...Object.values(edit)]);
    } else {
      const next = Math.min(TOTAL_LEVELS, level + 1);
      const y = success ? 1032 : canContinue ? HEIGHT / 2 + 178 : HEIGHT / 2 + 48;
      const retry = this.button(WIDTH / 2 - 185, y, 260, 64, success && level < TOTAL_LEVELS ? '次へ' : '再挑戦', () => this.startLevel(success && level < TOTAL_LEVELS ? next : level), { fill: 0x2c6f84 });
      const select = this.button(WIDTH / 2 + 185, y, 260, 64, '選択へ', () => this.showLevelSelect());
      const gallery = this.button(WIDTH / 2, y + 90, 300, 58, 'ギャラリー', () => this.showGallery(), { fill: 0x4a3d21, stroke: COLORS.gold });
      this.resultOverlay.add([...Object.values(retry), ...Object.values(select), ...Object.values(gallery)]);
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
window.pegFanGenerateLevel = generateLevel;
