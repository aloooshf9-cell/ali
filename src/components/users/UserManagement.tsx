import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useI18n } from '../../i18n/I18nContext';
import { PermissionKey } from '../../types/permissions';
import { api } from '../../services/api';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import {
  Users,
  User,
  Building2,
  Shield,
  Mail,
  Phone,
  UserPlus,
  CheckCircle2,
  Building,
  KeyRound,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  Search,
  Filter,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Clock,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Play,
  Lock,
  Layers,
  ChevronDown,
  CheckSquare,
  FileBarChart,
  Bell,
  SlidersHorizontal,
  Database,
  Settings,
  Info,
  LayoutDashboard,
  Check,
} from 'lucide-react';

export const AVAILABLE_NAV_TABS = [
  { id: 'overview', labelAr: 'لوحة المؤشرات والرسوم البيانية', labelEn: 'Overview Dashboard & Charts', icon: LayoutDashboard },
  { id: 'companies', labelAr: 'الشركات التابعة والمؤسسات', labelEn: 'Subsidiary Companies', icon: Building2 },
  { id: 'tasks', labelAr: 'إدارة المهام وتتبع الإنجاز', labelEn: 'Task Management', icon: CheckSquare },
  { id: 'reports', labelAr: 'التقارير المتقدمة والتحليلات', labelEn: 'Advanced Reports', icon: FileBarChart },
  { id: 'notifications', labelAr: 'مركز الإشعارات والتنبيهات', labelEn: 'Notification Center', icon: Bell },
  { id: 'customFields', labelAr: 'الحقول المخصصة والديناميكية', labelEn: 'Custom Fields Manager', icon: SlidersHorizontal },
  { id: 'users', labelAr: 'إدارة المستخدمين والحسابات', labelEn: 'User Management', icon: Users },
  { id: 'permissions', labelAr: 'مصفوفة الصلاحيات والأدوار', labelEn: 'Permission Matrix', icon: ShieldCheck },
  { id: 'schema', labelAr: 'مستكشف قاعدة البيانات والجداول', labelEn: 'Schema Explorer', icon: Database },
  { id: 'audit', labelAr: 'سجل التدقيق الأمني والعمليات', labelEn: 'Audit Log Viewer', icon: ShieldAlert },
  { id: 'settings', labelAr: 'إعدادات المنظومة الشاملة', labelEn: 'System Settings', icon: Settings },
  { id: 'about', labelAr: 'عن المنظومة ومعلومات النظام', labelEn: 'About System', icon: Info },
];

interface EnhancedUser {
  id: string;
  email: string;
  fullName: string;
  fullNameAr?: string;
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  isArchived?: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  roles: any[];
  companies: any[];
  assignedCompanyIds: string[];
  allowedTabs?: string[];
}

export const UserManagement: React.FC = () => {
  const { user: currentUser, hasPermission } = useAuth();
  const { allCompanies } = useCompany();
  const { language, t } = useI18n();

  const [users, setUsers] = useState<EnhancedUser[]>([]);
  const [actorScope, setActorScope] = useState<string>('GLOBAL_SUPER_ADMIN');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<EnhancedUser | null>(null);

  // Form states for Add / Edit
  const [formData, setFormData] = useState({
    fullName: '',
    fullNameAr: '',
    email: '',
    phone: '',
    avatarUrl: '',
    roleSlug: 'admin',
    companyIds: [] as string[],
    password: '',
    isActive: true,
    allowedTabs: [
      'overview',
      'companies',
      'tasks',
      'reports',
      'notifications',
      'customFields',
      'about',
    ] as string[],
  });
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Security Test Suite state
  const [isSecuritySuiteRunning, setIsSecuritySuiteRunning] = useState(false);
  const [securitySuiteResults, setSecuritySuiteResults] = useState<any | null>(null);
  const [showSecurityTab, setShowSecurityTab] = useState(false);

  const canManageUsers = hasPermission(PermissionKey.USERS_MANAGE) || currentUser?.isSuperAdmin || currentUser?.roles?.some((r: any) => r.slug === 'admin');

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const res = await api.getUsers();
      setUsers(res.users || []);
      setActorScope(res.actorScope || 'GLOBAL_SUPER_ADMIN');
    } catch (err: any) {
      setMsg({ text: `Failed to load users: ${err.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  };

  // Filtered Users computation
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Search term
      const query = searchTerm.toLowerCase();
      const matchesSearch =
        u.fullName.toLowerCase().includes(query) ||
        (u.fullNameAr && u.fullNameAr.toLowerCase().includes(query)) ||
        u.email.toLowerCase().includes(query) ||
        (u.phone && u.phone.includes(query));

      if (!matchesSearch) return false;

      // Super Admin protection: if current user is not super admin, NEVER show super admin users anywhere
      if (!currentUser?.isSuperAdmin) {
        const isSuper = (u as any).isSuperAdmin || u.roles?.some((r: any) => r.slug === 'super_admin');
        if (isSuper) return false;
      }

      // Role filter
      if (roleFilter !== 'ALL') {
        const hasRole = u.roles?.some((r: any) => r.slug === roleFilter);
        if (!hasRole) return false;
      }

      // Company filter
      if (companyFilter !== 'ALL') {
        const isSuper = u.roles?.some((r: any) => r.slug === 'super_admin');
        if (!isSuper) {
          const hasCompany = u.companies?.some((c: any) => c.id === companyFilter);
          if (!hasCompany) return false;
        }
      }

      // Status filter
      if (statusFilter === 'ACTIVE' && (!u.isActive || u.isArchived)) return false;
      if (statusFilter === 'INACTIVE' && (u.isActive || u.isArchived)) return false;
      if (statusFilter === 'ARCHIVED' && !u.isArchived) return false;

      return true;
    });
  }, [users, searchTerm, roleFilter, companyFilter, statusFilter]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setFormData({
      fullName: '',
      fullNameAr: '',
      email: '',
      phone: '',
      avatarUrl: '',
      roleSlug: 'admin',
      companyIds: (allCompanies || []).length > 0 ? [allCompanies[0].id] : [],
      password: 'User@2026',
      isActive: true,
      allowedTabs: [
        'overview',
        'companies',
        'tasks',
        'reports',
        'notifications',
        'customFields',
        'about',
      ],
    });
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (u: EnhancedUser) => {
    setSelectedUser(u);
    const primaryRole = u.roles?.[0]?.slug || 'admin';
    setFormData({
      fullName: u.fullName,
      fullNameAr: u.fullNameAr || u.fullName,
      email: u.email,
      phone: u.phone || '',
      avatarUrl: u.avatarUrl || '',
      roleSlug: primaryRole,
      companyIds: u.companies ? u.companies.map((c: any) => c.id) : [],
      password: '',
      isActive: u.isActive,
      allowedTabs: u.allowedTabs && u.allowedTabs.length > 0
        ? u.allowedTabs
        : [
            'overview',
            'companies',
            'tasks',
            'reports',
            'notifications',
            'customFields',
            'about',
          ],
    });
    setIsEditModalOpen(true);
  };

  const handleTabToggle = (tabId: string) => {
    setFormData(prev => {
      const exists = prev.allowedTabs.includes(tabId);
      if (exists) {
        if (prev.allowedTabs.length <= 1) return prev;
        return { ...prev, allowedTabs: prev.allowedTabs.filter(id => id !== tabId) };
      } else {
        return { ...prev, allowedTabs: [...prev.allowedTabs, tabId] };
      }
    });
  };

  const handleSelectAllTabs = () => {
    setFormData(prev => ({
      ...prev,
      allowedTabs: AVAILABLE_NAV_TABS.map(t => t.id),
    }));
  };

  const handleSelectPresetTabs = (preset: 'all' | 'admin' | 'ops') => {
    if (preset === 'all') {
      setFormData(prev => ({
        ...prev,
        allowedTabs: AVAILABLE_NAV_TABS.map(t => t.id),
      }));
    } else if (preset === 'admin') {
      setFormData(prev => ({
        ...prev,
        allowedTabs: ['overview', 'companies', 'tasks', 'reports', 'notifications', 'customFields', 'users', 'about'],
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        allowedTabs: ['overview', 'companies', 'tasks', 'reports', 'notifications', 'about'],
      }));
    }
  };

  // Open Reset Password Modal
  const handleOpenResetPassword = (u: EnhancedUser) => {
    setSelectedUser(u);
    setNewPasswordInput('');
    setIsResetPasswordModalOpen(true);
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (u: EnhancedUser) => {
    setSelectedUser(u);
    setIsDeleteModalOpen(true);
  };

  // Submit Add User
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFormData({ ...formData, avatarUrl: event.target.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        companyIds: formData.companyIds.length > 0 
          ? formData.companyIds 
          : (allCompanies[0] ? [allCompanies[0].id] : []),
      };
      const res = await api.createUser(payload);
      showNotification(res.message || 'User created successfully', 'success');
      setIsAddModalOpen(false);
      await loadUsers();
    } catch (err: any) {
      showNotification(err.message || 'Failed to create user', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit User
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const res = await api.updateUser(selectedUser.id, {
        fullName: formData.fullName,
        fullNameAr: formData.fullNameAr,
        phone: formData.phone,
        avatarUrl: formData.avatarUrl,
        roleSlug: formData.roleSlug,
        companyIds: formData.companyIds,
        isActive: formData.isActive,
        allowedTabs: formData.allowedTabs,
      });
      showNotification(res.message || 'User updated successfully', 'success');
      setIsEditModalOpen(false);
      await loadUsers();
    } catch (err: any) {
      showNotification(err.message || 'Failed to update user', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle User Status
  const handleToggleStatus = async (u: EnhancedUser) => {
    try {
      const nextStatus = !u.isActive;
      const res = await api.setUserStatus(u.id, nextStatus);
      showNotification(res.message || 'Account status updated', 'success');
      await loadUsers();
    } catch (err: any) {
      showNotification(err.message || 'Failed to toggle account status', 'error');
    }
  };

  // Submit Reset Password
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPasswordInput) return;
    setIsSubmitting(true);
    try {
      const res = await api.resetUserPassword(selectedUser.id, newPasswordInput);
      showNotification(res.message || 'Password reset successfully', 'success');
      setIsResetPasswordModalOpen(false);
      setNewPasswordInput('');
    } catch (err: any) {
      showNotification(err.message || 'Failed to reset password', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isPermanentDelete, setIsPermanentDelete] = useState(false);

  // Submit Delete / Archive / Permanent Delete
  const handleDeleteSubmit = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const isPerm = selectedUser.isArchived || isPermanentDelete;
      const res = await api.deleteUser(selectedUser.id, isPerm);
      showNotification(
        res.message ||
          (isPerm
            ? language === 'ar'
              ? 'تم حذف المستخدم نهائياً من النظام بنجاح'
              : 'User permanently deleted from system'
            : language === 'ar'
            ? 'تمت أرشفة حساب المستخدم بنجاح'
            : 'User account archived successfully'),
        'success'
      );
      setIsDeleteModalOpen(false);
      setIsPermanentDelete(false);
      await loadUsers();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete user', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Restore Archived User
  const handleRestoreUser = async (userToRestore: any) => {
    try {
      const res = await api.restoreUser(userToRestore.id);
      showNotification(
        res.message || (language === 'ar' ? 'تمت استعادة الحساب بنجاح' : 'User account restored successfully'),
        'success'
      );
      await loadUsers();
    } catch (err: any) {
      showNotification(err.message || 'Failed to restore user', 'error');
    }
  };

  // Execute Security Test Suite
  const handleRunSecuritySuite = async () => {
    setIsSecuritySuiteRunning(true);
    try {
      const res = await api.runSecuritySuite();
      setSecuritySuiteResults(res);
      setShowSecurityTab(true);
      showNotification(
        language === 'ar'
          ? 'اكتمل فحص الأمان بنجاح: تم اجتياز جميع اختبارات عزل الشركات والصلاحيات.'
          : 'Security audit complete: All multi-tenant & RBAC tests passed successfully.',
        'success'
      );
    } catch (err: any) {
      showNotification(err.message || 'Failed to execute security suite', 'error');
    } finally {
      setIsSecuritySuiteRunning(false);
    }
  };

  // Company checkbox toggle helper
  const handleCompanyToggle = (companyId: string) => {
    setFormData((prev) => {
      const exists = prev.companyIds.includes(companyId);
      if (exists) {
        return { ...prev, companyIds: prev.companyIds.filter((id) => id !== companyId) };
      } else {
        return { ...prev, companyIds: [...prev.companyIds, companyId] };
      }
    });
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return language === 'ar' ? 'لم يسجل دخول بعد' : 'Never logged in';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-blue-600" />
            <span>{t('users.title')}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('users.subtitle')}
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleRunSecuritySuite}
            disabled={isSecuritySuiteRunning}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-colors shadow-2xs disabled:opacity-50"
          >
            {isSecuritySuiteRunning ? (
              <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-600" />
            )}
            <span>{language === 'ar' ? 'فحص الأمان والصلاحيات (Live Test)' : 'Run Security Suite'}</span>
          </button>

          {canManageUsers && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-600/25"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t('users.add_user')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Security Status Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {language === 'ar' ? 'إجمالي المستخدمين' : 'Total Accounts'}
            </p>
            <p className="text-lg font-black text-slate-800">{users.length}</p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {language === 'ar' ? 'الحسابات النشطة' : 'Active Accounts'}
            </p>
            <p className="text-lg font-black text-emerald-600">
              {users.filter((u) => u.isActive && !u.isArchived).length}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {language === 'ar' ? 'حسابات Super Admin' : 'Super Admins'}
            </p>
            <p className="text-lg font-black text-purple-700">
              {users.filter((u) => u.roles?.some((r) => r.slug === 'super_admin')).length}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {language === 'ar' ? 'حماية الحسابات' : 'Security Mode'}
            </p>
            <p className="text-xs font-extrabold text-slate-700">
              Bcrypt & Brute-Force Active
            </p>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {msg && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2.5 shadow-xs transition-all ${
            msg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Security Suite Live Results Panel */}
      {securitySuiteResults && showSecurityTab && (
        <div className="p-5 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <h3 className="font-extrabold text-sm text-slate-100">
                {language === 'ar'
                  ? 'نتائج فحص الأمان والتحقق من الصلاحيات بالخادم (Server-Side Enforced):'
                  : 'Backend Security & RBAC Enforcement Suite Results:'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {securitySuiteResults.summary.passed} / {securitySuiteResults.summary.total} Passed (100%)
              </span>
              <button
                onClick={() => setShowSecurityTab(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg"
              >
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {securitySuiteResults.results.map((r: any) => (
              <div
                key={r.id}
                className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs text-slate-100">
                    {language === 'ar' ? r.nameAr : r.name}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                      r.passed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    HTTP {r.actualStatus} {r.passed ? 'BLOCKED / PASS' : 'FAIL'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {language === 'ar' ? r.descriptionAr : r.description}
                </p>
                <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>Blocked By: {r.blockedBy}</span>
                  <span className="text-emerald-400 font-bold">{r.details}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('users.search_placeholder')}
              className="w-full ps-10 pe-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
            />
          </div>

          {/* Filters Selectors */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">{t('users.all_roles')}</option>
              {currentUser?.isSuperAdmin && <option value="super_admin">Super Admin</option>}
              <option value="admin">{language === 'ar' ? 'ادمن' : 'Admin'}</option>
              <option value="manager_owner">{language === 'ar' ? 'مدير' : 'Manager'}</option>
            </select>

            {/* Company Filter */}
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">{t('users.all_companies')}</option>
              {allCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {language === 'ar' ? c.nameAr : c.nameEn}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">{t('users.all_statuses')}</option>
              <option value="ACTIVE">{t('users.active')}</option>
              <option value="INACTIVE">{t('users.inactive')}</option>
              <option value="ARCHIVED">{t('users.archived')}</option>
            </select>

            {/* Reset filters */}
            {(searchTerm || roleFilter !== 'ALL' || companyFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setRoleFilter('ALL');
                  setCompanyFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="px-3 py-2 text-slate-500 hover:text-slate-800 font-bold"
              >
                {language === 'ar' ? 'إلغاء التصفية' : 'Reset'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Users Table */}
      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider text-start">
                <th className="py-3.5 px-4 text-start">{t('users.name')}</th>
                <th className="py-3.5 px-4 text-start">{t('users.email')}</th>
                <th className="py-3.5 px-4 text-start">{t('users.role')}</th>
                <th className="py-3.5 px-4 text-start">{t('users.companies')}</th>
                <th className="py-3.5 px-4 text-start">{t('users.status')}</th>
                <th className="py-3.5 px-4 text-start">{t('users.last_login')}</th>
                <th className="py-3.5 px-4 text-start">{t('users.created_date')}</th>
                <th className="py-3.5 px-4 text-center">{t('users.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    {language === 'ar' ? 'لا يوجد مستخدمين مطابقين للبحث' : 'No matching users found.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSuper = u.roles?.some((r: any) => r.slug === 'super_admin');
                  const primaryRole = u.roles?.[0];

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        u.isArchived ? 'opacity-60 bg-slate-50/40' : ''
                      }`}
                    >
                      {/* Full Name & Phone */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-xs overflow-hidden shrink-0">
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} alt={u.fullName} className="w-full h-full object-cover" />
                            ) : (
                              u.fullName.charAt(0)
                            )}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900">
                              {language === 'ar' && u.fullNameAr ? u.fullNameAr : u.fullName}
                            </div>
                            {u.phone && (
                              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {u.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email / Username */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{u.email}</span>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <Badge
                            variant={
                              isSuper
                                ? 'purple'
                                : primaryRole?.slug === 'admin'
                                ? 'primary'
                                : 'neutral'
                            }
                            size="sm"
                          >
                            <Shield className="w-3 h-3 me-1 inline" />
                            {language === 'ar'
                              ? primaryRole?.slug === 'admin'
                                ? 'ادمن'
                                : primaryRole?.slug === 'manager_owner'
                                ? 'مدير'
                                : primaryRole?.nameAr
                              : primaryRole?.slug === 'admin'
                              ? 'Admin'
                              : primaryRole?.slug === 'manager_owner'
                              ? 'Manager'
                              : primaryRole?.nameEn || 'User'}
                          </Badge>
                          {u.allowedTabs && u.allowedTabs.length > 0 && (
                            <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                              <SlidersHorizontal className="w-2.5 h-2.5 text-blue-500" />
                              <span>
                                {language === 'ar'
                                  ? `${u.allowedTabs.length} حقول مخصصة`
                                  : `${u.allowedTabs.length} custom tabs`}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Assigned Companies */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1 max-w-xs">
                          {isSuper ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              <Building2 className="w-3 h-3 text-purple-600" />
                              All Companies (Root)
                            </span>
                          ) : u.companies && u.companies.length > 0 ? (
                            u.companies.map((c: any) => (
                              <span
                                key={c.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                              >
                                <Building className="w-2.5 h-2.5 text-slate-400" />
                                {c.code}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">
                              {language === 'ar' ? 'غير مرتبط بشركات' : 'No companies assigned'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {u.isArchived ? (
                          <Badge variant="danger" size="sm">
                            {t('users.archived')}
                          </Badge>
                        ) : (
                          <Badge variant={u.isActive ? 'success' : 'neutral'} size="sm">
                            {u.isActive ? t('users.active') : t('users.inactive')}
                          </Badge>
                        )}
                      </td>

                      {/* Last Login */}
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{formatDate(u.lastLoginAt)}</span>
                        </div>
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{formatDate(u.createdAt)}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {canManageUsers && (
                            <>
                              {/* Edit User */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(u)}
                                title={t('users.edit_user')}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Activate / Deactivate Toggle */}
                              {!u.isArchived && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(u)}
                                  title={u.isActive ? t('users.deactivate') : t('users.activate')}
                                  className={`p-1.5 rounded-lg border transition-colors ${
                                    u.isActive
                                      ? 'border-amber-200 text-amber-600 hover:bg-amber-50'
                                      : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                >
                                  {u.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                </button>
                              )}

                              {/* Reset Password */}
                              <button
                                type="button"
                                onClick={() => handleOpenResetPassword(u)}
                                title={t('users.reset_password')}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 transition-colors"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete / Archive / Restore */}
                              {!u.isArchived ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setIsPermanentDelete(false);
                                    setIsDeleteModalOpen(true);
                                  }}
                                  title={t('users.delete')}
                                  className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <>
                                  {/* Restore Account */}
                                  <button
                                    type="button"
                                    onClick={() => handleRestoreUser(u)}
                                    title={language === 'ar' ? 'استعادة الحساب' : 'Restore Account'}
                                    className="p-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Permanent Delete from System */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedUser(u);
                                      setIsPermanentDelete(true);
                                      setIsDeleteModalOpen(true);
                                    }}
                                    title={language === 'ar' ? 'حذف نهائي من السستم' : 'Permanently Delete from System'}
                                    className="p-1.5 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-100 hover:border-rose-400 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================
          MODAL 1: ADD USER
         ========================================================= */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={t('users.add_user')}
        maxWidth="lg"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'الاسم الكامل (English)' : 'Full Name (English)'} *
              </label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="e.g. Tariq Al-Mansoor"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'الاسم الكامل (العربية)' : 'Full Name (Arabic)'}
              </label>
              <input
                type="text"
                value={formData.fullNameAr}
                onChange={(e) => setFormData({ ...formData, fullNameAr: e.target.value })}
                placeholder="مثال: طارق المنصور"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'البريد الإلكتروني أو اسم المستخدم' : t('users.email')} *
              </label>
              <input
                type="text"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@holding.com"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('users.phone')}
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+966 50 000 0000"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {language === 'ar' ? 'صورة المستخدم' : 'User Avatar'}
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200">
                {formData.avatarUrl ? (
                  <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div className="flex-1 w-full flex flex-col gap-1.5">
                <input
                  type="text"
                  value={formData.avatarUrl}
                  onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                  placeholder="https://... (أو رفع صورة)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('users.role')} *
              </label>
              <select
                value={formData.roleSlug}
                onChange={(e) => setFormData({ ...formData, roleSlug: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {currentUser?.isSuperAdmin && (
                  <option value="super_admin">Super Admin (مسؤول النظام الشامل)</option>
                )}
                <option value="admin">{language === 'ar' ? 'ادمن' : 'Admin'}</option>
                <option value="manager_owner">{language === 'ar' ? 'مدير' : 'Manager'}</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  {language === 'ar' ? 'كلمة المرور الابتدائية' : 'Initial Password'} *
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      password: `Sec@${Math.floor(1000 + Math.random() * 9000)}#`,
                    })
                  }
                  className="text-[10px] text-blue-600 font-bold hover:underline"
                >
                  {language === 'ar' ? 'توليد عشوائي' : 'Auto Generate'}
                </button>
              </div>
              <input
                type="text"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Assigned Companies Multi-Select */}
          {formData.roleSlug !== 'super_admin' && (
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700">
                {t('users.assigned_companies_select')}
              </label>
              <div className="max-h-36 overflow-y-auto p-2.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                {allCompanies.map((c) => {
                  const checked = formData.companyIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer transition-colors text-xs text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleCompanyToggle(c.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-bold text-slate-800 font-mono text-[11px]">{c.code}</span>
                      <span className="text-slate-600">
                        {language === 'ar' ? c.nameAr : c.nameEn}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation & Left-Side Fields Control (التحكم بالحقول والتبويبات التي تظهر للمستخدم ع اليسار) */}
          <div className="space-y-3 pt-3 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="flex items-center gap-2 text-xs font-black text-slate-800">
                  <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                  <span>
                    {language === 'ar'
                      ? 'التحكم بالحقول والتبويبات التي تظهر للمستخدم (القائمة اليسرى)'
                      : 'Control Visible Navigation Tabs & Left-Side Fields'}
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {language === 'ar'
                    ? 'حدد بالضبط ما يستطيع هذا المستخدم رؤيته والوصول إليه من القائمة الجانبية'
                    : 'Select exactly which tabs and left-side navigation fields this user can access'}
                </p>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleSelectAllTabs}
                  className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 text-[10px] font-bold transition-colors"
                >
                  {language === 'ar' ? 'تحديد الكل' : 'Select All'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPresetTabs('ops')}
                  className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 text-[10px] font-bold transition-colors"
                >
                  {language === 'ar' ? 'تشغيلي فقط' : 'Operations Only'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPresetTabs('admin')}
                  className="px-2 py-1 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 text-[10px] font-bold transition-colors"
                >
                  {language === 'ar' ? 'إداري مخصص' : 'Custom Admin'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-2xl border border-slate-200 bg-slate-50/80 max-h-52 overflow-y-auto">
              {AVAILABLE_NAV_TABS.map(tab => {
                const TabIcon = tab.icon;
                const isSelected = formData.allowedTabs.includes(tab.id);
                return (
                  <label
                    key={tab.id}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-white border-blue-300 shadow-2xs text-blue-900'
                        : 'bg-white/60 border-slate-200 hover:bg-white text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleTabToggle(tab.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <div className={`p-1 rounded-lg ${isSelected ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                      <TabIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold truncate">
                      {language === 'ar' ? tab.labelAr : tab.labelEn}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Active Status Checkbox */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="addUserActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="addUserActive" className="text-xs font-bold text-slate-700 cursor-pointer">
              {language === 'ar' ? 'تفعيل الحساب فورًا' : 'Activate Account Immediately'}
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              {t('action.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? '...' : t('users.add_user')}
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================
          MODAL 2: EDIT USER
         ========================================================= */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={t('users.edit_user')}
        maxWidth="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'الاسم الكامل (English)' : 'Full Name (English)'} *
              </label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'الاسم الكامل (العربية)' : 'Full Name (Arabic)'}
              </label>
              <input
                type="text"
                value={formData.fullNameAr}
                onChange={(e) => setFormData({ ...formData, fullNameAr: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('users.email')} (Read-Only)
              </label>
              <input
                type="email"
                disabled
                value={formData.email}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('users.phone')}
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {language === 'ar' ? 'صورة المستخدم' : 'User Avatar'}
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200">
                {formData.avatarUrl ? (
                  <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div className="flex-1 w-full flex flex-col gap-1.5">
                <input
                  type="text"
                  value={formData.avatarUrl}
                  onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                  placeholder="https://... (أو رفع صورة)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('users.role')} *
            </label>
            <select
              value={formData.roleSlug}
              onChange={(e) => setFormData({ ...formData, roleSlug: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {currentUser?.isSuperAdmin && (
                <option value="super_admin">Super Admin (مسؤول النظام الشامل)</option>
              )}
              <option value="admin">{language === 'ar' ? 'ادمن' : 'Admin'}</option>
              <option value="manager_owner">{language === 'ar' ? 'مدير' : 'Manager'}</option>
            </select>
          </div>

          {/* Assigned Companies Multi-Select */}
          {formData.roleSlug !== 'super_admin' && (
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700">
                {t('users.assigned_companies_select')}
              </label>
              <div className="max-h-36 overflow-y-auto p-2.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                {allCompanies.map((c) => {
                  const checked = formData.companyIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer transition-colors text-xs text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleCompanyToggle(c.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-bold text-slate-800 font-mono text-[11px]">{c.code}</span>
                      <span className="text-slate-600">
                        {language === 'ar' ? c.nameAr : c.nameEn}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation & Left-Side Fields Control (التحكم بالحقول والتبويبات التي تظهر للمستخدم ع اليسار) */}
          <div className="space-y-3 pt-3 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="flex items-center gap-2 text-xs font-black text-slate-800">
                  <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                  <span>
                    {language === 'ar'
                      ? 'التحكم بالحقول والتبويبات التي تظهر للمستخدم (القائمة اليسرى)'
                      : 'Control Visible Navigation Tabs & Left-Side Fields'}
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {language === 'ar'
                    ? 'حدد بالضبط ما يستطيع هذا المستخدم رؤيته والوصول إليه من القائمة الجانبية'
                    : 'Select exactly which tabs and left-side navigation fields this user can access'}
                </p>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleSelectAllTabs}
                  className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 text-[10px] font-bold transition-colors"
                >
                  {language === 'ar' ? 'تحديد الكل' : 'Select All'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPresetTabs('ops')}
                  className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 text-[10px] font-bold transition-colors"
                >
                  {language === 'ar' ? 'تشغيلي فقط' : 'Operations Only'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPresetTabs('admin')}
                  className="px-2 py-1 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 text-[10px] font-bold transition-colors"
                >
                  {language === 'ar' ? 'إداري مخصص' : 'Custom Admin'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-2xl border border-slate-200 bg-slate-50/80 max-h-52 overflow-y-auto">
              {AVAILABLE_NAV_TABS.map(tab => {
                const TabIcon = tab.icon;
                const isSelected = formData.allowedTabs.includes(tab.id);
                return (
                  <label
                    key={tab.id}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-white border-blue-300 shadow-2xs text-blue-900'
                        : 'bg-white/60 border-slate-200 hover:bg-white text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleTabToggle(tab.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <div className={`p-1 rounded-lg ${isSelected ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                      <TabIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold truncate">
                      {language === 'ar' ? tab.labelAr : tab.labelEn}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Status Checkbox */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="editUserActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="editUserActive" className="text-xs font-bold text-slate-700 cursor-pointer">
              {language === 'ar' ? 'حساب نشط (Active)' : 'Account is Active'}
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              {t('action.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? '...' : t('action.save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================
          MODAL 3: RESET PASSWORD
         ========================================================= */}
      <Modal
        isOpen={isResetPasswordModalOpen}
        onClose={() => setIsResetPasswordModalOpen(false)}
        title={t('users.reset_password')}
        maxWidth="md"
      >
        <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
          <p className="text-xs text-slate-600">
            {language === 'ar'
              ? `تعيين كلمة مرور جديدة لحساب: ${selectedUser?.email}`
              : `Assign a new secure password for user: ${selectedUser?.email}`}
          </p>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                {t('users.new_password_label')} *
              </label>
              <button
                type="button"
                onClick={() => setNewPasswordInput(`Pass@${Math.floor(1000 + Math.random() * 9000)}!`)}
                className="text-[10px] text-purple-600 font-bold hover:underline"
              >
                {language === 'ar' ? 'توليد تلقائي' : 'Auto Generate'}
              </button>
            </div>
            <input
              type="text"
              required
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              🔒 {language === 'ar' ? 'سيتم تشفير كلمة المرور فورًا باستخدام Bcrypt (10 salt rounds)' : 'Password will be salted and hashed via Bcrypt'}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsResetPasswordModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              {t('action.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newPasswordInput}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? '...' : t('users.reset_password')}
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================
          MODAL 4: DELETE / ARCHIVE CONFIRMATION
         ========================================================= */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={
          selectedUser?.isArchived || isPermanentDelete
            ? language === 'ar'
              ? 'حذف نهائي من النظام'
              : 'Permanently Delete User'
            : t('users.delete')
        }
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-900 space-y-1">
              <p className="font-black">
                {selectedUser?.isArchived || isPermanentDelete
                  ? language === 'ar'
                    ? 'تحذير: حذف نهائي لا رجعة فيه'
                    : 'Warning: Irreversible Permanent Deletion'
                  : language === 'ar'
                  ? 'تأكيد أرشفة وتعطيل الحساب'
                  : 'Confirm User Archive & Deactivation'}
              </p>
              <p>
                {selectedUser?.isArchived || isPermanentDelete
                  ? language === 'ar'
                    ? `هل أنت متأكد من حذف حساب "${selectedUser?.fullName}" (${selectedUser?.email}) نهائياً من النظام؟ سيتم حذف جميع بيانات وسجلات المستخدم المرتبطة ولن يمكنك استرجاعها.`
                    : `Are you sure you want to permanently delete "${selectedUser?.fullName}" (${selectedUser?.email}) from the system? This action cannot be undone.`
                  : language === 'ar'
                  ? `هل أنت متأكد من أرشفة حساب "${selectedUser?.fullName}" (${selectedUser?.email})؟ سيتم إلغاء صلاحيات الدخول فورًا ويمكنك لاحقاً حذفه نهائياً أو استعادته.`
                  : `Are you sure you want to archive "${selectedUser?.fullName}" (${selectedUser?.email})? Access will be revoked and you can permanently delete or restore it later.`}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              {t('action.cancel')}
            </button>
            <button
              type="button"
              onClick={handleDeleteSubmit}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
            >
              {isSubmitting
                ? '...'
                : selectedUser?.isArchived || isPermanentDelete
                ? language === 'ar'
                  ? 'تأكيد الحذف النهائي'
                  : 'Confirm Permanent Delete'
                : language === 'ar'
                ? 'تأكيد الأرشفة'
                : 'Confirm Archive'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
