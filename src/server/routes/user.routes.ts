import { Router, Response } from 'express';
import { dbStorage } from '../db/storage';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { PermissionKey } from '../../types/permissions';

export const userRouter = Router();

userRouter.get('/', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const user = req.user!;
    const canViewUsers =
      user.isSuperAdmin ||
      user.permissions?.includes(PermissionKey.USERS_VIEW) ||
      user.permissions?.includes(PermissionKey.REPORTS_VIEW) ||
      user.permissions?.includes(PermissionKey.TASKS_VIEW) ||
      user.permissions?.includes(PermissionKey.TASKS_ASSIGN) ||
      user.roles?.some(r => r.slug === 'admin' || r.slug === 'manager_owner');

    if (!canViewUsers) {
      res.status(403).json({
        error: `Access Denied: You do not have permission to view users.`,
      });
      return;
    }

    let allUsers = dbStorage.getAllUsers();

    if (!user.isSuperAdmin) {
      const allowedCompanyIds = new Set(user.assignedCompanies?.map(c => c.id) || []);
      allUsers = allUsers.filter(u => {
        // Super Admin must NEVER appear to non-super-admin users anywhere
        const roles = dbStorage.getUserRoles(u.id);
        const isSuperAdminUser = roles.some(r => r.slug === 'super_admin');
        if (isSuperAdminUser) return false;

        const uCompanies = dbStorage.getUserCompanies(u.id);
        return uCompanies.some(c => allowedCompanyIds.has(c.id));
      });
    }

    const formatted = allUsers.map(u => {
      const roles = dbStorage.getUserRoles(u.id);
      const companies = dbStorage.getUserCompanies(u.id);
      return {
        ...u,
        roles,
        assignedCompanies: companies,
      };
    });

    res.json({
      users: formatted,
      actorScope: user.isSuperAdmin ? 'global' : 'tenant',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to list users' });
  }
});

userRouter.post('/', requireAuth, requirePermission(PermissionKey.USERS_MANAGE), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { fullName, fullNameAr, email, phone, roleSlug, companyIds, password, isActive, allowedTabs } = req.body;
    const created = dbStorage.createUser(
      {
        fullName,
        fullNameAr,
        email,
        phone,
        roleSlug: roleSlug || 'manager_owner',
        companyIds: companyIds || [],
        password: password || 'Password@123',
        isActive: isActive !== false,
        allowedTabs,
      },
      req.user!
    );
    res.status(201).json({ user: created, message: 'User created successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create user' });
  }
});

userRouter.put('/:id', requireAuth, requirePermission(PermissionKey.USERS_MANAGE), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { fullName, fullNameAr, phone, roleSlug, companyIds, isActive, allowedTabs } = req.body;
    const updated = dbStorage.updateUser(
      req.params.id,
      { fullName, fullNameAr, phone, roleSlug, companyIds, isActive, allowedTabs },
      req.user!
    );
    res.json({ user: updated, message: 'User updated successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update user' });
  }
});

userRouter.patch('/:id/status', requireAuth, requirePermission(PermissionKey.USERS_MANAGE), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { isActive } = req.body;
    const updated = dbStorage.setUserStatus(req.params.id, isActive, req.user!);
    res.json({ user: updated, message: 'User status updated successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update user status' });
  }
});

userRouter.post('/:id/reset-password', requireAuth, requirePermission(PermissionKey.USERS_MANAGE), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { newPassword } = req.body;
    dbStorage.resetUserPassword(req.params.id, newPassword, req.user!);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to reset password' });
  }
});

userRouter.delete('/:id', requireAuth, requirePermission(PermissionKey.USERS_MANAGE), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const permanent = req.query.permanent === 'true';
    if (permanent) {
      const success = dbStorage.permanentlyDeleteUser(req.params.id, req.user!);
      res.json({ success, message: 'User permanently deleted successfully' });
    } else {
      const success = dbStorage.deleteUser(req.params.id, req.user!);
      res.json({ success, message: 'User archived successfully' });
    }
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete user' });
  }
});

userRouter.post('/:id/restore', requireAuth, requirePermission(PermissionKey.USERS_MANAGE), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const success = dbStorage.restoreUser(req.params.id, req.user!);
    res.json({ success, message: 'User restored successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to restore user' });
  }
});

userRouter.post('/:id/assign-company', requireAuth, requirePermission(PermissionKey.USERS_MANAGE), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { companyId, roleSlug } = req.body;
    const success = dbStorage.assignUserToCompany(req.params.id, companyId, roleSlug, req.user!);
    res.json({ success });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to assign company' });
  }
});
