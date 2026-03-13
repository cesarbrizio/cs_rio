import { spawn } from 'node:child_process';
import { config as loadDotenv } from 'dotenv';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(workspaceRoot, '..', '..');
const rootEnvPath = path.join(repoRoot, '.env');

loadDotenv({
  override: false,
  path: rootEnvPath,
});

const expoCliPath = require.resolve('expo/bin/cli', {
  paths: [workspaceRoot],
});

const child = spawn(process.execPath, [expoCliPath, ...process.argv.slice(2)], {
  cwd: workspaceRoot,
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
