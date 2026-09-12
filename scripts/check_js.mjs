import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = new URL('../web/js/', import.meta.url);
const files = (await readdir(root)).filter((name) => name.endsWith('.js')).sort();
for (const file of files) {
  execFileSync(process.execPath, ['--check', join(root.pathname, file)], { stdio: 'inherit' });
}
console.log(`JavaScript syntax OK: ${files.length} files`);
