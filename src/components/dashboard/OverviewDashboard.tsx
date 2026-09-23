import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useI18n } from '../../i18n/I18nContext';
import { TabType } from '../common/Sidebar';
import { api } from '../../services/api';
import { UserDashboardConfig, DashboardWidgetKey, DashboardChartKey, Company } from '../../types/database';
import { WidgetCard } from './WidgetCard';
import { DashboardCustomizerModal } from './DashboardCustomizerModal';
import { CompanyDetailModal } from '../companies/CompanyDetailModal';
import { Modal } from '../common/Modal';
import { TaskDetailModal } from '../tasks/TaskDetailModal';
import { TasksByCompanyChart } from './charts/TasksByCompanyChart';
import { TasksByStatusChart } from './charts/TasksByStatusChart';
import { TasksByPriorityChart } from './charts/TasksByPriorityChart';
import { TasksByUserChart } from './charts/TasksByUserChart';
import { TasksOverTimeChart } from './charts/TasksOverTimeChart';
import {
  SlidersHorizontal,
  RefreshCw,
  Building2,
  Calendar,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Flame,
  ChevronRight,
  Sliders,
  Check,
  Briefcase,
  Loader2,
  ExternalLink,
  Eye,
  CheckSquare,
  Tag,
  Filter,
} from 'lucide-react';

interface OverviewDashboardProps {
  onNavigate: (tab: TabType) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { activeCompany, availableCompanies, setActiveCompany } = useCompany();
  const { language, direction, t } = useI18n();
  const isAr = language === 'ar';
  const Arrow = direction === 'rtl' ? ArrowLeft : ArrowRight;

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state - synchronized with activeCompany if available
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>(activeCompany?.id || 'all');

  // Customizer modal state
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  // Dashboard data
  const [dashboardConfig, setDashboardConfig] = useState<UserDashboardConfig | null>(null);
  const [widgetsData, setWidgetsData] = useState<Record<string, number>>({});
  const [chartsData, setChartsData] = useState<{
    tasks_by_company: any[];
    tasks_by_status: any[];
    tasks_by_priority: any[];
    tasks_by_user: any[];
    tasks_over_time: any[];
  }>({
    tasks_by_company: [],
    tasks_by_status: [],
    tasks_by_priority: [],
    tasks_by_user: [],
    tasks_over_time: [],
  });
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [scopedCompanies, setScopedCompanies] = useState<Array<{ id: string; code: string; nameEn: string; nameAr: string }>>([]);
  const [isCompanyDetailOpen, setIsCompanyDetailOpen] = useState(false);

  // Drilldown Modal state for clicking any chart segment or widget
  const [drilldown, setDrilldown] = useState<{
    isOpen: boolean;
    title: string;
    filterLabel: string;
    filterType: 'status' | 'priority' | 'company' | 'user' | 'widget' | 'all';
    filterValue: string;
    extraStatus?: string;
    tasks: any[];
    isLoading: boolean;
  } | null>(null);
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null);

  const openDrilldown = async (params: {
    title: string;
    filterLabel: string;
    filterType: 'status' | 'priority' | 'company' | 'user' | 'widget' | 'all';
    filterValue: string;
    extraStatus?: string;
  }) => {
    setDrilldown({
      isOpen: true,
      title: params.title,
      filterLabel: params.filterLabel,
      filterType: params.filterType,
      filterValue: params.filterValue,
      extraStatus: params.extraStatus,
      tasks: [],
      isLoading: true,
    });

    try {
      const apiParams: Record<string, any> = {};
      if (selectedCompanyFilter !== 'all') {
        apiParams.companyId = selectedCompanyFilter;
      }
      if (params.filterType === 'status') {
        apiParams.status = params.filterValue;
      } else if (params.filterType === 'priority') {
        apiParams.priority = params.filterValue;
      } else if (params.filterType === 'company') {
        apiParams.companyId = params.filterValue;
        if (params.extraStatus) apiParams.status = params.extraStatus;
      } else if (params.filterType === 'user') {
        apiParams.assignedToId = params.filterValue;
      } else if (params.filterType === 'widget') {
        if (params.filterValue === 'pending_tasks') apiParams.status = 'pending';
        else if (params.filterValue === 'in_progress_tasks') apiParams.status = 'in_progress';
        else if (params.filterValue === 'completed_tasks') apiParams.status = 'completed';
        else if (params.filterValue === 'delayed_tasks') apiParams.status = 'delayed';
        else if (params.filterValue === 'paused_tasks') apiParams.status = 'paused';
        else if (params.filterValue === 'cancelled_tasks') apiParams.status = 'cancelled';
        else if (params.filterValue === 'urgent_tasks') apiParams.priority = 'vip';
      }

      const res: any = await api.getTasks(apiParams);
      const taskList = Array.isArray(res) ? res : res.tasks || [];
      setDrilldown(prev => prev ? { ...prev, tasks: taskList, isLoading: false } : null);
    } catch (err) {
      console.error('Failed to load drilldown tasks:', err);
      setDrilldown(prev => prev ? { ...prev, isLoading: false } : null);
    }
  };

  const handleNavigateToTasksWithFilter = () => {
    if (!drilldown) return;
    try {
      sessionStorage.removeItem('task_filter_status');
      sessionStorage.removeItem('task_filter_priority');
      sessionStorage.removeItem('task_filter_companyId');
      sessionStorage.removeItem('task_filter_assigneeId');

      if (drilldown.filterType === 'status') {
        sessionStorage.setItem('task_filter_status', drilldown.filterValue);
      } else if (drilldown.filterType === 'priority') {
        sessionStorage.setItem('task_filter_priority', drilldown.filterValue);
      } else if (drilldown.filterType === 'company') {
        sessionStorage.setItem('task_filter_companyId', drilldown.filterValue);
        if (drilldown.extraStatus) {
          sessionStorage.setItem('task_filter_status', drilldown.extraStatus);
        }
      } else if (drilldown.filterType === 'user') {
        sessionStorage.setItem('task_filter_assigneeId', drilldown.filterValue);
      } else if (drilldown.filterType === 'widget') {
        if (drilldown.filterValue === 'pending_tasks') sessionStorage.setItem('task_filter_status', 'pending');
        else if (drilldown.filterValue === 'in_progress_tasks') sessionStorage.setItem('task_filter_status', 'in_progress');
        else if (drilldown.filterValue === 'completed_tasks') sessionStorage.setItem('task_filter_status', 'completed');
        else if (drilldown.filterValue === 'delayed_tasks') sessionStorage.setItem('task_filter_status', 'delayed');
        else if (drilldown.filterValue === 'paused_tasks') sessionStorage.setItem('task_filter_status', 'paused');
        else if (drilldown.filterValue === 'cancelled_tasks') sessionStorage.setItem('task_filter_status', 'cancelled');
        else if (drilldown.filterValue === 'urgent_tasks') sessionStorage.setItem('task_filter_priority', 'vip');
      }
    } catch {}
    setDrilldown(null);
    onNavigate('tasks');
  };

  const loadDashboardData = useCallback(async (filterOverride?: string) => {
    try {
      setError(null);
      const filterToUse = filterOverride !== undefined ? filterOverride : selectedCompanyFilter;
      const res = await api.getDashboardMetrics(filterToUse);

      setDashboardConfig(res.config);
      setWidgetsData(res.widgets || {});
      setChartsData(res.charts || {
        tasks_by_company: [],
        tasks_by_status: [],
        tasks_by_priority: [],
        tasks_by_user: [],
        tasks_over_time: [],
      });
      setRecentTasks(res.recentTasks || []);
      setScopedCompanies(res.allowedCompanies || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedCompanyFilter]);

  // Initial load
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const lastActiveCompanyId = React.useRef(activeCompany?.id);
  // Synchronize dashboard filter whenever activeCompany changes (e.g. from header selector)
  useEffect(() => {
    if (activeCompany?.id && activeCompany.id !== lastActiveCompanyId.current) {
      lastActiveCompanyId.current = activeCompany.id;
      setSelectedCompanyFilter(activeCompany.id);
      setIsRefreshing(true);
      loadDashboardData(activeCompany.id);
    }
  }, [activeCompany?.id, loadDashboardData]); 

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadDashboardData();
  };

  const handleCompanyFilterChange = (companyId: string) => {
    setSelectedCompanyFilter(companyId);
    if (companyId !== 'all') {
      const targetCompany = availableCompanies.find(c => c.id === companyId);
      if (targetCompany) {
        setActiveCompany(targetCompany);
      }
    }
    setIsRefreshing(true);
    loadDashboardData(companyId);
  };

  // Extract enabled widgets and charts sorted by order
  const enabledWidgets = (dashboardConfig?.widgets || [])
    .filter(w => w.enabled)
    .sort((a, b) => a.order - b.order);

  const enabledCharts = (dashboardConfig?.charts || [])
    .filter(c => c.enabled)
    .sort((a, b) => a.order - b.order);

  const currentFilteredCompany = selectedCompanyFilter !== 'all'
    ? (availableCompanies.find(c => c.id === selectedCompanyFilter) || (activeCompany?.id === selectedCompanyFilter ? activeCompany : null))
    : null;

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-slate-200 p-12">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <p className="text-sm font-semibold text-slate-600">
          {isAr ? 'جاري تجميع مؤشرات الأداء والرسوم البيانية...' : 'Synthesizing dashboard metrics & analytics...'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Dynamic Scope Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {t('dashboard.title')}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            {t('dashboard.subtitle')}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Scoped Company Filter Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-200">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[11px] font-bold text-slate-600 hidden sm:inline">
              {t('dashboard.filter_company')}
            </span>
            <select
              value={selectedCompanyFilter}
              onChange={e => handleCompanyFilterChange(e.target.value)}
              className="text-xs font-bold bg-transparent text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">{t('dashboard.all_companies')}</option>
              {scopedCompanies.map(c => (
                <option key={c.id} value={c.id}>
                  {isAr ? c.nameAr : c.nameEn} ({c.code})
                </option>
              ))}
            </select>
          </div>

          {/* Customize Dashboard Button */}
          <button
            onClick={() => setIsCustomizerOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-blue-50 text-blue-700 hover:bg-blue-100/80 border border-blue-200 text-xs font-bold transition-all shadow-2xs"
            title={t('dashboard.customize')}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{t('dashboard.customize')}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-9 h-9 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-all shadow-2xs disabled:opacity-50"
            title={t('action.refresh')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Profile & Customization Banner */}
      <div className="px-5 py-3 rounded-2xl bg-slate-100/80 border border-slate-200 flex flex-wrap items-center justify-between text-xs gap-2">
        <div className="flex items-center gap-2 text-slate-700">
          <Briefcase className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            {t('dashboard.configured_for')}{' '}
            <strong className="text-slate-900 font-black">
              {isAr && user?.fullNameAr ? user.fullNameAr : user?.fullName}
            </strong>
          </span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-500">
            {dashboardConfig?.companyIds?.includes('all')
              ? (isAr ? 'كافة شركات المجموعة' : 'Global Group Scope')
              : `${dashboardConfig?.companyIds?.length || 0} ${isAr ? 'شركات مخصصة' : 'Scoped Companies'}`}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
          <span>{enabledWidgets.length} {t('dashboard.active_widgets')}</span>
          <span>•</span>
          <span>{enabledCharts.length} {t('dashboard.active_charts')}</span>
          {user?.isSuperAdmin && (
            <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold">
              Super Admin Configurator
            </span>
          )}
        </div>
      </div>

      {/* Active Company Highlight Banner */}
      {currentFilteredCompany && (
        <div className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-blue-50/90 to-indigo-50/80 border border-blue-200/80 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-blue-200 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
              {currentFilteredCompany.logoUrl ? (
                <img
                  src={currentFilteredCompany.logoUrl}
                  alt={currentFilteredCompany.nameEn}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Building2 className="w-5 h-5 text-blue-600" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                  {isAr ? 'لوحة معلومات الشركة المحددة' : 'Active Company Dashboard'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-mono font-black">
                  {currentFilteredCompany.code}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-blue-200 text-slate-700 text-[10px] font-bold">
                  {currentFilteredCompany.currency || 'IQD'}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                {isAr ? currentFilteredCompany.nameAr : currentFilteredCompany.nameEn}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCompanyFilterChange('all')}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition-all shadow-2xs"
            >
              {isAr ? 'عرض كافة شركات المجموعة' : 'View All Companies'}
            </button>
            <button
              onClick={() => setIsCompanyDetailOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-2xs"
            >
              {isAr ? 'الملف الكامل للشركة' : 'Full Company Profile'}
            </button>
          </div>
        </div>
      )}

      {/* Render CompanyDetailModal if opened from dashboard */}
      {currentFilteredCompany && (
        <CompanyDetailModal
          isOpen={isCompanyDetailOpen}
          onClose={() => setIsCompanyDetailOpen(false)}
          companyId={currentFilteredCompany.id}
        />
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Dynamic Analytical Charts Grid (الصورة الأولى) */}
      {enabledCharts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              {t('dashboard.charts_section')}
            </h3>
            <span className="text-[11px] text-slate-400">
              {enabledCharts.length} {isAr ? 'مخططات نشطة' : 'Active Charts'}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {enabledCharts.map(chartConfig => {
              switch (chartConfig.key) {
                case 'tasks_by_company':
                  return (
                    <div key={chartConfig.key} className={enabledCharts.length === 1 ? 'lg:col-span-2' : ''}>
                      <TasksByCompanyChart
                        data={chartsData.tasks_by_company || []}
                        onSelectCompany={(companyId, companyName, status) => {
                          openDrilldown({
                            title: isAr ? `مهام شركة: ${companyName}` : `Tasks: ${companyName}`,
                            filterLabel: companyName,
                            filterType: 'company',
                            filterValue: companyId,
                            extraStatus: status,
                          });
                        }}
                      />
                    </div>
                  );
                case 'tasks_by_status':
                  return (
                    <div key={chartConfig.key} className={enabledCharts.length === 1 ? 'lg:col-span-2' : ''}>
                      <TasksByStatusChart
                        data={chartsData.tasks_by_status || []}
                        onSelectStatus={(statusKey, statusName) => {
                          openDrilldown({
                            title: isAr ? `مهام حالة: ${statusName}` : `Tasks: ${statusName}`,
                            filterLabel: statusName,
                            filterType: 'status',
                            filterValue: statusKey,
                          });
                        }}
                      />
                    </div>
                  );
                case 'tasks_by_priority':
                  return (
                    <div key={chartConfig.key} className={enabledCharts.length === 1 ? 'lg:col-span-2' : ''}>
                      <TasksByPriorityChart
                        data={chartsData.tasks_by_priority || []}
                        onSelectPriority={(priorityKey, priorityName) => {
                          openDrilldown({
                            title: isAr ? `مهام أولوية: ${priorityName}` : `Tasks: ${priorityName}`,
                            filterLabel: priorityName,
                            filterType: 'priority',
                            filterValue: priorityKey,
                          });
                        }}
                      />
                    </div>
                  );
                case 'tasks_by_user':
                  return (
                    <div key={chartConfig.key} className={enabledCharts.length === 1 ? 'lg:col-span-2' : ''}>
                      <TasksByUserChart
                        data={chartsData.tasks_by_user || []}
                        onSelectUser={(userId, userName) => {
                          openDrilldown({
                            title: isAr ? `مهام المسؤول: ${userName}` : `Tasks: ${userName}`,
                            filterLabel: userName,
                            filterType: 'user',
                            filterValue: userId,
                          });
                        }}
                      />
                    </div>
                  );
                case 'tasks_over_time':
                  return (
                    <div key={chartConfig.key} className={enabledCharts.length === 1 ? 'lg:col-span-2' : ''}>
                      <TasksOverTimeChart
                        data={chartsData.tasks_over_time || []}
                        onSelectTime={(timeLabel) => {
                          openDrilldown({
                            title: isAr ? `مهام الفترة: ${timeLabel}` : `Tasks for: ${timeLabel}`,
                            filterLabel: timeLabel,
                            filterType: 'all',
                            filterValue: 'all',
                          });
                        }}
                      />
                    </div>
                  );
                default:
                  return null;
              }
            })}
          </div>
        </div>
      )}

      {/* Dynamic Key Metric Widgets Grid (الصورة الثانية) */}
      {enabledWidgets.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              {t('dashboard.widgets_section')}
            </h3>
            <span className="text-[11px] text-slate-400">
              {isAr ? 'ترتيب ديناميكي ومحفوظ بقاعدة البيانات' : 'Dynamic order stored in database'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {enabledWidgets.map(widgetConfig => {
              const val = widgetsData[widgetConfig.key] ?? 0;
              return (
                <WidgetCard
                  key={widgetConfig.key}
                  widgetKey={widgetConfig.key}
                  value={val}
                  onClick={() => {
                    if (widgetConfig.key === 'total_companies') {
                      onNavigate('companies');
                    } else {
                      openDrilldown({
                        title: isAr ? `تفاصيل: ${t(`widget.${widgetConfig.key}`)}` : `Details: ${t(`widget.${widgetConfig.key}`)}`,
                        filterLabel: t(`widget.${widgetConfig.key}`),
                        filterType: 'widget',
                        filterValue: widgetConfig.key,
                      });
                    }
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Tasks & Workflow Highlights Section */}
      {(dashboardConfig?.showRecentTasks ?? true) && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{t('dashboard.recent_tasks')}</h3>
                <p className="text-[11px] text-slate-400">
                  {isAr ? 'أحدث المهام النشطة والمدرجة في نطاقك' : 'Latest active tasks matching your scope'}
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('tasks')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
            >
              <span>{isAr ? 'عرض كافة المهام' : 'View all tasks'}</span>
              <Arrow className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentTasks.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              {isAr ? 'لا توجد مهام نشطة حالياً' : 'No active tasks found in current company scope'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentTasks.map(task => {
                const isVip = task.priority === 'vip' || task.priorityId === 'tp-4';
                const isCompleted = task.status === 'completed' || task.statusId === 'ts-5';
                const isDelayed = task.status === 'delayed' || task.statusId === 'ts-4';

                return (
                  <div
                    key={task.id}
                    onClick={() => onNavigate('tasks')}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 p-2 rounded-2xl transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isCompleted
                            ? 'bg-emerald-50 text-emerald-600'
                            : isDelayed
                            ? 'bg-orange-50 text-orange-600'
                            : 'bg-blue-50 text-blue-600'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Clock className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-slate-400">
                            {task.taskId || task.code || task.id}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {task.title}
                          </span>
                          {isVip && (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 flex items-center gap-1">
                              <Flame className="w-3 h-3 text-purple-600" />
                              VIP
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {task.description || (isAr ? 'لا يوجد وصف تفصيلي' : 'No description provided')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center text-xs">
                      {task.dueDate && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{task.dueDate.substring(0, 10)}</span>
                        </div>
                      )}

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isCompleted
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isDelayed
                            ? 'bg-orange-50 text-orange-700 border border-orange-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {task.status || (isCompleted ? 'Completed' : 'Active')}
                      </span>

                      <ChevronRight className={`w-4 h-4 text-slate-300 ${isAr ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Interactive Chart & Widget Drilldown Modal */}
      {drilldown?.isOpen && (
        <Modal
          isOpen={drilldown.isOpen}
          onClose={() => setDrilldown(null)}
          title={drilldown.title}
          maxWidth="4xl"
        >
          <div className="space-y-4">
            {/* Header info & action button */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                <span className="text-xs font-bold text-slate-700">
                  {isAr ? 'التصنيف المحدد:' : 'Active Filter:'}{' '}
                  <strong className="text-blue-700">{drilldown.filterLabel}</strong>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-mono font-bold">
                  {drilldown.isLoading ? '...' : `${drilldown.tasks.length} ${isAr ? 'مهمة' : 'tasks'}`}
                </span>
              </div>

              <button
                type="button"
                onClick={handleNavigateToTasksWithFilter}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>{isAr ? 'فتح في جدول المهام الكامل' : 'Open in Full Tasks Table'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Content / Task list */}
            {drilldown.isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="text-xs font-semibold">{isAr ? 'جاري جلب المهام...' : 'Loading tasks...'}</span>
              </div>
            ) : drilldown.tasks.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <CheckSquare className="w-8 h-8 text-slate-300" />
                <p className="text-xs font-semibold">
                  {isAr ? 'لا توجد مهام مسجلة تطابق هذه الخانة حالياً' : 'No tasks match this selection'}
                </p>
              </div>
            ) : (
              <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                {drilldown.tasks.map((task: any) => (
                  <div
                    key={task.id}
                    onClick={() => setViewingTaskId(task.id)}
                    className="p-3 bg-white hover:bg-slate-50/90 rounded-2xl border border-slate-200 hover:border-blue-300 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-black px-2.5 py-1 bg-slate-100 group-hover:bg-blue-100 group-hover:text-blue-700 rounded-xl text-slate-800 shrink-0">
                        {task.taskCode || task.id}
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 group-hover:text-blue-600 truncate transition-colors text-xs sm:text-sm">
                          {task.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          {task.company && (
                            <span className="font-medium text-slate-700">
                              {isAr && task.company.nameAr ? task.company.nameAr : task.company.nameEn}
                            </span>
                          )}
                          {task.assignedUser && (
                            <>
                              <span>•</span>
                              <span>
                                {isAr && task.assignedUser.fullNameAr ? task.assignedUser.fullNameAr : task.assignedUser.fullName}
                              </span>
                            </>
                          )}
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

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          task.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : task.status === 'delayed'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : task.status === 'in_progress'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {task.status}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingTaskId(task.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title={isAr ? 'عرض التفاصيل' : 'View details'}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDrilldown(null)}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                {t('action.close')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Task Detail Modal when opened from drilldown or recent tasks */}
      {viewingTaskId && (
        <TaskDetailModal
          taskId={viewingTaskId}
          onClose={() => setViewingTaskId(null)}
          onTaskUpdated={() => {
            handleRefresh();
          }}
        />
      )}

      {/* Dashboard Customization Modal */}
      <DashboardCustomizerModal
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        onSaved={() => {
          handleRefresh();
        }}
        currentConfig={dashboardConfig}
        companies={availableCompanies}
      />
    </div>
  );
};
