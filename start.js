import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, 'dist');
const serverPath = path.join(distDir, 'server.cjs');

// Auto-compile if not already compiled
if (!fs.existsSync(serverPath)) {
  console.log('[System] Compiled files missing. Executing build...');
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
  } catch (err) {
    console.error('[System] Build failed before startup:', err);
    process.exit(1);
  }
}

const targetPort = process.env.PORT || '2026';
console.log(`[System] Starting enterprise server on Port ${targetPort}...`);

const child = spawn('node', [serverPath], {
  stdio: 'inherit',
  shell: false,
  windowsHide: true,
  env: { ...process.env, PORT: targetPort }
});

child.on('error', (err) => {
  console.error('[System] Server startup error:', err);
});

child.on('exit', (code, signal) => {
  console.log(`[System] Server process exited with code ${code} and signal ${signal}`);
});

