import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const stageDir = path.join(root, 'public', 'assets', 'stages');
const reportPath = path.resolve(root, process.env.QA_TUNE_REPORT ?? path.join('qa-results', 'autoplay-report.json'));
const dryRun = process.env.QA_TUNE_DRY_RUN === '1';
const maxStages = Number(process.env.QA_TUNE_MAX_STAGES ?? 100);
const summaryPath = path.resolve(root, process.env.QA_TUNE_SUMMARY ?? path.join('qa-results', 'stage-tune-summary.md'));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function stagePath(level) {
  return path.join(stageDir, `stage-${String(level).padStart(3, '0')}.json`);
}

function expectedDifficulty(level) {
  if (level <= 10) return 'TUTORIAL';
  if (level <= 35) return 'EASY';
  if (level <= 70) return 'NORMAL';
  if (level <= 95) return 'HARD';
  return 'EXPERT';
}

function desiredBands(level) {
  if (level <= 10) return { clearMin: 0.55, clearMax: 0.95, deadMax: 0.34, progressMin: 1.2, ballsMin: 10, ballsMax: 13 };
  if (level <= 35) return { clearMin: 0.38, clearMax: 0.88, deadMax: 0.4, progressMin: 1.0, ballsMin: 9, ballsMax: 12 };
  if (level <= 70) return { clearMin: 0.2, clearMax: 0.72, deadMax: 0.48, progressMin: 0.75, ballsMin: 8, ballsMax: 11 };
  if (level <= 95) return { clearMin: 0.08, clearMax: 0.55, deadMax: 0.55, progressMin: 0.55, ballsMin: 7, ballsMax: 10 };
  return { clearMin: 0.03, clearMax: 0.38, deadMax: 0.62, progressMin: 0.4, ballsMin: 7, ballsMax: 9 };
}

function desiredTargetRange(level) {
  if (level <= 3) return { min: 3, max: 3 };
  if (level <= 10) return { min: 4, max: 6 };
  if (level <= 35) return { min: 7, max: 11 };
  if (level <= 70) return { min: 10, max: 18 };
  if (level <= 95) return { min: 13, max: 24 };
  return { min: 16, max: 28 };
}

function recalcTargets(stage) {
  stage.targetCount = (stage.pegs ?? []).filter((peg) => peg.type === 'orange').length
    + (stage.bricks ?? []).filter((brick) => brick.type === 'orange').length;
}

function hasNearPeg(stage, point, radius = 30) {
  return (stage.pegs ?? []).some((peg) => distance(peg, point) < radius);
}

function addPeg(stage, x, y, type = 'blue', motion = null) {
  const point = { x: round(clamp(x, 70, 830)), y: round(clamp(y, 270, 1060)) };
  if (hasNearPeg(stage, point, 28)) return false;
  stage.pegs.push({ x: point.x, y: point.y, type, motion });
  return true;
}

function convertReachableBlueToOrange(stage, count) {
  const candidates = (stage.pegs ?? [])
    .filter((peg) => peg.type === 'blue' && peg.y >= 390 && peg.y <= 860)
    .sort((a, b) => a.y - b.y || Math.abs(a.x - 450) - Math.abs(b.x - 450));
  let changed = 0;
  for (const peg of candidates) {
    if (changed >= count) break;
    peg.type = 'orange';
    changed += 1;
  }
  return changed;
}

function orangePriority(peg) {
  const center = Math.abs((peg.x ?? 450) - 450) / 450;
  const vertical = Math.abs((peg.y ?? 650) - 570) / 700;
  const lowerPenalty = peg.y > 860 ? 1.2 : 0;
  return center + vertical + lowerPenalty;
}

function capOrangeTargets(stage, maxTargets) {
  const orangePegs = (stage.pegs ?? [])
    .filter((peg) => peg.type === 'orange')
    .sort((a, b) => orangePriority(b) - orangePriority(a));
  const orangeBricks = (stage.bricks ?? []).filter((brick) => brick.type === 'orange');
  let current = orangePegs.length + orangeBricks.length;
  let changed = 0;
  for (const peg of orangePegs) {
    if (current <= maxTargets) break;
    peg.type = 'blue';
    current -= 1;
    changed += 1;
  }
  for (const brick of orangeBricks) {
    if (current <= maxTargets) break;
    brick.type = 'blue';
    current -= 1;
    changed += 1;
  }
  return changed;
}

function forceTutorialTargets(stage) {
  (stage.pegs ?? []).forEach((peg) => {
    if (peg.type === 'orange') peg.type = 'blue';
  });
  (stage.bricks ?? []).forEach((brick) => {
    if (brick.type === 'orange') brick.type = 'blue';
  });
  const targets = [
    { x: 378, y: 430 },
    { x: 450, y: 535 },
    { x: 522, y: 430 },
  ];
  let changed = 0;
  targets.forEach((target) => {
    const existing = (stage.pegs ?? [])
      .filter((peg) => distance(peg, target) < 56)
      .sort((a, b) => distance(a, target) - distance(b, target))[0];
    if (existing) {
      existing.x = target.x;
      existing.y = target.y;
      existing.type = 'orange';
      existing.motion = null;
    } else {
      stage.pegs.push({ ...target, type: 'orange', motion: null });
    }
    changed += 1;
  });
  return changed;
}

function addCoverageFan(stage, level, count) {
  const rows = [
    { y: 360 + (level % 3) * 8, xs: [210, 330, 450, 570, 690] },
    { y: 475 + (level % 4) * 6, xs: [160, 275, 390, 510, 625, 740] },
    { y: 590 + (level % 5) * 5, xs: [220, 335, 450, 565, 680] },
  ];
  let added = 0;
  for (const row of rows) {
    for (const x of row.xs) {
      if (added >= count) return added;
      const type = (added + level) % 5 === 0 ? 'orange' : 'blue';
      if (addPeg(stage, x + ((level % 2) ? 12 : -12), row.y, type)) added += 1;
    }
  }
  return added;
}

function addGimmickBait(stage) {
  const anchors = [
    ...(stage.rails ?? []).map((rail) => ({ x: rail.x ?? 450, y: rail.y ?? 780 })),
    ...(stage.bumpers ?? []).map((bumper) => ({ x: bumper.x, y: bumper.y })),
    ...(stage.spinners ?? []).map((spinner) => ({ x: spinner.x, y: spinner.y })),
    ...(stage.timedBlocks ?? []).map((block) => ({ x: block.x, y: block.y })),
  ].filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y));
  let added = 0;
  anchors.slice(0, 3).forEach((anchor, index) => {
    if (addPeg(stage, anchor.x - 62, anchor.y - 78, index === 0 ? 'orange' : 'blue')) added += 1;
    if (addPeg(stage, anchor.x + 62, anchor.y - 78, 'blue')) added += 1;
  });
  return added;
}

function softenStage(stage, report, band) {
  const actions = [];
  const metrics = report.metrics ?? {};
  const targetRange = desiredTargetRange(stage.level);
  const severe = metrics.clearRate === 0 || report.flags?.some((flag) => /NO_CLEAR|LOW_TARGET_REACH|DEAD_SHOTS/.test(flag));
  if (stage.level <= 3 && metrics.clearRate === 0) {
    const forced = forceTutorialTargets(stage);
    if (forced) actions.push(`tutorial targets ${forced}`);
  }
  const removedOrange = capOrangeTargets(stage, targetRange.max);
  if (removedOrange) actions.push(`excess orange -${removedOrange}`);
  if (stage.balls < band.ballsMax && (severe || metrics.deadShotRate > band.deadMax)) {
    const before = stage.balls;
    stage.balls = clamp(stage.balls + (stage.level <= 10 ? 2 : 1), band.ballsMin, band.ballsMax);
    if (stage.balls !== before) actions.push(`balls ${before}->${stage.balls}`);
  }

  if ((metrics.deadShotRate ?? 0) > band.deadMax || (metrics.expectedTargetProgress ?? 0) < band.progressMin) {
    const added = addCoverageFan(stage, stage.level, stage.level <= 10 ? 12 : 8);
    if (added) actions.push(`coverage pegs +${added}`);
  }

  if ((metrics.p90TargetsCleared ?? 0) < Math.ceil((stage.targetCount ?? 0) * 0.7) || severe) {
    recalcTargets(stage);
    if (stage.targetCount < targetRange.min) {
      const converted = convertReachableBlueToOrange(stage, targetRange.min - stage.targetCount);
      if (converted) actions.push(`reachable orange +${converted}`);
    }
  }

  if ((metrics.gimmickContactRate ?? 1) < 0.15 && ((stage.rails?.length ?? 0) + (stage.bumpers?.length ?? 0) + (stage.spinners?.length ?? 0) + (stage.timedBlocks?.length ?? 0)) > 0) {
    const added = addGimmickBait(stage);
    if (added) actions.push(`gimmick bait +${added}`);
  }

  return actions;
}

function hardenStage(stage, report, band) {
  const actions = [];
  const metrics = report.metrics ?? {};
  if ((metrics.clearRate ?? 0) > band.clearMax && stage.balls > band.ballsMin) {
    const before = stage.balls;
    stage.balls = clamp(stage.balls - 1, band.ballsMin, band.ballsMax);
    if (stage.balls !== before) actions.push(`balls ${before}->${stage.balls}`);
  }
  if ((metrics.clearRate ?? 0) > band.clearMax && (stage.targetCount ?? 0) < 28) {
    const candidates = (stage.pegs ?? [])
      .filter((peg) => peg.type === 'blue' && peg.y > 620)
      .sort((a, b) => b.y - a.y);
    let changed = 0;
    for (const peg of candidates.slice(0, 2)) {
      peg.type = 'orange';
      changed += 1;
    }
    if (changed) actions.push(`lower orange +${changed}`);
  }
  return actions;
}

function tuneStage(stage, report) {
  stage.pegs = Array.isArray(stage.pegs) ? stage.pegs : [];
  stage.bricks = Array.isArray(stage.bricks) ? stage.bricks : [];
  stage.rails = Array.isArray(stage.rails) ? stage.rails : [];
  stage.timedBlocks = Array.isArray(stage.timedBlocks) ? stage.timedBlocks : [];
  stage.spinners = Array.isArray(stage.spinners) ? stage.spinners : [];
  stage.bumpers = Array.isArray(stage.bumpers) ? stage.bumpers : [];
  const band = desiredBands(stage.level);
  const actions = [];
  const metrics = report.metrics ?? {};
  if ((metrics.clearRate ?? 0) < band.clearMin || (metrics.deadShotRate ?? 0) > band.deadMax || report.flags?.length) {
    actions.push(...softenStage(stage, report, band));
  } else if ((metrics.clearRate ?? 0) > band.clearMax) {
    actions.push(...hardenStage(stage, report, band));
  }
  recalcTargets(stage);
  stage.tunedFromQa = {
    at: new Date().toISOString(),
    source: path.relative(root, reportPath).replaceAll('\\', '/'),
    expectedDifficulty: expectedDifficulty(stage.level),
    observedDifficulty: metrics.difficulty ?? 'UNKNOWN',
    clearRate: metrics.clearRate ?? null,
    medianBallsToClear: metrics.medianBallsToClear ?? null,
    deadShotRate: metrics.deadShotRate ?? null,
    actions,
  };
  return actions;
}

function main() {
  if (!fs.existsSync(reportPath)) {
    console.error(`Missing QA report: ${reportPath}`);
    process.exit(1);
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const levels = [...(report.levels ?? [])]
    .filter((item) => Number.isInteger(item.level))
    .slice(0, maxStages);
  const tuned = [];
  for (const item of levels) {
    const file = stagePath(item.level);
    if (!fs.existsSync(file)) continue;
    const stage = JSON.parse(fs.readFileSync(file, 'utf8'));
    const before = JSON.stringify(stage);
    const actions = tuneStage(stage, item);
    const after = JSON.stringify(stage);
    if (before !== after && actions.length) {
      tuned.push({ level: item.level, label: item.label ?? `L${String(item.level).padStart(3, '0')}`, actions });
      if (!dryRun) fs.writeFileSync(file, `${JSON.stringify(stage, null, 2)}\n`);
    }
  }

  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  const lines = [
    '# Stage Tune Summary',
    '',
    `Report: ${path.relative(root, reportPath).replaceAll('\\', '/')}`,
    `Dry run: ${dryRun ? 'yes' : 'no'}`,
    `Tuned stages: ${tuned.length}`,
    '',
    ...tuned.map((item) => `- ${item.label}: ${item.actions.join(', ')}`),
    '',
  ];
  fs.writeFileSync(summaryPath, lines.join('\n'));
  console.log(`Stage tune: ${tuned.length} stage(s) ${dryRun ? 'would be updated' : 'updated'}.`);
  tuned.slice(0, 30).forEach((item) => console.log(`${item.label}: ${item.actions.join(', ')}`));
  console.log(`Tune summary: ${path.relative(root, summaryPath)}`);
}

main();
