import { Router, Response } from 'express';
import { dbStorage } from '../db/storage';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

export const systemRouter = Router();

systemRouter.get('/about', (_req: AuthenticatedRequest, res: Response): void => {
  try {
    const about = dbStorage.getSystemAbout();
    res.json({ success: true, about });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve system information' });
  }
});

systemRouter.put('/about', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    if (!req.user?.isSuperAdmin) {
      res.status(403).json({
        error: 'Access Denied: Only Super Admin can modify system copyright and information.',
      });
      return;
    }

    const {
      aboutTitleAr,
      aboutTitleEn,
      aboutDescriptionAr,
      aboutDescriptionEn,
      copyrightTextAr,
      copyrightTextEn,
      developerNameAr,
      developerNameEn,
      systemVersion,
      licenseType,
      supportEmail,
    } = req.body;

    const updatePayload: Record<string, any> = {};
    if (aboutTitleAr !== undefined) updatePayload.aboutTitleAr = String(aboutTitleAr).trim();
    if (aboutTitleEn !== undefined) updatePayload.aboutTitleEn = String(aboutTitleEn).trim();
    if (aboutDescriptionAr !== undefined) updatePayload.aboutDescriptionAr = String(aboutDescriptionAr).trim();
    if (aboutDescriptionEn !== undefined) updatePayload.aboutDescriptionEn = String(aboutDescriptionEn).trim();
    if (copyrightTextAr !== undefined) updatePayload.copyrightTextAr = String(copyrightTextAr).trim();
    if (copyrightTextEn !== undefined) updatePayload.copyrightTextEn = String(copyrightTextEn).trim();
    if (developerNameAr !== undefined) updatePayload.developerNameAr = String(developerNameAr).trim();
    if (developerNameEn !== undefined) updatePayload.developerNameEn = String(developerNameEn).trim();
    if (systemVersion !== undefined) updatePayload.systemVersion = String(systemVersion).trim();
    if (licenseType !== undefined) updatePayload.licenseType = String(licenseType).trim();
    if (supportEmail !== undefined) updatePayload.supportEmail = String(supportEmail).trim();
    if (req.body.customSections !== undefined) updatePayload.customSections = req.body.customSections;
    if (req.body.additionalRights !== undefined) updatePayload.additionalRights = req.body.additionalRights;

    const updated = dbStorage.updateSystemAbout(
      updatePayload,
      {
        id: req.user.id,
        fullName: req.user.fullName,
        email: req.user.email,
      },
      req.ip
    );

    res.json({
      success: true,
      message: 'System about metadata updated successfully',
      about: updated,
    });
  } catch (err) {
    console.error('Error updating system about metadata:', err);
    res.status(500).json({ error: 'Failed to update system information' });
  }
});

systemRouter.post('/reset-zero', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    if (!req.user?.isSuperAdmin) {
      res.status(403).json({
        error: 'Access Denied: Only Super Admin can reset the system.',
      });
      return;
    }
    const result = dbStorage.resetToZero(
      {
        id: req.user.id,
        fullName: req.user.fullName,
        email: req.user.email,
      },
      req.ip
    );
    res.json(result);
  } catch (err: any) {
    console.error('Error resetting system to zero:', err);
    res.status(500).json({ error: err.message || 'Failed to reset system to zero' });
  }
});

systemRouter.get('/backup', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    if (!req.user?.isSuperAdmin) {
      res.status(403).json({ error: 'Access Denied: Only Super Admin can export backups.' });
      return;
    }
    const pathMode = ((req.query.pathMode as string) || 'auto') as 'auto' | 'manual';
    const customPath = (req.query.customPath as string) || '';
    const backup = dbStorage.generateBackupData(
      pathMode,
      customPath,
      {
        id: req.user.id,
        fullName: req.user.fullName,
        email: req.user.email,
      },
      'manual'
    );
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${backup.metadata.filename}"`);
    res.send(backup.jsonString);
  } catch (err: any) {
    console.error('Error creating backup:', err);
    res.status(500).json({ error: err.message || 'Failed to generate backup' });
  }
});

systemRouter.post('/backup', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    if (!req.user?.isSuperAdmin) {
      res.status(403).json({ error: 'Access Denied: Only Super Admin can create backups.' });
      return;
    }
    const { pathMode = 'auto', customPath = '', type = 'manual' } = req.body as {
      pathMode?: 'auto' | 'manual';
      customPath?: string;
      type?: 'manual' | 'auto';
    };
    const backup = dbStorage.generateBackupData(
      pathMode,
      customPath,
      {
        id: req.user.id,
        fullName: req.user.fullName,
        email: req.user.email,
      },
      type
    );
    res.json({
      success: true,
      message: 'Backup generated successfully',
      metadata: backup.metadata,
      payload: backup.payload,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create backup' });
  }
});

systemRouter.post('/restore', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    if (!req.user?.isSuperAdmin) {
      res.status(403).json({ error: 'Access Denied: Only Super Admin can restore backups.' });
      return;
    }
    const { backupData } = req.body;
    if (!backupData) {
      res.status(400).json({ error: 'No backup data provided in request body' });
      return;
    }
    const result = dbStorage.restoreBackupData(
      backupData,
      {
        id: req.user.id,
        fullName: req.user.fullName,
        email: req.user.email,
      },
      req.ip
    );
    res.json(result);
  } catch (err: any) {
    console.error('Error restoring backup:', err);
    res.status(400).json({ error: err.message || 'Failed to restore backup' });
  }
});

systemRouter.get('/backup-config', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    if (!req.user?.isSuperAdmin) {
      res.status(403).json({ error: 'Access Denied' });
      return;
    }
    const config = dbStorage.getBackupConfig();
    const history = dbStorage.getBackupsList();
    res.json({ success: true, config, history });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get backup config' });
  }
});

systemRouter.put('/backup-config', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    if (!req.user?.isSuperAdmin) {
      res.status(403).json({ error: 'Access Denied' });
      return;
    }
    const updated = dbStorage.updateBackupConfig(req.body);
    res.json({ success: true, message: 'Backup configuration updated successfully', config: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update backup config' });
  }
});
