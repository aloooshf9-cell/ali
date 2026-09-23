import { Company, Role } from './database';
import { PermissionKey } from './permissions';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  fullNameAr?: string;
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  isArchived: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  roles: Role[];
  permissions: PermissionKey[];
  assignedCompanies: Company[];
  primaryCompanyId?: string;
  isSuperAdmin: boolean;
  allowedTabs?: string[];
}
