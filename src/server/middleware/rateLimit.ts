import { Request, Response, NextFunction } from 'express';

const apiWindowMs = 60 * 1000;
const apiMaxRequests = 300;
const ipStore = new Map<string, { count: number; resetAt: number }>();

export function apiRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  let entry = ipStore.get(ip);

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + apiWindowMs };
    ipStore.set(ip, entry);
    next();
    return;
  }

  entry.count++;
  if (entry.count > apiMaxRequests) {
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
    return;
  }
  next();
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

interface BruteForceRecord {
  attempts: number;
  lockoutUntil: number;
}

const bruteForceMap = new Map<string, BruteForceRecord>();

export const bruteForceService = {
  isLockedOut(email: string): { locked: boolean; remainingSeconds?: number; attempts: number } {
    const record = bruteForceMap.get(email);
    if (!record) return { locked: false, attempts: 0 };

    const now = Date.now();
    if (record.lockoutUntil > now) {
      const remainingSeconds = Math.ceil((record.lockoutUntil - now) / 1000);
      return { locked: true, remainingSeconds, attempts: record.attempts };
    }
    if (record.lockoutUntil !== 0 && record.lockoutUntil <= now) {
      bruteForceMap.delete(email);
      return { locked: false, attempts: 0 };
    }
    return { locked: false, attempts: record.attempts };
  },

  recordFailedAttempt(email: string): { attempts: number; locked: boolean; remainingAttempts: number; remainingSeconds: number } {
    const record = bruteForceMap.get(email) || { attempts: 0, lockoutUntil: 0 };
    record.attempts++;

    if (record.attempts >= MAX_FAILED_ATTEMPTS) {
      record.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      bruteForceMap.set(email, record);
      return {
        attempts: record.attempts,
        locked: true,
        remainingAttempts: 0,
        remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
      };
    }

    bruteForceMap.set(email, record);
    return {
      attempts: record.attempts,
      locked: false,
      remainingAttempts: MAX_FAILED_ATTEMPTS - record.attempts,
      remainingSeconds: 0,
    };
  },

  reset(email: string): void {
    bruteForceMap.delete(email);
  },

  getStats(): { lockedOutAccounts: number; trackedAccounts: number } {
    const now = Date.now();
    let lockedCount = 0;
    bruteForceMap.forEach(v => {
      if (v.lockoutUntil > now) lockedCount++;
    });
    return {
      lockedOutAccounts: lockedCount,
      trackedAccounts: bruteForceMap.size,
    };
  },
};
