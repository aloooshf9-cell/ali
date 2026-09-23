import { Router, Response } from 'express';
import { dbStorage } from '../db/storage';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

export const dashboardRouter = Router();

dashboardRouter.get('/metrics', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const user = req.user!;
    const companyFilter = req.query.companyFilter as string;
    const data = dbStorage.getDashboardMetrics(user, companyFilter);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch dashboard metrics' });
  }
});

dashboardRouter.get('/config', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const config = dbStorage.getDashboardConfig(req.user!.id);
    res.json({ config });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch dashboard config' });
  }
});

dashboardRouter.get('/configs', requireAuth, (_req: AuthenticatedRequest, res: Response): void => {
  try {
    const configs = dbStorage.getAllDashboardConfigs();
    const users = dbStorage.getAllUsers();
    res.json({ configs, users });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch all dashboard configs' });
  }
});

dashboardRouter.put('/config/:userId', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const targetUserId = req.params.userId;
    const config = dbStorage.saveDashboardConfig({ ...req.body, userId: targetUserId }, req.user!);
    res.json({ config, message: 'Dashboard layout saved successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to save dashboard config' });
  }
});

dashboardRouter.post('/config/reset/:userId', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const targetUserId = req.params.userId;
    const config = dbStorage.getDashboardConfig(targetUserId);
    res.json({ config, message: 'Dashboard configuration reset' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to reset dashboard config' });
  }
});
