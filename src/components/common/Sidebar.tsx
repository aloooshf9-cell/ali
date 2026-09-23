import React, { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../context/AuthContext';
import { PermissionKey } from '../../types/permissions';
import { api } from '../../services/api';
import {
  Building2,
  ShieldCheck,
  Users,
  Database,
  ShieldAlert,
  LayoutDashboard,
  CheckCircle2,
  Layers,
  CheckSquare,
  SlidersHorizontal,
  FileBarChart,
  Bell,
  Settings,
  Info,
  Award,
  X,
  Sparkles,
} from 'lucide-react';

export type TabType =
  | 'overview'
  | 'companies'
  | 'tasks'
  | 'reports'
  | 'notifications'
  | 'customFields'
  | 'permissions'
  | 'users'
  | 'schema'
  | 'audit'
  | 'settings'
  | 'about';

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const { t, language } = useI18n();
  const { hasPermission, user } = useAuth();
  const [copyrightNotice, setCopyrightNotice] = useState('حقوق النظام محفوظة للمهندس علي أحمد عنيد');

  useEffect(() => {
    let isMounted = true;
    api
      .getSystemAbout()
      .then((res) => {
        if (isMounted && res.about) {
          setCopyrightNotice(
            language === 'ar' ? res.about.copyrightTextAr : res.about.copyrightTextEn
          );
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [language]);

  const navItems = [
    {
      id: 'overview' as TabType,
      label: t('nav.dashboard'),
      icon: LayoutDashboard,
      show: true,
      badge: undefined,
    },
    {
      id: 'companies' as TabType,
      label: t('nav.companies'),
      icon: Building2,
      show: hasPermission(PermissionKey.COMPANIES_VIEW),
      badge: undefined,
    },
    {
      id: 'tasks' as TabType,
      label: t('nav.tasks'),
      icon: CheckSquare,
      show: hasPermission(PermissionKey.TASKS_VIEW),
      badge: 'Workflows',
    },
    {
      id: 'reports' as TabType,
      label: t('nav.reports'),
      icon: FileBarChart,
      show: hasPermission(PermissionKey.REPORTS_VIEW),
      badge: 'Executive',
    },
    {
      id: 'notifications' as TabType,
      label: t('notif.center'),
      icon: Bell,
      show: true,
      badge: undefined,
    },
    {
      id: 'customFields' as TabType,
      label: t('nav.custom_fields'),
      icon: SlidersHorizontal,
      show: user?.isSuperAdmin || hasPermission(PermissionKey.CUSTOM_FIELDS_MANAGE),
      badge: 'Dynamic',
    },
    {
      id: 'permissions' as TabType,
      label: t('nav.permissions'),
      icon: ShieldCheck,
      show: !!user?.isSuperAdmin,
      badge: 'Granular',
    },
    {
      id: 'users' as TabType,
      label: t('nav.users'),
      icon: Users,
      show: !!user?.isSuperAdmin || hasPermission(PermissionKey.USERS_MANAGE) || user?.roles?.some(r => r.slug === 'admin'),
      badge: undefined,
    },
    {
      id: 'schema' as TabType,
      label: t('nav.schema'),
      icon: Database,
      show: !!user?.isSuperAdmin,
      badge: '17 Tables',
    },
    {
      id: 'audit' as TabType,
      label: t('nav.audit'),
      icon: ShieldAlert,
      show: !!user?.isSuperAdmin,
      badge: undefined,
    },
    {
      id: 'settings' as TabType,
      label: t('nav.settings'),
      icon: Settings,
      show: !!user?.isSuperAdmin,
      badge: undefined,
    },
    {
      id: 'about' as TabType,
      label: t('nav.about'),
      icon: Info,
      show: true,
      badge: 'Architect',
    },
  ];

  const handleSelect = (tab: TabType) => {
    onSelectTab(tab);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const content = (
    <div className="flex flex-col h-full justify-between">
      <div>
        {/* Mobile Header with Close Button */}
        <div className="flex items-center justify-between lg:hidden pb-3 mb-2 border-b border-slate-200">
          <div className="flex items-center gap-2 text-xs font-black text-slate-800">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>{t('app.title')}</span>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              title={t('action.close')}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <div className="space-y-1">
          {navItems
            .filter((item) => {
              if (!item.show) return false;
              if (user?.allowedTabs && user.allowedTabs.length > 0) {
                return user.allowedTabs.includes(item.id);
              }
              return true;
            })
            .map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive ? 'text-blue-600' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-blue-200/70 text-blue-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
        </div>
      </div>

      {/* Scope & Copyright Section */}
      <div className="hidden mt-6 pt-4 border-t border-slate-100 space-y-3">
        <button
          onClick={() => handleSelect('about')}
          className="w-full text-start p-3 rounded-xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-xs hover:shadow-md transition-all group relative overflow-hidden"
        >
          <div className="flex items-center gap-2 text-[11px] font-bold text-amber-300 mb-1">
            <Award className="w-3.5 h-3.5" />
            <span>{t('about.title')}</span>
          </div>
          <p className="text-[11px] font-semibold text-slate-200 leading-snug break-words">
            "{copyrightNotice}"
          </p>
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
            <span>{t('about.developer_name')}</span>
            <span className="text-blue-400 group-hover:underline">
              {language === 'ar' ? 'عرض التفاصيل ←' : 'View Details →'}
            </span>
          </div>
        </button>

        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>{language === 'ar' ? 'معمارية الحوكمة المؤسسية' : 'Enterprise Governance'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
            <CheckCircle2 className="w-3 h-3" />
            <span>100% Granular RBAC & i18n</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 bg-white min-h-[calc(100vh-5rem)] border-e border-slate-200 p-4 rounded-2xl shadow-xs">
        {content}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <aside className="fixed inset-y-0 start-0 w-72 max-w-[85vw] bg-white p-4 shadow-2xl z-50 overflow-y-auto animate-in slide-in-from-start duration-200">
            {content}
          </aside>
        </div>
      )}
    </>
  );
};
