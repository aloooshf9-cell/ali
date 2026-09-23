import React, { useState, useMemo } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { Company, User } from '../../types/database';
import { ReportQueryResult } from '../../types/reports';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Building2,
  CheckCircle2,
  PlayCircle,
  AlertTriangle,
  Clock,
  PauseCircle,
  BarChart3,
  PieChart as PieIcon,
  Filter,
  Check,
  Search,
  Users,
  ShieldAlert,
  ArrowUpDown,
} from 'lucide-react';

interface CompanyAnalysisViewProps {
  companies: Company[];
  users: User[];
  reportData: ReportQueryResult | null;
  isLoading: boolean;
  onFilterByCompany?: (companyId: string) => void;
}

export const CompanyAnalysisView: React.FC<CompanyAnalysisViewProps> = ({
  companies,
  users,
  reportData,
  isLoading,
  onFilterByCompany,
}) => {
  const { t, language } = useI18n();
  const isAr = language === 'ar';

  // Selection state: array of selected company IDs. Empty means ALL companies.
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [companySearch, setCompanySearch] = useState('');
  const [chartMode, setChartMode] = useState<'status_stacked' | 'total_volume' | 'priorities'>('status_stacked');
  const [sortField, setSortField] = useState<'total' | 'completed' | 'delayed' | 'overdue'>('total');
  const [sortAsc, setSortAsc] = useState(false);

  // All tasks in the system/report query
  const allTasks = reportData?.tasks || [];

  // Filtered companies based on search
  const searchedCompanies = useMemo(() => {
    if (!companySearch.trim()) return companies;
    const q = companySearch.toLowerCase();
    return companies.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.nameAr.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q)
    );
  }, [companies, companySearch]);

  // Active companies to display/compare
  const activeCompanies = useMemo(() => {
    if (selectedCompanyIds.length === 0) return companies;
    return companies.filter((c) => selectedCompanyIds.includes(c.id));
  }, [companies, selectedCompanyIds]);

  // Toggle company in multi-select
  const toggleCompany = (companyId: string) => {
    if (selectedCompanyIds.includes(companyId)) {
      setSelectedCompanyIds(selectedCompanyIds.filter((id) => id !== companyId));
    } else {
      setSelectedCompanyIds([...selectedCompanyIds, companyId]);
    }
  };

  const selectAllCompanies = () => {
    setSelectedCompanyIds([]);
  };

  // Compile statistical analysis per company
  const companyAnalytics = useMemo(() => {
    const list = activeCompanies.map((comp) => {
      const compTasks = allTasks.filter(
        (t) => t.companyId === comp.id || t.companyCode === comp.code
      );

      const total = compTasks.length;
      const completed = compTasks.filter((t) => t.status === 'completed').length;
      const inProgress = compTasks.filter((t) => t.status === 'in_progress').length;
      const delayed = compTasks.filter((t) => t.status === 'delayed').length;
      const paused = compTasks.filter((t) => t.status === 'paused').length;
      const pending = compTasks.filter((t) => t.status === 'pending').length;
      const cancelled = compTasks.filter((t) => t.status === 'cancelled').length;
      const overdue = compTasks.filter((t) => t.daysOverdue > 0 && t.status !== 'completed' && t.status !== 'cancelled').length;

      const priorityVip = compTasks.filter((t) => {
        const p = String(t.priority || (t.priorityId === 'tp-4' || t.priorityId === 'tp-vip' ? 'vip' : '')).toLowerCase();
        return p === 'vip' || p === 'urgent' || p === 'critical' || t.priorityId === 'tp-4' || t.priorityId === 'tp-vip';
      }).length;
      const priorityHigh = compTasks.filter((t) => {
        const p = String(t.priority || (t.priorityId === 'tp-3' || t.priorityId === 'tp-high' ? 'high' : '')).toLowerCase();
        return p === 'high' || t.priorityId === 'tp-3' || t.priorityId === 'tp-high';
      }).length;
      const priorityMedium = compTasks.filter((t) => {
        const p = String(t.priority || (t.priorityId === 'tp-2' || t.priorityId === 'tp-medium' ? 'medium' : '')).toLowerCase();
        return (p === 'medium' || t.priorityId === 'tp-2' || t.priorityId === 'tp-medium') && p !== 'high' && p !== 'vip' && p !== 'low';
      }).length;
      const priorityLow = compTasks.filter((t) => {
        const p = String(t.priority || (t.priorityId === 'tp-1' || t.priorityId === 'tp-low' ? 'low' : '')).toLowerCase();
        return p === 'low' || t.priorityId === 'tp-1' || t.priorityId === 'tp-low';
      }).length;

      const manager = users.find((u) => u.id === comp.managerId);

      return {
        id: comp.id,
        code: comp.code,
        nameAr: comp.nameAr,
        nameEn: comp.nameEn,
        name: isAr ? comp.nameAr : comp.nameEn,
        shortName: isAr ? comp.nameAr : (comp.nameEn.length > 15 ? comp.nameEn.slice(0, 15) + '...' : comp.nameEn),
        managerName: manager?.fullName || (isAr ? 'غير محدد' : 'Unassigned'),
        total,
        completed,
        inProgress,
        delayed,
        paused,
        pending,
        cancelled,
        overdue,
        priorityVip,
        priorityHigh,
        priorityMedium,
        priorityLow,
        highPriorityTotal: priorityVip + priorityHigh,
      };
    });

    // Sort list
    return list.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [activeCompanies, allTasks, users, isAr, sortField, sortAsc]);

  // Overall totals across the active companies
  const totals = useMemo(() => {
    return companyAnalytics.reduce(
      (acc, c) => ({
        total: acc.total + c.total,
        completed: acc.completed + c.completed,
        inProgress: acc.inProgress + c.inProgress,
        delayed: acc.delayed + c.delayed,
        paused: acc.paused + c.paused,
        overdue: acc.overdue + c.overdue,
        highPriority: acc.highPriority + c.highPriorityTotal,
      }),
      { total: 0, completed: 0, inProgress: 0, delayed: 0, paused: 0, overdue: 0, highPriority: 0 }
    );
  }, [companyAnalytics]);

  // Overall status distribution for Pie Chart
  const statusPieData = useMemo(() => {
    return [
      { name: isAr ? 'مكتملة' : 'Completed', value: totals.completed, color: '#10b981' },
      { name: isAr ? 'قيد التنفيذ' : 'In Progress', value: totals.inProgress, color: '#2563eb' },
      { name: isAr ? 'متأخرة' : 'Delayed', value: totals.delayed, color: '#f59e0b' },
      { name: isAr ? 'معلقة / متوقفة' : 'Paused', value: totals.paused, color: '#8b5cf6' },
      { name: isAr ? 'قيد الانتظار' : 'Pending', value: totals.total - (totals.completed + totals.inProgress + totals.delayed + totals.paused), color: '#94a3b8' },
    ].filter((item) => item.value > 0);
  }, [totals, isAr]);

  return (
    <div className="space-y-6">
      {/* Header & Company Selector Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
                <BarChart3 className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                {isAr ? 'لوحة تحليل ومقارنة أداء الشركات' : 'Company Comparative Analytics'}
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              {isAr
                ? 'مقارنة إحصائية دقيقة لتوزيع المهام، الحالات، والأولويات بين الشركات'
                : 'Direct cross-company comparison of task volumes, statuses, and priority workloads'}
            </p>
          </div>

          {/* Quick Stats Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg">
              {activeCompanies.length} {isAr ? 'شركات قيد التحليل' : 'Companies Analyzed'}
            </span>
            <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg">
              {totals.total} {isAr ? 'إجمالي المهام' : 'Total Tasks'}
            </span>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg">
              {totals.completed} {isAr ? 'مكتملة' : 'Completed'}
            </span>
          </div>
        </div>

        {/* Company Multi-Select Filter Bar */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={isAr ? 'بحث عن شركة...' : 'Search companies...'}
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl ps-9 pe-3 py-2 text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-1">
            <button
              type="button"
              onClick={selectAllCompanies}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all ${
                selectedCompanyIds.length === 0
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {isAr ? 'جميع الشركات (مقارنة شاملة)' : 'All Companies (Full Benchmark)'}
            </button>

            {searchedCompanies.slice(0, 10).map((c) => {
              const isSelected = selectedCompanyIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCompany(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                  <span>{c.code}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI Cards across selected companies (NO percentage progress!) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            {isAr ? 'إجمالي المهام' : 'Total Tasks'}
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 font-mono">{totals.total}</span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-xs bg-emerald-50/20">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">
            {isAr ? 'المهام المكتملة' : 'Completed Tasks'}
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-700 font-mono">{totals.completed}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-blue-200 shadow-xs bg-blue-50/20">
          <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block mb-1">
            {isAr ? 'قيد التنفيذ' : 'In Progress'}
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-700 font-mono">{totals.inProgress}</span>
            <PlayCircle className="w-4 h-4 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-xs bg-amber-50/20">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block mb-1">
            {isAr ? 'المهام المتأخرة' : 'Delayed Tasks'}
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-700 font-mono">{totals.delayed}</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-purple-200 shadow-xs bg-purple-50/20">
          <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider block mb-1">
            {isAr ? 'المتوقفة مؤقتاً' : 'Paused Tasks'}
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-purple-700 font-mono">{totals.paused}</span>
            <PauseCircle className="w-4 h-4 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-rose-200 shadow-xs bg-rose-50/20">
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block mb-1">
            {isAr ? 'تجاوزت الاستحقاق' : 'Overdue Tasks'}
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-700 font-mono">{totals.overdue}</span>
            <Clock className="w-4 h-4 text-rose-600" />
          </div>
        </div>
      </div>

      {/* Dynamic Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart (Takes 2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {chartMode === 'status_stacked'
                  ? (isAr ? 'رسم بياني: توزيع حالات التاسكات لكل شركة' : 'Task Status Breakdown per Company')
                  : chartMode === 'total_volume'
                  ? (isAr ? 'رسم بياني: حجم المهام الإجمالي لكل شركة' : 'Total Task Volume per Company')
                  : (isAr ? 'رسم بياني: توزيع الأولويات لكل شركة' : 'Task Priority Breakdown per Company')}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAr ? 'مقارنة مرئية فورية بين الشركات المحددة' : 'Direct interactive visual distribution'}
              </p>
            </div>

            {/* Chart Mode Toggle Buttons */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setChartMode('status_stacked')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  chartMode === 'status_stacked'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isAr ? 'الحالات' : 'Statuses'}
              </button>
              <button
                type="button"
                onClick={() => setChartMode('total_volume')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  chartMode === 'total_volume'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isAr ? 'الحجم' : 'Volume'}
              </button>
              <button
                type="button"
                onClick={() => setChartMode('priorities')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  chartMode === 'priorities'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isAr ? 'الأولويات' : 'Priorities'}
              </button>
            </div>
          </div>

          {/* Chart Rendering */}
          <div className="w-full h-80">
            {companyAnalytics.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                {isAr ? 'لا توجد بيانات متاحة للعرض' : 'No chart data available'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartMode === 'status_stacked' ? (
                  <BarChart data={companyAnalytics} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="code" tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#475569' }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="completed" name={isAr ? 'مكتملة' : 'Completed'} stackId="status" fill="#10b981" />
                    <Bar dataKey="inProgress" name={isAr ? 'قيد التنفيذ' : 'In Progress'} stackId="status" fill="#2563eb" />
                    <Bar dataKey="delayed" name={isAr ? 'متأخرة' : 'Delayed'} stackId="status" fill="#f59e0b" />
                    <Bar dataKey="paused" name={isAr ? 'متوقفة' : 'Paused'} stackId="status" fill="#8b5cf6" />
                    <Bar dataKey="pending" name={isAr ? 'قيد الانتظار' : 'Pending'} stackId="status" fill="#94a3b8" />
                  </BarChart>
                ) : chartMode === 'total_volume' ? (
                  <BarChart data={companyAnalytics} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="code" tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#475569' }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar
                      dataKey="total"
                      name={isAr ? 'إجمالي المهام' : 'Total Tasks'}
                      fill="#2563eb"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                ) : (
                  <BarChart data={companyAnalytics} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="code" tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#475569' }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="priorityVip" name={isAr ? 'عاجل جداً (VIP)' : 'VIP'} fill="#e11d48" />
                    <Bar dataKey="priorityHigh" name={isAr ? 'عالي' : 'High'} fill="#ea580c" />
                    <Bar dataKey="priorityMedium" name={isAr ? 'متوسط' : 'Medium'} fill="#3b82f6" />
                    <Bar dataKey="priorityLow" name={isAr ? 'منخفض' : 'Low'} fill="#94a3b8" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Status Distribution Pie / Donut (Takes 1 col) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-900">
                {isAr ? 'الحصص الإجمالية للحالات' : 'Overall Status Share'}
              </h3>
              <PieIcon className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-xs text-slate-500 mb-4">
              {isAr ? 'توزيع نسبي لحالات المهام ضمن الشركات المحددة' : 'Share of each status in analyzed group'}
            </p>
          </div>

          <div className="w-full h-56 flex items-center justify-center">
            {statusPieData.length === 0 ? (
              <span className="text-xs text-slate-400">{isAr ? 'لا توجد بيانات' : 'No data'}</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs">
            {statusPieData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600 truncate">{item.name}</span>
                <span className="font-bold text-slate-900 ms-auto font-mono">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comparative Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {isAr ? 'مصفوفة المقارنة المباشرة للشركات' : 'Company Comparative Matrix'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAr
                ? 'عرض تفصيلي لأرقام المهام، المسؤوليات، وحالات التنفيذ لكل شركة'
                : 'Detailed multi-company task metrics, accountability, and execution state'}
            </p>
          </div>

          {/* Sort Toggles */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">{isAr ? 'ترتيب حسب:' : 'Sort by:'}</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              className="text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700"
            >
              <option value="total">{isAr ? 'إجمالي المهام' : 'Total Tasks'}</option>
              <option value="completed">{isAr ? 'المكتملة' : 'Completed'}</option>
              <option value="delayed">{isAr ? 'المتأخرة' : 'Delayed'}</option>
              <option value="overdue">{isAr ? 'تجاوزت الاستحقاق' : 'Overdue'}</option>
            </select>
            <button
              type="button"
              onClick={() => setSortAsc(!sortAsc)}
              className="p-1.5 border border-slate-200 rounded-lg bg-white text-slate-600 hover:text-slate-900"
              title={sortAsc ? 'Ascending' : 'Descending'}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="p-3 text-start">{isAr ? 'الشركة' : 'Company'}</th>
                <th className="p-3 text-start">{isAr ? 'المدير المسؤول' : 'Manager'}</th>
                <th className="p-3 text-center">{isAr ? 'إجمالي المهام' : 'Total Tasks'}</th>
                <th className="p-3 text-center">{isAr ? 'مكتملة' : 'Completed'}</th>
                <th className="p-3 text-center">{isAr ? 'قيد التنفيذ' : 'In Progress'}</th>
                <th className="p-3 text-center">{isAr ? 'متأخرة' : 'Delayed'}</th>
                <th className="p-3 text-center">{isAr ? 'متوقفة' : 'Paused'}</th>
                <th className="p-3 text-center">{isAr ? 'تجاوزت الاستحقاق' : 'Overdue'}</th>
                <th className="p-3 text-center">{isAr ? 'أولوية عاجلة (VIP/High)' : 'VIP / High'}</th>
                <th className="p-3 text-center">{isAr ? 'إجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companyAnalytics.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-medium">
                    {isAr ? 'لا توجد شركات مطابقة' : 'No matching companies'}
                  </td>
                </tr>
              ) : (
                companyAnalytics.map((comp) => (
                  <tr key={comp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                          {comp.code.slice(0, 2)}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block">{comp.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{comp.code}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-slate-600 font-medium">{comp.managerName}</td>
                    <td className="p-3 text-center font-bold text-slate-900 font-mono text-sm">{comp.total}</td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-mono">
                        {comp.completed}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/60 font-mono">
                        {comp.inProgress}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                        comp.delayed > 0 ? 'bg-amber-100 text-amber-800' : 'text-slate-400'
                      }`}>
                        {comp.delayed}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                        comp.paused > 0 ? 'bg-purple-100 text-purple-800' : 'text-slate-400'
                      }`}>
                        {comp.paused}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                        comp.overdue > 0 ? 'bg-rose-100 text-rose-800 font-black' : 'text-slate-400'
                      }`}>
                        {comp.overdue}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                        comp.highPriorityTotal > 0 ? 'bg-rose-50 text-rose-700 border border-rose-200/60' : 'text-slate-400'
                      }`}>
                        {comp.highPriorityTotal}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {onFilterByCompany && (
                        <button
                          type="button"
                          onClick={() => onFilterByCompany(comp.id)}
                          className="px-2.5 py-1 text-xs font-bold text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          {isAr ? 'عرض المهام' : 'View Tasks'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
