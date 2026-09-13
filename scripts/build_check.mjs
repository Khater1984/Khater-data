import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../web/', import.meta.url).pathname;
const required = ['index.html', 'funds.html', 'fund.html', 'categories.html', 'macro.html', 'map.html', 'why.html', 'config.js'];
for (const file of required) await access(join(root, file));

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
  'css/fund.css',
  'css/fund-chart.css',
  'css/fund-profile.css',
  'css/fund-price.css',
];

for (const asset of requiredFundAssets) {
  if (!html.includes(asset)) {
    throw new Error(`fund.html missing required asset reference: ${asset}`);
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

const fundCore = await readFile(join(jsRoot, 'fund-core.js'), 'utf8');
if (!fundCore.includes('fund-price.css')) {
  throw new Error('fund-core.js missing canonical fund-price.css dependency');
}

console.log('Static build contract OK');
