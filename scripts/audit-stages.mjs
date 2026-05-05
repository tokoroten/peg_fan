import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const stageDir = path.join(root, 'public', 'assets', 'stages');
const files = Array.from({ length: 100 }, (_, index) => `stage-${String(index + 1).padStart(3, '0')}.json`);

function audit(level) {
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
  if (!level.concept) flags.push('NO_CONCEPT');
  return { level: level.level, concept: level.concept ?? 'custom', objects, targetCount, balls: level.balls, flags };
}

if (!fs.existsSync(stageDir)) {
  console.error(`Missing stage directory: ${stageDir}`);
  process.exit(1);
}

const audits = files.map((file, index) => {
  const fullPath = path.join(stageDir, file);
  if (!fs.existsSync(fullPath)) return { level: index + 1, concept: 'missing', objects: 0, targetCount: 0, balls: 0, flags: ['MISSING_FILE'] };
  return audit(JSON.parse(fs.readFileSync(fullPath, 'utf8')));
});

const flagged = audits.filter((item) => item.flags.length);
const avgObjects = audits.reduce((sum, item) => sum + item.objects, 0) / audits.length;
const avgTargets = audits.reduce((sum, item) => sum + item.targetCount, 0) / audits.length;

console.log(`Stage audit: ${audits.length} stages, avg objects ${avgObjects.toFixed(1)}, avg orange ${avgTargets.toFixed(1)}, flagged ${flagged.length}`);
for (const item of flagged.slice(0, 40)) {
  console.log(`L${String(item.level).padStart(3, '0')} ${item.concept} obj=${item.objects} orange=${item.targetCount} balls=${item.balls} flags=${item.flags.join(',')}`);
}

if (flagged.some((item) => item.flags.includes('MISSING_FILE') || item.flags.includes('NO_ORANGE'))) {
  process.exit(1);
}
