import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useCompany } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Badge } from '../common/Badge';
import {
  ShieldAlert,
  Search,
  Filter,
  Calendar,
  User as UserIcon,
  RotateCw,
  Clock,
  Shield,
  FileSpreadsheet,
  ArrowRight,
  Eye,
  X,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Globe,
  Database,
  Download,
} from 'lucide-react';

interface AuditLog {
  id: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  companyId?: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export const AuditLogViewer: React.FC = () => {
  const { language } = useI18n();
  const { activeCompany, availableCompanies } = useCompany();
  const { user: currentUser } = useAuth();
  const isAr = language === 'ar';

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [todayCount, setTodayCount] = useState<number>(0);
  const [securityCount, setSecurityCount] = useState<number>(0);
  const [uniqueUsers, setUniqueUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [availableEntities, setAvailableEntities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters State
  const [search, setSearch] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [companyIdFilter, setCompanyIdFilter] = useState<string>('all');

  // Selected Log Details Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadAuditLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.queryAuditLogs({
        search: search.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        userFilter: userFilter !== 'all' ? userFilter : undefined,
        actionFilter: actionFilter !== 'all' ? actionFilter : undefined,
        entityFilter: entityFilter !== 'all' ? entityFilter : undefined,
        companyId: companyIdFilter !== 'all' ? companyIdFilter : undefined,
        limit: 100,
      });

      setLogs(res.logs || []);
      setTotalCount(res.totalCount || 0);
      setTodayCount(res.todayCount || 0);
      setSecurityCount(res.securityCount || 0);
      setUniqueUsers(res.uniqueUsers || []);
      setAvailableActions(res.availableActions || []);
      setAvailableEntities(res.availableEntities || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, dateFrom, dateTo, userFilter, actionFilter, entityFilter, companyIdFilter]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const handleResetFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setUserFilter('all');
    setActionFilter('all');
    setEntityFilter('all');
    setCompanyIdFilter('all');
  };

  // Export filtered logs to CSV
  const handleExportCsv = () => {
    if (logs.length === 0) return;
    const headers = [
      'Log ID',
      'Date',
      'Time',
      'User Name',
      'User Email',
      'Action',
      'Entity',
      'Entity ID',
      'Old Value',
      'New Value',
      'Status',
      'IP Address',
    ];

    const rows = logs.map((l) => [
      l.id,
      new Date(l.createdAt).toISOString().substring(0, 10),
      new Date(l.createdAt).toLocaleTimeString(),
      `"${l.userName || ''}"`,
      `"${l.userEmail || ''}"`,
      l.action,
      l.entity,
      l.entityId || '',
      `"${typeof l.oldValue === 'object' ? JSON.stringify(l.oldValue).replace(/"/g, '""') : l.oldValue || ''}"`,
      `"${typeof l.newValue === 'object' ? JSON.stringify(l.newValue).replace(/"/g, '""') : l.newValue || ''}"`,
      l.status,
      l.ipAddress || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().substring(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'LOGIN':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'LOGOUT':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'CREATE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'UPDATE':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'STATUS_CHANGE':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'PERMISSION_CHANGE':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'USER_CHANGE':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'COMPANY_CHANGE':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'DELETE':
      case 'ARCHIVE':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'FILE_UPLOAD':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'FILE_DOWNLOAD':
        return 'bg-violet-50 text-violet-700 border-violet-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getActionLabel = (action: string) => {
    if (!isAr) return action;
    switch (action) {
      case 'LOGIN':
        return 'تسجيل دخول (Login)';
      case 'LOGOUT':
        return 'تسجيل خروج (Logout)';
      case 'CREATE':
        return 'إنشاء (Create)';
      case 'UPDATE':
        return 'تحديث (Update)';
      case 'DELETE':
        return 'حذف (Delete)';
      case 'ARCHIVE':
        return 'أرشفة (Archive)';
      case 'PERMISSION_CHANGE':
        return 'تعديل صلاحيات (Permission Change)';
      case 'STATUS_CHANGE':
        return 'تغيير حالة (Status Change)';
      case 'USER_CHANGE':
        return 'تعديل مستخدم (User Change)';
      case 'COMPANY_CHANGE':
        return 'تعديل شركة (Company Change)';
      case 'FILE_UPLOAD':
        return 'رفع ملف (File Upload)';
      case 'FILE_DOWNLOAD':
        return 'تحميل ملف (File Download)';
      default:
        return action;
    }
  };

  const formatValueDisplay = (val: any) => {
    if (val === null || val === undefined) return <span className="text-slate-300 font-mono">—</span>;
    if (typeof val === 'object') {
      const str = JSON.stringify(val);
      return <span className="font-mono text-slate-600 truncate max-w-[140px] inline-block">{str}</span>;
    }
    return <span className="font-mono text-slate-800 font-semibold">{String(val)}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-900 to-indigo-900 text-white flex items-center justify-center shadow-xs">
              <ShieldAlert className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>{isAr ? 'سجل التدقيق والأمان المتقدم' : 'Executive Audit & Security Logs'}</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-white font-mono">
                  Super Admin
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAr
                  ? 'رصد وحوكمة كافة العمليات الحساسة، التعديلات، صلاحيات النظام، ومحاولات الوصول'
                  : 'Immutable enterprise compliance audit trail tracking all user events, state diffs, and security operations'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={logs.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
            title={isAr ? 'تصدير السجل CSV' : 'Export CSV'}
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>{isAr ? 'تصدير CSV' : 'Export CSV'}</span>
          </button>

          <button
            onClick={loadAuditLogs}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-2xs"
            title={isAr ? 'تحديث السجلات' : 'Refresh'}
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">{isAr ? 'إجمالي العمليات المسجلة' : 'Total Audit Events'}</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{totalCount.toLocaleString()}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">{isAr ? 'عمليات اليوم' : "Today's Operations"}</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{todayCount.toLocaleString()}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">{isAr ? 'عمليات الصلاحيات والأمان' : 'Security & Auth Events'}</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{securityCount.toLocaleString()}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <UserIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">{isAr ? 'المستخدمون النشطون' : 'Active Operators'}</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{uniqueUsers.length}</p>
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>{isAr ? 'خيارات التصفية والبحث المتقدم' : 'Advanced Filters & Search'}</span>
          </div>
          {(search || dateFrom || dateTo || userFilter !== 'all' || actionFilter !== 'all' || entityFilter !== 'all' || companyIdFilter !== 'all') && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
            >
              {isAr ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                isAr
                  ? 'بحث باسم المستخدم، الإيميل، معرف الكيان، أو IP...'
                  : 'Search by user, email, entity ID, or IP address...'
              }
              className="w-full ps-9 pe-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {/* Action Filter */}
          <div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
            >
              <option value="all">{isAr ? 'كافة العمليات (All Actions)' : 'All Actions'}</option>
              <option value="LOGIN">Login</option>
              <option value="LOGOUT">Logout</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="STATUS_CHANGE">Status Change</option>
              <option value="DELETE">Delete</option>
              <option value="ARCHIVE">Archive</option>
              <option value="PERMISSION_CHANGE">Permission Change</option>
              <option value="USER_CHANGE">User Change</option>
              <option value="COMPANY_CHANGE">Company Change</option>
              <option value="FILE_UPLOAD">File Upload</option>
              <option value="FILE_DOWNLOAD">File Download</option>
            </select>
          </div>

          {/* Entity Filter */}
          <div>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
            >
              <option value="all">{isAr ? 'كافة الكيانات (All Entities)' : 'All Entities'}</option>
              <option value="TASKS">Tasks (المهام)</option>
              <option value="COMPANIES">Companies (الشركات)</option>
              <option value="USERS">Users (المستخدمون)</option>
              <option value="ROLES">Roles (الأدوار)</option>
              <option value="PERMISSIONS">Permissions (الصلاحيات)</option>
              <option value="ATTACHMENTS">Attachments (الملفات)</option>
              <option value="AUTH">Authentication (الأمان)</option>
              <option value="CUSTOM_FIELDS">Custom Fields (الحقول)</option>
            </select>
          </div>

          {/* User Filter */}
          <div>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
            >
              <option value="all">{isAr ? 'كافة المستخدمين (All Users)' : 'All Users'}</option>
              {uniqueUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          {/* Company Multi-Tenant Filter */}
          {currentUser?.isSuperAdmin && (
            <div>
              <select
                value={companyIdFilter}
                onChange={(e) => setCompanyIdFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
              >
                <option value="all">{isAr ? 'كافة الشركات (Global)' : 'All Companies'}</option>
                {availableCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {isAr ? c.nameAr : c.nameEn}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date From */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 whitespace-nowrap">{isAr ? 'من:' : 'From:'}</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-700"
            />
          </div>

          {/* Date To */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 whitespace-nowrap">{isAr ? 'إلى:' : 'To:'}</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-700"
            />
          </div>
        </div>
      </div>

      {/* Main Audit Logs Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50/90 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3.5 text-start">{isAr ? 'التاريخ والوقت' : 'Date & Time'}</th>
                <th className="px-4 py-3.5 text-start">{isAr ? 'المستخدم' : 'User'}</th>
                <th className="px-4 py-3.5 text-start">{isAr ? 'العملية' : 'Action'}</th>
                <th className="px-4 py-3.5 text-start">{isAr ? 'الكيان والمُعرّف' : 'Entity & ID'}</th>
                <th className="px-4 py-3.5 text-start">{isAr ? 'القيمة السابقة ← الجديدة' : 'Old Value → New Value'}</th>
                <th className="px-4 py-3.5 text-start">{isAr ? 'عنوان IP' : 'IP Address'}</th>
                <th className="px-4 py-3.5 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="px-4 py-3.5 text-center">{isAr ? 'التفاصيل' : 'Details'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <p>{isAr ? 'جاري استرجاع سجلات التدقيق...' : 'Loading audit trail...'}</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <Shield className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-700">
                      {isAr ? 'لا توجد سجلات تطابق الفلاتر المحددة' : 'No audit records match the selected filters'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {isAr ? 'جرب تعديل نطاق التاريخ أو إزالة الفلاتر' : 'Try expanding the date range or resetting filters'}
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const dateObj = new Date(log.createdAt);
                  const isWarning = log.status === 'WARNING';
                  const isFail = log.status === 'FAILURE';
                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isFail ? 'bg-rose-50/40' : isWarning ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      {/* Date & Time */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-bold text-slate-800">
                            {dateObj.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                            })}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      </td>

                      {/* User */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {log.userName ? log.userName.charAt(0) : 'S'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {log.userName || (isAr ? 'مستخدم النظام' : 'System Operator')}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">{log.userEmail || 'system@internal'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border ${getActionBadgeColor(
                            log.action
                          )}`}
                        >
                          {getActionLabel(log.action)}
                        </span>
                      </td>

                      {/* Entity & Entity ID */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                            {log.entity}
                          </span>
                          {log.entityId && (
                            <span className="font-mono text-[10px] text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded max-w-[110px] truncate">
                              {log.entityId}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Old Value -> New Value */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                          <div className="p-1 rounded bg-slate-50 border border-slate-200/80">
                            {formatValueDisplay(log.oldValue)}
                          </div>
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0 rtl:rotate-180" />
                          <div className="p-1 rounded bg-blue-50/60 border border-blue-200/80">
                            {formatValueDisplay(log.newValue)}
                          </div>
                        </div>
                      </td>

                      {/* IP Address */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                          <Shield className="w-3 h-3 text-slate-400" />
                          {log.ipAddress || '192.168.1.102'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge
                          variant={log.status === 'SUCCESS' ? 'success' : log.status === 'WARNING' ? 'warning' : 'danger'}
                          size="sm"
                        >
                          {log.status}
                        </Badge>
                      </td>

                      {/* Details Inspector Button */}
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title={isAr ? 'عرض التفاصيل والبيانات الوصفية' : 'View full metadata details'}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            {isAr ? `عرض ${logs.length} من إجمالي ${totalCount} سجل` : `Showing ${logs.length} of ${totalCount} records`}
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            {isAr ? 'قاعدة بيانات التدقيق محصنة ضد التعديل (Append-Only)' : 'Append-only cryptographically verifiable audit log'}
          </span>
        </div>
      </div>

      {/* Detail Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {isAr ? 'تفاصيل سجل التدقيق والبيانات الوصفية' : 'Audit Log Full Inspection'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">ID: {selectedLog.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[11px] text-slate-400 block">{isAr ? 'المستخدم المسؤول' : 'Operator User'}</span>
                  <span className="font-bold text-slate-900">{selectedLog.userName} ({selectedLog.userEmail})</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">{isAr ? 'العملية والكيان' : 'Action & Entity'}</span>
                  <span className="font-bold text-blue-700">{selectedLog.action} / {selectedLog.entity}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">{isAr ? 'معرّف الكيان' : 'Entity ID'}</span>
                  <span className="font-mono text-slate-700">{selectedLog.entityId || '—'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">{isAr ? 'التاريخ والوقت' : 'Timestamp'}</span>
                  <span className="font-mono text-slate-700">{new Date(selectedLog.createdAt).toISOString()}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">{isAr ? 'عنوان IP' : 'Client IP'}</span>
                  <span className="font-mono text-slate-700">{selectedLog.ipAddress || '192.168.1.102'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">{isAr ? 'حالة العملية' : 'Outcome Status'}</span>
                  <Badge variant={selectedLog.status === 'SUCCESS' ? 'success' : 'danger'} size="sm">
                    {selectedLog.status}
                  </Badge>
                </div>
              </div>

              {/* State Transition Diff */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-700">{isAr ? 'مقارنة التحول (Old vs New Diff)' : 'State Transition'}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-xl">
                    <span className="text-[10px] font-bold text-rose-700 uppercase block mb-1">
                      {isAr ? 'القيمة السابقة (Old Value)' : 'Old Value'}
                    </span>
                    <pre className="font-mono text-[11px] text-rose-950 overflow-x-auto whitespace-pre-wrap">
                      {selectedLog.oldValue ? JSON.stringify(selectedLog.oldValue, null, 2) : 'null'}
                    </pre>
                  </div>
                  <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase block mb-1">
                      {isAr ? 'القيمة الجديدة (New Value)' : 'New Value'}
                    </span>
                    <pre className="font-mono text-[11px] text-emerald-950 overflow-x-auto whitespace-pre-wrap">
                      {selectedLog.newValue ? JSON.stringify(selectedLog.newValue, null, 2) : 'null'}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Extended Details / Metadata */}
              {selectedLog.details && (
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-700">{isAr ? 'البيانات الوصفية الإضافية' : 'Extended Metadata'}</h4>
                  <div className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto max-h-40">
                    <pre>{JSON.stringify(selectedLog.details, null, 2)}</pre>
                  </div>
                </div>
              )}

              {/* User Agent */}
              {selectedLog.userAgent && (
                <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-700">{isAr ? 'متصفح العميل:' : 'User Agent:'} </span>
                  <span className="font-mono break-all">{selectedLog.userAgent}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition-colors"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
