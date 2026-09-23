import { Response, NextFunction } from 'express';
import { dbStorage } from '../db/storage';
import { AuthenticatedRequest } from './auth';
import { PermissionKey } from '../../types/permissions';

export function requirePermission(requiredPerm: PermissionKey) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.isSuperAdmin) {
      next();
      return;
    }

    if (req.user.permissions && req.user.permissions.includes(requiredPerm)) {
      next();
      return;
    }

    dbStorage.logAudit({
      userId: req.user.id,
      companyId: req.user.primaryCompanyId || null,
      action: 'security.permission_denied',
      resource: 'system_security',
      resourceId: requiredPerm,
      status: 'FAILURE',
      ipAddress: req.ip || '127.0.0.1',
      details: {
        attemptedPermission: requiredPerm,
        userEmail: req.user.email,
        path: req.originalUrl,
      },
    } as any);

    res.status(403).json({
      error: `Access Denied: You do not have permission '${requiredPerm}' to perform this action.`,
    });
  };
}
