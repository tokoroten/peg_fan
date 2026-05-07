import { chromium } from '@playwright/test';
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
const CANDIDATE_COUNT = Number(process.env.QA_AUTO_CANDIDATES ?? (FULL ? 25 : 5));
const POLICY_COUNT = Number(process.env.QA_AUTO_POLICIES ?? (FULL ? 5 : 1));
const REPEAT_MOVING = Number(process.env.QA_AUTO_REPEAT_MOVING ?? (FULL ? 3 : 1));
const MAX_BALLS = Number(process.env.QA_AUTO_MAX_BALLS ?? (FULL ? 18 : 3));
const SHOT_TIMEOUT_MS = Number(process.env.QA_AUTO_SHOT_TIMEOUT_MS ?? (FULL ? 6500 : 4200));

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

function candidateAngles(min, max, count) {
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0.5 : index / (count - 1);
    return min + (max - min) * t;
  });
}

function quantile(values, q) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
  return sorted[index];
}

function analyzeLevel(levelNumber, levelInfo, singles, policies) {
  const successful = policies.filter((policy) => policy.cleared);
  const allShots = [
    ...singles.map((single) => single.shot),
    ...policies.flatMap((policy) => policy.shots),
  ].filter(Boolean);
  const scores = policies.map((policy) => policy.score);
  const deadShots = singles.filter((single) => single.shot.targetsCleared === 0 && single.shot.scoreGain < 150).length;
  const stuckShots = allShots.filter((shot) => shot.stuckNudges > 2).length;
  const timedOutShots = allShots.filter((shot) => shot.timedOut).length;
  const caughtShots = allShots.filter((shot) => shot.caught).length;
  const gimmickShots = allShots.filter((shot) => shot.gimmickHits > 0).length;
  const firstHits = new Set(allShots.map((shot) => shot.firstHit).filter(Boolean));
  const targetOrders = new Set(policies.map((policy) => policy.targetOrder.join('>')).filter(Boolean));
  const metrics = {
    clearRate: policies.length ? successful.length / policies.length : 0,
    medianBallsToClear: successful.length ? quantile(successful.map((policy) => policy.shotsFired), 0.5) : null,
    targetProgress: singles.length ? singles.reduce((sum, single) => sum + single.shot.targetsCleared, 0) / singles.length : 0,
    deadShotRate: singles.length ? deadShots / singles.length : 0,
    stuckRate: allShots.length ? stuckShots / allShots.length : 0,
    timeoutRate: allShots.length ? timedOutShots / allShots.length : 0,
    catchRate: allShots.length ? caughtShots / allShots.length : 0,
    gimmickContactRate: allShots.length ? gimmickShots / allShots.length : 0,
    pathDiversity: firstHits.size + targetOrders.size,
    scoreSpread: {
      low: quantile(scores, 0.1),
      median: quantile(scores, 0.5),
      high: quantile(scores, 0.9),
    },
  };
  const flags = [];
  const hasGimmicks = levelInfo.objects.rails + levelInfo.objects.timedBlocks + levelInfo.objects.spinners + levelInfo.objects.bumpers > 0;
  if (metrics.clearRate === 0 && MAX_BALLS >= levelInfo.startBalls) flags.push('REJECT_NO_CLEAR');
  else if (metrics.clearRate === 0) flags.push('WARN_NO_CLEAR_IN_BUDGET');
  if (metrics.deadShotRate > 0.55) flags.push('REJECT_DEAD_SHOTS');
  if (metrics.stuckRate > 0.03) flags.push('REJECT_STUCK');
  if (metrics.timeoutRate > 0.25 && !STRICT) flags.push('WARN_LONG_SHOTS');
  if (hasGimmicks && metrics.gimmickContactRate < 0.15) flags.push('WARN_LOW_GIMMICK_CONTACT');
  if (metrics.pathDiversity < 4) flags.push('WARN_LOW_PATH_DIVERSITY');
  if (metrics.medianBallsToClear !== null && metrics.medianBallsToClear < Math.max(2, Math.floor(levelInfo.startBalls * 0.3))) flags.push('WARN_TOO_EASY');
  if (!policies.some((policy) => policy.targetsCleared >= Math.ceil(levelInfo.startTargets * 0.7))) flags.push('WARN_LOW_TARGET_REACH');
  return {
    level: levelNumber,
    objects: levelInfo.objects,
    startBalls: levelInfo.startBalls,
    startTargets: levelInfo.startTargets,
    metrics,
    flags,
    singles,
    policies,
  };
}

function markdownSummary(report) {
  const rejected = report.levels.filter((level) => level.flags.some((flag) => flag.startsWith('REJECT')));
  const warned = report.levels.filter((level) => !level.flags.some((flag) => flag.startsWith('REJECT')) && level.flags.length);
  const passed = report.levels.filter((level) => !level.flags.length);
  const lines = [
    '# Autoplay QA Summary',
    '',
    `Generated: ${report.generatedAt}`,
    `Levels: ${report.levels.length}`,
    `Rejected: ${rejected.length}`,
    `Warned: ${warned.length}`,
    `Passed: ${passed.length}`,
    '',
    '## Levels',
    '',
  ];
  report.levels.forEach((level) => {
    const m = level.metrics;
    lines.push(`- ${level.label ?? `L${String(level.level).padStart(3, '0')}`} clear ${(m.clearRate * 100).toFixed(0)}% dead ${(m.deadShotRate * 100).toFixed(0)}% stuck ${(m.stuckRate * 100).toFixed(0)}% timeout ${(m.timeoutRate * 100).toFixed(0)}% gimmick ${(m.gimmickContactRate * 100).toFixed(0)}% diversity ${m.pathDiversity} ${level.flags.join(',') || 'PASS'}`);
  });
  return `${lines.join('\n')}\n`;
}

async function runSingleShot(page, target, angle) {
  return page.evaluate(async ({ target, angle, timeout }) => {
    window.pegFanDebug.loadLevel(target.levelNumber, target.levelOverride);
    window.pegFanDebug.launchAngle(angle);
    const snapshot = await window.pegFanDebug.waitForShot(timeout);
    return {
      angle,
      shot: snapshot.lastShot,
      score: snapshot.score,
      targetsLeft: snapshot.targetsLeft,
    };
  }, { target, angle, timeout: SHOT_TIMEOUT_MS });
}

async function runPolicy(page, target, baseAngle, repeatIndex) {
  return page.evaluate(async ({ target, baseAngle, repeatIndex, maxBalls, timeout, minAngle, maxAngle }) => {
    const first = window.pegFanDebug.loadLevel(target.levelNumber, target.levelOverride);
    const offsets = [0, -0.045, 0.045, -0.09, 0.09, -0.135, 0.135];
    const shots = [];
    while (!window.pegFanDebug.snapshot().levelCleared && !window.pegFanDebug.snapshot().levelFailed && shots.length < Math.min(maxBalls, first.startBalls)) {
      const angle = Math.max(minAngle, Math.min(maxAngle, baseAngle + offsets[(shots.length + repeatIndex) % offsets.length]));
      const launched = window.pegFanDebug.launchAngle(angle);
      if (!launched) break;
      const snapshot = await window.pegFanDebug.waitForShot(timeout);
      if (snapshot.lastShot) shots.push(snapshot.lastShot);
      if (snapshot.levelCleared || snapshot.levelFailed) break;
    }
    const final = window.pegFanDebug.snapshot();
    return {
      baseAngle,
      repeatIndex,
      cleared: final.levelCleared,
      failed: final.levelFailed,
      score: final.score,
      targetsLeft: final.targetsLeft,
      targetsCleared: Math.max(0, final.startTargets - final.targetsLeft),
      shotsFired: shots.length,
      targetOrder: shots.flatMap((shot) => shot.targetOrder ?? []),
      shots,
    };
  }, {
    target,
    baseAngle,
    repeatIndex,
    maxBalls: MAX_BALLS,
    timeout: SHOT_TIMEOUT_MS,
    minAngle: 0.28,
    maxAngle: Math.PI - 0.28,
  });
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

async function run() {
  const levels = parseLevels(LEVEL_SPEC);
  if (!levels.length) throw new Error(`No valid levels in QA_AUTO_LEVELS=${LEVEL_SPEC}`);
  await mkdir(REPORT_DIR, { recursive: true });
  const preview = startPreview();
  let browser;
  try {
    await waitForServer(BASE_URL);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1300 }, deviceScaleFactor: 1 });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error.stack || error.message || error)));
    page.on('console', (message) => {
      if (message.type() === 'error') pageErrors.push(message.text());
    });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.pegFanDebug?.scene?.());
    await page.evaluate(() => window.pegFanDebug.muteAudio(true));
    const constants = await page.evaluate(() => window.pegFanDebug.constants);
    const angles = candidateAngles(constants.minAimAngle, constants.maxAimAngle, CANDIDATE_COUNT);

    const targets = await collectTargets(page, levels);
    if (!targets.length) {
      console.log(`No QA targets found for source ${SOURCE}`);
    }

    const levelReports = [];
    for (const target of targets) {
      const levelInfo = await page.evaluate((targetValue) => window.pegFanDebug.loadLevel(targetValue.levelNumber, targetValue.levelOverride), target);
      const singles = [];
      for (const angle of angles) {
        singles.push(await runSingleShot(page, target, angle));
      }
      const bestAngles = [...singles]
        .sort((a, b) => ((b.shot?.targetsCleared ?? 0) * 10000 + (b.shot?.scoreGain ?? 0)) - ((a.shot?.targetsCleared ?? 0) * 10000 + (a.shot?.scoreGain ?? 0)))
        .slice(0, POLICY_COUNT)
        .map((single) => single.angle);
      const hasMoving = levelInfo.objects.timedBlocks + levelInfo.objects.spinners > 0;
      const repeats = hasMoving ? REPEAT_MOVING : 1;
      const policies = [];
      for (const angle of bestAngles) {
        for (let repeat = 0; repeat < repeats; repeat += 1) {
          policies.push(await runPolicy(page, target, angle, repeat));
        }
      }
      const report = analyzeLevel(target.levelNumber, levelInfo, singles, policies);
      report.id = target.id;
      report.label = target.label;
      levelReports.push(report);
      const m = report.metrics;
      console.log(`${target.label} clear=${(m.clearRate * 100).toFixed(0)}% dead=${(m.deadShotRate * 100).toFixed(0)}% stuck=${(m.stuckRate * 100).toFixed(0)}% timeout=${(m.timeoutRate * 100).toFixed(0)}% ${report.flags.join(',') || 'PASS'}`);
    }

    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
    const report = {
      generatedAt: new Date().toISOString(),
      config: {
        levels: LEVEL_SPEC,
        source: SOURCE,
        candidateCount: CANDIDATE_COUNT,
        policyCount: POLICY_COUNT,
        repeatMoving: REPEAT_MOVING,
        maxBalls: MAX_BALLS,
        shotTimeoutMs: SHOT_TIMEOUT_MS,
        strict: STRICT,
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
