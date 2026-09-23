import React, { useState, useMemo } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { PermissionKey } from '../../types/permissions';
import { Company } from '../../types/database';
import { CompanyWithMetrics } from '../../types/company';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { CompanyFormModal } from './CompanyFormModal';
import { CompanyDetailModal } from './CompanyDetailModal';
import {
  Building2,
  Plus,
  CheckCircle2,
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit2,
  Archive,
  Trash2,
  Clock,
  AlertTriangle,
  Layers,
  Sparkles,
  TrendingUp,
  LayoutGrid,
  Table as TableIcon,
  User,
  ShieldCheck,
  Building,
  Check,
  ExternalLink,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

type SortField = 'name' | 'status' | 'tasks' | 'progress' | 'createdAt';
type SortOrder = 'asc' | 'desc';

export const CompanyList: React.FC = () => {
  const {
    availableCompanies,
    activeCompany,
    setActiveCompany,
    archiveCompany,
    refreshCompanies,
  } = useCompany();
  const { hasPermission, user } = useAuth();
  const { language, direction, t } = useI18n();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'archived'>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const [detailCompanyId, setDetailCompanyId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState<CompanyWithMetrics | null>(null);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isPermanentDelete, setIsPermanentDelete] = useState(false);
  const [isSubmittingArchive, setIsSubmittingArchive] = useState(false);

  // Permissions
  const canCreate = hasPermission(PermissionKey.COMPANIES_CREATE);
  const canEdit = hasPermission(PermissionKey.COMPANIES_EDIT);
  const canDelete = hasPermission(PermissionKey.COMPANIES_DELETE);

  // Sorting handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filtered & Sorted Companies
  const filteredAndSortedCompanies = useMemo(() => {
    return availableCompanies
      .filter((comp) => {
        // Status filter
        if (statusFilter === 'active' && (!comp.isActive || comp.isArchived)) return false;
        if (statusFilter === 'inactive' && (comp.isActive || comp.isArchived)) return false;
        if (statusFilter === 'archived' && !comp.isArchived) return false;

        // Country filter
        if (countryFilter !== 'all' && comp.country !== countryFilter) return false;

        // Search text
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase().trim();
        const matchNameEn = comp.nameEn?.toLowerCase().includes(q);
        const matchNameAr = comp.nameAr?.toLowerCase().includes(q);
        const matchCode = comp.code?.toLowerCase().includes(q);
        const matchIndustry = (comp.industryEn?.toLowerCase().includes(q) || comp.industryAr?.toLowerCase().includes(q));
        const matchManager = (comp.manager?.fullName?.toLowerCase().includes(q) || comp.manager?.fullNameAr?.toLowerCase().includes(q));

        return matchNameEn || matchNameAr || matchCode || matchIndustry || matchManager;
      })
      .sort((a, b) => {
        let compA: any;
        let compB: any;

        if (sortField === 'name') {
          compA = (language === 'ar' ? a.nameAr : a.nameEn) || '';
          compB = (language === 'ar' ? b.nameAr : b.nameEn) || '';
        } else if (sortField === 'status') {
          compA = a.isArchived ? 2 : a.isActive ? 0 : 1;
          compB = b.isArchived ? 2 : b.isActive ? 0 : 1;
        } else if (sortField === 'tasks') {
          compA = a.metrics?.totalTasks || 0;
          compB = b.metrics?.totalTasks || 0;
        } else if (sortField === 'progress') {
          compA = a.metrics?.completionRate || 0;
          compB = b.metrics?.completionRate || 0;
        } else if (sortField === 'createdAt') {
          compA = new Date(a.createdAt).getTime();
          compB = new Date(b.createdAt).getTime();
        }

        if (compA < compB) return sortOrder === 'asc' ? -1 : 1;
        if (compA > compB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [availableCompanies, searchTerm, statusFilter, countryFilter, sortField, sortOrder, language]);

  // Pagination calculation
  const totalItems = filteredAndSortedCompanies.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedCompanies = filteredAndSortedCompanies.slice(startIndex, startIndex + pageSize);

  // Open Detail View
  const handleOpenDetail = (companyId: string) => {
    setDetailCompanyId(companyId);
    setIsDetailModalOpen(true);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingCompany(null);
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (comp: Company) => {
    setEditingCompany(comp);
    setIsFormModalOpen(true);
  };

  // Open Archive Confirm
  const handleOpenArchive = (comp: CompanyWithMetrics) => {
    setArchiveTarget(comp);
    setIsPermanentDelete(false);
    setIsArchiveModalOpen(true);
  };

  // Submit Archive / Delete
  const handleConfirmArchive = async () => {
    if (!archiveTarget) return;
    setIsSubmittingArchive(true);
    try {
      await archiveCompany(archiveTarget.id, isPermanentDelete);
      setIsArchiveModalOpen(false);
      setArchiveTarget(null);
      await refreshCompanies();
    } catch (err: any) {
      alert(err.message || 'Failed to archive company');
    } finally {
      setIsSubmittingArchive(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Building className="w-7 h-7 text-blue-600" />
            <span>{t('nav.companies')}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {user?.isSuperAdmin
              ? t('nav.all_companies')
              : `${t('company.total_count')}: ${availableCompanies?.length || 0}`}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {canCreate && (
            <button
              id="btn-add-company"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t('action.add_company')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Control Bar: Search, Filters, Sorting */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={language === 'ar' ? 'بحث باسم الشركة، الكود، المدير أو القطاع...' : 'Search by company, code, manager...'}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="all">{language === 'ar' ? 'جميع الحالات' : 'All Statuses'}</option>
                <option value="active">{t('company.status_active')}</option>
                <option value="inactive">{t('company.status_inactive')}</option>
                <option value="archived">{t('company.status_archived')}</option>
              </select>
            </div>

            {/* Country Filter */}
            <select
              value={countryFilter}
              onChange={(e) => {
                setCountryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="all">{language === 'ar' ? 'كافة الدول' : 'All Countries'}</option>
              <option value="SA">🇸🇦 Saudi Arabia</option>
              <option value="AE">🇦🇪 United Arab Emirates</option>
              <option value="QA">🇶🇦 Qatar</option>
              <option value="KW">🇰🇼 Kuwait</option>
              <option value="US">🇺🇸 United States</option>
            </select>

            {/* Sorting */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortField}
                onChange={(e) => handleSort(e.target.value as SortField)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="name">{t('company.sort_name')}</option>
                <option value="tasks">{t('company.sort_tasks')}</option>
                <option value="progress">{t('company.sort_progress')}</option>
                <option value="createdAt">{t('company.sort_date')}</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-2 border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
                title={`Order: ${sortOrder.toUpperCase()}`}
              >
                {sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Results summary */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>
            {t('company.showing_results')} <strong>{filteredAndSortedCompanies.length}</strong> {t('company.of')} <strong>{availableCompanies?.length || 0}</strong> {language === 'ar' ? 'شركات' : 'companies'}
          </span>
          <div className="flex items-center gap-2">
            <span>{t('company.items_per_page')}:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content: Table or Grid */}
      {paginatedCompanies.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="text-base font-bold text-slate-700">
            {language === 'ar' ? 'لم يتم العثور على شركات مطابقة لمعايير البحث' : 'No companies found matching your filters'}
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {language === 'ar' ? 'جرب تعديل كلمات البحث أو تصفية الحالات لإظهار النتائج' : 'Try adjusting your search criteria or resetting filters'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW (Primary requirement) */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold text-[11px]">
                <tr>
                  <th className="px-4 py-3.5 cursor-pointer select-none" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1.5">
                      <span>{language === 'ar' ? 'الشركة' : 'Company'}</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-4 py-3.5 cursor-pointer select-none" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-1.5">
                      <span>{t('company.status')}</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-4 py-3.5">{t('company.manager')}</th>
                  <th className="px-4 py-3.5 text-center cursor-pointer select-none" onClick={() => handleSort('tasks')}>
                    <div className="flex items-center justify-center gap-1.5">
                      <span>{t('company.tasks_count')}</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-4 py-3.5 text-center">{t('company.completed_tasks')}</th>
                  <th className="px-4 py-3.5 text-center">{t('company.pending_tasks')}</th>
                  <th className="px-4 py-3.5 text-center">{t('company.delayed_tasks')}</th>
                  <th className="px-4 py-3.5 text-center cursor-pointer select-none" onClick={() => handleSort('progress')}>
                    <div className="flex items-center justify-center gap-1.5">
                      <span>{t('company.progress')}</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-4 py-3.5 text-right">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedCompanies.map((company) => {
                  const isActiveWorkspace = activeCompany?.id === company.id;
                  const metrics = company.metrics || {
                    totalTasks: 0,
                    completedTasks: 0,
                    pendingTasks: 0,
                    delayedTasks: 0,
                    completionRate: 0,
                  };

                  return (
                    <tr
                      key={company.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isActiveWorkspace ? 'bg-blue-50/30 font-medium' : ''
                      }`}
                    >
                      {/* Logo & Name */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                            {company.logoUrl ? (
                              <img src={company.logoUrl} alt={company.nameEn} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Building2 className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                              <span>{language === 'ar' ? company.nameAr : company.nameEn}</span>
                              {isActiveWorkspace && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold">
                                  {language === 'ar' ? 'نشطة حالياً' : 'Active'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                              <span className="font-mono uppercase font-bold text-slate-600">{company.code}</span>
                              <span>•</span>
                              <span>{language === 'ar' ? company.industryAr || '-' : company.industryEn || '-'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        {company.isArchived ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {t('company.status_archived')}
                          </span>
                        ) : company.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {t('company.status_active')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            {t('company.status_inactive')}
                          </span>
                        )}
                      </td>

                      {/* Manager */}
                      <td className="px-4 py-3.5">
                        {company.manager ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs shrink-0">
                              {(company.manager.fullName || 'M').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-800">
                                {language === 'ar' && company.manager.fullNameAr ? company.manager.fullNameAr : company.manager.fullName}
                              </div>
                              <div className="text-[10px] text-slate-400">{company.manager.email}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* Number of Tasks (Total) */}
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 font-mono font-bold text-slate-800 text-xs">
                          {metrics.totalTasks}
                        </span>
                      </td>

                      {/* Completed Tasks */}
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-mono font-bold text-xs border border-emerald-100">
                          {metrics.completedTasks}
                        </span>
                      </td>

                      {/* Pending Tasks */}
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono font-bold text-xs">
                          {metrics.pendingTasks}
                        </span>
                      </td>

                      {/* Delayed Tasks */}
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                          metrics.delayedTasks > 0
                            ? 'bg-rose-100 text-rose-800 border border-rose-200 animate-pulse'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {metrics.delayedTasks}
                        </span>
                      </td>

                      {/* Progress */}
                      <td className="px-4 py-3.5 text-center min-w-[120px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold text-slate-700">
                            <span>{metrics.completionRate}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                metrics.completionRate === 100 ? 'bg-emerald-500' : 'bg-blue-600'
                              }`}
                              style={{ width: `${metrics.completionRate}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Switch Active Workspace */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCompany(company);
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isActiveWorkspace
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                            title={language === 'ar' ? 'تعيين كشركة نشطة' : 'Switch Workspace'}
                          >
                            <Check className="w-4 h-4" />
                          </button>

                          {/* View Details Modal */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(company.id)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title={t('company.view_details')}
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit Company */}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(company)}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title={t('action.edit')}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Archive / Delete */}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleOpenArchive(company)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title={t('action.delete')}
                            >
                              <Archive className="w-4 h-4" />
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
        </div>
      ) : (
        /* GRID VIEW (Alternative responsive view) */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {paginatedCompanies.map((company) => {
            const isActiveWorkspace = activeCompany?.id === company.id;
            const metrics = company.metrics || {
              totalTasks: 0,
              completedTasks: 0,
              pendingTasks: 0,
              delayedTasks: 0,
              completionRate: 0,
            };

            return (
              <div
                key={company.id}
                className={`rounded-2xl border transition-all p-5 flex flex-col justify-between bg-white ${
                  isActiveWorkspace
                    ? 'border-blue-500 shadow-sm ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shadow-2xs">
                        {company.logoUrl ? (
                          <img src={company.logoUrl} alt={company.nameEn} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Building2 className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          {language === 'ar' ? company.nameAr : company.nameEn}
                        </h4>
                        <span className="font-mono text-xs uppercase font-bold text-slate-500">
                          {company.code}
                        </span>
                      </div>
                    </div>

                    <div>
                      {company.isArchived ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {t('company.status_archived')}
                        </span>
                      ) : company.isActive ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {t('company.status_active')}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
                          {t('company.status_inactive')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Manager */}
                  {company.manager && (
                    <div className="flex items-center gap-2 mb-3 text-xs text-slate-600 bg-slate-50 p-2 rounded-xl">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{language === 'ar' ? 'المدير:' : 'Manager:'} <strong>{company.manager.fullName}</strong></span>
                    </div>
                  )}

                  {/* Metrics Row */}
                  <div className="grid grid-cols-4 gap-2 text-center my-3 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block">{t('company.tasks_count')}</span>
                      <span className="font-bold text-slate-800">{metrics.totalTasks}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">{t('company.completed_tasks')}</span>
                      <span className="font-bold text-emerald-600">{metrics.completedTasks}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">{t('company.pending_tasks')}</span>
                      <span className="font-bold text-slate-700">{metrics.pendingTasks}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">{t('company.delayed_tasks')}</span>
                      <span className="font-bold text-rose-600">{metrics.delayedTasks}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                      <span>{t('company.progress')}</span>
                      <span>{metrics.completionRate}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full transition-all"
                        style={{ width: `${metrics.completionRate}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenDetail(company.id)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{t('company.view_details')}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(company)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveCompany(company)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        isActiveWorkspace
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {isActiveWorkspace ? (language === 'ar' ? 'النشطة' : 'Active') : t('action.switch')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500">
            {language === 'ar'
              ? `الصفحة ${safeCurrentPage} من ${totalPages} (إجمالي ${totalItems} شركة)`
              : `Page ${safeCurrentPage} of ${totalPages} (Total ${totalItems} companies)`}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safeCurrentPage === 1}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }).map((_, idx) => {
              const pageNumber = idx + 1;
              if (
                pageNumber === 1 ||
                pageNumber === totalPages ||
                Math.abs(pageNumber - safeCurrentPage) <= 1
              ) {
                return (
                  <button
                    key={pageNumber}
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-colors ${
                      safeCurrentPage === pageNumber
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {pageNumber}
                  </button>
                );
              }
              if (
                pageNumber === 2 && safeCurrentPage > 3 ||
                pageNumber === totalPages - 1 && safeCurrentPage < totalPages - 2
              ) {
                return <span key={pageNumber} className="text-slate-400 text-xs">...</span>;
              }
              return null;
            })}

            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage === totalPages}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Company Form Modal (Create / Edit) */}
      <CompanyFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={async () => {
          await refreshCompanies();
        }}
        initialData={editingCompany}
      />

      {/* Company Details Modal (Overview, Dashboard, Tasks, Reports, Files, Activity) */}
      <CompanyDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        companyId={detailCompanyId}
        onCompanyUpdated={async () => {
          await refreshCompanies();
        }}
      />

      {/* Archive / Delete Confirmation Modal */}
      {isArchiveModalOpen && archiveTarget && (
        <Modal
          isOpen={isArchiveModalOpen}
          onClose={() => setIsArchiveModalOpen(false)}
          title={language === 'ar' ? 'تأكيد أرشفة أو حذف الشركة' : 'Confirm Archive / Delete Company'}
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs leading-relaxed">
              <div className="font-bold mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>{language === 'ar' ? 'تنبيه متعلق بحوكمة الشركات' : 'Governance Notice'}</span>
              </div>
              <p>
                {t('company.archive_confirm')}
              </p>
              <div className="mt-2 font-bold text-slate-800">
                {language === 'ar' ? archiveTarget.nameAr : archiveTarget.nameEn} ({archiveTarget.code})
              </div>
            </div>

            {user?.isSuperAdmin && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={isPermanentDelete}
                    onChange={(e) => setIsPermanentDelete(e.target.checked)}
                    className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <div>
                    <span className="font-bold text-rose-900 block">{t('company.delete_permanent')}</span>
                    <span className="text-rose-700 text-[11px] block mt-0.5">
                      {language === 'ar'
                        ? 'سيتم حذف الشركة وكافة مهامها وملفاتها وسجلات ربط المستخدمين بها بشكل نهائي لا رجعة فيه.'
                        : 'Permanently remove the company entity, tasks, files, and tenant memberships.'}
                    </span>
                  </div>
                </label>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setIsArchiveModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50"
              >
                {t('action.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmArchive}
                disabled={isSubmittingArchive}
                className={`px-5 py-2 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 ${
                  isPermanentDelete ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {isSubmittingArchive
                  ? (language === 'ar' ? 'جارٍ التنفيذ...' : 'Processing...')
                  : (isPermanentDelete ? t('action.delete') : (language === 'ar' ? 'أرشفة الشركة' : 'Archive Company'))}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
