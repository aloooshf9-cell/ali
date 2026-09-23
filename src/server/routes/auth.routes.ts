import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { dbStorage } from '../db/storage';
import { requireAuth, AuthenticatedRequest, generateAuthToken } from '../middleware/auth';
import { bruteForceService } from '../middleware/rateLimit';

export const authRouter = Router();

authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawIdentifier = req.body.email || req.body.username;
    if (!rawIdentifier) {
      res.status(400).json({ error: 'Email or username is required' });
      return;
    }
    const password = req.body.password;
    const normalizedEmail = rawIdentifier.toLowerCase().trim();

    const lockoutStatus = bruteForceService.isLockedOut(normalizedEmail);
    if (lockoutStatus.locked) {
      dbStorage.logAudit({
        userId: null,
        userEmail: normalizedEmail,
        action: 'AUTH_LOCKOUT_BLOCKED',
        resource: 'AUTH',
        details: { remainingSeconds: lockoutStatus.remainingSeconds, attempts: lockoutStatus.attempts },
        status: 'FAILURE',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      const remainingSecs = lockoutStatus.remainingSeconds || 0;
      res.status(429).json({
        error: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${Math.ceil(remainingSecs / 60)} minute(s).`,
        remainingSeconds: remainingSecs,
        locked: true,
      });
      return;
    }

    const user = dbStorage.findUserByEmail(normalizedEmail);
    if (!user) {
      const attempt = bruteForceService.recordFailedAttempt(normalizedEmail);
      dbStorage.logAudit({
        userId: null,
        userEmail: normalizedEmail,
        action: 'AUTH_LOGIN_FAILED',
        resource: 'AUTH',
        details: { reason: 'User not found', attempts: attempt.attempts, remainingAttempts: attempt.remainingAttempts },
        status: 'FAILURE',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.status(401).json({
        error: 'Invalid credentials provided.',
        remainingAttempts: attempt.remainingAttempts,
      });
      return;
    }

    if (!user.isActive || user.isArchived) {
      dbStorage.logAudit({
        userId: user.id,
        userEmail: user.email,
        action: 'AUTH_LOGIN_BLOCKED_INACTIVE',
        resource: 'AUTH',
        resourceId: user.id,
        details: { isActive: user.isActive, isArchived: !!user.isArchived },
        status: 'FAILURE',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.status(403).json({
        error: 'This account has been deactivated or archived. Contact your system administrator.',
      });
      return;
    }

    if (password && user.passwordHash) {
      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) {
        const attempt = bruteForceService.recordFailedAttempt(normalizedEmail);
        if (attempt.locked) {
          dbStorage.logAudit({
            userId: user.id,
            userEmail: user.email,
            action: 'AUTH_LOCKOUT_TRIGGERED',
            resource: 'AUTH',
            details: { attempts: attempt.attempts, lockoutDurationSeconds: attempt.remainingSeconds },
            status: 'WARNING',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          });
          const remainingSecs = attempt.remainingSeconds || 0;
          res.status(429).json({
            error: `Maximum failed login attempts exceeded (5/5). Account locked for ${Math.ceil(remainingSecs / 60)} minutes.`,
            remainingSeconds: remainingSecs,
            locked: true,
          });
          return;
        }
        dbStorage.logAudit({
          userId: user.id,
          userEmail: user.email,
          action: 'AUTH_LOGIN_FAILED',
          resource: 'AUTH',
          details: { reason: 'Password mismatch', attempts: attempt.attempts, remainingAttempts: attempt.remainingAttempts },
          status: 'FAILURE',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });
        res.status(401).json({
          error: `Invalid credentials. ${attempt.remainingAttempts} attempt(s) remaining before temporary lockout.`,
          remainingAttempts: attempt.remainingAttempts,
        });
        return;
      }
    } else if (!password) {
      res.status(400).json({ error: 'Password is required' });
      return;
    }

    bruteForceService.reset(normalizedEmail);
    dbStorage.updateLastLogin(user.id);
    const authUser = dbStorage.buildAuthUser(user);
    const token = generateAuthToken(authUser, '24h');

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    dbStorage.logAudit({
      userId: user.id,
      userEmail: user.email,
      userName: user.fullName,
      action: 'LOGIN',
      entity: 'AUTH',
      entityId: user.id,
      oldValue: null,
      newValue: user.email,
      details: {
        isSuperAdmin: authUser.isSuperAdmin,
        roles: authUser.roles.map(r => r.slug),
        assignedCompaniesCount: authUser.assignedCompanies.length,
      },
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      token,
      user: authUser,
      message: 'Authenticated successfully',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error during authentication' });
  }
});

authRouter.post('/logout', (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user;
  res.clearCookie('auth_token', {
    httpOnly: true,
    sameSite: 'lax',
  });

  if (user) {
    dbStorage.logAudit({
      userId: user.id,
      userEmail: user.email,
      userName: user.fullName,
      action: 'LOGOUT',
      entity: 'AUTH',
      entityId: user.id,
      oldValue: user.email,
      newValue: null,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  res.json({ success: true, message: 'Logged out successfully' });
});

authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  res.json({
    user: req.user,
  });
});

authRouter.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email address is required' });
      return;
    }
    const normalizedEmail = email.toLowerCase().trim();
    const user = dbStorage.findUserByEmail(normalizedEmail);

    if (!user) {
      // Do not reveal whether the account exists
      res.json({
        success: true,
        message: 'If an account matches this email, password reset instructions have been generated.',
      });
      return;
    }

    const resetToken = `rst-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    dbStorage.logAudit({
      userId: user.id,
      userEmail: user.email,
      action: 'AUTH_PASSWORD_RESET_REQUESTED',
      resource: 'AUTH',
      resourceId: user.id,
      details: { tokenPrefix: resetToken.substring(0, 8) },
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Password reset link generated.',
      resetToken, // NOTE: returned directly for demo/sandbox purposes only. In production this must be emailed, never returned in the API response.
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to process password reset' });
  }
});

authRouter.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, newPassword, resetToken } = req.body;
    if (!email || !newPassword || !resetToken) {
      res.status(400).json({ error: 'Email, new password, and reset token are required' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long' });
      return;
    }
    const normalizedEmail = email.toLowerCase().trim();
    const user = dbStorage.findUserByEmail(normalizedEmail);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const actorUser = dbStorage.buildAuthUser(user);
    dbStorage.resetUserPassword(user.id, newPassword, actorUser);
    bruteForceService.reset(normalizedEmail);

    res.json({
      success: true,
      message: 'Password has been securely reset. You may now log in with your new credentials.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to reset password' });
  }
});

authRouter.get('/security-status', (_req: Request, res: Response): void => {
  res.json({
    bruteForce: bruteForceService.getStats(),
    sessionPolicy: {
      cookieHttpOnly: true,
      cookieSameSite: 'lax',
      tokenValidity: '24 hours',
      maxFailedAttempts: 5,
      lockoutDurationMinutes: 15,
      passwordHashing: 'Bcrypt (10 salt rounds)',
    },
  });
});
