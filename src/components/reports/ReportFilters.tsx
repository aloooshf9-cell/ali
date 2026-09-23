import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { ReportFilterParams } from '../../types/reports';
import { Company, User, CustomField } from '../../types/database';
import { api } from '../../services/api';
import {
  Filter,
  RotateCcw,
  Search,
  Building2,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Calendar,
  X,
  ChevronDown,
  Sparkles,
  Users,
  Settings2,
  Check,
} from 'lucide-react';

interface ReportFiltersProps {
  filters: ReportFilterParams;
  onChangeFilters: (newFilters: ReportFilterParams) => void;
  onApply: () => void;
  onReset: () => void;
  companies: Company[];
  users: User[];
  totalMatches: number;
  isLoading?: boolean;
}

export const ReportFilters: React.FC<ReportFiltersProps> = ({
  filters,
  onChangeFilters,
  onApply,
  onReset,
  companies,
  users,
  totalMatches,
  isLoading = false,
}) => {
  const { t, language } = useI18n();
  const isAr = language === 'ar';
  const [isExpanded, setIsExpanded] = useState(true);
  const [isManagerDropdownOpen, setIsManagerDropdownOpen] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [managerSearch, setManagerSearch] = useState('');

  // Fetch active custom fields
  useEffect(() => {
    let isMounted = true;
    api.getCustomFields().then((res) => {
      if (isMounted && res.customFields) {
        setCustomFields(res.customFields);
      }
    }).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // List all users added in the system as potential managers, prioritizing admin/manager roles
  const managerUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const aIsMgr = a.roles?.some((r) => r.slug.includes('admin') || r.slug.includes('manager')) || companies.some((c) => c.managerId === a.id);
      const bIsMgr = b.roles?.some((r) => r.slug.includes('admin') || r.slug.includes('manager')) || companies.some((c) => c.managerId === b.id);
      if (aIsMgr && !bIsMgr) return -1;
      if (!aIsMgr && bIsMgr) return 1;
      return (a.fullName || '').localeCompare(b.fullName || '');
    });
  }, [users, companies]);

  const filteredManagers = useMemo(() => {
    if (!managerSearch.trim()) return managerUsers;
    const query = managerSearch.toLowerCase();
    return managerUsers.filter(
      (m) =>
        m.fullName.toLowerCase().includes(query) ||
        (m.fullNameAr && m.fullNameAr.toLowerCase().includes(query)) ||
        m.email.toLowerCase().includes(query)
    );
  }, [managerUsers, managerSearch]);

  const handleFieldChange = (field: keyof ReportFilterParams, value: any) => {
    onChangeFilters({
      ...filters,
      [field]: value === '' ? undefined : value,
    });
  };

  const removeSingleFilter = (field: keyof ReportFilterParams) => {
    const updated = { ...filters };
    delete updated[field];
    onChangeFilters(updated);
  };

  const handleCustomFieldChange = (fieldKey: string, val: string) => {
    const current = { ...(filters.customFieldFilters || {}) };
    if (!val || !val.trim()) {
      delete current[fieldKey];
    } else {
      current[fieldKey] = val;
    }
    onChangeFilters({
      ...filters,
      customFieldFilters: Object.keys(current).length > 0 ? current : undefined,
    });
  };

  // Creator / Manager filter handlers
  const isAllManagersSelected = filters.managerIds?.includes('all_managers');
  const selectedManagerIds = useMemo(() => {
    if (!filters.managerIds || filters.managerIds.includes('all_managers')) return [];
    return filters.managerIds;
  }, [filters.managerIds]);

  const handleSelectManagerMode = (mode: 'none' | 'all_managers' | 'custom') => {
    if (mode === 'none') {
      onChangeFilters({ ...filters, managerIds: undefined, creatorId: undefined, assignedToId: undefined });
      setIsManagerDropdownOpen(false);
    } else if (mode === 'all_managers') {
      onChangeFilters({ ...filters, managerIds: ['all_managers'], creatorId: undefined, assignedToId: undefined });
      setIsManagerDropdownOpen(false);
    } else {
      // Custom mode: if none currently selected, keep existing or select first
      if (!filters.managerIds || filters.managerIds.includes('all_managers')) {
        onChangeFilters({ ...filters, managerIds: [], creatorId: undefined });
      }
    }
  };

  const toggleSingleManager = (managerId: string) => {
    let current = [...selectedManagerIds];
    if (current.includes(managerId)) {
      current = current.filter((id) => id !== managerId);
    } else {
      current.push(managerId);
    }
    const creatorVal = current.length === 1 ? current[0] : (current.length > 1 ? current.join(',') : undefined);
    onChangeFilters({
      ...filters,
      managerIds: current.length > 0 ? current : undefined,
      creatorId: creatorVal,
      assignedToId: undefined,
    });
  };

  // Build active filter badges list
  const activeBadges: Array<{ id: keyof ReportFilterParams | string; label: string; value: string; onRemove: () => void }> = [];

  if (filters.companyId && filters.companyId !== 'all') {
    const c = companies.find((comp) => comp.id === filters.companyId);
    activeBadges.push({
      id: 'companyId',
      label: t('reports.filter_company'),
      value: c ? (isAr ? c.nameAr : c.nameEn) : filters.companyId,
      onRemove: () => removeSingleFilter('companyId'),
    });
  }

  // Creator Filter Badge
  if (filters.managerIds && filters.managerIds.length > 0) {
    if (isAllManagersSelected) {
      activeBadges.push({
        id: 'managerIds',
        label: isAr ? 'منشئ التاسك' : 'Task Creator',
        value: isAr ? 'جميع المنشئين' : 'All Creators',
        onRemove: () => removeSingleFilter('managerIds'),
      });
    } else {
      const names = selectedManagerIds
        .map((id) => {
          const m = managerUsers.find((u) => u.id === id);
          return m ? (isAr ? m.fullNameAr || m.fullName : m.fullName) : id;
        })
        .join(', ');
      activeBadges.push({
        id: 'managerIds',
        label: isAr ? 'منشئ التاسك' : 'Task Creator',
        value: names || (isAr ? 'محدد' : 'Selected'),
        onRemove: () => removeSingleFilter('managerIds'),
      });
    }
  }

  if (filters.status && filters.status !== 'all') {
    const statusMap: Record<string, string> = {
      pending: isAr ? 'قيد الانتظار' : 'Pending',
      in_progress: isAr ? 'قيد التنفيذ' : 'In Progress',
      delayed: isAr ? 'متأخرة' : 'Delayed',
      completed: isAr ? 'مكتملة' : 'Completed',
      paused: isAr ? 'معلقة' : 'Paused',
      cancelled: isAr ? 'ملغاة' : 'Cancelled',
    };
    activeBadges.push({
      id: 'status',
      label: t('reports.filter_status'),
      value: statusMap[filters.status] || filters.status,
      onRemove: () => removeSingleFilter('status'),
    });
  }

  if (filters.priority && filters.priority !== 'all') {
    const priorityMap: Record<string, string> = {
      vip: isAr ? 'أولوية قصوى (VIP)' : 'VIP Critical',
      high: isAr ? 'عالية' : 'High',
      medium: isAr ? 'متوسطة' : 'Medium',
      low: isAr ? 'منخفضة' : 'Low',
    };
    activeBadges.push({
      id: 'priority',
      label: t('reports.filter_priority'),
      value: priorityMap[filters.priority] || filters.priority,
      onRemove: () => removeSingleFilter('priority'),
    });
  }

  if (filters.assignedToId && filters.assignedToId !== 'all') {
    const u = users.find((usr) => usr.id === filters.assignedToId);
    activeBadges.push({
      id: 'assignedToId',
      label: t('reports.filter_assigned_to'),
      value: u ? (isAr ? u.fullNameAr || u.fullName : u.fullName) : filters.assignedToId,
      onRemove: () => removeSingleFilter('assignedToId'),
    });
  }

  if (filters.dateFrom || filters.dateTo) {
    activeBadges.push({
      id: 'dateFrom',
      label: isAr ? 'فترة الإنشاء' : 'Creation Date',
      value: `${filters.dateFrom || '...'} → ${filters.dateTo || '...'}`,
      onRemove: () => {
        const up = { ...filters };
        delete up.dateFrom;
        delete up.dateTo;
        onChangeFilters(up);
      },
    });
  }

  if (filters.dueDateFrom || filters.dueDateTo) {
    activeBadges.push({
      id: 'dueDateFrom',
      label: isAr ? 'تاريخ الاستحقاق' : 'Due Date',
      value: `${filters.dueDateFrom || '...'} → ${filters.dueDateTo || '...'}`,
      onRemove: () => {
        const up = { ...filters };
        delete up.dueDateFrom;
        delete up.dueDateTo;
        onChangeFilters(up);
      },
    });
  }

  if (filters.search) {
    activeBadges.push({
      id: 'search',
      label: isAr ? 'بحث' : 'Search',
      value: `"${filters.search}"`,
      onRemove: () => removeSingleFilter('search'),
    });
  }

  // Custom Fields Badges
  if (filters.customFieldFilters) {
    Object.entries(filters.customFieldFilters).forEach(([key, val]) => {
      const fieldDef = customFields.find((f) => f.fieldKey === key);
      const label = fieldDef ? (isAr ? fieldDef.nameAr : fieldDef.nameEn) : key;
      activeBadges.push({
        id: `cf_${key}`,
        label,
        value: String(val),
        onRemove: () => handleCustomFieldChange(key, ''),
      });
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden mb-6">
      {/* Header Bar */}
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">{t('reports.advanced_filters')}</span>
              {activeBadges.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-600 text-white">
                  {activeBadges.length} {t('reports.active_filters')}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              {isAr ? 'تصفية وتقارير دقيقة حسب الشركة، المدراء، الحالات، والبيانات المخصصة' : 'Filter by company, manager source, status, dates, and custom fields'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeBadges.length > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('reports.clear_filters')}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors flex items-center gap-1"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Active Combined Filter Badges */}
      {activeBadges.length > 0 && (
        <div className="px-4 py-2.5 bg-blue-50/40 border-b border-blue-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-blue-900 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            {isAr ? 'الفلاتر النشطة:' : 'Active Filters:'}
          </span>
          {activeBadges.map((badge) => (
            <span
              key={badge.id}
              className="inline-flex items-center gap-1.5 bg-white border border-blue-200 text-blue-900 px-2.5 py-1 rounded-lg text-xs font-semibold shadow-xs"
            >
              <span className="text-slate-500 font-normal">{badge.label}:</span>
              <span>{badge.value}</span>
              <button
                type="button"
                onClick={badge.onRemove}
                className="text-slate-400 hover:text-rose-600 transition-colors p-0.5 rounded hover:bg-rose-50"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          <span className="ms-auto text-xs font-bold text-slate-600">
            {isAr ? `النتائج المطابقة: ${totalMatches} مهمة` : `Matches: ${totalMatches} tasks`}
          </span>
        </div>
      )}

      {/* Filters Form Controls */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Row 1: Company, Manager Filter, Status, Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Company Filter */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                {t('reports.filter_company')}
              </label>
              <select
                value={filters.companyId || 'all'}
                onChange={(e) => handleFieldChange('companyId', e.target.value)}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                <option value="all">{t('reports.filter_all_companies')}</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {isAr ? c.nameAr : c.nameEn}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Task Creator Filter (منشئ التاسك) */}
            <div className="relative">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  {isAr ? 'منشئ التاسك' : 'Task Creator'}
                </span>
                {filters.managerIds && (
                  <button
                    type="button"
                    onClick={() => handleSelectManagerMode('none')}
                    className="text-[10px] text-rose-600 hover:underline"
                  >
                    {isAr ? 'إلغاء التحديد' : 'Clear'}
                  </button>
                )}
              </label>

              <button
                type="button"
                onClick={() => setIsManagerDropdownOpen(!isManagerDropdownOpen)}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-start flex items-center justify-between focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                <span className="truncate text-slate-800">
                  {!filters.managerIds || filters.managerIds.length === 0
                    ? (isAr ? 'بدون تحديد منشئ (جميع النتائج)' : 'No creator filter (All results)')
                    : isAllManagersSelected
                    ? (isAr ? 'جميع المنشئين' : 'All Creators')
                    : selectedManagerIds.length === 1
                    ? (managerUsers.find((m) => m.id === selectedManagerIds[0])?.fullName || (isAr ? 'منشئ محدد' : '1 Creator'))
                    : (isAr ? `${selectedManagerIds.length} منشئين محددين` : `${selectedManagerIds.length} Creators selected`)}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ms-1" />
              </button>

              {/* Creator Dropdown Modal/Popover */}
              {isManagerDropdownOpen && (
                <div className="absolute z-30 start-0 mt-1 w-72 sm:w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-3 space-y-2 animate-in fade-in duration-100">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-800">
                      {isAr ? 'تصفية حسب منشئ التاسك' : 'Filter by Task Creator'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsManagerDropdownOpen(false)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Quick Select Options */}
                  <div className="grid grid-cols-2 gap-1.5 pb-2 border-b border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleSelectManagerMode('none')}
                      className={`px-2 py-1.5 text-[11px] font-bold rounded-lg border text-center transition-all ${
                        !filters.managerIds
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {isAr ? 'بدون تحديد (الكل)' : 'No filter (All)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectManagerMode('all_managers')}
                      className={`px-2 py-1.5 text-[11px] font-bold rounded-lg border text-center transition-all ${
                        isAllManagersSelected
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {isAr ? 'جميع المنشئين' : 'All Creators'}
                    </button>
                  </div>

                  {/* Creator Search */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={isAr ? 'بحث في منشئي المهام...' : 'Search task creators...'}
                      value={managerSearch}
                      onChange={(e) => setManagerSearch(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg ps-7 pe-2 py-1.5 outline-hidden focus:bg-white focus:border-blue-500"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute start-2 top-2" />
                  </div>

                  {/* Managers Checklist */}
                  <div className="max-h-48 overflow-y-auto space-y-1 pt-1">
                    {filteredManagers.map((m) => {
                      const isChecked = selectedManagerIds.includes(m.id);
                      return (
                        <div
                          key={m.id}
                          onClick={() => toggleSingleManager(m.id)}
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                            isChecked
                              ? 'bg-blue-50 text-blue-900 font-bold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              isChecked
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3" />}
                          </div>
                          <div className="truncate">
                            <div className="truncate">{isAr ? m.fullNameAr || m.fullName : m.fullName}</div>
                            <div className="text-[10px] text-slate-400 truncate">{m.email}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsManagerDropdownOpen(false)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      {isAr ? 'تم' : 'Done'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Status Filter */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                {t('reports.filter_status')}
              </label>
              <select
                value={filters.status || 'all'}
                onChange={(e) => handleFieldChange('status', e.target.value)}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                <option value="all">{t('reports.filter_all_statuses')}</option>
                <option value="pending">{isAr ? 'قيد الانتظار (Pending)' : 'Pending'}</option>
                <option value="in_progress">{isAr ? 'قيد التنفيذ (In Progress)' : 'In Progress'}</option>
                <option value="delayed">{isAr ? 'متأخرة (Delayed)' : 'Delayed'}</option>
                <option value="completed">{isAr ? 'مكتملة (Completed)' : 'Completed'}</option>
                <option value="paused">{isAr ? 'معلقة / متوقفة (Paused)' : 'Paused'}</option>
                <option value="cancelled">{isAr ? 'ملغاة (Cancelled)' : 'Cancelled'}</option>
              </select>
            </div>

            {/* 4. Priority Filter */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
                {t('reports.filter_priority')}
              </label>
              <select
                value={filters.priority || 'all'}
                onChange={(e) => handleFieldChange('priority', e.target.value)}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                <option value="all">{t('reports.filter_all_priorities')}</option>
                <option value="vip">{isAr ? 'أولوية قصوى (VIP)' : 'VIP Critical'}</option>
                <option value="high">{isAr ? 'عالية (High)' : 'High'}</option>
                <option value="medium">{isAr ? 'متوسطة (Medium)' : 'Medium'}</option>
                <option value="low">{isAr ? 'منخفضة (Low)' : 'Low'}</option>
              </select>
            </div>
          </div>

          {/* Row 2: Assigned To, Date Range, Due Date Range, Search Keyword */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2 border-t border-slate-100">
            {/* Assigned To Filter */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                {t('reports.filter_assigned_to')}
              </label>
              <select
                value={filters.assignedToId || (filters.managerIds && filters.managerIds.length === 1 && filters.managerIds[0] !== 'all_managers' ? filters.managerIds[0] : 'all')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'all') {
                    onChangeFilters({ ...filters, assignedToId: undefined, managerIds: undefined });
                  } else {
                    onChangeFilters({ ...filters, assignedToId: val, managerIds: [val] });
                  }
                }}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                <option value="all">{isAr ? 'جميع المدراء والمستخدمين' : 'All Managers / Users'}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {isAr ? u.fullNameAr || u.fullName : u.fullName}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range (Created / Start) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {isAr ? 'فترة الإنشاء / البدء' : 'Creation / Start Date'}
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => handleFieldChange('dateFrom', e.target.value)}
                  className="w-1/2 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  placeholder="من"
                />
                <span className="text-slate-400 text-xs">→</span>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => handleFieldChange('dateTo', e.target.value)}
                  className="w-1/2 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  placeholder="إلى"
                />
              </div>
            </div>

            {/* Due Date Range */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {isAr ? 'تاريخ الاستحقاق المحدد' : 'Due Date Range'}
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={filters.dueDateFrom || ''}
                  onChange={(e) => handleFieldChange('dueDateFrom', e.target.value)}
                  className="w-1/2 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  placeholder="من"
                />
                <span className="text-slate-400 text-xs">→</span>
                <input
                  type="date"
                  value={filters.dueDateTo || ''}
                  onChange={(e) => handleFieldChange('dueDateTo', e.target.value)}
                  className="w-1/2 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  placeholder="إلى"
                />
              </div>
            </div>

            {/* Keyword Search */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                {isAr ? 'بحث بالنص أو المعرف' : 'Keyword or Code'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={filters.search || ''}
                  onChange={(e) => handleFieldChange('search', e.target.value)}
                  placeholder={t('reports.filter_search')}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl ps-8 pe-3 py-2 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute start-2.5 top-2.5 pointer-events-none" />
                {filters.search && (
                  <button
                    type="button"
                    onClick={() => handleFieldChange('search', undefined)}
                    className="absolute end-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
