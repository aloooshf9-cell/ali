import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useI18n } from '../../i18n/I18nContext';
import { Badge } from './Badge';
import { NotificationCenter } from './NotificationCenter';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  Building2,
  ChevronDown,
  Globe,
  LogOut,
  Shield,
  UserCheck,
  Briefcase,
  Layers,
  Sparkles,
  Bell,
  Menu,
  Settings,
  Info,
} from 'lucide-react';

interface HeaderProps {
  onSelectTask?: (taskId: string) => void;
  onOpenMobileNav?: () => void;
  onNavigateTab?: (tab: any) => void;
}

export const Header: React.FC<HeaderProps> = ({ onSelectTask, onOpenMobileNav, onNavigateTab }) => {
  const { user, logout, switchRolePersona } = useAuth();
  const { activeCompany, availableCompanies, setActiveCompany } = useCompany();
  const { language, setLanguage, t } = useI18n();
  const { toast } = useToast();
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchCount = async () => {
      try {
        const res = await api.getUnreadNotificationsCount();
        setUnreadCount(res.unreadCount || 0);
      } catch (err) {
        // silent fail
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const toggleLanguage = () => {
    const next = language === 'ar' ? 'en' : 'ar';
    setLanguage(next);
    toast.info(next === 'ar' ? 'تم تحويل اللغة إلى العربية (RTL)' : 'Language switched to English (LTR)');
  };

  const getRoleLabel = () => {
    if (!user) return '';
    if (user.isSuperAdmin) return t('role.super_admin');
    const primaryRole = user.roles[0]?.slug;
    if (primaryRole === 'admin') return t('role.admin');
    return t('role.manager_owner');
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Active Workspace */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Mobile hamburger button */}
          {onOpenMobileNav && (
            <button
              id="mobile-nav-toggle-btn"
              onClick={onOpenMobileNav}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              title="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => onNavigateTab?.('overview')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center font-bold shadow-sm shadow-blue-500/20 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-slate-900 tracking-tight text-base sm:text-lg leading-tight">
                {language === 'ar' ? 'منظومة إدارة الشركات' : 'Holding Enterprise OS'}
              </h1>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                {language === 'ar' ? 'نظام الحوكمة وإدارة الصلاحيات' : 'Multi-Company Governance & RBAC'}
              </p>
            </div>
          </div>

          <div className="hidden lg:block h-6 w-px bg-slate-200" />

          {/* Active Company Switcher */}
          {activeCompany && (
            <div className="relative">
              <button
                id="company-switcher-btn"
                onClick={() => setShowCompanyMenu(!showCompanyMenu)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  {activeCompany.logoUrl ? (
                    <img
                      src={activeCompany.logoUrl}
                      alt={activeCompany.nameEn}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Building2 className="w-4 h-4 text-blue-600" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium text-slate-400 leading-tight">
                    {t('company.current')}
                  </span>
                  <span className="text-xs font-bold text-slate-800 max-w-[150px] truncate leading-tight">
                    {language === 'ar' ? activeCompany.nameAr : activeCompany.nameEn}
                  </span>
                </div>
                <Badge variant="primary" size="sm">
                  {activeCompany.code}
                </Badge>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Company dropdown */}
              {showCompanyMenu && (
                <div
                  className="absolute top-full mt-1.5 start-0 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                  onClick={() => setShowCompanyMenu(false)}
                >
                  <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {t('nav.switch_company')} ({availableCompanies?.length || 0})
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
                    {(availableCompanies || []).map((comp) => (
                      <button
                        key={comp.id}
                        onClick={() => {
                          setActiveCompany(comp);
                          setShowCompanyMenu(false);
                          if (onNavigateTab) {
                            onNavigateTab('overview');
                          }
                        }}
                        className={`w-full px-3 py-2.5 flex items-center justify-between text-start hover:bg-slate-50 transition-colors ${
                          comp.id === activeCompany.id ? 'bg-blue-50/70' : ''
                        }`}
                        title={language === 'ar' ? `فتح داشبورد شركة ${comp.nameAr}` : `Open ${comp.nameEn} Dashboard`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-6 h-6 rounded bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                            <Building2 className="w-3.5 h-3.5 text-slate-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">
                              {language === 'ar' ? comp.nameAr : comp.nameEn}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              {comp.code} • {comp.currency}
                            </p>
                          </div>
                        </div>
                        {comp.id === activeCompany.id && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Tools: Language, Notifications, Persona & User Menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick About Link */}
          {onNavigateTab && (
            <button
              id="topbar-about-btn"
              onClick={() => onNavigateTab('about')}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors hidden sm:flex items-center gap-1.5 text-xs font-semibold"
              title={t('about.title')}
            >
              <Info className="w-4 h-4 text-blue-600" />
              <span className="hidden md:inline">{t('nav.about')}</span>
            </button>
          )}

          {/* Quick Settings Link (Super Admin Only) */}
          {onNavigateTab && user?.isSuperAdmin && (
            <button
              id="topbar-settings-btn"
              onClick={() => onNavigateTab('settings')}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors hidden sm:flex items-center gap-1.5 text-xs font-semibold"
              title={t('settings.title')}
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span className="hidden md:inline">{t('nav.settings')}</span>
            </button>
          )}

          {/* Language Switcher */}
          <button
            id="lang-toggle-btn"
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors shadow-2xs"
            title="Toggle Arabic (RTL) / English (LTR)"
          >
            <Globe className="w-4 h-4 text-blue-600" />
            <span className="font-bold">{language === 'ar' ? 'English' : 'العربية'}</span>
          </button>

          {/* Notification Center Trigger */}
          <div className="relative">
            <button
              id="notification-bell-btn"
              onClick={() => setShowNotifications(!showNotifications)}
              className={`relative p-2 rounded-xl border transition-all shadow-2xs ${
                showNotifications
                  ? 'bg-blue-50 border-blue-300 text-blue-600'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title={language === 'ar' ? 'مركز الإشعارات' : 'Notification Center'}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -end-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black text-white bg-rose-600 rounded-full border-2 border-white shadow-xs animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Popover */}
            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="absolute top-full mt-2 end-0 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <NotificationCenter
                    isDropdown={true}
                    onClose={() => setShowNotifications(false)}
                    onSelectTask={(taskId) => {
                      setShowNotifications(false);
                      if (onSelectTask) onSelectTask(taskId);
                    }}
                  />
                </div>
              </>
            )}
          </div>

          {/* User Profile dropdown */}
          {user && (
            <div className="relative">
              <button
                id="user-profile-btn"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-800 to-slate-950 text-white flex items-center justify-center font-bold text-xs shadow-xs overflow-hidden border border-slate-200 shrink-0">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
                  ) : (
                    user.fullName.charAt(0)
                  )}
                </div>
                <div className="hidden sm:flex flex-col text-start">
                  <span className="text-xs font-bold text-slate-800 leading-tight">
                    {language === 'ar' && user.fullNameAr ? user.fullNameAr : user.fullName}
                  </span>
                  <span className="text-[11px] text-blue-600 font-semibold leading-tight">
                    {getRoleLabel()}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {showUserMenu && (
                <div
                  className="absolute top-full mt-1.5 end-0 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                  onClick={() => setShowUserMenu(false)}
                >
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-800">
                      {language === 'ar' && user.fullNameAr ? user.fullNameAr : user.fullName}
                    </p>
                    <p className="text-[11px] text-slate-500">{user.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {user.roles.map((r) => (
                        <Badge key={r.id} variant={r.slug === 'super_admin' ? 'purple' : 'primary'} size="sm">
                          {language === 'ar' ? r.nameAr : r.nameEn}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="px-2 py-1.5 border-b border-slate-100 space-y-1">
                    {onNavigateTab && (
                      <>
                        {user?.isSuperAdmin && (
                          <button
                            onClick={() => onNavigateTab('settings')}
                            className="w-full px-3 py-2 flex items-center gap-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                          >
                            <Settings className="w-4 h-4 text-slate-500" />
                            <span>{t('nav.settings')}</span>
                          </button>
                        )}
                        <button
                          onClick={() => onNavigateTab('about')}
                          className="w-full px-3 py-2 flex items-center gap-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          <Info className="w-4 h-4 text-blue-600" />
                          <span>{t('nav.about')}</span>
                        </button>
                      </>
                    )}
                  </div>

                  <div className="px-2 py-1.5">
                    <button
                      onClick={logout}
                      className="w-full px-3 py-2 flex items-center gap-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('nav.logout')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
