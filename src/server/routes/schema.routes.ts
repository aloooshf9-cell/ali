import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

export const schemaRouter = Router();

schemaRouter.get('/', requireAuth, (_req: AuthenticatedRequest, res: Response): void => {
  try {
    const sqlPath = path.join(process.cwd(), 'src/server/db/schema.sql');
    const drizzlePath = path.join(process.cwd(), 'src/server/db/drizzle.schema.ts');
    const sqlSchema = fs.existsSync(sqlPath) ? fs.readFileSync(sqlPath, 'utf8') : '-- SQL Schema';
    const drizzleSchema = fs.existsSync(drizzlePath) ? fs.readFileSync(drizzlePath, 'utf8') : '// Drizzle Schema';

    const entities = [
      { name: 'companies', count: 18, description: 'Holdings and subsidiary companies' },
      { name: 'users', count: 12, description: 'System and operational users' },
      { name: 'roles', count: 3, description: 'Granular capability-based roles' },
      { name: 'permissions', count: 17, description: 'Individual system action gates' },
      { name: 'tasks', count: 50, description: 'Operational tasks and milestones' },
      { name: 'task_statuses', count: 5, description: 'Workflow stage progression states' },
      { name: 'task_priorities', count: 4, description: 'Priority levels' },
      { name: 'custom_fields', count: 8, description: 'Dynamic EAV metadata fields' },
      { name: 'audit_logs', count: 120, description: 'Immutable operational security trail' },
      { name: 'notifications', count: 25, description: 'Targeted user notifications' },
    ];

    res.json({
      totalEntities: 17,
      entities,
      sqlSchema,
      drizzleSchema,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to inspect schema' });
  }
});
