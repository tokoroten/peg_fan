import fs from 'node:fs';
import path from 'node:path';

const bundlePath = process.argv[2];
if (!bundlePath) {
  console.error('Usage: npm run apply:stage-bundle -- path/to/peg-fan-production-stages.json');
  process.exit(1);
}

const root = process.cwd();
const resolvedBundle = path.resolve(root, bundlePath);
const bundle = JSON.parse(fs.readFileSync(resolvedBundle, 'utf8'));

if (bundle.format !== 'peg-fan-stage-bundle' || !bundle.files || typeof bundle.files !== 'object') {
  console.error('Invalid peg-fan-stage-bundle JSON.');
  process.exit(1);
}

let written = 0;
for (const [relativePath, level] of Object.entries(bundle.files)) {
  if (!/^public\/assets\/stages\/stage-\d{3}\.json$/.test(relativePath)) {
    console.error(`Refusing unexpected path in bundle: ${relativePath}`);
    process.exit(1);
  }
  const outputPath = path.resolve(root, relativePath);
  if (!outputPath.startsWith(path.resolve(root, 'public', 'assets', 'stages'))) {
    console.error(`Refusing path outside stage directory: ${relativePath}`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(level, null, 2)}\n`);
  written += 1;
}

console.log(`Applied ${written} stage files from ${path.relative(root, resolvedBundle)}.`);
