import fs from 'fs';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');

try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
} catch {
  // Ignore log directory creation errors (e.g. read-only filesystem)
}

function appendToFile(fileName: string, message: string): void {
  try {
    const filePath = path.join(logsDir, fileName);
    const line = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(filePath, line, 'utf8');
  } catch {
    // Ignore file write errors
  }
}

export const logger = {
  info: (msg: string, meta?: unknown): void => {
    const formatted = meta ? `${msg} ${JSON.stringify(meta)}` : msg;
    console.log(`[INFO] ${formatted}`);
    appendToFile('app.log', `[INFO] ${formatted}`);
  },
  warn: (msg: string, meta?: unknown): void => {
    const formatted = meta ? `${msg} ${JSON.stringify(meta)}` : msg;
    console.warn(`[WARN] ${formatted}`);
    appendToFile('app.log', `[WARN] ${formatted}`);
  },
  error: (msg: string, err?: unknown): void => {
    const errDetails = err instanceof Error ? `${err.message}\n${err.stack}` : err ? JSON.stringify(err) : '';
    const formatted = `${msg} ${errDetails}`.trim();
    console.error(`[ERROR] ${formatted}`);
    appendToFile('app.log', `[ERROR] ${formatted}`);
    appendToFile('error.log', `[ERROR] ${formatted}`);
  },
};
