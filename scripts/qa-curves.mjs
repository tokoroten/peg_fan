import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import process from 'node:process';

const PORT = Number(process.env.QA_CURVES_PORT ?? 4310);
const BASE_URL = `http://127.0.0.1:${PORT}/`;
const REPORT_DIR = 'qa-results';
const REPORT_PATH = `${REPORT_DIR}/curves-report.json`;
const SCREENSHOT_PATH = `${REPORT_DIR}/curves-last.png`;

const cases = [
  { shape: 'arc', part: 'brick', start: { x: 170, y: 750 }, end: { x: 730, y: 760 } },
  { shape: 'arc', part: 'rail', start: { x: 170, y: 750 }, end: { x: 730, y: 760 } },
  { shape: 'bezier', part: 'brick', start: { x: 150, y: 820 }, end: { x: 740, y: 500 } },
  { shape: 'bezier', part: 'rail', start: { x: 150, y: 820 }, end: { x: 740, y: 500 } },
  { shape: 'circle', part: 'brick', start: { x: 210, y: 430 }, end: { x: 720, y: 920 } },
  { shape: 'circle', part: 'rail', start: { x: 210, y: 430 }, end: { x: 720, y: 920 } },
];

const shots = [
  { label: 'top-drop', x: 450, y: 260, vx: 0, vy: 13.2 },
  { label: 'left-graze', x: 155, y: 510, vx: 12.4, vy: 8.4 },
  { label: 'right-graze', x: 745, y: 510, vx: -12.4, vy: 8.4 },
];

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
    if (code && code !== 0) {
      console.error(output);
    }
  });
  return child;
}

function summarize(results, pageErrors) {
  const failed = results.filter((result) => result.failures.length);
  return {
    generatedAt: new Date().toISOString(),
    cases: results.length,
    failed: failed.length,
    pageErrors,
    ok: failed.length === 0 && pageErrors.length === 0,
  };
}

async function run() {
  await mkdir(REPORT_DIR, { recursive: true });
  const preview = startPreview();
  let browser;
  try {
    await waitForServer(BASE_URL);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1500, height: 1500 }, deviceScaleFactor: 1 });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error.stack || error.message || error)));
    page.on('console', (message) => {
      if (message.type() === 'error') pageErrors.push(message.text());
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.pegFanGame?.scene?.scenes?.[0]);
    await page.evaluate(() => {
      window.pegFanGame.sound.mute = true;
    });

    const results = [];
    for (const testCase of cases) {
      for (const shot of shots) {
        const result = await page.evaluate(async ({ testCase, shot }) => {
          const scene = window.pegFanGame.scene.scenes[0];
          scene.showStageEditor();
          scene.editorState.mode = 'manual';
          scene.editorState.manualTool = 'curve';
          scene.editorState.curveMode = testCase.shape;
          scene.editorState.curvePart = testCase.part;
          scene.editorState.curveSegments = 32;
          scene.editorState.curveThickness = testCase.part === 'rail' ? 13 : 18;
          scene.editorState.type = 'blue';
          scene.editorState.gridSnap = true;
          scene.editorState.manualObjects = [];
          scene.editorState.selectedManualIndices = [];
          scene.editorState.selectedManualIndex = -1;
          scene.createManualCurve(testCase.start, testCase.end);
          const level = scene.buildManualLevel();
          level.editorTest = true;
          level.balls = 99;
          level.bucketSpeed = 0;
          level.targetCount = 0;
          level.pegs = [];
          level.bumpers = [];
          level.timedBlocks = [];
          level.spinners = [];
          level.bricks = level.bricks.map((brick) => ({ ...brick, type: 'blue' }));

          scene.startLevel(1, level);
          scene.qaCurveCollisions = 0;
          scene.hitPeg = (ball) => {
            scene.qaCurveCollisions += 1;
            if (ball.body) scene.setBodyVelocity(ball, ball.body.velocity.x * 1.005, ball.body.velocity.y * 1.005);
          };
          scene.hitRail = (ball) => {
            scene.qaCurveCollisions += 1;
            if (ball.body) scene.setBodyVelocity(ball, ball.body.velocity.x * 1.005, ball.body.velocity.y * 1.005);
          };
          scene.hitBumper = () => {
            scene.qaCurveCollisions += 1;
          };
          scene.spawnBall(shot.x, shot.y, shot.vx, shot.vy);

          const samples = [];
          const startedAt = performance.now();
          let lastSpeed = null;
          let maxSpeed = 0;
          let maxDeltaSpeed = 0;
          let minX = Infinity;
          let maxX = -Infinity;
          let minY = Infinity;
          let maxY = -Infinity;
          let nanFrame = false;
          let activeFrames = 0;
          let lowSpeedFrames = 0;

          while (performance.now() - startedAt < 5200) {
            await new Promise((resolve) => requestAnimationFrame(resolve));
            const ball = scene.balls?.getChildren().find((item) => item?.active && item.body);
            if (!ball) break;
            activeFrames += 1;
            const vx = ball.body.velocity.x;
            const vy = ball.body.velocity.y;
            const speed = Math.hypot(vx, vy);
            if (![ball.x, ball.y, vx, vy, speed].every(Number.isFinite)) nanFrame = true;
            maxSpeed = Math.max(maxSpeed, speed);
            if (lastSpeed !== null) maxDeltaSpeed = Math.max(maxDeltaSpeed, Math.abs(speed - lastSpeed));
            lastSpeed = speed;
            if (speed < 0.22) lowSpeedFrames += 1;
            minX = Math.min(minX, ball.x);
            maxX = Math.max(maxX, ball.x);
            minY = Math.min(minY, ball.y);
            maxY = Math.max(maxY, ball.y);
            if (samples.length < 180) samples.push({ t: Math.round(performance.now() - startedAt), x: Math.round(ball.x), y: Math.round(ball.y), speed: Number(speed.toFixed(3)) });
          }

          const travelX = Number.isFinite(minX) ? maxX - minX : 0;
          const travelY = Number.isFinite(minY) ? maxY - minY : 0;
          const failures = [];
          if (nanFrame) failures.push('NAN_STATE');
          if (activeFrames < 20) failures.push('NO_SIMULATION');
          if (maxSpeed > 42) failures.push(`SPEED_SPIKE_${maxSpeed.toFixed(1)}`);
          if (maxDeltaSpeed > 18) failures.push(`DELTA_SPIKE_${maxDeltaSpeed.toFixed(1)}`);
          if (scene.qaCurveCollisions > 95) failures.push(`COLLISION_STORM_${scene.qaCurveCollisions}`);
          if (lowSpeedFrames > 75 && scene.qaCurveCollisions > 8) failures.push('STICKY_CONTACT');
          if (activeFrames > 180 && travelX < 18 && travelY < 18) failures.push('POSITION_TRAP');

          return {
            case: `${testCase.shape}-${testCase.part}`,
            shot: shot.label,
            objects: level.bricks.length + level.rails.length,
            collisions: scene.qaCurveCollisions,
            activeFrames,
            maxSpeed: Number(maxSpeed.toFixed(3)),
            maxDeltaSpeed: Number(maxDeltaSpeed.toFixed(3)),
            travelX: Number(travelX.toFixed(1)),
            travelY: Number(travelY.toFixed(1)),
            failures,
            samples,
          };
        }, { testCase, shot });
        results.push(result);
        const status = result.failures.length ? 'FAIL' : 'ok';
        console.log(`${status} ${result.case} ${result.shot} collisions=${result.collisions} maxSpeed=${result.maxSpeed}`);
      }
    }

    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
    const summary = summarize(results, pageErrors);
    await writeFile(REPORT_PATH, `${JSON.stringify({ summary, results }, null, 2)}\n`);
    console.log(`Curve QA report: ${REPORT_PATH}`);
    console.log(`Curve QA screenshot: ${SCREENSHOT_PATH}`);
    if (!summary.ok) {
      console.error(`Curve QA failed: ${summary.failed} case(s), ${pageErrors.length} page error(s)`);
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
