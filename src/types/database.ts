import { PermissionKey } from './permissions';

export interface Company {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  industryEn: string;
  industryAr: string;
  logoUrl?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  managerId?: string;
  manager?: Partial<User> | null;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  address?: string;
  currency?: string;
  country?: string;
  isActive: boolean;
  isArchived: boolean;
  settings?: {
    timezone?: string;
    fiscalYearStart?: string;
    [key: string]: any;
  };
  metrics?: CompanyMetrics;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  passwordHash?: string;
  fullName: string;
  fullNameAr?: string;
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  isArchived: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  roles?: Role[];
  permissions?: PermissionKey[];
  assignedCompanies?: Company[];
  allowedTabs?: string[];
}

export interface Role {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  isSystem?: boolean;
  permissions?: PermissionKey[];
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  key: PermissionKey;
  module: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  createdAt: string;
}

export type TaskStatusSlug = 'pending' | 'in_progress' | 'delayed' | 'completed' | 'paused' | 'cancelled' | string;
export type TaskPrioritySlug = 'low' | 'medium' | 'high' | 'urgent' | 'critical' | 'vip' | string;

export interface TaskStatus {
  id: string;
  slug: TaskStatusSlug;
  nameEn: string;
  nameAr: string;
  color: string;
  orderIndex: number;
  isDefault?: boolean;
  isFinal?: boolean;
  createdAt?: string;
}

export interface TaskPriority {
  id: string;
  slug: TaskPrioritySlug;
  nameEn: string;
  nameAr: string;
  color: string;
  orderIndex: number;
  createdAt?: string;
}

export type CustomFieldType =
  | 'text'
  | 'long_text'
  | 'number'
  | 'date'
  | 'date_time'
  | 'boolean'
  | 'select'
  | 'multi_select'
  | 'dropdown'
  | 'checkbox'
  | 'radio'
  | 'user_selector'
  | 'company_selector'
  | 'file_upload'
  | 'user'
  | 'url'
  | string;

export interface CustomField {
  id: string;
  nameAr: string;
  nameEn: string;
  fieldKey: string;
  type: CustomFieldType;
  required: boolean;
  defaultValue?: any;
  options?: Array<{ labelAr: string; labelEn: string; value: string }> | string[];
  visibility: 'all' | 'specific_companies' | 'specific_roles' | string;
  companyIds?: string[];
  roleSlugs?: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface TaskTimelineEvent {
  id: string;
  taskId: string;
  type: string;
  userId?: string;
  userName?: string;
  date: string;
  time: string;
  oldValue?: any;
  newValue?: any;
  reason?: string | null;
  details?: string;
  createdAt: string;
}

export interface TaskNote {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  authorName?: string;
  content: string;
  isInternalOnly: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileUrl: string;
  isPrivate?: boolean;
  uploadedBy?: string;
  uploaderId?: string;
  uploaderName: string;
  fileData?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  taskCode: string;
  companyId: string;
  company?: Company;
  title: string;
  description: string;
  priority: TaskPrioritySlug;
  status: TaskStatusSlug;
  statusReason?: string | null;
  statusId?: string;
  priorityId?: string;
  assignedToId?: string | null;
  assigneeId?: string | null;
  assignedTo?: Partial<User> | null;
  assignee?: Partial<User> | null;
  assignedUser?: Partial<User> | null;
  responsiblePersonId?: string | null;
  responsiblePerson?: Partial<User> | null;
  recipientId?: string | null;
  recipient?: Partial<User> | null;
  creatorId: string;
  creator?: Partial<User> | null;
  startDate?: string;
  dueDate?: string | null;
  completionDate?: string | null;
  customFields?: Record<string, any>;
  notes?: TaskNote[];
  attachments?: TaskAttachment[];
  timeline?: TaskTimelineEvent[];
  estimatedHours?: number | null;
  actualHours?: number | null;
  progress?: number; // Completion percentage 0 - 100
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyFile {
  id: string;
  companyId: string;
  name: string;
  category: string;
  fileSize: number;
  mimeType: string;
  fileUrl: string;
  uploaderId: string;
  uploaderName: string;
  createdAt: string;
}

export interface CompanyMetrics {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  delayedTasks: number;
  pausedTasks: number;
  vipTasks: number;
  overdueTasks: number;
  completionRate: number;
}

export type DashboardWidgetKey =
  | 'total_companies'
  | 'total_tasks'
  | 'pending_tasks'
  | 'in_progress_tasks'
  | 'delayed_tasks'
  | 'completed_tasks'
  | 'paused_tasks'
  | 'cancelled_tasks'
  | 'vip_tasks'
  | 'overdue_tasks'
  | 'completion_rate';

export type DashboardChartKey =
  | 'tasks_by_company'
  | 'tasks_by_status'
  | 'tasks_by_priority'
  | 'tasks_by_user'
  | 'tasks_over_time';

export interface UserDashboardConfig {
  id: string;
  userId: string;
  companyIds: string[];
  widgets: Array<{
    key: DashboardWidgetKey;
    enabled: boolean;
    order: number;
  }>;
  charts: Array<{
    key: DashboardChartKey;
    enabled: boolean;
    order: number;
  }>;
  showRecentTasks: boolean;
  updatedAt: string;
  updatedBy: string;
}

export type AuditAction = string;

export interface AuditLog {
  id: string;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  action: AuditAction;
  entity?: string;
  entityId?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  date: string;
  time: string;
  timestamp?: string;
  createdAt?: string;
  ipAddress?: string;
  userAgent?: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
  details?: Record<string, any>;
  resource?: string;
  resourceId?: string | null;
}

export type NotificationType = string;

export interface Notification {
  id: string;
  userId: string;
  companyId?: string | null;
  taskId?: string | null;
  taskCode?: string | null;
  type: NotificationType;
  titleEn: string;
  titleAr: string;
  messageEn: string;
  messageAr: string;
  isRead: boolean;
  readByUserIds?: string[];
  actionUrl?: string;
  createdAt: string;
}

export interface BackupConfig {
  autoBackupEnabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | string;
  pathMode: 'auto' | 'manual' | string;
  customPath: string;
  retentionCount?: number;
  lastBackupAt?: string;
  lastBackupStatus?: string;
}

export interface BackupMetadata {
  id: string;
  filename: string;
  filePath: string;
  pathMode: string;
  createdAt: string;
  sizeBytes: number;
  companiesCount: number;
  usersCount: number;
  tasksCount: number;
  triggeredBy: string;
  type?: string;
}

export interface SystemAboutSettings {
  aboutTitleAr: string;
  aboutTitleEn: string;
  aboutDescriptionAr: string;
  aboutDescriptionEn: string;
  copyrightTextAr: string;
  copyrightTextEn: string;
  developerNameAr: string;
  developerNameEn: string;
  systemVersion: string;
  licenseType: string;
  supportEmail: string;
  updatedAt: string;
  updatedBy?: string;
}
