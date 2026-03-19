import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(currentDir, '..');
const sourceDir = resolve(packageRoot, 'src/data/assets');
const destinationDir = resolve(packageRoot, 'dist/data/assets');

if (existsSync(sourceDir)) {
  mkdirSync(destinationDir, { recursive: true });
  cpSync(sourceDir, destinationDir, { force: true, recursive: true });
}
