import { Router, Response } from 'express';
import { dbStorage } from '../db/storage';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { PermissionKey } from '../../types/permissions';

export const companyRouter = Router();

companyRouter.get('/', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const user = req.user!;
    let companies = dbStorage.getAllCompanies();

    if (!user.isSuperAdmin) {
      const allowedIds = new Set(user.assignedCompanies?.map(c => c.id) || []);
      companies = companies.filter(c => allowedIds.has(c.id));
    }

    const withMetrics = companies.map(c => ({
      ...c,
      metrics: dbStorage.computeCompanyMetrics(c.id),
    }));

    res.json({
      companies: withMetrics,
      isGlobalScope: user.isSuperAdmin,
      totalCount: companies.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch companies' });
  }
});

companyRouter.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const company = dbStorage.getCompanyById(req.params.id);
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }
    res.json({ company });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch company' });
  }
});

companyRouter.post('/', requireAuth, requirePermission(PermissionKey.COMPANIES_CREATE), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const company = dbStorage.createCompany(req.body, req.user!);
    res.status(201).json({ company });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create company' });
  }
});

companyRouter.put('/:id', requireAuth, requirePermission(PermissionKey.COMPANIES_EDIT), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const company = dbStorage.updateCompany(req.params.id, req.body, req.user!);
    res.json({ company });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update company' });
  }
});

companyRouter.delete('/:id', requireAuth, requirePermission(PermissionKey.COMPANIES_DELETE), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const permanent = req.query.permanent === 'true';
    if (permanent) {
      const deleted = dbStorage.deleteCompany(req.params.id, req.user!);
      res.json({ success: deleted, message: 'Company permanently deleted' });
    } else {
      const archived = dbStorage.archiveCompany(req.params.id, req.user!);
      res.json({ success: true, message: 'Company archived successfully', company: archived });
    }
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete/archive company' });
  }
});

companyRouter.get('/:id/dashboard', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const companyId = req.params.id;
    const company = dbStorage.getCompanyById(companyId);
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }
    const metrics = dbStorage.computeCompanyMetrics(companyId);
    const recentTasks = dbStorage.getCompanyTasks(companyId).slice(0, 5);
    const reports = dbStorage.getCompanyReports(companyId);
    res.json({ company, metrics, recentTasks, reports });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load company dashboard' });
  }
});

companyRouter.get('/:id/tasks', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tasks = dbStorage.getCompanyTasks(req.params.id);
    res.json({ tasks });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch company tasks' });
  }
});

companyRouter.post('/:id/tasks', requireAuth, requirePermission(PermissionKey.TASKS_CREATE), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const task = dbStorage.createTask({ ...req.body, companyId: req.params.id }, req.user!);
    res.status(201).json({ task });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create company task' });
  }
});

companyRouter.put('/:id/tasks/:taskId', requireAuth, requirePermission(PermissionKey.TASKS_EDIT), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const task = dbStorage.updateTask(req.params.taskId, req.body, req.user!);
    res.json({ task });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update company task' });
  }
});

companyRouter.get('/:id/reports', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const reports = dbStorage.getCompanyReports(req.params.id);
    res.json({ reports });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load company reports' });
  }
});

companyRouter.get('/:id/files', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const files = dbStorage.getCompanyFiles(req.params.id);
    res.json({ files });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load company files' });
  }
});

companyRouter.post('/:id/files', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const file = dbStorage.addCompanyFile({ ...req.body, companyId: req.params.id }, req.user!);
    res.status(201).json({ file });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to upload company file' });
  }
});

companyRouter.delete('/:id/files/:fileId', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const success = dbStorage.deleteCompanyFile(req.params.id, req.params.fileId, req.user!);
    res.json({ success, message: 'File removed successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete company file' });
  }
});

companyRouter.get('/:id/activity', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const activity = dbStorage.getCompanyActivity(req.params.id, limit);
    res.json({ activity });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load company activity' });
  }
});
