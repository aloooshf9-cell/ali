import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { PermissionKey } from '../../types/permissions';
import {
  ReportType,
  ReportFilterParams,
  ReportQueryResult,
  ReportExportFieldKey,
  REPORT_EXPORT_FIELDS,
} from '../../types/reports';
import { Company, User } from '../../types/database';
import { ReportFilters } from './ReportFilters';
import { SelectFieldsModal } from './SelectFieldsModal';
import { PrintableReportView } from './PrintableReportView';
import { CompanyAnalysisView } from './CompanyAnalysisView';
import { generateReportPdf } from '../../utils/pdfExport';
import {
  Building2,
  CheckSquare,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Clock,
  Sparkles,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  RefreshCw,
  Layers,
  ArrowUpRight,
  TrendingUp,
  AlertCircle,
  BarChart3,
  Calendar,
  PieChart as PieChartIcon,
  X,
} from 'lucide-react';

export type ReportTabType = ReportType | 'company_analysis';

const REPORT_TABS: Array<{ id: ReportTabType; key: string; labelAr: string; labelEn: string; icon: any }> = [
  { id: 'company_report', key: 'reports.tab_company', labelAr: 'تقرير الشركات', labelEn: 'Company Report', icon: Building2 },
  { id: 'company_analysis', key: 'reports.tab_analysis', labelAr: 'تحليل ومقارنة الشركات', labelEn: 'Company Analysis', icon: BarChart3 },
];

export const ReportDashboard: React.FC = () => {
  const { t, language } = useI18n();
  const { hasPermission, user } = useAuth();
  const isAr = language === 'ar';

  const [activeReportType, setActiveReportType] = useState<ReportTabType>('company_report');
  const [filters, setFilters] = useState<ReportFilterParams>({});
  const [kpiFilter, setKpiFilter] = useState<'all' | 'completed' | 'in_progress' | 'delayed' | 'overdue' | 'paused'>('all');
  const [reportData, setReportData] = useState<ReportQueryResult | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Field Selection Modal State
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel');

  // Printable Document Preview Modal State
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [selectedFieldsForPrint, setSelectedFieldsForPrint] = useState<ReportExportFieldKey[]>(() =>
    REPORT_EXPORT_FIELDS.filter(f => f.defaultSelected).map(f => f.key)
  );

  // Fetch reference metadata (companies and users)
  useEffect(() => {
    async function fetchMetadata() {
      try {
        const [compRes, usersRes] = await Promise.allSettled([
          api.getCompanies(),
          api.getUsers(),
        ]);
        if (compRes.status === 'fulfilled') {
          setCompanies(compRes.value.companies || []);
        }
        if (usersRes.status === 'fulfilled') {
          setUsers(usersRes.value.users || []);
        }
      } catch (err: any) {
        console.error('Failed to load companies/users for reports:', err);
      }
    }
    fetchMetadata();
  }, []);

  // Fetch report data from authoritative backend
  const loadReportData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const queryType: ReportType = activeReportType === 'company_analysis' ? 'company_report' : activeReportType;
      const data = await api.queryReports(queryType, filters);
      setReportData(data);
    } catch (err: any) {
      console.error('Report query failed:', err);
      setError(err.message || 'Failed to query report data');
    } finally {
      setIsLoading(false);
    }
  }, [activeReportType, filters]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const handleResetFilters = () => {
    setFilters({});
  };

  const handleOpenExportModal = (format: 'excel' | 'pdf') => {
    setExportFormat(format);
    setIsFieldModalOpen(true);
  };

  const handleConfirmExport = async (selectedFields: ReportExportFieldKey[], selectedManagerId?: string) => {
    if (!reportData) return;
    setIsExporting(true);
    const exportType: ReportType = activeReportType === 'company_analysis' ? 'company_report' : activeReportType;
    
    // Determine if user selected a specific manager in the modal
    const isSpecificManager = Boolean(selectedManagerId && selectedManagerId !== 'all');
    const selectedUser = isSpecificManager ? users.find(u => u.id === selectedManagerId) : undefined;
    const selectedManagerName = selectedUser
      ? (isAr ? (selectedUser.fullNameAr || selectedUser.fullName) : selectedUser.fullName)
      : undefined;

    const exportFilters = { ...filters };
    if (isSpecificManager && selectedManagerId) {
      exportFilters.managerIds = [selectedManagerId];
      exportFilters.assignedToId = selectedManagerId;
    }

    try {
      if (exportFormat === 'excel') {
        await api.exportReportExcel({
          reportType: exportType,
          filters: exportFilters,
          selectedFields,
          language: isAr ? 'ar' : 'en',
        });
        setIsFieldModalOpen(false);
      } else {
        // PDF Export
        setSelectedFieldsForPrint(selectedFields);
        setIsFieldModalOpen(false);

        // Prepare report data strictly for this manager if specified
        let dataToExport = reportData;
        if (isSpecificManager && selectedManagerId) {
          try {
            const specificData = await api.queryReports(exportType, exportFilters);
            if (specificData && specificData.tasks) {
              dataToExport = specificData;
            }
          } catch (e) {
            console.warn('Could not query backend for specific manager data, falling back to local filtering:', e);
          }

          // In all cases, guarantee rigorous filtering for the target manager
          const rawTasks = dataToExport.tasks || reportData.tasks || [];
          const matchPool = new Set([
            selectedManagerId,
            selectedManagerId.toLowerCase(),
            selectedUser?.fullName?.trim(),
            selectedUser?.fullName?.trim().toLowerCase(),
            selectedUser?.fullNameAr?.trim(),
            selectedUser?.email?.trim().toLowerCase(),
          ].filter(Boolean));

          const filteredTasks = rawTasks.filter((t: any) => {
            const assignedId = t.assignedToId || t.assigneeId;
            const assignedName = t.assignedTo?.fullName || t.assignedToName;
            const assignedNameAr = t.assignedTo?.fullNameAr || t.assignedToNameAr;
            const resp = t.responsiblePersonId || t.responsiblePerson?.fullName;
            const creator = t.creatorId || t.creator?.fullName;

            return (
              (assignedId && matchPool.has(String(assignedId))) ||
              (assignedId && matchPool.has(String(assignedId).toLowerCase())) ||
              (t.assigneeId && matchPool.has(String(t.assigneeId))) ||
              (t.assignedToId && matchPool.has(String(t.assignedToId))) ||
              (assignedName && matchPool.has(String(assignedName).trim())) ||
              (assignedNameAr && matchPool.has(String(assignedNameAr).trim())) ||
              (resp && matchPool.has(String(resp))) ||
              (creator && matchPool.has(String(creator)))
            );
          });

          dataToExport = {
            ...dataToExport,
            tasks: filteredTasks,
            filteredCount: filteredTasks.length,
            appliedFilters: {
              ...dataToExport.appliedFilters,
              managerName: selectedManagerName,
            },
            summary: {
              totalTasks: filteredTasks.length,
              completedTasks: filteredTasks.filter((t: any) => t.status === 'completed').length,
              inProgressTasks: filteredTasks.filter((t: any) => t.status === 'in_progress').length,
              delayedTasks: filteredTasks.filter((t: any) => t.status === 'delayed' || t.isDelayed).length,
              overdueTasks: filteredTasks.filter((t: any) => t.daysOverdue > 0).length,
            },
          };
        }

        // Generate and download client PDF via jspdf with executive formatting
        generateReportPdf(dataToExport, selectedFields, isAr, selectedManagerName);

        // Log backend audit
        await api.exportReportPdfData({
          reportType: exportType,
          filters: exportFilters,
          selectedFields,
        });
      }
    } catch (err: any) {
      alert(`Export failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenPrintPreview = () => {
    setIsPrintPreviewOpen(true);
  };

  // Keep export capabilities always enabled and visible for all authorized team members
  const canExport = true;

  // Real-time quick filtering of records when clicking on KPI boxes
  const displayedTasks = useMemo(() => {
    if (!reportData?.tasks) return [];
    if (kpiFilter === 'completed') {
      return reportData.tasks.filter((t) => t.status === 'completed');
    }
    if (kpiFilter === 'in_progress') {
      return reportData.tasks.filter((t) => t.status === 'in_progress');
    }
    if (kpiFilter === 'delayed') {
      return reportData.tasks.filter((t) => t.status === 'delayed');
    }
    if (kpiFilter === 'overdue') {
      return reportData.tasks.filter(
        (t) => t.daysOverdue > 0 && t.status !== 'completed' && t.status !== 'cancelled'
      );
    }
    if (kpiFilter === 'paused') {
      return reportData.tasks.filter((t) => t.status === 'paused');
    }
    return reportData.tasks;
  }, [reportData?.tasks, kpiFilter]);

  const handleKpiCardClick = (type: 'all' | 'completed' | 'in_progress' | 'delayed' | 'overdue' | 'paused') => {
    setKpiFilter((prev) => (prev === type ? 'all' : type));
    setTimeout(() => {
      const tableEl = document.getElementById('report-records-table');
      if (tableEl) {
        tableEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              {isAr ? 'نظام التقارير والرقابة التشغيلية' : 'Executive Reporting Engine'}
            </span>
            <span className="text-xs font-medium text-slate-400">•</span>
            <span className="text-xs font-medium text-slate-500">
              {isAr ? 'معتمد ومحمي بالصلاحيات' : 'Audited & RBAC Protected'}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{t('reports.title')}</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">{t('reports.subtitle')}</p>
        </div>

        {/* Global Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={loadReportData}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            title={t('action.refresh')}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleOpenPrintPreview}
            disabled={isLoading || !reportData}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition-all flex items-center gap-2"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>{t('reports.print_report')}</span>
          </button>

          {canExport && (
            <>
              <button
                type="button"
                onClick={() => handleOpenExportModal('excel')}
                disabled={isLoading || !reportData?.tasks || reportData.tasks.length === 0}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{t('reports.export_excel')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenExportModal('pdf')}
                disabled={isLoading || !reportData?.tasks || reportData.tasks.length === 0}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                <FileText className="w-4 h-4" />
                <span>{t('reports.export_pdf')}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 8 Report Types Tab Navigation Bar */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200 shadow-sm overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 min-w-max">
          {REPORT_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeReportType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveReportType(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{isAr ? tab.labelAr : tab.labelEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeReportType === 'company_analysis' ? (
        <CompanyAnalysisView
          companies={companies}
          users={users}
          reportData={reportData}
          isLoading={isLoading}
          onFilterByCompany={(companyId) => {
            setFilters({ ...filters, companyId });
            setActiveReportType('company_report');
          }}
        />
      ) : (
        <>
          {/* Advanced Multi-Filters Component */}
          <ReportFilters
            filters={filters}
            onChangeFilters={setFilters}
            onApply={loadReportData}
            onReset={handleResetFilters}
            companies={companies}
            users={users}
            totalMatches={reportData?.tasks?.length || 0}
            isLoading={isLoading}
          />

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <p className="font-semibold">{error}</p>
            </div>
          )}

          {/* KPI Summary Cards (Pure numbers and counts, strictly NO progress percentage) */}
          {reportData && reportData.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <button
                type="button"
                onClick={() => handleKpiCardClick('all')}
                title={isAr ? 'انقر لعرض كافة السجلات' : 'Click to show all records'}
                className={`text-start bg-white rounded-2xl p-4 border transition-all cursor-pointer hover:shadow-md hover:scale-[1.02] ${
                  kpiFilter === 'all'
                    ? 'border-slate-800 ring-2 ring-slate-800/80 shadow-md'
                    : 'border-slate-200 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    {t('reports.total_tasks')}
                  </span>
                  {kpiFilter === 'all' && (
                    <span className="w-2 h-2 rounded-full bg-slate-800 animate-pulse" />
                  )}
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900">{reportData.summary?.totalTasks ?? 0}</span>
                  <span className="text-xs font-semibold text-slate-400">
                    {isAr ? 'سجل' : 'records'}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleKpiCardClick('completed')}
                title={isAr ? 'انقر لعرض المهام المنجزة' : 'Click to show completed tasks'}
                className={`text-start rounded-2xl p-4 border transition-all cursor-pointer hover:shadow-md hover:scale-[1.02] bg-gradient-to-br from-white to-emerald-50/30 ${
                  kpiFilter === 'completed'
                    ? 'border-emerald-600 ring-2 ring-emerald-600/80 shadow-md'
                    : 'border-emerald-200/80 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                    {t('reports.completed_tasks')}
                  </span>
                  {kpiFilter === 'completed' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  )}
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-emerald-700">{reportData.summary?.completedTasks ?? 0}</span>
                  <span className="text-xs font-bold text-emerald-600">
                    {isAr ? 'مكتملة' : 'done'}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleKpiCardClick('in_progress')}
                title={isAr ? 'انقر لعرض المهام قيد التنفيذ' : 'Click to show in-progress tasks'}
                className={`text-start rounded-2xl p-4 border transition-all cursor-pointer hover:shadow-md hover:scale-[1.02] bg-gradient-to-br from-white to-blue-50/30 ${
                  kpiFilter === 'in_progress'
                    ? 'border-blue-600 ring-2 ring-blue-600/80 shadow-md'
                    : 'border-blue-200/80 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
                    {t('reports.in_progress_tasks')}
                  </span>
                  {kpiFilter === 'in_progress' && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                  )}
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-blue-700">{reportData.summary?.inProgressTasks ?? 0}</span>
                  <span className="text-xs font-semibold text-blue-500">
                    {isAr ? 'نشطة' : 'active'}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleKpiCardClick('delayed')}
                title={isAr ? 'انقر لعرض المهام المتأخرة' : 'Click to show delayed tasks'}
                className={`text-start rounded-2xl p-4 border transition-all cursor-pointer hover:shadow-md hover:scale-[1.02] bg-gradient-to-br from-white to-amber-50/30 ${
                  kpiFilter === 'delayed'
                    ? 'border-amber-600 ring-2 ring-amber-600/80 shadow-md'
                    : 'border-amber-200/80 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                    {t('reports.delayed_tasks')}
                  </span>
                  {kpiFilter === 'delayed' && (
                    <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                  )}
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-amber-700">{reportData.summary?.delayedTasks ?? 0}</span>
                  <span className="text-xs font-semibold text-amber-600">
                    {isAr ? 'متأخرة' : 'delayed'}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleKpiCardClick('overdue')}
                title={isAr ? 'انقر لعرض المهام التي تجاوزت الموعد' : 'Click to show overdue tasks'}
                className={`text-start rounded-2xl p-4 border transition-all cursor-pointer hover:shadow-md hover:scale-[1.02] bg-gradient-to-br from-white to-rose-50/30 ${
                  kpiFilter === 'overdue'
                    ? 'border-rose-600 ring-2 ring-rose-600/80 shadow-md'
                    : 'border-rose-200/80 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">
                    {t('reports.overdue_tasks')}
                  </span>
                  {kpiFilter === 'overdue' && (
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                  )}
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-rose-700">{reportData.summary?.overdueTasks ?? 0}</span>
                  <span className="text-xs font-bold text-rose-600">
                    {isAr ? 'حرجة' : 'critical'}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleKpiCardClick('paused')}
                title={isAr ? 'انقر لعرض المهام المتوقفة مؤقتاً' : 'Click to show paused tasks'}
                className={`text-start rounded-2xl p-4 border transition-all cursor-pointer hover:shadow-md hover:scale-[1.02] bg-gradient-to-br from-white to-purple-50/30 ${
                  kpiFilter === 'paused'
                    ? 'border-purple-600 ring-2 ring-purple-600/80 shadow-md'
                    : 'border-purple-200/80 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider block">
                    {isAr ? 'المتوقفة مؤقتاً' : 'Paused Tasks'}
                  </span>
                  {kpiFilter === 'paused' && (
                    <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
                  )}
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-purple-700">{reportData.summary?.pausedTasks ?? 0}</span>
                  <span className="text-xs font-semibold text-purple-500">
                    {reportData.summary?.avgTurnaroundDays ? `${reportData.summary.avgTurnaroundDays}d avg` : 'SLA'}
                  </span>
                </div>
              </button>
            </div>
          )}

          {/* Group Breakdown Section */}
          {reportData?.groupBreakdown && reportData.groupBreakdown.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-slate-900 text-sm">{t('reports.breakdown_title')}</h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {reportData.groupBreakdown?.length || 0} {isAr ? 'عناصر تحليلية' : 'segments'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {reportData.groupBreakdown.map(item => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-xs transition-all bg-slate-50/50 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-bold text-slate-900 text-sm leading-tight">
                          {isAr ? item.labelAr : item.labelEn}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/70 text-slate-700 font-mono">
                          {item.key}
                        </span>
                      </div>
                      {item.subLabel && (
                        <p className="text-xs text-slate-500 mb-3">{item.subLabel}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">{isAr ? 'المهام الإجمالية:' : 'Total Tasks:'}</span>
                        <span className="font-black text-slate-900">{item.total}</span>
                      </div>

                      {/* Visual Status Segments Bar */}
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
                        {item.total > 0 && item.completed > 0 && (
                          <div
                            style={{ width: `${Math.round((item.completed / item.total) * 100)}%` }}
                            className="bg-emerald-500 h-full transition-all duration-300"
                            title={`Completed: ${item.completed}`}
                          />
                        )}
                        {item.total > 0 && item.inProgress > 0 && (
                          <div
                            style={{ width: `${Math.round((item.inProgress / item.total) * 100)}%` }}
                            className="bg-blue-600 h-full transition-all duration-300"
                            title={`In Progress: ${item.inProgress}`}
                          />
                        )}
                        {item.total > 0 && item.delayed > 0 && (
                          <div
                            style={{ width: `${Math.round((item.delayed / item.total) * 100)}%` }}
                            className="bg-amber-500 h-full transition-all duration-300"
                            title={`Delayed: ${item.delayed}`}
                          />
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-emerald-700 font-semibold">
                          {isAr ? `مكتمل: ${item.completed}` : `Done: ${item.completed}`}
                        </span>
                        <span className="text-blue-600 font-semibold">
                          {isAr ? `نشطة: ${item.inProgress}` : `Active: ${item.inProgress}`}
                        </span>
                        {item.overdue > 0 && (
                          <span className="text-rose-600 font-bold">
                            {isAr ? `متأخر: ${item.overdue}` : `Overdue: ${item.overdue}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

      {/* Filtered Records Data Table */}
      <div id="report-records-table" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-6">
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm">{t('reports.records_table_title')}</h3>
              {reportData && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-600 text-white font-mono">
                  {displayedTasks.length}
                  {kpiFilter !== 'all' && (
                    <span className="opacity-80 font-normal ms-1 text-[11px]">
                      /{reportData.tasks?.length || 0}
                    </span>
                  )}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAr
                ? 'السجلات الفعلية المفلترة الجاهزة للتصدير والتحليل والمطابقة'
                : 'Authoritative data records strictly matching your active filter criteria'}
            </p>

            {/* Quick KPI Active Filter Indicator */}
            {kpiFilter !== 'all' && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 font-bold flex items-center gap-1.5 shadow-xs">
                  <span>
                    {isAr
                      ? `تصفية نشطة للمحتوى: ${
                          kpiFilter === 'completed'
                            ? 'المهام المنجزة'
                            : kpiFilter === 'in_progress'
                            ? 'المهام قيد التنفيذ'
                            : kpiFilter === 'delayed'
                            ? 'المهام المتأخرة'
                            : kpiFilter === 'overdue'
                            ? 'المهام التي تجاوزت الاستحقاق'
                            : 'المهام المتوقفة مؤقتاً'
                        } (${displayedTasks.length} سجل)`
                      : `Active Filter: ${kpiFilter.replace('_', ' ')} (${displayedTasks.length} records)`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setKpiFilter('all')}
                    className="hover:bg-blue-200 rounded p-0.5 text-blue-800 transition-colors"
                    title={isAr ? 'إلغاء التصفية وعرض كافة المهام' : 'Clear filter'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
                <button
                  type="button"
                  onClick={() => setKpiFilter('all')}
                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-semibold"
                >
                  {isAr ? 'عرض الكل' : 'Show All'}
                </button>
              </div>
            )}
          </div>

          <div className="text-xs font-semibold text-slate-500">
            {reportData?.appliedFilters?.companyName && (
              <span>{reportData.appliedFilters.companyName} • </span>
            )}
            <span>{isAr ? 'بيانات مؤكدة من الخادم' : 'Server-Verified Authenticity'}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="p-3.5 text-start">{isAr ? 'المعرف' : 'Task ID'}</th>
                <th className="p-3.5 text-start">{isAr ? 'العنوان' : 'Title'}</th>
                <th className="p-3.5 text-start">{isAr ? 'الشركة' : 'Company'}</th>
                <th className="p-3.5 text-start">{isAr ? 'المسؤول' : 'Assigned To'}</th>
                <th className="p-3.5 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="p-3.5 text-start">{isAr ? 'الأولوية' : 'Priority'}</th>
                <th className="p-3.5 text-start">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                <th className="p-3.5 text-start">{isAr ? 'الإنشاء' : 'Created'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-medium text-slate-500">
                        {isAr ? 'جاري استخراج وتجميع بيانات التقرير...' : 'Compiling report records...'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : !reportData?.tasks || reportData.tasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400 font-medium">
                    <div className="max-w-sm mx-auto flex flex-col items-center gap-2">
                      <Clock className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-700">{t('reports.no_records_found')}</p>
                      <p className="text-xs text-slate-400">
                        {isAr ? 'جرب تغيير أو إزالة بعض الفلاتر لعرض نتائج أوسع' : 'Try adjusting your filters'}
                      </p>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-800"
                      >
                        {t('reports.clear_filters')}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : displayedTasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-500 font-medium">
                    <div className="max-w-sm mx-auto flex flex-col items-center gap-2">
                      <AlertCircle className="w-7 h-7 text-amber-500" />
                      <p className="font-semibold text-slate-800">
                        {isAr ? 'لا توجد مهام تطابق التصفية السريعة المحددة' : 'No tasks match this KPI filter'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setKpiFilter('all')}
                        className="mt-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        {isAr ? 'عرض كافة المهام' : 'Show All Tasks'}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedTasks.map((task: any, idx: number) => (
                  <tr key={task.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-blue-700 whitespace-nowrap">
                      {task.taskCode}
                    </td>
                    <td className="p-3.5 font-semibold text-slate-900 max-w-xs">
                      <div className="truncate" title={task.title}>
                        {task.title}
                      </div>
                      {task.statusReason && (
                        <p className="text-[10px] text-amber-700 line-clamp-1 mt-0.5 font-normal">
                          {task.statusReason}
                        </p>
                      )}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">
                        {isAr ? task.companyNameAr : task.companyNameEn}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">({task.companyCode})</span>
                    </td>
                    <td className="p-3.5 whitespace-nowrap text-slate-700">
                      {isAr ? task.assignedToNameAr || task.assignedToName : task.assignedToName}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          task.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : task.status === 'delayed'
                            ? 'bg-amber-100 text-amber-800'
                            : task.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800'
                            : task.status === 'paused'
                            ? 'bg-slate-100 text-slate-700'
                            : task.status === 'cancelled'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {isAr ? task.statusLabelAr : task.statusLabelEn}
                      </span>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      {(() => {
                        const pSlug = String(task.priority || (task.priorityId === 'tp-4' ? 'vip' : task.priorityId === 'tp-3' ? 'high' : task.priorityId === 'tp-1' ? 'low' : 'medium')).toLowerCase();
                        const pLabel = isAr
                          ? (task.priorityLabelAr && (pSlug === 'medium' || !task.priorityLabelAr.includes('متوسط'))
                              ? task.priorityLabelAr
                              : (pSlug === 'vip' || pSlug === 'urgent' || pSlug === 'critical' ? 'أولوية قصوى (VIP)' : pSlug === 'high' ? 'عالية' : pSlug === 'low' ? 'منخفضة' : 'متوسطة'))
                          : (task.priorityLabelEn && (pSlug === 'medium' || !task.priorityLabelEn.includes('Medium'))
                              ? task.priorityLabelEn
                              : (pSlug === 'vip' || pSlug === 'urgent' || pSlug === 'critical' ? 'VIP' : pSlug === 'high' ? 'High' : pSlug === 'low' ? 'Low' : 'Medium'));
                        return (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              pSlug === 'vip' || pSlug === 'urgent' || pSlug === 'critical'
                                ? 'bg-rose-100 text-rose-800'
                                : pSlug === 'high'
                                ? 'bg-orange-100 text-orange-800'
                                : pSlug === 'medium'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {pLabel}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span
                        className={`font-mono text-xs ${
                          task.daysOverdue > 0 ? 'text-rose-600 font-black' : 'text-slate-600'
                        }`}
                      >
                        {task.dueDate || '-'}
                      </span>
                      {task.daysOverdue > 0 && (
                        <span className="block text-[10px] text-rose-600 font-bold">
                          +{task.daysOverdue} {isAr ? 'يوم تأخير' : 'days overdue'}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {task.createdAt}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* Field Selection Modal before Exporting */}
      <SelectFieldsModal
        isOpen={isFieldModalOpen}
        onClose={() => setIsFieldModalOpen(false)}
        exportFormat={exportFormat}
        totalFilteredRecords={reportData?.tasks?.length || 0}
        onConfirm={handleConfirmExport}
        isLoading={isExporting}
        users={users}
        currentManagerId={filters.assignedToId || (filters.managerIds && filters.managerIds[0]) || 'all'}
      />

      {/* Printable Report Document Preview */}
      {reportData && (
        <PrintableReportView
          isOpen={isPrintPreviewOpen}
          onClose={() => setIsPrintPreviewOpen(false)}
          reportData={reportData}
          selectedFields={selectedFieldsForPrint}
          onDownloadPdfFile={() => generateReportPdf(reportData, selectedFieldsForPrint, isAr, reportData.appliedFilters?.managerName)}
        />
      )}
    </div>
  );
};
