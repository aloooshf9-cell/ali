import { Router, Response } from 'express';
import * as XLSX from 'xlsx';
import { dbStorage } from '../db/storage';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { PermissionKey } from '../../types/permissions';
import { REPORT_EXPORT_FIELDS, ReportQueryResult } from '../../types/reports';

export const reportRouter = Router();

function matchesManagerFilter(t: any, managerParam: any, allUsers: any[], allCompanies: any[]): boolean {
  if (!managerParam || managerParam === 'all') return true;

  if (managerParam === 'all_managers') {
    const managerUserIds = new Set<string>();
    allUsers.forEach((u: any) => {
      const isManager = u.isSuperAdmin ||
        u.roles?.some((r: any) => r.slug.includes('admin') || r.slug.includes('manager')) ||
        allCompanies.some((c: any) => c.managerId === u.id);
      if (isManager) managerUserIds.add(u.id);
    });
    return (
      (t.creatorId && managerUserIds.has(t.creatorId)) ||
      (t.assigneeId && managerUserIds.has(t.assigneeId)) ||
      (t.assignedToId && managerUserIds.has(t.assignedToId)) ||
      (t.responsiblePersonId && managerUserIds.has(t.responsiblePersonId))
    );
  }

  const selectedManagerList = Array.isArray(managerParam)
    ? managerParam.map(String)
    : String(managerParam).split(',').map((s: string) => s.trim()).filter(Boolean);

  if (!selectedManagerList.length || selectedManagerList.includes('all')) return true;

  const matchPool = new Set<string>();
  const managedCompanyIds = new Set<string>();

  selectedManagerList.forEach((id: string) => {
    matchPool.add(id);
    matchPool.add(id.toLowerCase());
    const matchedUser = allUsers.find(u => u.id === id || u.email?.toLowerCase() === id.toLowerCase() || u.fullName === id || u.fullNameAr === id);
    if (matchedUser) {
      matchPool.add(matchedUser.id);
      if (matchedUser.fullName) {
        matchPool.add(matchedUser.fullName.trim());
        matchPool.add(matchedUser.fullName.trim().toLowerCase());
      }
      if (matchedUser.fullNameAr) {
        matchPool.add(matchedUser.fullNameAr.trim());
      }
      if (matchedUser.email) {
        matchPool.add(matchedUser.email.trim().toLowerCase());
      }
      allCompanies.forEach(c => {
        if (c.managerId === matchedUser.id) managedCompanyIds.add(c.id);
      });
    }
  });

  const assignedId = t.assignedToId || t.assigneeId;
  const assignedName = t.assignedTo?.fullName || t.assignedToName;
  const assignedNameAr = t.assignedTo?.fullNameAr || t.assignedToNameAr;
  const resp = t.responsiblePersonId || t.responsiblePerson?.fullName;
  const recip = t.recipientId || t.recipient?.fullName;
  const creator = t.creatorId || t.creator?.fullName;

  return (
    (assignedId && matchPool.has(String(assignedId))) ||
    (assignedId && matchPool.has(String(assignedId).toLowerCase())) ||
    (t.assigneeId && matchPool.has(String(t.assigneeId))) ||
    (t.assignedToId && matchPool.has(String(t.assignedToId))) ||
    (assignedName && matchPool.has(String(assignedName).trim())) ||
    (assignedNameAr && matchPool.has(String(assignedNameAr).trim())) ||
    (resp && matchPool.has(String(resp))) ||
    (recip && matchPool.has(String(recip))) ||
    (creator && matchPool.has(String(creator))) ||
    (t.companyId && managedCompanyIds.has(t.companyId))
  );
}

function getPriorityDetails(t: any): { priority: string; priorityLabelAr: string; priorityLabelEn: string } {
  let slug = 'medium';
  if (typeof t.priority === 'object' && t.priority && t.priority.slug) {
    slug = String(t.priority.slug).toLowerCase();
  } else if (typeof t.priority === 'string' && t.priority.trim()) {
    slug = t.priority.toLowerCase().trim();
  } else if (t.priorityId) {
    const pid = String(t.priorityId).toLowerCase();
    if (pid === 'tp-4' || pid === 'tp-vip') slug = 'vip';
    else if (pid === 'tp-3' || pid === 'tp-high') slug = 'high';
    else if (pid === 'tp-1' || pid === 'tp-low') slug = 'low';
    else slug = 'medium';
  }

  if (slug === 'urgent' || slug === 'critical') slug = 'vip';

  let priorityLabelAr = 'متوسطة';
  let priorityLabelEn = 'Medium';

  if (slug === 'vip') {
    priorityLabelAr = 'أولوية قصوى (VIP)';
    priorityLabelEn = 'VIP';
  } else if (slug === 'high') {
    priorityLabelAr = 'عالية';
    priorityLabelEn = 'High';
  } else if (slug === 'low') {
    priorityLabelAr = 'منخفضة';
    priorityLabelEn = 'Low';
  } else {
    slug = 'medium';
    priorityLabelAr = 'متوسطة';
    priorityLabelEn = 'Medium';
  }

  if (typeof t.priority === 'object' && t.priority) {
    if (t.priority.nameAr) priorityLabelAr = t.priority.nameAr;
    if (t.priority.nameEn) priorityLabelEn = t.priority.nameEn;
  }

  return { priority: slug, priorityLabelAr, priorityLabelEn };
}

reportRouter.get('/query', requireAuth, requirePermission(PermissionKey.REPORTS_VIEW), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const user = req.user!;
    const {
      reportType = 'tasks',
      companyId,
      status,
      priority,
      assignedToId,
      creatorId,
      managerIds,
      dateFrom,
      dateTo,
      dueDateFrom,
      dueDateTo,
      search,
    } = req.query;

    const allowedCompanyIds = user.isSuperAdmin
      ? undefined
      : user.assignedCompanies?.map(c => c.id) || [];

    const allTasks = dbStorage.getTasks({
      companyId: companyId as string,
      status: status as string,
      priority: priority as string,
      search: search as string,
      allowedCompanyIds,
    });

    let filtered = allTasks;

    // Filter by specific creator if explicitly set
    if (creatorId && creatorId !== 'all') {
      const creatorList = (typeof creatorId === 'string' && (creatorId as string).includes(','))
        ? (creatorId as string).split(',').map(s => s.trim())
        : Array.isArray(creatorId)
        ? (creatorId as string[])
        : [creatorId as string];
      filtered = filtered.filter(t => creatorList.includes(t.creatorId));
    }

    // Comprehensive Manager filter (Single, Multiple, All Managers, or None/All)
    const activeManagerParam = managerIds || assignedToId;
    if (activeManagerParam && activeManagerParam !== 'all') {
      const allUsers = dbStorage.getAllUsers();
      const allCompanies = dbStorage.getAllCompanies();
      filtered = filtered.filter(t => matchesManagerFilter(t, activeManagerParam, allUsers, allCompanies));
    }

    // Filter by date ranges
    if (dateFrom) {
      filtered = filtered.filter(t => new Date(t.createdAt) >= new Date(dateFrom as string));
    }
    if (dateTo) {
      filtered = filtered.filter(t => new Date(t.createdAt) <= new Date(dateTo as string));
    }
    if (dueDateFrom) {
      filtered = filtered.filter(t => t.dueDate && new Date(t.dueDate) >= new Date(dueDateFrom as string));
    }
    if (dueDateTo) {
      filtered = filtered.filter(t => t.dueDate && new Date(t.dueDate) <= new Date(dueDateTo as string));
    }

    // Filter by custom fields if passed
    if (req.query.customFieldFilters) {
      let cfFilters: Record<string, string> = {};
      if (typeof req.query.customFieldFilters === 'string') {
        try {
          cfFilters = JSON.parse(req.query.customFieldFilters);
        } catch {
          // ignore json parse error
        }
      } else if (typeof req.query.customFieldFilters === 'object') {
        cfFilters = req.query.customFieldFilters as any;
      }

      for (const [key, val] of Object.entries(cfFilters)) {
        if (val && String(val).trim()) {
          filtered = filtered.filter(t => {
            const cfVal = t.customFields ? t.customFields[key] : undefined;
            if (cfVal === undefined || cfVal === null) return false;
            return String(cfVal).toLowerCase().includes(String(val).toLowerCase());
          });
        }
      }
    }

    const now = new Date();
    const tasks = filtered.map((t: any) => {
      const dueDateObj = t.dueDate ? new Date(t.dueDate) : null;
      const isCompleted = t.status?.slug === 'completed' || t.statusId === 'ts-5';
      const daysOverdue = dueDateObj && dueDateObj < now && !isCompleted
        ? Math.ceil((now.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const { priority: pSlug, priorityLabelAr: pAr, priorityLabelEn: pEn } = getPriorityDetails(t);

      return {
        ...t,
        taskCode: t.taskCode || t.code || `TSK-${t.id}`,
        title: t.title || '',
        statusReason: t.statusReason || (t.isDelayed ? 'تأخير في الاعتماد' : ''),
        companyName: t.company?.nameAr || t.company?.nameEn || '',
        companyNameAr: t.company?.nameAr || t.company?.nameEn || '',
        companyNameEn: t.company?.nameEn || t.company?.nameAr || '',
        companyCode: t.company?.code || '',
        assignedToName: t.assignedTo?.fullName || 'غير مسند',
        assignedToNameAr: t.assignedTo?.fullName || 'غير مسند',
        creatorName: t.creator?.fullName || '',
        status: t.status?.slug || (isCompleted ? 'completed' : t.isDelayed ? 'delayed' : 'in_progress'),
        statusLabelAr: t.status?.nameAr || (isCompleted ? 'مكتملة' : 'قيد التنفيذ'),
        statusLabelEn: t.status?.nameEn || (isCompleted ? 'Completed' : 'In Progress'),
        priority: pSlug,
        priorityLabelAr: pAr,
        priorityLabelEn: pEn,
        daysOverdue,
      };
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t: any) => t.status === 'completed' || t.statusId === 'ts-5' || t.statusSlug === 'completed').length;
    const inProgressTasks = tasks.filter((t: any) => t.status === 'in_progress' || t.statusId === 'ts-2' || t.statusSlug === 'in_progress').length;
    const delayedTasks = tasks.filter((t: any) => t.status === 'delayed' || t.statusId === 'ts-4' || t.statusSlug === 'delayed' || t.isDelayed).length;
    const overdueTasks = tasks.filter((t: any) => t.daysOverdue > 0 || (t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed' && t.statusId !== 'ts-5')).length;
    const pausedTasks = tasks.filter((t: any) => t.status === 'paused' || t.statusId === 'ts-3').length;
    const cancelledTasks = tasks.filter((t: any) => t.status === 'cancelled' || t.statusId === 'ts-6').length;

    // Strict removal of progress percentage
    const summary = {
      totalTasks,
      completedTasks,
      inProgressTasks,
      delayedTasks,
      overdueTasks,
      pausedTasks,
      cancelledTasks,
      avgTurnaroundDays: 3,
    };

    const companyMap = new Map<string, any>();
    tasks.forEach((t: any) => {
      const cId = t.companyId || 'general';
      const cNameAr = t.companyNameAr || 'عامة';
      const cNameEn = t.companyNameEn || 'General';
      const cCode = t.companyCode || '';
      if (!companyMap.has(cId)) {
        companyMap.set(cId, {
          id: cId,
          key: cId,
          labelAr: cNameAr,
          labelEn: cNameEn,
          subLabel: cCode,
          total: 0,
          completed: 0,
          inProgress: 0,
          delayed: 0,
          overdue: 0,
          paused: 0,
          cancelled: 0,
        });
      }
      const item = companyMap.get(cId);
      item.total++;
      if (t.status === 'completed' || t.statusId === 'ts-5') item.completed++;
      else if (t.status === 'in_progress' || t.statusId === 'ts-2') item.inProgress++;
      else if (t.status === 'delayed' || t.statusId === 'ts-4' || t.isDelayed) item.delayed++;
      else if (t.status === 'paused' || t.statusId === 'ts-3') item.paused++;
      else if (t.status === 'cancelled' || t.statusId === 'ts-6') item.cancelled++;
      if (t.daysOverdue > 0) item.overdue++;
    });
    const groupBreakdown = Array.from(companyMap.values());

    let selectedCompanyName = '';
    if (companyId && companyId !== 'all') {
      const comp = dbStorage.getCompanyById(companyId as string);
      selectedCompanyName = comp?.nameAr || comp?.nameEn || (companyId as string);
    }

    let selectedAssigneeName = '';
    if (assignedToId && assignedToId !== 'all') {
      const u = dbStorage.findUserById(assignedToId as string);
      selectedAssigneeName = u?.fullName || (assignedToId as string);
    }

    let activeFilterCount = 0;
    if (companyId && companyId !== 'all') activeFilterCount++;
    if (status && status !== 'all') activeFilterCount++;
    if (priority && priority !== 'all') activeFilterCount++;
    if (assignedToId && assignedToId !== 'all') activeFilterCount++;
    if (managerIds && managerIds !== 'all') activeFilterCount++;
    if (dateFrom) activeFilterCount++;
    if (dateTo) activeFilterCount++;
    if (search) activeFilterCount++;

    const appliedFilters = {
      companyName: selectedCompanyName,
      status: status && status !== 'all' ? (status as string) : undefined,
      priority: priority && priority !== 'all' ? (priority as string) : undefined,
      priorityName: priority && priority !== 'all'
        ? (priority === 'vip' || priority === 'urgent' || priority === 'critical' ? 'أولوية قصوى (VIP)'
          : priority === 'high' ? 'عالية'
          : priority === 'medium' ? 'متوسطة'
          : priority === 'low' ? 'منخفضة' : String(priority))
        : undefined,
      assignedToName: selectedAssigneeName,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
      search: search as string | undefined,
      activeFilterCount,
    };

    const result: ReportQueryResult = {
      data: tasks,
      tasks,
      totalCount: allTasks.length,
      filteredCount: tasks.length,
      metrics: {
        total: tasks.length,
        completed: completedTasks,
      },
      summary,
      groupBreakdown,
      appliedFilters,
      reportType: (reportType as any) || 'company_report',
      generatedBy: {
        fullName: user.fullName || user.email,
        role: user.roles?.[0]?.nameAr || (user.isSuperAdmin ? 'مدير عام النظام' : 'مستخدم مصرح'),
      },
      generatedAt: new Date().toISOString(),
      filters: req.query as any,
    };

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to query reports' });
  }
});

reportRouter.post('/export/excel', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { reportType = 'tasks', filters = {}, selectedFields = [], language = 'ar' } = req.body;
    const isAr = language === 'ar';

    const user = req.user!;
    const allowedCompanyIds = user.isSuperAdmin
      ? undefined
      : user.assignedCompanies?.map(c => c.id) || [];

    let tasks = dbStorage.getTasks({
      companyId: filters.companyId,
      status: filters.status,
      priority: filters.priority,
      search: filters.search,
      allowedCompanyIds,
    });

    const activeManagerParam = filters.managerIds || filters.assignedToId || filters.assigneeId;
    if (activeManagerParam && activeManagerParam !== 'all') {
      const allUsers = dbStorage.getAllUsers();
      const allCompanies = dbStorage.getAllCompanies();
      tasks = tasks.filter(t => matchesManagerFilter(t, activeManagerParam, allUsers, allCompanies));
    }

    const fieldDefs = REPORT_EXPORT_FIELDS.filter(f => selectedFields.length === 0 || selectedFields.includes(f.key));

    const rows = tasks.map((t: any) => {
      const row: Record<string, any> = {};
      fieldDefs.forEach(field => {
        const header = isAr ? field.labelAr : field.labelEn;
        if (field.key === 'companyName') row[header] = t.company?.nameAr || t.company?.nameEn || '';
        else if (field.key === 'status') row[header] = t.status?.nameAr || t.status?.nameEn || '';
        else if (field.key === 'priority') {
          const { priorityLabelAr: pAr, priorityLabelEn: pEn } = getPriorityDetails(t);
          row[header] = isAr ? pAr : pEn;
        }
        else if (field.key === 'assigneeName') row[header] = t.assignedTo?.fullName || 'غير مسند';
        else if (field.key === 'creatorName') row[header] = t.creator?.fullName || '';
        else row[header] = t[field.key] ?? '';
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=report_${reportType}_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to export Excel' });
  }
});

reportRouter.post('/export/pdf-data', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { filters = {} } = req.body;
    const user = req.user!;
    const allowedCompanyIds = user.isSuperAdmin
      ? undefined
      : user.assignedCompanies?.map(c => c.id) || [];

    let tasks = dbStorage.getTasks({
      companyId: filters.companyId,
      status: filters.status,
      priority: filters.priority,
      search: filters.search,
      allowedCompanyIds,
    });

    const activeManagerParam = filters.managerIds || filters.assignedToId || filters.assigneeId;
    if (activeManagerParam && activeManagerParam !== 'all') {
      const allUsers = dbStorage.getAllUsers();
      const allCompanies = dbStorage.getAllCompanies();
      tasks = tasks.filter(t => matchesManagerFilter(t, activeManagerParam, allUsers, allCompanies));
    }

    const formattedData = tasks.map((t: any) => {
      const { priority: pSlug, priorityLabelAr: pAr, priorityLabelEn: pEn } = getPriorityDetails(t);
      return {
        ...t,
        companyName: t.company?.nameAr || t.company?.nameEn || '',
        status: t.status?.nameAr || t.status?.nameEn || '',
        priority: pSlug,
        priorityLabelAr: pAr,
        priorityLabelEn: pEn,
        assigneeName: t.assignedTo?.fullName || 'غير مسند',
        creatorName: t.creator?.fullName || '',
      };
    });

    res.json({
      success: true,
      data: {
        data: formattedData,
        totalCount: formattedData.length,
        filteredCount: formattedData.length,
        generatedAt: new Date().toISOString(),
        filters,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to export PDF data' });
  }
});
