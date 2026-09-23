import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  UserDashboardConfig,
  DashboardWidgetKey,
  DashboardChartKey,
  Company,
  User,
} from '../../types/database';
import {
  SlidersHorizontal,
  X,
  Check,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Building2,
  CheckSquare,
  Clock,
  PlayCircle,
  AlertCircle,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Sparkles,
  ShieldAlert,
  Percent,
  BarChart3,
  PieChart,
  LineChart,
  Users,
  Shield,
  Layers,
  Save,
  Loader2,
} from 'lucide-react';

interface DashboardCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  currentConfig?: UserDashboardConfig | null;
  companies: Company[];
}

const ALL_WIDGETS_METADATA: Array<{
  key: DashboardWidgetKey;
  labelEn: string;
  labelAr: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  { key: 'total_companies', labelEn: 'Total Companies', labelAr: 'إجمالي الشركات', icon: Building2, color: 'text-blue-600 bg-blue-50' },
  { key: 'total_tasks', labelEn: 'Total Tasks', labelAr: 'إجمالي المهام', icon: CheckSquare, color: 'text-indigo-600 bg-indigo-50' },
  { key: 'pending_tasks', labelEn: 'Pending', labelAr: 'قيد الانتظار', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  { key: 'in_progress_tasks', labelEn: 'In Progress', labelAr: 'قيد التنفيذ', icon: PlayCircle, color: 'text-blue-600 bg-blue-50' },
  { key: 'delayed_tasks', labelEn: 'Delayed', labelAr: 'المتأخرة', icon: AlertCircle, color: 'text-orange-600 bg-orange-50' },
  { key: 'completed_tasks', labelEn: 'Completed', labelAr: 'المكتملة', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
  { key: 'paused_tasks', labelEn: 'Paused', labelAr: 'متوقفة مؤقتاً', icon: PauseCircle, color: 'text-slate-600 bg-slate-100' },
  { key: 'cancelled_tasks', labelEn: 'Cancelled', labelAr: 'ملغاة', icon: XCircle, color: 'text-rose-600 bg-rose-50' },
  { key: 'vip_tasks', labelEn: 'VIP & Critical Tasks', labelAr: 'مهام VIP والحرجة', icon: Sparkles, color: 'text-purple-600 bg-purple-50' },
  { key: 'overdue_tasks', labelEn: 'Overdue Tasks', labelAr: 'متجاوزة للموعد', icon: ShieldAlert, color: 'text-red-600 bg-red-50' },
  { key: 'completion_rate', labelEn: 'Completion Rate', labelAr: 'نسبة الإنجاز', icon: Percent, color: 'text-teal-600 bg-teal-50' },
];

const ALL_CHARTS_METADATA: Array<{
  key: DashboardChartKey;
  labelEn: string;
  labelAr: string;
  icon: React.ComponentType<{ className?: string }>;
  typeEn: string;
  typeAr: string;
}> = [
  { key: 'tasks_by_company', labelEn: 'Tasks by Company', labelAr: 'المهام حسب الشركة', icon: BarChart3, typeEn: 'Stacked Bar Chart', typeAr: 'مخطط أعمدة تراكمي' },
  { key: 'tasks_by_status', labelEn: 'Tasks by Status', labelAr: 'المهام حسب الحالة', icon: PieChart, typeEn: 'Donut Chart', typeAr: 'مخطط دائري مجوف' },
  { key: 'tasks_by_priority', labelEn: 'Tasks by Priority', labelAr: 'المهام حسب الأولوية', icon: BarChart3, typeEn: 'Bar Chart', typeAr: 'مخطط أعمدة ملون' },
  { key: 'tasks_by_user', labelEn: 'Tasks by Assigned User', labelAr: 'المهام حسب المستخدم', icon: Users, typeEn: 'Workload Chart', typeAr: 'توزيع عبء العمل' },
  { key: 'tasks_over_time', labelEn: 'Tasks Over Time', labelAr: 'تطور المهام عبر الزمن', icon: LineChart, typeEn: 'Trend Area Chart', typeAr: 'مخطط مساحي زمني' },
];

export const DashboardCustomizerModal: React.FC<DashboardCustomizerModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  currentConfig,
  companies,
}) => {
  const { t, language } = useI18n();
  const isAr = language === 'ar';
  const { user: currentUser } = useAuth();

  const [usersList, setUsersList] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser?.id || '');
  const [activeTab, setActiveTab] = useState<'widgets' | 'charts' | 'scope'>('widgets');

  // Working config state
  const [widgets, setWidgets] = useState<Array<{ key: DashboardWidgetKey; enabled: boolean; order: number }>>([]);
  const [charts, setCharts] = useState<Array<{ key: DashboardChartKey; enabled: boolean; order: number }>>([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>(['all']);
  const [showRecentTasks, setShowRecentTasks] = useState(true);

  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load all users if Super Admin
  useEffect(() => {
    if (!isOpen) return;

    if (currentUser?.isSuperAdmin) {
      api.getUsers()
        .then(res => {
          setUsersList(res.users || []);
        })
        .catch(err => console.error('Failed to load users for customizer:', err));
    }
  }, [isOpen, currentUser]);

  // Load configuration for selected user
  const loadUserConfig = async (targetUserId: string) => {
    setIsLoadingUser(true);
    setErrorMessage(null);
    try {
      if (currentUser?.isSuperAdmin) {
        const res = await api.getAllDashboardConfigs();
        const found = res.configs.find((c: any) => c.userId === targetUserId);
        if (found) {
          applyConfigState(found);
        } else {
          // generate from defaults
          buildDefaultState(targetUserId);
        }
      } else if (currentConfig) {
        applyConfigState(currentConfig);
      } else {
        buildDefaultState(targetUserId);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load user configuration');
    } finally {
      setIsLoadingUser(false);
    }
  };

  const applyConfigState = (cfg: UserDashboardConfig) => {
    // Merge existing with any missing widgets
    const fullWidgets: Array<{ key: DashboardWidgetKey; enabled: boolean; order: number }> = [];
    ALL_WIDGETS_METADATA.forEach((meta, idx) => {
      const existing = cfg.widgets?.find(w => w.key === meta.key);
      if (existing) {
        fullWidgets.push({ ...existing });
      } else {
        fullWidgets.push({ key: meta.key, enabled: false, order: idx + 1 });
      }
    });
    fullWidgets.sort((a, b) => a.order - b.order);
    setWidgets(fullWidgets);

    // Merge charts
    const fullCharts: Array<{ key: DashboardChartKey; enabled: boolean; order: number }> = [];
    ALL_CHARTS_METADATA.forEach((meta, idx) => {
      const existing = cfg.charts?.find(c => c.key === meta.key);
      if (existing) {
        fullCharts.push({ ...existing });
      } else {
        fullCharts.push({ key: meta.key, enabled: false, order: idx + 1 });
      }
    });
    fullCharts.sort((a, b) => a.order - b.order);
    setCharts(fullCharts);

    setSelectedCompanyIds(cfg.companyIds && cfg.companyIds.length > 0 ? cfg.companyIds : ['all']);
    setShowRecentTasks(cfg.showRecentTasks !== undefined ? cfg.showRecentTasks : true);
  };

  const buildDefaultState = (_targetUserId: string) => {
    const isSuper = selectedUserId === 'u1-super-admin' || currentUser?.isSuperAdmin;
    setWidgets(
      ALL_WIDGETS_METADATA.map((meta, idx) => ({
        key: meta.key,
        enabled: isSuper ? true : ['total_tasks', 'in_progress_tasks', 'pending_tasks', 'completed_tasks', 'completion_rate'].includes(meta.key),
        order: idx + 1,
      }))
    );
    setCharts(
      ALL_CHARTS_METADATA.map((meta, idx) => ({
        key: meta.key,
        enabled: isSuper ? true : ['tasks_by_status', 'tasks_by_priority'].includes(meta.key),
        order: idx + 1,
      }))
    );
    setSelectedCompanyIds(['all']);
    setShowRecentTasks(true);
  };

  useEffect(() => {
    if (isOpen) {
      const target = selectedUserId || currentUser?.id || '';
      loadUserConfig(target);
    }
  }, [isOpen, selectedUserId]);

  if (!isOpen) return null;

  // Reordering helpers
  const moveWidget = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= widgets.length) return;

    const updated = [...widgets];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Renumber orders
    updated.forEach((item, idx) => {
      item.order = idx + 1;
    });

    setWidgets(updated);
  };

  const toggleWidget = (key: DashboardWidgetKey) => {
    setWidgets(prev =>
      prev.map(w => (w.key === key ? { ...w, enabled: !w.enabled } : w))
    );
  };

  const moveChart = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= charts.length) return;

    const updated = [...charts];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    updated.forEach((item, idx) => {
      item.order = idx + 1;
    });

    setCharts(updated);
  };

  const toggleChart = (key: DashboardChartKey) => {
    setCharts(prev =>
      prev.map(c => (c.key === key ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const handleCompanyToggle = (companyId: string) => {
    if (companyId === 'all') {
      setSelectedCompanyIds(['all']);
      return;
    }

    let next = selectedCompanyIds.filter(id => id !== 'all');
    if (next.includes(companyId)) {
      next = next.filter(id => id !== companyId);
      if (next.length === 0) {
        next = ['all'];
      }
    } else {
      next.push(companyId);
    }
    setSelectedCompanyIds(next);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      await api.saveDashboardConfig(selectedUserId, {
        widgets,
        charts,
        companyIds: selectedCompanyIds,
        showRecentTasks,
      });

      setSuccessMessage(t('customizer.save_success'));
      setTimeout(() => {
        onSaved();
        onClose();
      }, 900);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save dashboard configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm(t('customizer.reset_confirm'))) return;

    try {
      setIsSaving(true);
      await api.resetDashboardConfig(selectedUserId);
      await loadUserConfig(selectedUserId);
      setSuccessMessage('Reset to default template');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reset configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedUserData = usersList.find(u => u.id === selectedUserId) || currentUser;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{t('customizer.title')}</h3>
              <p className="text-xs text-slate-500">{t('dashboard.customize_desc')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Picker for Super Admin */}
        {currentUser?.isSuperAdmin && usersList.length > 0 && (
          <div className="px-6 py-3.5 bg-blue-50/50 border-b border-blue-100/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600 shrink-0" />
              <label className="text-xs font-bold text-blue-900">
                {t('customizer.select_user')}
              </label>
            </div>
            <select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 bg-white border border-blue-200 rounded-xl text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {usersList.map(u => (
                <option key={u.id} value={u.id}>
                  {isAr && u.fullNameAr ? u.fullNameAr : u.fullName} ({u.email})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* User Context Banner */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">
              {isAr ? 'المستخدم الحالي للتخصيص:' : 'Active Target:'}
            </span>
            <span className="font-bold text-blue-600">
              {isAr && selectedUserData?.fullNameAr ? selectedUserData.fullNameAr : selectedUserData?.fullName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">|</span>
            <span className="text-slate-500">
              {widgets.filter(w => w.enabled).length} {t('dashboard.active_widgets')} • {charts.filter(c => c.enabled).length} {t('dashboard.active_charts')}
            </span>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="px-6 pt-3 flex border-b border-slate-200 bg-white">
          <button
            onClick={() => setActiveTab('widgets')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'widgets'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{t('customizer.enable_widgets')}</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700 font-black">
              {widgets.filter(w => w.enabled).length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('charts')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'charts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>{t('customizer.enable_charts')}</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700 font-black">
              {charts.filter(c => c.enabled).length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('scope')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'scope'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>{t('dashboard.company_scope')}</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-black">
              {selectedCompanyIds.includes('all') ? (isAr ? 'الكل' : 'All') : selectedCompanyIds.length}
            </span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{successMessage}</span>
            </div>
          )}

          {isLoadingUser ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-xs font-medium">{isAr ? 'جاري قراءة إعدادات قاعدة البيانات...' : 'Loading database settings...'}</p>
            </div>
          ) : (
            <>
              {/* TAB 1: WIDGETS */}
              {activeTab === 'widgets' && (
                <div className="space-y-2.5">
                  <div className="text-xs text-slate-500 pb-1">
                    {t('customizer.drag_hint')}
                  </div>
                  {widgets.map((widgetItem, idx) => {
                    const meta = ALL_WIDGETS_METADATA.find(m => m.key === widgetItem.key);
                    if (!meta) return null;
                    const Icon = meta.icon;

                    return (
                      <div
                        key={widgetItem.key}
                        className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                          widgetItem.enabled
                            ? 'bg-white border-slate-200 shadow-2xs'
                            : 'bg-slate-50/80 border-slate-200/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleWidget(widgetItem.key)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                              widgetItem.enabled
                                ? 'bg-blue-600 text-white shadow-2xs'
                                : 'border border-slate-300 bg-white text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>

                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${meta.color}`}>
                            <Icon className="w-4 h-4" />
                          </div>

                          <div>
                            <p className="text-xs font-bold text-slate-800">
                              {isAr ? meta.labelAr : meta.labelEn}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              #{widgetItem.order} • {widgetItem.key}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              widgetItem.enabled
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {widgetItem.enabled ? t('customizer.enabled') : t('customizer.disabled')}
                          </span>

                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveWidget(idx, 'up')}
                            className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-slate-600 shadow-2xs"
                            title={t('customizer.move_up')}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={idx === widgets.length - 1}
                            onClick={() => moveWidget(idx, 'down')}
                            className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-slate-600 shadow-2xs"
                            title={t('customizer.move_down')}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 2: CHARTS */}
              {activeTab === 'charts' && (
                <div className="space-y-2.5">
                  <div className="text-xs text-slate-500 pb-1">
                    {t('customizer.drag_hint')}
                  </div>
                  {charts.map((chartItem, idx) => {
                    const meta = ALL_CHARTS_METADATA.find(m => m.key === chartItem.key);
                    if (!meta) return null;
                    const Icon = meta.icon;

                    return (
                      <div
                        key={chartItem.key}
                        className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                          chartItem.enabled
                            ? 'bg-white border-slate-200 shadow-2xs'
                            : 'bg-slate-50/80 border-slate-200/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleChart(chartItem.key)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                              chartItem.enabled
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'border border-slate-300 bg-white text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>

                          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <Icon className="w-4 h-4" />
                          </div>

                          <div>
                            <p className="text-xs font-bold text-slate-800">
                              {isAr ? meta.labelAr : meta.labelEn}
                            </p>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {isAr ? meta.typeAr : meta.typeEn} • #{chartItem.order}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              chartItem.enabled
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {chartItem.enabled ? t('customizer.enabled') : t('customizer.disabled')}
                          </span>

                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveChart(idx, 'up')}
                            className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-slate-600 shadow-2xs"
                            title={t('customizer.move_up')}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={idx === charts.length - 1}
                            onClick={() => moveChart(idx, 'down')}
                            className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-slate-600 shadow-2xs"
                            title={t('customizer.move_down')}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 3: SCOPE & SECTIONS */}
              {activeTab === 'scope' && (
                <div className="space-y-5">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold text-slate-800">
                      {t('customizer.company_scope_desc')}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {isAr
                        ? 'تتيح هذه الإمكانية تحديد الشركات التي تظهر للمستخدم فقط في لوحته (مثل شركة أ فقط، أو شركتي أ + ب).'
                        : 'Enables scoping the dashboard to specific companies (e.g. Company A only, or Companies A + B).'}
                    </p>

                    <div className="pt-2 space-y-2">
                      {/* All Companies Option */}
                      <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 cursor-pointer transition-colors shadow-2xs">
                        <input
                          type="checkbox"
                          checked={selectedCompanyIds.includes('all')}
                          onChange={() => handleCompanyToggle('all')}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                        />
                        <div className="flex-1">
                          <span className="text-xs font-bold text-slate-900">
                            {t('customizer.all_companies_allowed')}
                          </span>
                          <p className="text-[10px] text-slate-400">
                            {isAr ? 'يتم عرض إجمالي كافة الشركات المصرح للمستخدم بها' : 'Aggregates all company tenants accessible to user'}
                          </p>
                        </div>
                      </label>

                      {/* Individual Companies */}
                      {companies.map(c => {
                        const isChecked = selectedCompanyIds.includes('all') || selectedCompanyIds.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors shadow-2xs ${
                              isChecked ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-slate-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={selectedCompanyIds.includes('all')}
                              onChange={() => handleCompanyToggle(c.id)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 disabled:opacity-50"
                            />
                            <div className="flex-1 flex items-center justify-between">
                              <div>
                                <span className="text-xs font-bold text-slate-900">
                                  {isAr ? c.nameAr : c.nameEn}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono mr-2 ml-2">
                                  ({c.code})
                                </span>
                              </div>
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
                                {c.currency}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section Controls */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold text-slate-800">
                      {isAr ? 'أقسام إضافية في لوحة التحكم' : 'Additional Dashboard Sections'}
                    </h4>
                    <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 cursor-pointer shadow-2xs">
                      <input
                        type="checkbox"
                        checked={showRecentTasks}
                        onChange={e => setShowRecentTasks(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900">
                          {t('customizer.show_recent_tasks')}
                        </span>
                        <p className="text-[10px] text-slate-400">
                          {isAr ? 'يعرض قائمة بأحدث المهام النشطة وروابط سريعة للتفاصيل' : 'Displays a live feed of high-priority and recently updated tasks'}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          {currentUser?.isSuperAdmin ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('customizer.reset_default')}</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all shadow-2xs"
            >
              {t('action.cancel')}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{t('customizer.save_btn')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
