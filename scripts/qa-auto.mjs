import { chromium } from '@playwright/test';
import { cpus } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import process from 'node:process';

const PORT = Number(process.env.QA_AUTO_PORT ?? 4312);
const BASE_URL = `http://127.0.0.1:${PORT}/`;
const REPORT_DIR = 'qa-results';
const REPORT_PATH = `${REPORT_DIR}/autoplay-report.json`;
const SUMMARY_PATH = `${REPORT_DIR}/autoplay-summary.md`;
const SCREENSHOT_PATH = `${REPORT_DIR}/autoplay-last.png`;
const FULL = process.env.QA_AUTO_FULL === '1';
const STRICT = process.env.QA_AUTO_STRICT === '1' || FULL;
const SOURCE = process.env.QA_AUTO_SOURCE ?? 'bundled';
const LEVEL_SPEC = process.env.QA_AUTO_LEVELS ?? (FULL ? '1-100' : '1-3');
const WORKERS = Math.max(1, Number(process.env.QA_AUTO_WORKERS ?? Math.min(FULL ? 8 : 3, cpus().length || 1)));
const TRIALS = Math.max(1, Number(process.env.QA_AUTO_TRIALS ?? (FULL ? 600 : 12)));
const MAX_BALLS = Math.max(1, Number(process.env.QA_AUTO_MAX_BALLS ?? (FULL ? 18 : 4)));
const SHOT_TIMEOUT_MS = Number(process.env.QA_AUTO_SHOT_TIMEOUT_MS ?? (FULL ? 3600 : 2200));
const FAST_MODE = process.env.QA_AUTO_FAST !== '0';
const FAST_SCALE = Number(process.env.QA_AUTO_FAST_SCALE ?? (FULL ? 8 : 6));
const BASE_SEED = Number(process.env.QA_AUTO_SEED ?? 1729);

function parseLevels(spec) {
  const levels = new Set();
  spec.split(',').map((item) => item.trim()).filter(Boolean).forEach((item) => {
    const match = item.match(/^(\d+)-(\d+)$/);
    if (match) {
      const start = Number(match[1]);
      const end = Number(match[2]);
      for (let level = Math.min(start, end); level <= Math.max(start, end); level += 1) levels.add(level);
    } else {
      levels.add(Number(item));
    }
  });
  return [...levels].filter((level) => Number.isInteger(level) && level >= 1 && level <= 100).sort((a, b) => a - b);
}

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // Vite is still starting.
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(tick, 250);
    };
    tick();
  });
}

function startPreview() {
  const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '0.0.0.0', '--port', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  });
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.on('exit', (code) => {
    if (code && code !== 0) console.error(output);
  });
  return child;
}

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function quantile(values, q) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return null;
  const index = Math.min(finite.length - 1, Math.max(0, Math.floor((finite.length - 1) * q)));
  return finite[index];
}

function mean(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

function makeAnglePlan({ minAngle, maxAngle, levelNumber, trialIndex, maxBalls }) {
  const rng = createRng(BASE_SEED + levelNumber * 100003 + trialIndex * 9176);
  const plan = [];
  const center = (minAngle + maxAngle) / 2;
  const width = maxAngle - minAngle;
  for (let shot = 0; shot < maxBalls; shot += 1) {
    const mode = rng();
    let angle;
    if (mode < 0.52) {
      angle = minAngle + width * rng();
    } else if (mode < 0.78) {
      const lane = Math.floor(rng() * 9);
      angle = minAngle + width * (lane / 8) + (rng() - 0.5) * 0.09;
    } else {
      angle = center + (rng() - 0.5) * width * 0.42;
    }
    plan.push(Math.max(minAngle, Math.min(maxAngle, angle)));
  }
  return plan;
}

function difficultyLabel(metrics) {
  if (metrics.clearRate <= 0.05) return 'BROKEN';
  if (metrics.clearRate <= 0.15) return 'EXPERT';
  if (metrics.clearRate <= 0.35) return 'HARD';
  if (metrics.clearRate <= 0.65) return 'NORMAL';
  if (metrics.medianBallsToClear !== null && metrics.medianBallsToClear <= metrics.startBalls * 0.45) return 'TUTORIAL';
  return 'EASY';
}

function analyzeLevel(target, levelInfo, trials, elapsedMs) {
  const successful = trials.filter((trial) => trial.cleared);
  const allShots = trials.flatMap((trial) => trial.shots).filter(Boolean);
  const deadShots = allShots.filter((shot) => shot.targetsCleared === 0 && shot.scoreGain < 150).length;
  const stuckShots = allShots.filter((shot) => shot.stuckNudges > 2).length;
  const timedOutShots = allShots.filter((shot) => shot.timedOut).length;
  const caughtShots = allShots.filter((shot) => shot.caught).length;
  const gimmickShots = allShots.filter((shot) => shot.gimmickHits > 0).length;
  const firstHits = new Set(allShots.map((shot) => shot.firstHit).filter(Boolean));
  const targetOrders = new Set(trials.map((trial) => trial.targetOrder.join('>')).filter(Boolean));
  const ballsToClear = successful.map((trial) => trial.shotsFired);
  const targetsCleared = trials.map((trial) => trial.targetsCleared);
  const scores = trials.map((trial) => trial.score);
  const metrics = {
    startBalls: levelInfo.startBalls,
    trials: trials.length,
    clearRate: trials.length ? successful.length / trials.length : 0,
    meanBallsToClear: mean(ballsToClear),
    medianBallsToClear: quantile(ballsToClear, 0.5),
    p90BallsToClear: quantile(ballsToClear, 0.9),
    meanTargetsCleared: mean(targetsCleared) ?? 0,
    p90TargetsCleared: quantile(targetsCleared, 0.9) ?? 0,
    expectedTargetProgress: allShots.length ? allShots.reduce((sum, shot) => sum + shot.targetsCleared, 0) / allShots.length : 0,
    deadShotRate: allShots.length ? deadShots / allShots.length : 0,
    stuckRate: allShots.length ? stuckShots / allShots.length : 0,
    timeoutRate: allShots.length ? timedOutShots / allShots.length : 0,
    catchRate: allShots.length ? caughtShots / allShots.length : 0,
    gimmickContactRate: allShots.length ? gimmickShots / allShots.length : 0,
    pathDiversity: firstHits.size + targetOrders.size,
    scoreSpread: {
      low: quantile(scores, 0.1) ?? 0,
      median: quantile(scores, 0.5) ?? 0,
      high: quantile(scores, 0.9) ?? 0,
    },
  };
  metrics.difficulty = difficultyLabel(metrics);

  const flags = [];
  const rejectFlag = (name) => flags.push(STRICT ? `REJECT_${name}` : `WARN_${name}`);
  const hasGimmicks = levelInfo.objects.rails + levelInfo.objects.timedBlocks + levelInfo.objects.spinners + levelInfo.objects.bumpers > 0;
  if (metrics.clearRate === 0 && MAX_BALLS >= levelInfo.startBalls) rejectFlag('NO_CLEAR');
  else if (metrics.clearRate === 0) flags.push('WARN_NO_CLEAR_IN_BUDGET');
  if (metrics.deadShotRate > 0.55) rejectFlag('DEAD_SHOTS');
  if (metrics.stuckRate > 0.03) rejectFlag('STUCK');
  if (metrics.timeoutRate > 0.25 && !STRICT) flags.push('WARN_LONG_SHOTS');
  if (hasGimmicks && metrics.gimmickContactRate < 0.15) flags.push('WARN_LOW_GIMMICK_CONTACT');
  if (metrics.pathDiversity < 4) flags.push('WARN_LOW_PATH_DIVERSITY');
  if (metrics.clearRate > 0.7 && metrics.medianBallsToClear !== null && metrics.medianBallsToClear < Math.max(2, Math.floor(levelInfo.startBalls * 0.3))) flags.push('WARN_TOO_EASY');
  if (metrics.p90TargetsCleared < Math.ceil(levelInfo.startTargets * 0.7)) flags.push('WARN_LOW_TARGET_REACH');

  return {
    id: target.id,
    label: target.label,
    level: target.levelNumber,
    objects: levelInfo.objects,
    startBalls: levelInfo.startBalls,
    startTargets: levelInfo.startTargets,
    elapsedMs,
    metrics,
    flags,
    bestTrials: [...trials].sort((a, b) => b.targetsCleared - a.targetsCleared || b.score - a.score).slice(0, 6),
    trials,
  };
}

function markdownSummary(report) {
  const rejected = report.levels.filter((level) => level.flags.some((flag) => flag.startsWith('REJECT')));
  const warned = report.levels.filter((level) => !level.flags.some((flag) => flag.startsWith('REJECT')) && level.flags.length);
  const passed = report.levels.filter((level) => !level.flags.length);
  const lines = [
    '# Autoplay Monte Carlo QA Summary',
    '',
    `Generated: ${report.generatedAt}`,
    `Source: ${report.config.source}`,
    `Levels: ${report.levels.length}`,
    `Trials per level: ${report.config.trials}`,
    `Workers: ${report.config.workers}`,
    `Fast mode: ${report.config.fastMode ? `${report.config.fastScale}x` : 'off'}`,
    `Rejected: ${rejected.length}`,
    `Warned: ${warned.length}`,
    `Passed: ${passed.length}`,
    '',
    '## Levels',
    '',
  ];
  report.levels.forEach((level) => {
    const m = level.metrics;
    const balls = m.medianBallsToClear === null ? '-' : `${m.medianBallsToClear}/${m.p90BallsToClear}`;
    lines.push(`- ${level.label} ${m.difficulty} clear ${(m.clearRate * 100).toFixed(1)}% balls med/p90 ${balls} dead ${(m.deadShotRate * 100).toFixed(0)}% timeout ${(m.timeoutRate * 100).toFixed(0)}% gimmick ${(m.gimmickContactRate * 100).toFixed(0)}% diversity ${m.pathDiversity} ${level.flags.join(',') || 'PASS'}`);
  });
  return `${lines.join('\n')}\n`;
}

async function collectTargets(page, levels) {
  if (SOURCE === 'editor-slots') {
    const slots = await page.evaluate(() => window.pegFanDebug.getEditorSlots());
    return slots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => slot?.level)
      .map(({ slot, index }) => ({
        id: `slot-${index + 1}`,
        label: `SLOT ${index + 1}`,
        levelNumber: slot.level.level ?? index + 1,
        levelOverride: { ...slot.level, level: slot.level.level ?? index + 1, editorTest: true },
      }));
  }
  return levels.map((levelNumber) => ({
    id: `level-${levelNumber}`,
    label: `L${String(levelNumber).padStart(3, '0')}`,
    levelNumber,
    levelOverride: null,
  }));
}

async function preparePage(browser, pageErrors) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1300 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(String(error.stack || error.message || error)));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text());
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.pegFanDebug?.scene?.());
  await page.evaluate(({ fastMode, fastScale }) => {
    window.pegFanDebug.muteAudio(true);
    window.pegFanDebug.setQaFastMode(fastMode, fastScale);
  }, { fastMode: FAST_MODE, fastScale: FAST_SCALE });
  return { context, page };
}

async function runTrial(page, target, anglePlan, trialIndex) {
  return page.evaluate(async ({ target, anglePlan, trialIndex, timeout }) => {
    const first = window.pegFanDebug.loadLevel(target.levelNumber, target.levelOverride);
    const shots = [];
    for (const angle of anglePlan.slice(0, Math.min(anglePlan.length, first.startBalls))) {
      const snapshotBefore = window.pegFanDebug.snapshot();
      if (snapshotBefore.levelCleared || snapshotBefore.levelFailed) break;
      const launched = window.pegFanDebug.launchAngle(angle);
      if (!launched) break;
      const snapshot = await window.pegFanDebug.waitForShot(timeout);
      if (snapshot.lastShot) shots.push(snapshot.lastShot);
      if (snapshot.levelCleared || snapshot.levelFailed) break;
    }
    const final = window.pegFanDebug.snapshot();
    return {
      trialIndex,
      angles: anglePlan.slice(0, shots.length),
      cleared: final.levelCleared,
      failed: final.levelFailed,
      score: final.score,
      targetsLeft: final.targetsLeft,
      targetsCleared: Math.max(0, final.startTargets - final.targetsLeft),
      shotsFired: shots.length,
      targetOrder: shots.flatMap((shot) => shot.targetOrder ?? []),
      shots,
    };
  }, { target, anglePlan, trialIndex, timeout: SHOT_TIMEOUT_MS });
}

async function evaluateTarget(page, constants, target) {
  const startedAt = Date.now();
  const levelInfo = await page.evaluate((targetValue) => window.pegFanDebug.loadLevel(targetValue.levelNumber, targetValue.levelOverride), target);
  const maxBalls = Math.min(MAX_BALLS, levelInfo.startBalls);
  const trials = [];
  for (let index = 0; index < TRIALS; index += 1) {
    const anglePlan = makeAnglePlan({
      minAngle: constants.minAimAngle,
      maxAngle: constants.maxAimAngle,
      levelNumber: target.levelNumber,
      trialIndex: index,
      maxBalls,
    });
    trials.push(await runTrial(page, target, anglePlan, index));
  }
  return analyzeLevel(target, levelInfo, trials, Date.now() - startedAt);
}

async function workerLoop(browser, constants, queue, pageErrors, workerIndex) {
  const { context, page } = await preparePage(browser, pageErrors);
  const reports = [];
  try {
    while (queue.length) {
      const target = queue.shift();
      if (!target) break;
      const report = await evaluateTarget(page, constants, target);
      reports.push(report);
      const m = report.metrics;
      console.log(`W${workerIndex} ${target.label} ${m.difficulty} clear=${(m.clearRate * 100).toFixed(1)}% med=${m.medianBallsToClear ?? '-'} p90=${m.p90BallsToClear ?? '-'} dead=${(m.deadShotRate * 100).toFixed(0)}% ${report.flags.join(',') || 'PASS'}`);
    }
  } finally {
    await context.close();
  }
  return reports;
}

async function run() {
  const levels = parseLevels(LEVEL_SPEC);
  if (!levels.length) throw new Error(`No valid levels in QA_AUTO_LEVELS=${LEVEL_SPEC}`);
  await mkdir(REPORT_DIR, { recursive: true });
  const preview = startPreview();
  let browser;
  try {
    await waitForServer(BASE_URL);
    browser = await chromium.launch({ headless: true });
    const pageErrors = [];
    const bootstrap = await preparePage(browser, pageErrors);
    const constants = await bootstrap.page.evaluate(() => window.pegFanDebug.constants);
    const targets = await collectTargets(bootstrap.page, levels);
    await bootstrap.context.close();
    if (!targets.length) console.log(`No QA targets found for source ${SOURCE}`);

    const queue = [...targets];
    const workerCount = Math.min(WORKERS, Math.max(1, queue.length));
    const workerResults = await Promise.all(Array.from({ length: workerCount }, (_, index) => workerLoop(browser, constants, queue, pageErrors, index + 1)));
    const levelReports = workerResults.flat().sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));

    const screenshotPage = await preparePage(browser, pageErrors);
    if (targets[0]) await screenshotPage.page.evaluate((target) => window.pegFanDebug.loadLevel(target.levelNumber, target.levelOverride), targets[0]);
    await screenshotPage.page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
    await screenshotPage.context.close();

    const report = {
      generatedAt: new Date().toISOString(),
      config: {
        levels: LEVEL_SPEC,
        source: SOURCE,
        workers: workerCount,
        trials: TRIALS,
        maxBalls: MAX_BALLS,
        shotTimeoutMs: SHOT_TIMEOUT_MS,
        fastMode: FAST_MODE,
        fastScale: FAST_SCALE,
        strict: STRICT,
        seed: BASE_SEED,
      },
      pageErrors,
      levels: levelReports,
    };
    await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(SUMMARY_PATH, markdownSummary(report));
    console.log(`Autoplay QA report: ${REPORT_PATH}`);
    console.log(`Autoplay QA summary: ${SUMMARY_PATH}`);
    console.log(`Autoplay QA screenshot: ${SCREENSHOT_PATH}`);
    if (pageErrors.length || (STRICT && levelReports.some((level) => level.flags.some((flag) => flag.startsWith('REJECT'))))) {
      process.exitCode = 1;
    }
  } finally {
    if (browser) await browser.close();
    preview.kill();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
