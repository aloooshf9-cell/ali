import { Router, Response } from 'express';
import { dbStorage } from '../db/storage';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { PermissionKey } from '../../types/permissions';

export const taskRouter = Router();

// GET all tasks (filtered by company, status, priority, assignee, etc.)
taskRouter.get('/', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const user = req.user!;
    const { companyId, status, priority, assigneeId, search } = req.query;

    const allowedCompanyIds = user.isSuperAdmin
      ? undefined
      : user.assignedCompanies?.map(c => c.id) || [];

    const tasks = dbStorage.getTasks({
      companyId: companyId as string,
      status: status as string,
      priority: priority as string,
      assigneeId: assigneeId as string,
      search: search as string,
      allowedCompanyIds,
    });

    res.json({ tasks, totalCount: tasks.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch tasks' });
  }
});

// GET task by ID
taskRouter.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const user = req.user!;
    const allowedCompanyIds = user.isSuperAdmin
      ? undefined
      : user.assignedCompanies?.map(c => c.id) || [];

    const task = dbStorage.getTaskById(req.params.id, allowedCompanyIds);
    if (!task) {
      res.status(404).json({ error: 'Task not found or access denied' });
      return;
    }
    res.json({ task });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch task' });
  }
});

// POST create task
taskRouter.post('/', requireAuth, requirePermission(PermissionKey.TASKS_CREATE), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const task = dbStorage.createTask(req.body, req.user!);
    res.status(201).json({ task });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create task' });
  }
});

// PUT / PATCH update task
const handleUpdateTask = (req: AuthenticatedRequest, res: Response): void => {
  try {
    const task = dbStorage.updateTask(req.params.id, req.body, req.user!);
    res.json({ task });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update task' });
  }
};
taskRouter.put('/:id', requireAuth, requirePermission(PermissionKey.TASKS_EDIT), handleUpdateTask);
taskRouter.patch('/:id', requireAuth, requirePermission(PermissionKey.TASKS_EDIT), handleUpdateTask);

// PATCH change status
taskRouter.patch('/:id/status', requireAuth, requirePermission(PermissionKey.TASKS_CHANGE_STATUS), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { status, reason, progress } = req.body;
    const task = dbStorage.changeTaskStatus(req.params.id, status, reason, req.user!, progress);
    res.json({ task });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to change task status' });
  }
});

// POST task note
taskRouter.post('/:id/notes', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { content, isInternalOnly = false } = req.body;
    const note = dbStorage.addTaskNote(req.params.id, content, isInternalOnly, req.user!);
    res.status(201).json({ note });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to add note' });
  }
});

// POST task attachment
taskRouter.post('/:id/attachments', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const attachment = dbStorage.addTaskAttachment(req.params.id, req.body, req.user!);
    res.status(201).json({ attachment });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to add attachment' });
  }
});

// GET task attachment download
taskRouter.get('/:id/attachments/:attachmentId/download', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const attachment = dbStorage.getTaskAttachment(req.params.id, req.params.attachmentId);
    if (!attachment) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }
    res.json({ success: true, attachment });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to download attachment' });
  }
});

// DELETE task attachment
taskRouter.delete('/:id/attachments/:attachmentId', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const success = dbStorage.deleteTaskAttachment(req.params.id, req.params.attachmentId, req.user!);
    res.json({ success, message: 'Attachment deleted successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete attachment' });
  }
});

// DELETE task
taskRouter.delete('/:id', requireAuth, requirePermission(PermissionKey.TASKS_DELETE), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const permanent = req.query.permanent === 'true';
    const success = dbStorage.deleteTask(req.params.id, permanent, req.user!);
    res.json({ success, message: permanent ? 'Task permanently deleted' : 'Task archived' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete task' });
  }
});
