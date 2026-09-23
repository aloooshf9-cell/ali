import React, { useState, useEffect, useMemo } from 'react';
import { Task, Company, User, TaskStatusSlug, TaskPrioritySlug } from '../../types/database';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { PermissionKey } from '../../types/permissions';
import { TaskDetailModal } from './TaskDetailModal';
import { TaskFormModal } from './TaskFormModal';
import { StatusChangeModal } from './StatusChangeModal';
import { CustomFieldManager } from './CustomFieldManager';
import {
  CheckSquare,
  Search,
  Filter,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building2,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  XCircle,
  Eye,
  Edit2,
  Trash2,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  LayoutGrid,
  List,
  FolderOpen,
  ExternalLink,
} from 'lucide-react';
import { Modal } from '../common/Modal';

export const TaskList: React.FC = () => {
  const { t, language } = useI18n();
  const isAr = language === 'ar';
  const { user, hasPermission } = useAuth();
  const { activeCompany } = useCompany();

  // Tasks & Metadata State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View Mode: Table vs Workflow Board
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table');

  // Interactive KPI Boxes state
  const [activeKpiFilter, setActiveKpiFilter] = useState<'all' | 'in_progress' | 'completed' | 'delayed_or_paused' | 'vip_or_high' | null>(null);
  const [openedKpiModal, setOpenedKpiModal] = useState<{ title: string; tasks: Task[]; color: string } | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    return sessionStorage.getItem('task_filter_companyId') || 'all';
  });
  const [selectedStatus, setSelectedStatus] = useState<string>(() => {
    return sessionStorage.getItem('task_filter_status') || 'all';
  });
  const [selectedPriority, setSelectedPriority] = useState<string>(() => {
    return sessionStorage.getItem('task_filter_priority') || 'all';
  });
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>(() => {
    return sessionStorage.getItem('task_filter_assigneeId') || 'all';
  });
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Consume and clear sessionStorage dashboard filters on mount
  useEffect(() => {
    const sStatus = sessionStorage.getItem('task_filter_status');
    const sPriority = sessionStorage.getItem('task_filter_priority');
    const sCompany = sessionStorage.getItem('task_filter_companyId');
    const sAssignee = sessionStorage.getItem('task_filter_assigneeId');

    if (sStatus) setSelectedStatus(sStatus);
    if (sPriority) setSelectedPriority(sPriority);
    if (sCompany) setSelectedCompanyId(sCompany);
    if (sAssignee) setSelectedAssigneeId(sAssignee);

    if (sStatus || sPriority || sCompany || sAssignee) {
      sessionStorage.removeItem('task_filter_status');
      sessionStorage.removeItem('task_filter_priority');
      sessionStorage.removeItem('task_filter_companyId');
      sessionStorage.removeItem('task_filter_assigneeId');
    }
  }, []);

  // Sorting State
  const [sortField, setSortField] = useState<'taskCode' | 'dueDate' | 'priority' | 'status' | 'createdAt'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Active Modals State
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [statusChangeTask, setStatusChangeTask] = useState<Task | null>(null);
  const [showCustomFieldsManager, setShowCustomFieldsManager] = useState(false);

  // Synchronize company filter with global context if not super admin
  useEffect(() => {
    if (activeCompany && !user?.isSuperAdmin) {
      setSelectedCompanyId(activeCompany.id);
    }
  }, [activeCompany, user]);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchAllData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Build task query
      const params = new URLSearchParams();
      if (selectedCompanyId && selectedCompanyId !== 'all') {
        params.append('companyId', selectedCompanyId);
      }
      if (selectedStatus && selectedStatus !== 'all') {
        params.append('status', selectedStatus);
      }
      if (selectedPriority && selectedPriority !== 'all') {
        params.append('priority', selectedPriority);
      }
      if (selectedAssigneeId && selectedAssigneeId !== 'all') {
        params.append('assigneeId', selectedAssigneeId);
      }

      const authHeaders = getAuthHeaders();
      const [tasksRes, compRes, usersRes] = await Promise.all([
        fetch(`/api/tasks?${params.toString()}`, { headers: authHeaders, credentials: 'include' }),
        fetch('/api/companies', { headers: authHeaders, credentials: 'include' }),
        fetch('/api/users', { headers: authHeaders, credentials: 'include' }),
      ]);

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData.tasks || []);
      } else {
        const errData = await tasksRes.json();
        throw new Error(errData.error || 'Failed to fetch tasks');
      }

      if (compRes.ok) {
        const compData = await compRes.json();
        setCompanies(compData.companies || []);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load task management data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [selectedCompanyId, selectedStatus, selectedPriority, selectedAssigneeId]);

  // Client-Side Search & Filter refinement
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const codeMatch = (task.taskCode || '').toLowerCase().includes(q);
        const titleMatch = (task.title || '').toLowerCase().includes(q);
        const descMatch = (task.description || '').toLowerCase().includes(q);
        const assigneeMatch = (task.assignedTo?.fullName || '').toLowerCase().includes(q);
        if (!codeMatch && !titleMatch && !descMatch && !assigneeMatch) {
          return false;
        }
      }

      // Overdue filter
      if (overdueOnly) {
        if (!task.dueDate || task.status === 'completed') return false;
        const due = new Date(task.dueDate).getTime();
        const now = Date.now();
        if (due >= now) return false;
      }

      return true;
    });
  }, [tasks, searchQuery, overdueOnly]);

  // Sorting
  const sortedTasks = useMemo(() => {
    const list = [...filteredTasks];
    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'priority') {
        const pWeights: Record<string, number> = { vip: 4, high: 3, medium: 2, low: 1 };
        valA = pWeights[a.priority || 'medium'] || 0;
        valB = pWeights[b.priority || 'medium'] || 0;
      } else if (sortField === 'dueDate' || sortField === 'createdAt') {
        valA = valA ? new Date(valA).getTime() : 0;
        valB = valB ? new Date(valB).getTime() : 0;
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredTasks, sortField, sortDirection]);

  // Pagination calculation
  const totalPages = Math.ceil((sortedTasks?.length || 0) / pageSize) || 1;
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return (sortedTasks || []).slice(start, start + pageSize);
  }, [sortedTasks, currentPage, pageSize]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // KPIs
  const kpiStats = useMemo(() => {
    const safeTasks = tasks || [];
    const total = safeTasks.length;
    const inProgress = safeTasks.filter((t) => t.status === 'in_progress').length;
    const completed = safeTasks.filter((t) => t.status === 'completed').length;
    const delayedOrPaused = safeTasks.filter((t) => t.status === 'delayed' || t.status === 'paused').length;
    const vipOrHigh = safeTasks.filter((t) => t.priority === 'vip' || t.priority === 'high').length;
    return { total, inProgress, completed, delayedOrPaused, vipOrHigh };
  }, [tasks]);

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm(t('task.confirm_delete'))) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete task');
      fetchAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Render Status Badge
  const renderStatusBadge = (status?: TaskStatusSlug, task?: Task) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t('task.status_completed')}
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
            <PlayCircle className="w-3.5 h-3.5" />
            {t('task.status_in_progress')}
          </span>
        );
      case 'delayed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5" />
            {t('task.status_delayed')}
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
            <PauseCircle className="w-3.5 h-3.5" />
            {t('task.status_paused')}
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
            <XCircle className="w-3.5 h-3.5" />
            {t('task.status_cancelled')}
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-50 text-slate-700 border border-slate-200">
            <Clock className="w-3.5 h-3.5" />
            {t('task.status_pending')}
          </span>
        );
    }
  };

  // Render Priority Badge
  const renderPriorityBadge = (priority?: TaskPrioritySlug) => {
    switch (priority) {
      case 'vip':
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-rose-100 text-rose-800 border border-rose-200">VIP</span>;
      case 'high':
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-orange-100 text-orange-800 border border-orange-200">{t('task.priority_high')}</span>;
      case 'medium':
        return <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-blue-100 text-blue-800 border border-blue-200">{t('task.priority_medium')}</span>;
      case 'low':
      default:
        return <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 text-slate-700 border border-slate-200">{t('task.priority_low')}</span>;
    }
  };

  if (showCustomFieldsManager) {
    return <CustomFieldManager onClose={() => setShowCustomFieldsManager(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">{t('task.title')}</h1>
          </div>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            {t('task.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Switcher: Table vs Workflow Tracks */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>{isAr ? 'عرض الجدول' : 'Table View'}</span>
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'board' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{isAr ? 'مسارات العمل (المراحل)' : 'Workflow Tracks'}</span>
            </button>
          </div>

          <button
            id="refresh-tasks-btn"
            onClick={fetchAllData}
            disabled={isLoading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
            title={t('action.refresh')}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {(user?.isSuperAdmin || hasPermission(PermissionKey.CUSTOM_FIELDS_MANAGE)) && (
            <button
              id="manage-custom-fields-btn"
              onClick={() => setShowCustomFieldsManager(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors shadow-2xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              <span>{t('task.manage_custom_fields')}</span>
            </button>
          )}

          {hasPermission(PermissionKey.TASKS_CREATE) && (
            <button
              id="create-task-btn"
              onClick={() => setIsCreatingTask(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t('task.new_task')}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid - Clickable & Opens Tasks */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div
          onClick={() =>
            setOpenedKpiModal({
              title: isAr ? 'كافة المهام المسجلة' : 'All Registered Tasks',
              tasks: tasks,
              color: 'slate',
            })
          }
          className="p-4 bg-white hover:bg-slate-50/80 rounded-2xl border border-slate-200 hover:border-blue-400 shadow-xs cursor-pointer transition-all active:scale-98 group"
          title={isAr ? 'اضغط لعرض المهام الموجودة في هذه الخانة' : 'Click to inspect tasks'}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="block text-xs font-semibold text-slate-600 group-hover:text-blue-700">{t('task.total_tasks')}</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono">{kpiStats.total}</p>
          <span className="text-[10px] text-blue-600 font-medium block mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isAr ? 'اضغط للاستعراض ←' : 'Click to inspect →'}
          </span>
        </div>

        <div
          onClick={() =>
            setOpenedKpiModal({
              title: isAr ? 'مسار المهام قيد التنفيذ' : 'In Progress Tasks Track',
              tasks: tasks.filter((t) => t.status === 'in_progress'),
              color: 'blue',
            })
          }
          className="p-4 bg-white hover:bg-blue-50/30 rounded-2xl border border-slate-200 hover:border-blue-400 shadow-xs cursor-pointer transition-all active:scale-98 group"
          title={isAr ? 'اضغط لعرض المهام قيد التنفيذ' : 'Click to inspect in progress tasks'}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="block text-xs font-semibold text-slate-600 group-hover:text-blue-700">{t('task.status_in_progress')}</span>
            <PlayCircle className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-blue-600 font-mono">{kpiStats.inProgress}</p>
          <span className="text-[10px] text-blue-600 font-medium block mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isAr ? 'اضغط للاستعراض ←' : 'Click to inspect →'}
          </span>
        </div>

        <div
          onClick={() =>
            setOpenedKpiModal({
              title: isAr ? 'مسار المهام المكتملة' : 'Completed Tasks Track',
              tasks: tasks.filter((t) => t.status === 'completed'),
              color: 'emerald',
            })
          }
          className="p-4 bg-white hover:bg-emerald-50/30 rounded-2xl border border-slate-200 hover:border-emerald-400 shadow-xs cursor-pointer transition-all active:scale-98 group"
          title={isAr ? 'اضغط لعرض المهام المكتملة' : 'Click to inspect completed tasks'}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="block text-xs font-semibold text-slate-600 group-hover:text-emerald-700">{t('task.status_completed')}</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 font-mono">{kpiStats.completed}</p>
          <span className="text-[10px] text-emerald-600 font-medium block mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isAr ? 'اضغط للاستعراض ←' : 'Click to inspect →'}
          </span>
        </div>

        <div
          onClick={() =>
            setOpenedKpiModal({
              title: isAr ? 'مسار المهام المتأخرة والمتوقفة' : 'Delayed & Paused Tasks Track',
              tasks: tasks.filter((t) => t.status === 'delayed' || t.status === 'paused'),
              color: 'rose',
            })
          }
          className="p-4 bg-white hover:bg-rose-50/30 rounded-2xl border border-slate-200 hover:border-rose-400 shadow-xs cursor-pointer transition-all active:scale-98 group"
          title={isAr ? 'اضغط لعرض المهام المتأخرة والمتوقفة' : 'Click to inspect delayed tasks'}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="block text-xs font-semibold text-slate-600 group-hover:text-rose-700">{isAr ? 'متأخرة / متوقفة' : 'Delayed & Paused'}</span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <p className="text-2xl font-bold text-rose-600 font-mono">{kpiStats.delayedOrPaused}</p>
          <span className="text-[10px] text-rose-600 font-medium block mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isAr ? 'اضغط للاستعراض ←' : 'Click to inspect →'}
          </span>
        </div>

        <div
          onClick={() =>
            setOpenedKpiModal({
              title: isAr ? 'مسار المهام ذات الأولوية القصوى والعالية' : 'VIP & High Priority Tasks Track',
              tasks: tasks.filter((t) => t.priority === 'vip' || t.priority === 'high'),
              color: 'amber',
            })
          }
          className="p-4 bg-white hover:bg-amber-50/30 rounded-2xl border border-slate-200 hover:border-amber-400 shadow-xs col-span-2 sm:col-span-1 cursor-pointer transition-all active:scale-98 group"
          title={isAr ? 'اضغط لعرض المهام ذات الأولوية القصوى' : 'Click to inspect high priority tasks'}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="block text-xs font-semibold text-slate-600 group-hover:text-amber-700">{isAr ? 'قصوى / عالية' : 'VIP & High'}</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-600 font-mono">{kpiStats.vipOrHigh}</p>
          <span className="text-[10px] text-amber-600 font-medium block mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isAr ? 'اضغط للاستعراض ←' : 'Click to inspect →'}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search */}
          <div className="sm:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-600 absolute start-3 top-2.5" />
            <input
              type="text"
              id="tasks-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('task.search_placeholder')}
              className="w-full ps-9 pe-4 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
            />
          </div>

          {/* Company Filter */}
          <div className="sm:col-span-2">
            <select
              id="filter-company-select"
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
            >
              <option value="all">{t('task.all_companies')}</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {isAr && c.nameAr ? c.nameAr : c.nameEn}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-2">
            <select
              id="filter-status-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
            >
              <option value="all">{t('task.all_statuses')}</option>
              <option value="pending">{t('task.status_pending')}</option>
              <option value="in_progress">{t('task.status_in_progress')}</option>
              <option value="delayed">{t('task.status_delayed')}</option>
              <option value="paused">{t('task.status_paused')}</option>
              <option value="completed">{t('task.status_completed')}</option>
              <option value="cancelled">{t('task.status_cancelled')}</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="sm:col-span-2">
            <select
              id="filter-priority-select"
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
            >
              <option value="all">{t('task.all_priorities')}</option>
              <option value="vip">VIP</option>
              <option value="high">{t('task.priority_high')}</option>
              <option value="medium">{t('task.priority_medium')}</option>
              <option value="low">{t('task.priority_low')}</option>
            </select>
          </div>

          {/* Assignee Filter */}
          <div className="sm:col-span-2">
            <select
              id="filter-assignee-select"
              value={selectedAssigneeId}
              onChange={(e) => setSelectedAssigneeId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
            >
              <option value="all">{isAr ? 'كافة المدراء' : 'All Assignees'}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {isAr && u.fullNameAr ? u.fullNameAr : u.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Checkbox for Overdue Only */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
            <input
              type="checkbox"
              id="filter-overdue-checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
              className="w-4 h-4 text-rose-600 rounded"
            />
            <span className={overdueOnly ? 'text-rose-700 font-bold' : ''}>
              {isAr ? 'عرض المهام المتجاوزة لموعد الاستحقاق فقط (Overdue Only)' : 'Show Overdue Tasks Only'}
            </span>
          </label>

          <span className="text-slate-600 font-mono text-[11px]">
            {(filteredTasks || []).length} {isAr ? 'مهمة مطابقة' : 'tasks matched'}
          </span>
        </div>
      </div>

      {/* Main Task Content: Table or Workflow Tracks Board */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-600 flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>{isAr ? 'جاري استرجاع المهام...' : 'Loading tasks...'}</span>
          </div>
        ) : (!paginatedTasks || paginatedTasks.length === 0) ? (
          <div className="p-12 text-center text-slate-600">
            <CheckSquare className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-semibold">{t('task.no_tasks')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th
                    className="p-3.5 text-start cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('taskCode')}
                  >
                    <div className="flex items-center gap-1">
                      <span>{t('task.id')}</span>
                      {sortField === 'taskCode' && (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                      )}
                    </div>
                  </th>
                  <th className="p-3.5 text-start">{t('task.task_title')}</th>
                  <th className="p-3.5 text-start">{t('task.company')}</th>
                  <th className="p-3.5 text-start">{t('task.assigned_to')}</th>
                  <th className="p-3.5 text-start">{t('task.responsible')}</th>
                  <th
                    className="p-3.5 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('priority')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{t('task.priority')}</span>
                      {sortField === 'priority' && (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                      )}
                    </div>
                  </th>
                  <th
                    className="p-3.5 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{t('task.status')}</span>
                      {sortField === 'status' && (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                      )}
                    </div>
                  </th>
                  <th
                    className="p-3.5 text-start cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('dueDate')}
                  >
                    <div className="flex items-center gap-1">
                      <span>{t('task.due_date')}</span>
                      {sortField === 'dueDate' && (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                      )}
                    </div>
                  </th>
                  <th className="p-3.5 text-end">{isAr ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedTasks.map((task) => {
                  const isTaskOverdue = task.dueDate && task.status !== 'completed' && new Date(task.dueDate) < new Date();
                  return (
                    <tr key={task.id} className="hover:bg-slate-50/70 transition-colors group">
                      {/* Task Code */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-mono text-xs font-bold text-slate-800">
                          {task.taskCode || task.id}
                        </span>
                      </td>

                      {/* Title & Excerpt */}
                      <td className="p-3.5 min-w-[200px]">
                        <button
                          onClick={() => setViewingTaskId(task.id)}
                          className="font-bold text-slate-900 hover:text-blue-600 text-start line-clamp-1 block transition-colors"
                        >
                          {task.title}
                        </button>
                        <p className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">
                          {task.description || (isAr ? 'لا يوجد تفاصيل إضافية' : 'No description')}
                        </p>
                      </td>

                      {/* Company */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          <span className="font-semibold text-slate-700">
                            {isAr && task.company?.nameAr ? task.company.nameAr : task.company?.nameEn || 'Corporate'}
                          </span>
                        </div>
                      </td>

                      {/* Assigned To */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                            {task.assignedTo?.fullName?.charAt(0) || 'U'}
                          </div>
                          <span className="text-slate-800 font-medium">
                            {isAr && task.assignedTo?.fullNameAr ? task.assignedTo.fullNameAr : task.assignedTo?.fullName || (isAr ? 'غير محدد' : 'Unassigned')}
                          </span>
                        </div>
                      </td>

                      {/* Responsible Person */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="text-slate-600 text-xs">
                          {isAr && task.responsiblePerson?.fullNameAr ? task.responsiblePerson.fullNameAr : task.responsiblePerson?.fullName || '-'}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        {renderPriorityBadge(task.priority)}
                      </td>

                      {/* Status (Clickable for quick status change) */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <button
                          onClick={() => setStatusChangeTask(task)}
                          className="hover:opacity-85 transition-opacity"
                          title={isAr ? 'انقر للتحديث السريع للحالة' : 'Click to quick-update status'}
                        >
                          {renderStatusBadge(task.status, task)}
                        </button>
                      </td>

                      {/* Due Date */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className={`font-mono font-medium ${isTaskOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US') : '-'}
                          </span>
                          {isTaskOverdue && (
                            <span className="text-[10px] text-rose-600 font-bold">{t('task.overdue')}</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-end whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`view-task-${task.id}`}
                            onClick={() => setViewingTaskId(task.id)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title={t('action.view')}
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {hasPermission(PermissionKey.TASKS_EDIT) && (
                            <button
                              id={`edit-task-${task.id}`}
                              onClick={() => setEditingTask(task)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title={t('action.edit')}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}

                          {hasPermission(PermissionKey.TASKS_DELETE) && (
                            <button
                              id={`delete-task-${task.id}`}
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title={t('action.delete')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>{isAr ? 'المهام لكل صفحة:' : 'Rows per page:'}</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-slate-300 rounded-lg bg-white"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="ms-2">
              {isAr
                ? `عرض ${(currentPage - 1) * pageSize + 1} إلى ${Math.min(currentPage * pageSize, sortedTasks.length)} من أصل ${sortedTasks.length}`
                : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, sortedTasks.length)} of ${sortedTasks.length}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              {isAr ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            <span className="font-semibold">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              {isAr ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
      ) : (
        /* Workflow Tracks Board View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            {
              id: 'pending',
              title: isAr ? 'مسار قيد الانتظار' : 'Pending Track',
              tasks: filteredTasks.filter((t) => t.status === 'pending'),
              color: 'slate',
              bgHeader: 'bg-slate-100 border-slate-200 text-slate-800',
            },
            {
              id: 'in_progress',
              title: isAr ? 'مسار قيد التنفيذ' : 'In Progress Track',
              tasks: filteredTasks.filter((t) => t.status === 'in_progress'),
              color: 'blue',
              bgHeader: 'bg-blue-50 border-blue-200 text-blue-900',
            },
            {
              id: 'delayed',
              title: isAr ? 'مسار المتأخرة' : 'Delayed Track',
              tasks: filteredTasks.filter((t) => t.status === 'delayed'),
              color: 'rose',
              bgHeader: 'bg-rose-50 border-rose-200 text-rose-900',
            },
            {
              id: 'paused',
              title: isAr ? 'مسار المتوقفة' : 'Paused Track',
              tasks: filteredTasks.filter((t) => t.status === 'paused'),
              color: 'amber',
              bgHeader: 'bg-amber-50 border-amber-200 text-amber-900',
            },
            {
              id: 'completed',
              title: isAr ? 'مسار المكتملة' : 'Completed Track',
              tasks: filteredTasks.filter((t) => t.status === 'completed'),
              color: 'emerald',
              bgHeader: 'bg-emerald-50 border-emerald-200 text-emerald-900',
            },
          ].map((col) => (
            <div
              key={col.id}
              className="bg-slate-100/70 rounded-2xl border border-slate-200/80 p-3 flex flex-col min-h-[450px]"
            >
              {/* Stage/Track Header: Clickable to inspect all tasks in this track */}
              <div
                onClick={() =>
                  setOpenedKpiModal({
                    title: col.title,
                    tasks: col.tasks,
                    color: col.color,
                  })
                }
                className={`p-3 rounded-xl border ${col.bgHeader} flex items-center justify-between cursor-pointer hover:shadow-xs transition-all active:scale-98 mb-3`}
                title={isAr ? 'انقر لعرض وفتح كامل مهام هذا المسار' : 'Click to inspect all tasks in track'}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black">{col.title}</span>
                  <span className="text-[10px] bg-white px-2 py-0.5 rounded-full font-bold shadow-2xs">
                    {col.tasks?.length || 0}
                  </span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
              </div>

              {/* Task Cards in Track */}
              <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[600px] pe-1">
                {!col.tasks || col.tasks.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs italic">
                    {isAr ? 'لا توجد مهام في هذا المسار' : 'No tasks in this track'}
                  </div>
                ) : (
                  col.tasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setViewingTaskId(task.id)}
                      className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all active:scale-98 group space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {task.taskCode || task.id}
                        </span>
                        {renderPriorityBadge(task.priority)}
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 line-clamp-2 transition-colors">
                        {task.title}
                      </h4>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                        <span className="truncate max-w-[120px]">
                          {isAr && task.company?.nameAr ? task.company.nameAr : task.company?.nameEn || 'Corporate'}
                        </span>
                        {task.dueDate && (
                          <span className="font-mono font-semibold">
                            {new Date(task.dueDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Opened KPI / Track Inspector Modal */}
      {openedKpiModal && (
        <Modal
          isOpen={!!openedKpiModal}
          onClose={() => setOpenedKpiModal(null)}
          title={`${openedKpiModal.title} (${openedKpiModal.tasks?.length || 0} ${isAr ? 'مهمة' : 'tasks'})`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-blue-900 flex items-center justify-between">
              <span className="text-xs font-medium">
                {isAr
                  ? 'انقر على أي مهمة أدناه لفتح كامل تفاصيلها ومساراتها فوراً:'
                  : 'Click any task below to open full details and history:'}
              </span>
              <span className="text-[11px] font-bold bg-white text-blue-700 px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs">
                {openedKpiModal.tasks?.length || 0} {isAr ? 'مهمة متوفرة' : 'tasks available'}
              </span>
            </div>

            {!openedKpiModal.tasks || openedKpiModal.tasks.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-medium">
                {isAr ? 'لا توجد مهام مدرجة في هذه الخانة حالياً.' : 'No tasks currently exist in this box.'}
              </div>
            ) : (
              <div className="max-h-[450px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white">
                {openedKpiModal.tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => {
                      setOpenedKpiModal(null);
                      setViewingTaskId(task.id);
                    }}
                    className="p-3.5 flex items-center justify-between gap-4 hover:bg-blue-50/40 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-bold px-2 py-1 bg-slate-100 group-hover:bg-blue-100 group-hover:text-blue-700 rounded-lg text-slate-800 shrink-0">
                        {task.taskCode || task.id}
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 group-hover:text-blue-600 truncate transition-colors text-xs">
                          {task.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span>{isAr && task.company?.nameAr ? task.company.nameAr : task.company?.nameEn}</span>
                          <span>•</span>
                          <span>{task.assignedUser ? (isAr && task.assignedUser.fullNameAr ? task.assignedUser.fullNameAr : task.assignedUser.fullName) : '-'}</span>
                          {task.dueDate && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-slate-600">
                                {new Date(task.dueDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {renderPriorityBadge(task.priority)}
                      {renderStatusBadge(task.status, task)}
                      <button
                        type="button"
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-colors flex items-center gap-1"
                      >
                        <span>{isAr ? 'فتح المهمة' : 'Open Task'}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setOpenedKpiModal(null)}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl font-bold text-xs transition-colors"
              >
                {t('action.close')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Task Details Modal */}
      {viewingTaskId && (
        <TaskDetailModal
          taskId={viewingTaskId}
          onClose={() => setViewingTaskId(null)}
          onTaskUpdated={fetchAllData}
          onEditTask={(task) => setEditingTask(task)}
        />
      )}

      {/* Create / Edit Task Modal */}
      {(isCreatingTask || editingTask) && (
        <TaskFormModal
          taskToEdit={editingTask}
          onClose={() => {
            setIsCreatingTask(false);
            setEditingTask(null);
          }}
          onSuccess={fetchAllData}
        />
      )}

      {/* Quick Status Change Modal */}
      {statusChangeTask && (
        <StatusChangeModal
          task={statusChangeTask}
          onClose={() => setStatusChangeTask(null)}
          onSuccess={() => {
            fetchAllData();
            if (viewingTaskId === statusChangeTask.id) {
              setViewingTaskId(statusChangeTask.id);
            }
          }}
        />
      )}
    </div>
  );
};
