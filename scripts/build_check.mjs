import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../web/', import.meta.url).pathname;
const required = ['index.html', 'funds.html', 'fund.html', 'macro.html', 'wealth.html', 'categories.html', 'map.html', 'why.html', 'config.js'];
for (const file of required) await access(join(root, file));

const retired = ['heatmap.html'];
for (const file of retired) {
  try {
    await access(join(root, file));
    throw new Error(`retired surface still on disk: ${file}`);
  } catch (err) {
    if (err && err.message && err.message.includes('retired surface')) throw err;
  }
}

const html = await readFile(join(root, 'fund.html'), 'utf8');
const requiredFundAssets = [
  'js/fund-core.js',
  'js/fund-performance.js',
  'js/fund-risk.js',
  'js/fund-benchmark.js',
  'js/fund-smartscore.js',
  'js/fund-evidence.js',
  'js/fund-profile.js',
  'js/fund-tabs.js',
  'css/fund-detail.css',
];

for (const asset of requiredFundAssets) {
  if (!html.includes(asset)) {
    throw new Error(`fund.html missing required asset reference: ${asset}`);
  }
}

const cssEntry = await readFile(join(root, 'css', 'fund-detail.css'), 'utf8');
const requiredOwnership = [
  '--fd-line:',
  '--fd-radius-card:',
  '--fd-card-gradient:',
  '.metric,',
  '.card {',
];
for (const token of requiredOwnership) {
  if (!cssEntry.includes(token)) {
    throw new Error(`fund-detail.css missing ownership contract token: ${token}`);
  }
}
if (cssEntry.includes("@import") && cssEntry.includes('fund.css')) {
  throw new Error('fund-detail.css must not @import split fund modules; ownership is inlined');
}

const retiredModules = ['fund.css', 'fund-chart.css', 'fund-price.css', 'fund-profile.css'];
for (const name of retiredModules) {
  try {
    await access(join(root, 'css', name));
    throw new Error(`retired Fund Detail stylesheet still on disk: css/${name}`);
  } catch (err) {
    if (err && err.message && err.message.includes('retired Fund Detail')) throw err;
  }
}

const jsRoot = join(root, 'js');
const tabs = [
  ['performance', 'fund-performance.js'],
  ['risk', 'fund-risk.js'],
  ['benchmark', 'fund-benchmark.js'],
  ['smartscore', 'fund-smartscore.js'],
  ['evidence', 'fund-evidence.js'],
  ['profile', 'fund-profile.js'],
];

for (const [name, file] of tabs) {
  const source = await readFile(join(jsRoot, file), 'utf8');
  if (!source.includes(`FUND_TABS.${name}`)) {
    throw new Error(`${file} missing FUND_TABS.${name} contract`);
  }
}

console.log('Static build contract OK');
