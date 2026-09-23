import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { Language } from '../../types/i18n';
import { BackupConfig, BackupMetadata } from '../../types/database';
import { api } from '../../services/api';
import { Modal } from '../common/Modal';
import {
  Settings as SettingsIcon,
  Globe2,
  Shield,
  Bell,
  Save,
  CheckCircle2,
  Database,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  AlertTriangle,
  FolderCog,
  Sliders,
  Sparkles,
  Key,
  Info,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { language, setLanguage, t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const { refreshCompanies } = useCompany();

  const isAr = language === 'ar';
  const isSuperAdmin = !!user?.isSuperAdmin;

  const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'security' | 'backup' | 'superadmin'>('general');
  const [selectedLang, setSelectedLang] = useState<Language>(language);
  const [enableEmailAlerts, setEnableEmailAlerts] = useState(true);
  const [enableDesktopNotifs, setEnableDesktopNotifs] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState('60');

  // Backup State
  const [backupConfig, setBackupConfig] = useState<BackupConfig>({
    autoBackupEnabled: true,
    frequency: 'daily',
    pathMode: 'auto',
    customPath: '/var/backups/holding-enterprise',
    retentionCount: 30,
  });
  const [backupHistory, setBackupHistory] = useState<BackupMetadata[]>([]);
  const [manualPathMode, setManualPathMode] = useState<'auto' | 'manual'>('auto');
  const [manualCustomPath, setManualCustomPath] = useState('');
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isSavingBackupConfig, setIsSavingBackupConfig] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Reset to Zero State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (isSuperAdmin && activeTab === 'backup') {
      loadBackupData();
    }
  }, [activeTab, isSuperAdmin]);

  const loadBackupData = async () => {
    try {
      const res = await api.getBackupConfig();
      if (res.success) {
        if (res.config) setBackupConfig(res.config);
        if (res.history) setBackupHistory(res.history);
      }
    } catch (err: any) {
      console.error('Failed to load backup data:', err);
    }
  };

  const handleLanguageChange = (lang: Language) => {
    setSelectedLang(lang);
    setLanguage(lang);
    toast.success(
      lang === 'ar' ? 'تم تحويل لغة النظام إلى العربية (RTL)' : 'System language switched to English (LTR)'
    );
  };

  const handleSaveSettings = () => {
    toast.success(t('settings.saved_successfully'));
  };

  const handleSaveBackupConfig = async () => {
    try {
      setIsSavingBackupConfig(true);
      const res = await api.updateBackupConfig(backupConfig);
      if (res.success) {
        toast.success(isAr ? 'تم حفظ إعدادات النسخ الاحتياطي بنجاح' : 'Backup configuration saved successfully');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save backup config');
    } finally {
      setIsSavingBackupConfig(false);
    }
  };

  const handleDownloadManualBackup = async () => {
    try {
      setIsCreatingBackup(true);
      await api.downloadBackupFile(manualPathMode, manualPathMode === 'manual' ? manualCustomPath : undefined);
      toast.success(isAr ? 'تم إنشاء وتحميل النسخة الاحتياطية بنجاح' : 'Backup created and downloaded successfully');
      loadBackupData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to download backup');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsRestoring(true);
      const text = await file.text();
      const parsed = JSON.parse(text);

      const res = await api.restoreBackup(parsed);
      if (res.success) {
        toast.success(isAr ? 'تمت استعادة النسخة الاحتياطية بنجاح!' : 'Backup restored successfully!');
        await refreshCompanies();
        loadBackupData();
      }
    } catch (err: any) {
      toast.error(err.message || (isAr ? 'فشل قراءة أو استعادة ملف النسخة الاحتياطية' : 'Failed to restore backup'));
    } finally {
      setIsRestoring(false);
      e.target.value = '';
    }
  };

  const handleResetToZero = async () => {
    if (confirmText !== 'تصفير' && confirmText !== 'RESET') {
      toast.error(isAr ? 'يرجى كتابة كلمة "تصفير" للتأكيد' : 'Please type RESET to confirm');
      return;
    }

    try {
      setIsResetting(true);
      const res = await api.resetSystemToZero();
      if (res.success) {
        toast.success(isAr ? 'تم تصفير النظام بنجاح. يمكنك الآن البدء بإضافة شركاتك من الصفر!' : 'System reset to zero. You can now add your companies from scratch!');
        setIsResetModalOpen(false);
        setConfirmText('');
        await refreshCompanies();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset system');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Intro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <SettingsIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">{t('settings.title')}</h2>
            <p className="text-xs text-slate-500">{t('settings.subtitle')}</p>
          </div>
        </div>

        <button
          id="save-settings-btn"
          onClick={handleSaveSettings}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95"
        >
          <Save className="w-4 h-4" />
          <span>{t('settings.save')}</span>
        </button>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'general'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Globe2 className="w-4 h-4" />
          <span>{t('settings.appearance')}</span>
        </button>

        <button
          onClick={() => setActiveTab('appearance')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'appearance'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>{t('notif.center')}</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'security'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>{t('settings.security')}</span>
        </button>

        {isSuperAdmin && (
          <>
            <button
              onClick={() => setActiveTab('backup')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'backup'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>{isAr ? 'النسخ الاحتياطي (آلي ويدوي)' : 'Backups (Auto & Manual)'}</span>
            </button>

            <button
              onClick={() => setActiveTab('superadmin')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'superadmin'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-700 bg-amber-50 hover:bg-amber-100'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>{isAr ? 'إدارة السوبر أدمن وتصفير النظام' : 'Super Admin & Reset to Zero'}</span>
            </button>
          </>
        )}
      </div>

      {/* Tab: Language & Appearance */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">{t('settings.language')}</h3>
            <p className="text-xs text-slate-500 mb-4">
              {language === 'ar'
                ? 'حدد اللغة المفضلة للواجهة. يدعم النظام اتجاه الكتابة من اليمين لليسار (RTL) تلقائياً مع العربية.'
                : 'Select your preferred interface language. Direction and typography adapt automatically.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
              <button
                type="button"
                onClick={() => handleLanguageChange('ar')}
                className={`flex items-center justify-between p-4 rounded-xl border text-start transition-all ${
                  selectedLang === 'ar'
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-2 ring-blue-600/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div>
                  <div className="font-bold text-sm">العربية</div>
                  <div className="text-xs text-slate-500 mt-0.5">واجهة كاملة باللغة العربية مع دعم RTL</div>
                </div>
                {selectedLang === 'ar' && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
              </button>

              <button
                type="button"
                onClick={() => handleLanguageChange('en')}
                className={`flex items-center justify-between p-4 rounded-xl border text-start transition-all ${
                  selectedLang === 'en'
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-2 ring-blue-600/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div>
                  <div className="font-bold text-sm">English</div>
                  <div className="text-xs text-slate-500 mt-0.5">Full English interface with LTR alignment</div>
                </div>
                {selectedLang === 'en' && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Notifications */}
      {activeTab === 'appearance' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5 max-w-2xl">
          <h3 className="text-sm font-bold text-slate-900">{t('notif.center')}</h3>
          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableEmailAlerts}
                onChange={(e) => setEnableEmailAlerts(e.target.checked)}
                className="mt-1 rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <div>
                <span className="text-xs font-bold text-slate-800">
                  {language === 'ar' ? 'تنبيهات البريد الإلكتروني للمهام العاجلة' : 'Email Alerts for Urgent Tasks'}
                </span>
                <p className="text-xs text-slate-500">
                  {language === 'ar'
                    ? 'إرسال إشعار فوري عند إسناد مهمة حرجة أو تأخر مهمة عن موعدها'
                    : 'Dispatch immediate email notifications when a task is delayed or VIP assigned'}
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableDesktopNotifs}
                onChange={(e) => setEnableDesktopNotifs(e.target.checked)}
                className="mt-1 rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <div>
                <span className="text-xs font-bold text-slate-800">
                  {language === 'ar' ? 'إشعارات المتصفح الفورية' : 'Instant In-App Popover Notifications'}
                </span>
                <p className="text-xs text-slate-500">
                  {language === 'ar'
                    ? 'عرض شارات تنبيه حية في الشريط العلوي'
                    : 'Display animated indicator badges in the top navigation'}
                </p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Tab: Security */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-6 max-w-2xl">
          <h3 className="text-sm font-bold text-slate-900">{t('settings.security')}</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'مهلة الجلسة الآمنة (بالدقائق)' : 'Session Inactivity Timeout (Minutes)'}
              </label>
              <select
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                className="w-48 px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="15">15 {language === 'ar' ? 'دقيقة' : 'Minutes'}</option>
                <option value="30">30 {language === 'ar' ? 'دقيقة' : 'Minutes'}</option>
                <option value="60">60 {language === 'ar' ? 'دقيقة' : 'Minutes'}</option>
                <option value="120">120 {language === 'ar' ? 'دقيقة' : 'Minutes'}</option>
              </select>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                <span>{language === 'ar' ? 'الحماية من هجمات Brute Force نشطة' : 'Brute Force Rate Limiting Active'}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {language === 'ar'
                  ? 'يتم تقييد محاولات تسجيل الدخول والطلبات البرمجية تلقائياً لمنع الهجمات المكررة مع توثيقها في سجل التدقيق.'
                  : 'Automated IP rate limiter safeguards authentication and API endpoints with full audit logging.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Backups (Auto & Manual with Path Selection) */}
      {isSuperAdmin && activeTab === 'backup' && (
        <div className="space-y-6">
          {/* Automated Backup Settings */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  <span>{isAr ? 'إعدادات النسخ الاحتياطي الآلي' : 'Automated Backup Configuration'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {isAr
                    ? 'ضبط جدولة النسخ الاحتياطي التلقائي ومسار حفظ البيانات'
                    : 'Configure automated background schedule and storage destination'}
                </p>
              </div>
              <button
                onClick={handleSaveBackupConfig}
                disabled={isSavingBackupConfig}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingBackupConfig ? '...' : (isAr ? 'حفظ إعدادات النسخ' : 'Save Backup Settings')}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backupConfig.autoBackupEnabled}
                    onChange={(e) => setBackupConfig({ ...backupConfig, autoBackupEnabled: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      {isAr ? 'تفعيل النسخ الاحتياطي الآلي' : 'Enable Automated Backups'}
                    </span>
                    <p className="text-[11px] text-slate-500">
                      {isAr ? 'إنشاء نسخ دورية من قواعد البيانات والشركات تلقائياً' : 'Automatically create recurring system snapshots'}
                    </p>
                  </div>
                </label>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isAr ? 'تكرار النسخ الاحتياطي الآلي' : 'Backup Frequency'}
                  </label>
                  <select
                    value={backupConfig.frequency}
                    onChange={(e) => setBackupConfig({ ...backupConfig, frequency: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                  >
                    <option value="hourly">{isAr ? 'كل ساعة (Hourly)' : 'Hourly'}</option>
                    <option value="daily">{isAr ? 'يومياً (Daily)' : 'Daily'}</option>
                    <option value="weekly">{isAr ? 'أسبوعياً (Weekly)' : 'Weekly'}</option>
                  </select>
                </div>
              </div>

              {/* Path Mode Selection (Auto vs Manual) */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  {isAr ? 'طريقة تحديد مسار التخزين' : 'Storage Path Selection Mode'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBackupConfig({ ...backupConfig, pathMode: 'auto' })}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
                      backupConfig.pathMode === 'auto'
                        ? 'bg-blue-50 text-blue-700 border-blue-300 ring-2 ring-blue-500/20'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    {isAr ? 'تلقائي (مسار النظام)' : 'Automatic (Default)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackupConfig({ ...backupConfig, pathMode: 'manual' })}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
                      backupConfig.pathMode === 'manual'
                        ? 'bg-blue-50 text-blue-700 border-blue-300 ring-2 ring-blue-500/20'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    {isAr ? 'يدوي (تحديد المسار)' : 'Manual (Custom Path)'}
                  </button>
                </div>

                {backupConfig.pathMode === 'manual' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {isAr ? 'المسار المخصص لحفظ النسخ على الخادم' : 'Custom Server File Path'}
                    </label>
                    <input
                      type="text"
                      value={backupConfig.customPath}
                      onChange={(e) => setBackupConfig({ ...backupConfig, customPath: e.target.value })}
                      placeholder="/var/backups/enterprise/data"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-mono focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                )}
                {backupConfig.pathMode === 'auto' && (
                  <p className="text-[11px] text-slate-500 italic">
                    {isAr
                      ? 'سيتم حفظ النسخ تلقائياً داخل مسار الأرشيف الداخلي الآمن للنظام.'
                      : 'Backups will be archived in the system default storage pool.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Manual Backup and Restore Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Instant Manual Backup */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-600" />
                <span>{isAr ? 'نسخ احتياطي يدوي فوري' : 'Instant Manual Backup'}</span>
              </h3>
              <p className="text-xs text-slate-500">
                {isAr
                  ? 'تصدير وتحميل لقطة فورية كاملة من النظام والشركات والمستخدمين كملف JSON آمن.'
                  : 'Export and download an instant snapshot of all data as a portable JSON package.'}
              </p>

              <div className="space-y-2">
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-semibold text-slate-700">{isAr ? 'مسار النسخة:' : 'Path Mode:'}</span>
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="manualPathMode"
                      checked={manualPathMode === 'auto'}
                      onChange={() => setManualPathMode('auto')}
                    />
                    <span>{isAr ? 'تلقائي' : 'Auto'}</span>
                  </label>
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="manualPathMode"
                      checked={manualPathMode === 'manual'}
                      onChange={() => setManualPathMode('manual')}
                    />
                    <span>{isAr ? 'يدوي' : 'Manual'}</span>
                  </label>
                </div>

                {manualPathMode === 'manual' && (
                  <input
                    type="text"
                    value={manualCustomPath}
                    onChange={(e) => setManualCustomPath(e.target.value)}
                    placeholder="/my/custom/path/backup.json"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-mono bg-white"
                  />
                )}
              </div>

              <button
                onClick={handleDownloadManualBackup}
                disabled={isCreatingBackup}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{isCreatingBackup ? '...' : (isAr ? 'تحميل النسخة الاحتياطية الآن' : 'Download Manual Backup Now')}</span>
              </button>
            </div>

            {/* Restore from Backup */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600" />
                <span>{isAr ? 'استعادة نسخة احتياطية' : 'Restore from Backup File'}</span>
              </h3>
              <p className="text-xs text-slate-500">
                {isAr
                  ? 'استرجاع بيانات النظام من ملف JSON تم تصديره مسبقاً.'
                  : 'Import and restore enterprise entities from a previously saved JSON backup.'}
              </p>

              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl cursor-pointer bg-slate-50/60 hover:bg-blue-50/20 transition-all">
                <Upload className="w-6 h-6 text-slate-400 mb-2" />
                <span className="text-xs font-bold text-slate-700">
                  {isRestoring ? (isAr ? 'جاري الاستعادة...' : 'Restoring...') : (isAr ? 'انقر لاختيار ملف النسخة الاحتياطية (.json)' : 'Click to select .json backup file')}
                </span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreFile}
                  disabled={isRestoring}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Backup History Table */}
          {backupHistory.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">{isAr ? 'سجل النسخ الاحتياطية الأخيرة' : 'Recent Backups Log'}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-2.5 px-3 text-start">{isAr ? 'الملف' : 'Filename'}</th>
                      <th className="py-2.5 px-3 text-start">{isAr ? 'النوع' : 'Type'}</th>
                      <th className="py-2.5 px-3 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                      <th className="py-2.5 px-3 text-start">{isAr ? 'الشركات' : 'Companies'}</th>
                      <th className="py-2.5 px-3 text-start">{isAr ? 'المهام' : 'Tasks'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backupHistory.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">{item.filename}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.type === 'auto' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {(item.type || 'manual').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-600">{new Date(item.createdAt).toLocaleString()}</td>
                        <td className="py-2 px-3 font-semibold">{item.companiesCount}</td>
                        <td className="py-2 px-3 font-semibold">{item.tasksCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Super Admin Exclusive Zone (Reset System to Zero & Permissions) */}
      {isSuperAdmin && activeTab === 'superadmin' && (
        <div className="space-y-6">
          {/* Super Admin Info Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {isAr ? 'حساب مدير النظام الأعلى (Super Admin)' : 'System Super Admin Account'}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {user?.fullName} ({user?.email}) - All Permissions Granted
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold">
                Super Admin Active
              </span>
            </div>
          </div>

          {/* Reset System to Zero (Wipe all companies to start fresh) */}
          <div className="bg-rose-50/50 rounded-2xl p-6 border border-rose-200 shadow-xs space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-rose-900">
                  {isAr ? 'تصفير النظام والموقع بالكامل (Reset to Zero)' : 'System Zero Reset (Clean Slate)'}
                </h3>
                <p className="text-xs text-rose-700 mt-1 leading-relaxed max-w-3xl">
                  {isAr
                    ? 'يمكّنك هذا الخيار كمدير للنظام من مسح وتصفير كافة الشركات التجريبية، المهام، الحقول، وسجلات النشاط، للبدء بصفحة بيضاء نظيفة لإضافة شركاتك الحقيقية من الصفر. سيبقى حساب السوبر أدمن (admin) فعالاً بكامل صلاحياته.'
                    : 'This wipes all demonstration companies, tasks, custom fields, and logs so you can start clean and add your actual companies from scratch. The Super Admin account remains intact with full permissions.'}
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-rose-200/80">
              <span className="text-[11px] text-rose-600 font-semibold">
                {isAr ? 'تحذير: هذا الإجراء لا يمكن التراجع عنه بدون استعادة نسخة احتياطية.' : 'Warning: This action permanently wipes dummy companies.'}
              </span>

              <button
                id="btn-reset-to-zero"
                onClick={() => {
                  setConfirmText('');
                  setIsResetModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isAr ? 'تصفير الموقع والشركات للبدء من جديد' : 'Reset System to Zero'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Reset to Zero */}
      {isResetModalOpen && (
        <Modal
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          title={isAr ? 'تأكيد تصفير النظام بالكامل' : 'Confirm System Zero Reset'}
        >
          <div className="space-y-4 text-xs text-slate-700">
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
              <p className="font-bold flex items-center gap-1.5 text-sm text-rose-700">
                <AlertTriangle className="w-4 h-4" />
                <span>{isAr ? 'هل أنت متأكد من رغبتك في تصفير النظام؟' : 'Are you sure you want to reset the system?'}</span>
              </p>
              <ul className="list-disc list-inside space-y-1 text-rose-800 text-[11px]">
                <li>{isAr ? 'سيتم حذف جميع الشركات التجريبية الحالية نهائياً.' : 'All current companies will be erased.'}</li>
                <li>{isAr ? 'سيتم مسح جميع المهام والمسارات ومراحل الإنجاز.' : 'All tasks and workflows will be cleared.'}</li>
                <li>{isAr ? 'سيبقى حسابك كمدير عام (admin) لتضيف شركاتك من جديد من الصفر.' : 'Your admin account will remain so you can register your companies anew.'}</li>
              </ul>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                {isAr ? 'اكتب كلمة "تصفير" في الحقل أدناه لتأكيد الإجراء:' : 'Type "RESET" to confirm:'}
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={isAr ? 'تصفير' : 'RESET'}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-rose-500 outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl font-bold"
              >
                {t('action.cancel')}
              </button>
              <button
                type="button"
                onClick={handleResetToZero}
                disabled={isResetting || (confirmText !== 'تصفير' && confirmText !== 'RESET')}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all disabled:opacity-40"
              >
                {isResetting ? '...' : (isAr ? 'تأكيد التصفير النهائي' : 'Confirm Reset')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
