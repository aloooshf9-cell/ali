import { Router, Response } from 'express';
import { dbStorage } from '../db/storage';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { PermissionKey } from '../../types/permissions';

export const roleRouter = Router();

roleRouter.use(requireAuth);

roleRouter.get('/', (_req: AuthenticatedRequest, res: Response): void => {
  res.json({ roles: dbStorage.getAllRoles() });
});

roleRouter.get('/permissions', (_req: AuthenticatedRequest, res: Response): void => {
  res.json({ permissions: dbStorage.getAllPermissions() });
});

roleRouter.get('/:roleId/permissions', (req: AuthenticatedRequest, res: Response): void => {
  const permissions = dbStorage.getRolePermissions(req.params.roleId);
  res.json({ roleId: req.params.roleId, permissions });
});

roleRouter.put(
  '/:roleId/permissions',
  requirePermission(PermissionKey.PERMISSIONS_MANAGE),
  (req: AuthenticatedRequest, res: Response): void => {
    try {
      const { permissions } = req.body;
      if (!Array.isArray(permissions)) {
        res.status(400).json({ error: 'Permissions must be provided as an array of permission keys' });
        return;
      }
      const result = dbStorage.updateRolePermissions(req.params.roleId, permissions, req.user!);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update role permissions' });
    }
  }
);

roleRouter.post(
  '/permissions',
  requirePermission(PermissionKey.PERMISSIONS_MANAGE),
  (req: AuthenticatedRequest, res: Response): void => {
    try {
      const { key, module, nameEn, nameAr, descriptionEn, descriptionAr } = req.body;
      if (!key || !nameAr || !nameEn) {
        res.status(400).json({ error: 'Permission key and names (Arabic & English) are required' });
        return;
      }
      const validModules = ['companies', 'tasks', 'reports', 'users', 'system'];
      const targetModule = validModules.includes(module) ? module : 'system';
      const newPerm = dbStorage.createCustomPermission(
        {
          key,
          module: targetModule,
          nameEn,
          nameAr,
          descriptionEn: descriptionEn || nameEn,
          descriptionAr: descriptionAr || nameAr,
        },
        req.user!,
        req.ip
      );
      res.status(201).json({
        success: true,
        message: 'Permission created successfully',
        permission: newPerm,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create permission' });
    }
  }
);

roleRouter.delete(
  '/permissions/:key',
  requirePermission(PermissionKey.PERMISSIONS_MANAGE),
  (req: AuthenticatedRequest, res: Response): void => {
    try {
      const key = req.params.key;
      const success = dbStorage.deleteCustomPermission(key, req.user!, req.ip);
      if (!success) {
        res.status(404).json({ error: 'Permission not found' });
        return;
      }
      res.json({ success: true, message: 'Permission removed successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete permission' });
    }
  }
);
