import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { dbStorage } from '../db/storage';
import { AuthUser } from '../../types/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'enterprise_system_secret_key_2026_super_secure';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: AuthUser, expiresIn: string = '7d'): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
    },
    JWT_SECRET,
    { expiresIn } as jwt.SignOptions
  );
}

// Alias kept for compatibility with route modules that import it under this name
export const generateAuthToken = generateToken;

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && (req.cookies.auth_token || req.cookies.token)) {
      token = req.cookies.auth_token || req.cookies.token;
    } else if (req.headers['x-auth-token'] && typeof req.headers['x-auth-token'] === 'string') {
      token = req.headers['x-auth-token'] as string;
    }

    if (!token) {
      res.status(401).json({ error: 'Authentication required. No token provided.' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const user = dbStorage.findUserById(decoded.id);

    if (!user || !user.isActive || user.isArchived) {
      res.status(401).json({ error: 'User account is invalid, deactivated, or deleted.' });
      return;
    }

    req.user = dbStorage.buildAuthUser(user);
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}
