import { Router, Response } from 'express';
import { dbStorage } from '../db/storage';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

export const notificationRouter = Router();

notificationRouter.get('/', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const user = req.user!;
    const { unreadOnly, type, limit = '50' } = req.query;
    const { notifications, unreadCount } = dbStorage.getNotifications(
      user.id,
      user.isSuperAdmin,
      {
        unreadOnly: unreadOnly === 'true',
        type: type as string,
        limit: parseInt(limit as string, 10),
      }
    );
    res.json({ notifications, unreadCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch notifications' });
  }
});

notificationRouter.get('/unread-count', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const user = req.user!;
    const unreadCount = dbStorage.getUnreadNotificationsCount(user.id, user.isSuperAdmin);
    res.json({ unreadCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get unread count' });
  }
});

notificationRouter.patch('/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const user = req.user!;
    const { isRead = true } = req.body;
    const success = dbStorage.markNotificationAsRead(req.params.id, user.id, user.isSuperAdmin, isRead);
    res.json({ success, id: req.params.id, isRead });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to mark notification' });
  }
});

notificationRouter.post('/read-all', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const user = req.user!;
    const markedReadCount = dbStorage.markAllNotificationsAsRead(user.id, user.isSuperAdmin);
    res.json({ success: true, markedReadCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to mark all as read' });
  }
});

notificationRouter.delete('/:id', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const user = req.user!;
    const success = dbStorage.deleteNotification(req.params.id, user.id, user.isSuperAdmin);
    res.json({ success, message: 'Notification deleted successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete notification' });
  }
});
