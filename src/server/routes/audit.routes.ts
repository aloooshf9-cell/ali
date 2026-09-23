import { Router, Response } from 'express';
import { dbStorage } from '../db/storage';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { PermissionKey } from '../../types/permissions';

export const auditRouter = Router();

auditRouter.get('/', requireAuth, requirePermission(PermissionKey.AUDIT_LOGS_VIEW), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const user = req.user!;
    const {
      search,
      dateFrom,
      dateTo,
      userFilter,
      actionFilter,
      entityFilter,
      companyId,
      limit = '100',
      offset = '0',
    } = req.query;

    const scopedCompanyId = !user.isSuperAdmin
      ? user.primaryCompanyId || user.assignedCompanies?.[0]?.id
      : (companyId as string | undefined);

    const result = dbStorage.queryAuditLogs({
      search: search as string,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      userFilter: userFilter as string,
      actionFilter: actionFilter as string,
      entityFilter: entityFilter as string,
      companyId: scopedCompanyId,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch audit logs' });
  }
});
