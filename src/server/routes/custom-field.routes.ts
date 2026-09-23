import { Router, Response } from 'express';
import { dbStorage } from '../db/storage';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { PermissionKey } from '../../types/permissions';

export const customFieldRouter = Router();

customFieldRouter.get('/', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { companyId, roleSlug } = req.query;
    const fields = dbStorage.getCustomFields({
      companyId: companyId as string,
      roleSlug: roleSlug as string,
    });
    res.json({ customFields: fields });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch custom fields' });
  }
});

customFieldRouter.post('/', requireAuth, requirePermission(PermissionKey.CUSTOM_FIELDS_MANAGE), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const field = dbStorage.createCustomField(req.body, req.user!);
    res.status(201).json({ customField: field });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create custom field' });
  }
});

customFieldRouter.put('/:id', requireAuth, requirePermission(PermissionKey.CUSTOM_FIELDS_MANAGE), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const field = dbStorage.updateCustomField(req.params.id, req.body, req.user!);
    res.json({ customField: field });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update custom field' });
  }
});

customFieldRouter.delete('/:id', requireAuth, requirePermission(PermissionKey.CUSTOM_FIELDS_MANAGE), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const success = dbStorage.deleteCustomField(req.params.id, req.user!);
    res.json({ success, message: 'Custom field deleted successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete custom field' });
  }
});
