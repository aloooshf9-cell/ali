export type ReportType =
  | 'tasks'
  | 'companies'
  | 'users'
  | 'activity'
  | 'overview'
  | 'company_report'
  | 'task_report'
  | 'status_report'
  | 'priority_report'
  | 'user_report'
  | 'overdue_report'
  | 'completion_report';

export interface ReportFilterParams {
  companyId?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  assignedToId?: string;
  creatorId?: string;
  managerIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  search?: string;
  searchQuery?: string;
  tags?: string[];
  isOverdue?: boolean;
  type?: ReportType;
  customFieldFilters?: Record<string, string>;
}

export interface ReportSummary {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  delayedTasks: number;
  overdueTasks: number;
  pausedTasks?: number;
  cancelledTasks?: number;
  completionRate?: number;
  avgTurnaroundDays?: number;
}

export interface ReportGroupBreakdownItem {
  id: string;
  key: string;
  labelAr: string;
  labelEn: string;
  subLabel?: string;
  total: number;
  completed: number;
  inProgress: number;
  delayed: number;
  overdue: number;
  paused?: number;
  cancelled?: number;
  completionRate?: number;
}

export interface ReportAppliedFilters {
  companyName?: string;
  status?: string;
  priority?: string;
  priorityName?: string;
  assignedToName?: string;
  managerName?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  activeFilterCount: number;
}

export interface ReportQueryResult {
  data: any[];
  tasks: any[];
  totalCount: number;
  filteredCount: number;
  metrics?: any;
  summary: ReportSummary;
  groupBreakdown: ReportGroupBreakdownItem[];
  appliedFilters: ReportAppliedFilters;
  reportType: ReportType;
  generatedBy: {
    fullName: string;
    role: string;
  };
  generatedAt: string;
  filters: ReportFilterParams;
}

export type ReportExportFieldKey =
  | 'id'
  | 'taskCode'
  | 'title'
  | 'company'
  | 'companyName'
  | 'status'
  | 'statusReason'
  | 'priority'
  | 'assigneeName'
  | 'assignedTo'
  | 'responsiblePersonId'
  | 'creator'
  | 'creatorName'
  | 'startDate'
  | 'dueDate'
  | 'completionDate'
  | 'estimatedHours'
  | 'actualHours'
  | 'completionRate'
  | 'description'
  | 'notes'
  | 'createdAt'
  | 'updatedAt'
  | 'customFields';

export interface ReportExportField {
  key: ReportExportFieldKey;
  labelEn: string;
  labelAr: string;
  category: 'core' | 'details' | 'meta';
  defaultSelected: boolean;
}

export const REPORT_EXPORT_FIELDS: ReportExportField[] = [
  { key: 'taskCode', labelEn: 'Task Code', labelAr: 'رمز المهمة', category: 'core', defaultSelected: true },
  { key: 'title', labelEn: 'Task Title', labelAr: 'عنوان المهمة', category: 'core', defaultSelected: true },
  { key: 'companyName', labelEn: 'Company', labelAr: 'الشركة', category: 'core', defaultSelected: true },
  { key: 'status', labelEn: 'Status', labelAr: 'الحالة', category: 'core', defaultSelected: true },
  { key: 'priority', labelEn: 'Priority', labelAr: 'الأولوية', category: 'core', defaultSelected: true },
  { key: 'assigneeName', labelEn: 'Assignee', labelAr: 'المدير', category: 'core', defaultSelected: true },
  { key: 'dueDate', labelEn: 'Due Date', labelAr: 'تاريخ الاستحقاق', category: 'details', defaultSelected: true },
  { key: 'creatorName', labelEn: 'Creator', labelAr: 'المنشئ', category: 'details', defaultSelected: false },
  { key: 'estimatedHours', labelEn: 'Est. Hours', labelAr: 'الساعات المقدرة', category: 'details', defaultSelected: true },
  { key: 'actualHours', labelEn: 'Actual Hours', labelAr: 'الساعات الفعلية', category: 'details', defaultSelected: true },
  { key: 'description', labelEn: 'Description', labelAr: 'الوصف', category: 'details', defaultSelected: false },
  { key: 'statusReason', labelEn: 'Status Reason', labelAr: 'سبب الحالة', category: 'details', defaultSelected: false },
  { key: 'id', labelEn: 'Record ID', labelAr: 'المعرف الفريد', category: 'meta', defaultSelected: false },
  { key: 'createdAt', labelEn: 'Created Date', labelAr: 'تاريخ الإنشاء', category: 'meta', defaultSelected: false },
  { key: 'updatedAt', labelEn: 'Last Updated', labelAr: 'آخر تحديث', category: 'meta', defaultSelected: false },
  { key: 'customFields', labelEn: 'Custom Fields', labelAr: 'الحقول المخصصة', category: 'meta', defaultSelected: false },
];
