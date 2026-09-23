import React, { useState } from 'react';
import { I18nProvider, useI18n } from './i18n/I18nContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CompanyProvider } from './context/CompanyContext';
import { Header } from './components/common/Header';
import { Sidebar, TabType } from './components/common/Sidebar';
import { OverviewDashboard } from './components/dashboard/OverviewDashboard';
import { CompanyList } from './components/companies/CompanyList';
import { TaskList } from './components/tasks/TaskList';
import { CustomFieldManager } from './components/tasks/CustomFieldManager';
import { PermissionMatrix } from './components/permissions/PermissionMatrix';
import { UserManagement } from './components/users/UserManagement';
import { SchemaExplorer } from './components/schema/SchemaExplorer';
import { AuditLogViewer } from './components/audit/AuditLogViewer';
import { ReportDashboard } from './components/reports/ReportDashboard';
import { NotificationCenter } from './components/common/NotificationCenter';
import { SettingsView } from './components/settings/SettingsView';
import { AboutView } from './components/about/AboutView';
import { TaskDetailModal } from './components/tasks/TaskDetailModal';
import { LoginForm } from './components/auth/LoginForm';
import { PermissionKey } from './types/permissions';

const MainLayout: React.FC = () => {
  const { isAuthenticated, isLoading, user, hasPermission } = useAuth();
  const { language } = useI18n();
  const [activeTab, setActiveTabState] = useState<TabType>(() => {
    try {
      const saved = localStorage.getItem('app_active_tab') as TabType;
      if (saved) return saved;
    } catch {}
    return 'overview';
  });

  const setActiveTab = (tab: TabType) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem('app_active_tab', tab);
    } catch {}
  };
  const [selectedTaskIdForModal, setSelectedTaskIdForModal] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-600">
            {language === 'ar'
              ? 'جاري تشغيل وتهيئة منظومة إدارة الشركات...'
              : 'Initializing Enterprise Multi-Company Workspace...'}
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      <Header
        onSelectTask={(taskId) => setSelectedTaskIdForModal(taskId)}
        onOpenMobileNav={() => setIsMobileNavOpen(true)}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />

      <div className="max-w-[1780px] w-full mx-auto px-2.5 sm:px-5 lg:px-7 py-5 flex-1 flex flex-col lg:flex-row gap-5">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          isOpenMobile={isMobileNavOpen}
          onCloseMobile={() => setIsMobileNavOpen(false)}
        />

        <main className="flex-1 min-w-0">
          {activeTab === 'overview' && <OverviewDashboard onNavigate={setActiveTab} />}
          {activeTab === 'companies' && <CompanyList />}
          {activeTab === 'tasks' && <TaskList />}
          {activeTab === 'reports' && <ReportDashboard />}
          {activeTab === 'notifications' && (
            <NotificationCenter onSelectTask={(taskId) => setSelectedTaskIdForModal(taskId)} />
          )}
          {activeTab === 'customFields' && <CustomFieldManager />}
          {activeTab === 'permissions' && (user?.isSuperAdmin ? <PermissionMatrix /> : <OverviewDashboard onNavigate={setActiveTab} />)}
          {activeTab === 'users' && (user?.isSuperAdmin || hasPermission(PermissionKey.USERS_MANAGE) || user?.roles?.some(r => r.slug === 'admin') ? <UserManagement /> : <OverviewDashboard onNavigate={setActiveTab} />)}
          {activeTab === 'schema' && (user?.isSuperAdmin ? <SchemaExplorer /> : <OverviewDashboard onNavigate={setActiveTab} />)}
          {activeTab === 'audit' && (user?.isSuperAdmin ? <AuditLogViewer /> : <OverviewDashboard onNavigate={setActiveTab} />)}
          {activeTab === 'settings' && (user?.isSuperAdmin ? <SettingsView /> : <OverviewDashboard onNavigate={setActiveTab} />)}
          {activeTab === 'about' && <AboutView />}
        </main>
      </div>

      {selectedTaskIdForModal && (
        <TaskDetailModal
          taskId={selectedTaskIdForModal}
          onClose={() => setSelectedTaskIdForModal(null)}
          onTaskUpdated={() => {}}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <AuthProvider>
          <CompanyProvider>
            <MainLayout />
          </CompanyProvider>
        </AuthProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
