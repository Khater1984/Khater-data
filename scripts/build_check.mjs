import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../web/', import.meta.url).pathname;
const required = ['index.html', 'funds.html', 'fund.html', 'categories.html', 'macro.html', 'map.html', 'why.html', 'config.js'];
for (const file of required) await access(join(root, file));
const html = await readFile(join(root, 'fund.html'), 'utf8');
for (const asset of ['js/fund-core.js', 'js/fund-performance.js', 'css/fund.css']) {
  if (!html.includes(asset)) throw new Error(`fund.html missing required asset reference: ${asset}`);
}
console.log('Static build contract OK');
