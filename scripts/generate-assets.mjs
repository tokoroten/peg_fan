import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const rewardsDir = path.join(root, 'public', 'assets', 'rewards');
const audioDir = path.join(root, 'public', 'assets', 'audio');
fs.mkdirSync(rewardsDir, { recursive: true });
fs.mkdirSync(audioDir, { recursive: true });

const palettes = [
  ['#172033', '#ffcf5a', '#ff6f91', '#f4bf9d'],
  ['#162b35', '#44d7b6', '#3068d9', '#e7b58f'],
  ['#2d244b', '#f472b6', '#7c3aed', '#f0c1a1'],
  ['#243447', '#93c5fd', '#f97316', '#e8b08d'],
  ['#182438', '#facc15', '#14b8a6', '#eab99a'],
  ['#221d2f', '#fb7185', '#22d3ee', '#efc2a4'],
  ['#10231f', '#84cc16', '#06b6d4', '#e7b18e'],
  ['#271b26', '#f59e0b', '#ec4899', '#f1c3a5'],
];

function rewardSvg(index) {
  const p = palettes[index % palettes.length];
  const name = `Reward ${String(index + 1).padStart(3, '0')}`;
  const phase = index * 17;
  const hair = ['#312032', '#193647', '#46213d', '#1d2532', '#4b2a24', '#22223b'][index % 6];
  const accentY = 180 + (index % 7) * 18;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1300">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${p[0]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient>
    <linearGradient id="costume" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${p[1]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient>
    <filter id="soft"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-opacity=".35"/></filter>
  </defs>
  <rect width="900" height="1300" fill="url(#bg)"/>
  <circle cx="${150 + (phase % 550)}" cy="${accentY}" r="${80 + (index % 5) * 16}" fill="#fff" opacity=".08"/>
  <circle cx="${720 - (phase % 430)}" cy="${260 + (index % 9) * 28}" r="${44 + (index % 6) * 12}" fill="${p[1]}" opacity=".16"/>
  <path d="M82 1120 C220 1010 676 1018 818 1120 L818 1300 L82 1300 Z" fill="#050914" opacity=".22"/>
  <g filter="url(#soft)">
    <path d="M194 1074C270 835 329 701 451 701s196 145 263 373c-137 86-390 87-520 0z" fill="url(#costume)"/>
    <circle cx="451" cy="431" r="188" fill="${p[3]}"/>
    <path d="M252 438c-10-169 90-285 221-285 133 0 223 94 225 258-78-62-146-96-236-105-74-7-150 30-210 132z" fill="${hair}"/>
    <circle cx="374" cy="419" r="18" fill="#202431"/><circle cx="535" cy="419" r="18" fill="#202431"/>
    <path d="M318 521c48 55 180 60 251 1" fill="none" stroke="#8b3d51" stroke-width="18" stroke-linecap="round"/>
    <path d="M154 975c134 92 453 106 594 4" fill="none" stroke="#fff" stroke-width="16" opacity=".45"/>
  </g>
  <text x="60" y="1206" fill="#fff" font-family="Verdana" font-size="52" font-weight="700">${name}</text>
  <text x="64" y="1262" fill="${p[1]}" font-family="Verdana" font-size="26" font-weight="700">PEG FAN CLEAR ART</text>
</svg>`;
}

for (let i = 0; i < 100; i += 1) {
  fs.writeFileSync(path.join(rewardsDir, `reward-${String(i + 1).padStart(3, '0')}.svg`), rewardSvg(i));
}

function writeWav(file, duration, synth) {
  const sampleRate = 44100;
  const samples = Math.floor(sampleRate * duration);
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate;
    const value = Math.max(-1, Math.min(1, synth(t, i / samples)));
    data.writeInt16LE(Math.round(value * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(audioDir, file), Buffer.concat([header, data]));
}

const env = (p, a = 16) => Math.sin(Math.PI * p) ** 0.6 * (1 - p) ** (1 / a);
const tone = (freq, t) => Math.sin(Math.PI * 2 * freq * t);
writeWav('launch.wav', 0.16, (t, p) => (tone(180 + p * 720, t) + tone(92, t) * 0.25) * env(p, 9) * 0.55);
writeWav('peg.wav', 0.14, (t, p) => (tone(820 + p * 260, t) + tone(1240, t) * 0.35) * env(p, 11) * 0.45);
writeWav('orange.wav', 0.22, (t, p) => (tone(520 + p * 680, t) + tone(1040 + p * 900, t) * 0.45) * env(p, 18) * 0.55);
writeWav('green.wav', 0.28, (t, p) => (tone(392, t) + tone(784 + p * 320, t) + tone(1176, t) * 0.25) * env(p, 16) * 0.45);
writeWav('bumper.wav', 0.18, (t, p) => (tone(260 + p * 1200, t) + tone(1560, t) * 0.28) * env(p, 10) * 0.5);
writeWav('catch.wav', 0.36, (t, p) => (tone(440, t) + tone(660, t) + tone(990, t)) * env(p, 22) * 0.35);
writeWav('combo.wav', 0.32, (t, p) => {
  const sweep = 720 + p * 1600;
  const bell = 1046.5 + Math.sin(p * Math.PI) * 880;
  return (tone(sweep, t) * 0.58 + tone(bell, t) * 0.34 + tone(2093, t) * 0.16) * env(p, 24) * 0.46;
});
writeWav('clear.wav', 0.9, (t, p) => {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  const n = notes[Math.min(3, Math.floor(p * 4))];
  return (tone(n, t) + tone(n * 2, t) * 0.25) * env(p, 30) * 0.45;
});
writeWav('fail.wav', 0.55, (t, p) => (tone(220 - p * 80, t) + tone(110 - p * 30, t) * 0.4) * env(p, 12) * 0.45);
writeWav('reward.wav', 0.8, (t, p) => (tone(659 + p * 520, t) + tone(988 + p * 780, t) * 0.35) * env(p, 28) * 0.42);

console.log('Generated reward SVGs and WAV sound effects.');
