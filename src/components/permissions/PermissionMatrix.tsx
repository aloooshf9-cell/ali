import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { useToast } from '../../context/ToastContext';
import { Role, Permission } from '../../types/database';
import { PermissionKey } from '../../types/permissions';
import { api } from '../../services/api';
import { Modal } from '../common/Modal';
import {
  Shield,
  ShieldCheck,
  Check,
  X,
  Lock,
  Plus,
  Trash2,
  Sliders,
  Layers,
} from 'lucide-react';

export const PermissionMatrix: React.FC = () => {
  const { user } = useAuth();
  const { language, t } = useI18n();
  const { toast } = useToast();

  const isAr = language === 'ar';
  const isSuperAdmin = !!user?.isSuperAdmin;

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [rolePermissions, setRolePermissions] = useState<PermissionKey[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Create Permission Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newModule, setNewModule] = useState('operations');
  const [newNameAr, setNewNameAr] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [newDescAr, setNewDescAr] = useState('');
  const [newDescEn, setNewDescEn] = useState('');
  const [isCreatingPerm, setIsCreatingPerm] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        api.getRoles(),
        api.getPermissions(),
      ]);
      setRoles(rolesRes.roles);
      setPermissions(permsRes.permissions);

      const defaultRole = rolesRes.roles.find((r: any) => r.slug === 'admin') || rolesRes.roles[0];
      if (defaultRole) {
        setSelectedRoleId(defaultRole.id);
        const rpRes = await api.getRolePermissions(defaultRole.id);
        setRolePermissions(rpRes.permissions);
      }
    } catch (err) {
      console.error('Failed to load permissions matrix:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRole = async (roleId: string) => {
    setSelectedRoleId(roleId);
    setStatusMessage(null);
    try {
      const rpRes = await api.getRolePermissions(roleId);
      setRolePermissions(rpRes.permissions);
    } catch (err) {
      console.error('Failed to load role permissions:', err);
    }
  };

  const handleTogglePermission = (key: PermissionKey) => {
    if (!isSuperAdmin) return;
    const selectedRole = roles.find(r => r.id === selectedRoleId);
    if (selectedRole?.slug === 'super_admin') return; // immutable all-access

    setRolePermissions(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  const handleSaveMatrix = async () => {
    if (!selectedRoleId || !isSuperAdmin) return;
    setIsSaving(true);
    setStatusMessage(null);
    try {
      await api.updateRolePermissions(selectedRoleId, rolePermissions);
      setStatusMessage(t('permissions.save_success'));
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      console.error('Failed to save permissions:', err);
      setStatusMessage(`Error: ${err.message || 'Failed to save'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreatePermissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newNameAr.trim()) {
      toast.error(isAr ? 'يرجى إدخال المفتاح البرمجي واسم الصلاحية بالعربية' : 'Please provide key and Arabic name');
      return;
    }

    try {
      setIsCreatingPerm(true);
      const formattedKey = newKey.trim().toLowerCase().replace(/\s+/g, '.');
      const res = await api.createPermission({
        key: formattedKey,
        module: newModule.trim().toLowerCase(),
        nameAr: newNameAr.trim(),
        nameEn: newNameEn.trim() || newNameAr.trim(),
        descriptionAr: newDescAr.trim(),
        descriptionEn: newDescEn.trim(),
      });

      if (res.success) {
        toast.success(isAr ? 'تمت إضافة الصلاحية الجديدة للنظام بنجاح' : 'New system permission created successfully');
        setIsCreateModalOpen(false);
        setNewKey('');
        setNewNameAr('');
        setNewNameEn('');
        setNewDescAr('');
        setNewDescEn('');
        // Refresh permissions
        const permsRes = await api.getPermissions();
        setPermissions(permsRes.permissions);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create permission');
    } finally {
      setIsCreatingPerm(false);
    }
  };

  const handleDeleteCustomPermission = async (key: string) => {
    if (!window.confirm(isAr ? `هل أنت متأكد من حذف الصلاحية (${key}) من النظام؟` : `Delete permission ${key}?`)) return;
    try {
      const res = await api.deletePermission(key);
      if (res.success) {
        toast.success(isAr ? 'تم حذف الصلاحية بنجاح' : 'Permission deleted successfully');
        const permsRes = await api.getPermissions();
        setPermissions(permsRes.permissions);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete permission');
    }
  };

  const selectedRole = roles.find(r => r.id === selectedRoleId);
  const isSelectedSuperAdmin = selectedRole?.slug === 'super_admin';

  // Group permissions by module
  const modules: string[] = Array.from(new Set(permissions.map(p => p.module)));

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-400 font-medium">
        Loading permissions matrix...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-blue-600" />
            <span>{t('permissions.title')}</span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {t('permissions.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isSuperAdmin && (
            <button
              id="btn-create-permission"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{isAr ? 'إنشاء صلاحية جديدة للنظام' : 'Create System Permission'}</span>
            </button>
          )}

          {isSuperAdmin && !isSelectedSuperAdmin && (
            <button
              id="btn-save-permissions"
              onClick={handleSaveMatrix}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isSaving ? '...' : t('action.save')}</span>
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Role Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
        {roles.map(role => {
          const isCurrent = role.id === selectedRoleId;
          return (
            <button
              key={role.id}
              onClick={() => handleSelectRole(role.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isCurrent
                  ? 'bg-white text-blue-700 shadow-xs ring-1 ring-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Shield className={`w-3.5 h-3.5 ${isCurrent ? 'text-blue-600' : 'text-slate-400'}`} />
              <span>{language === 'ar' ? role.nameAr : role.nameEn}</span>
              {role.slug === 'super_admin' && (
                <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded-md font-semibold">
                  Global
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Super Admin Immutable Notice */}
      {isSelectedSuperAdmin && (
        <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/70 text-purple-900 text-xs flex items-center gap-3">
          <Lock className="w-5 h-5 text-purple-600 shrink-0" />
          <div>
            <p className="font-bold">{t('permissions.super_admin_notice')}</p>
            <p className="text-purple-700 text-[11px] mt-0.5">
              {isAr
                ? 'مدير النظام الأعلى يملك بطبيعته حق الوصول الشامل وغير المقيد لكافة الصلاحيات البرمجية والحقول والموارد.'
                : 'Super Admin inherently possesses global bypass capability on all resources and actions.'}
            </p>
          </div>
        </div>
      )}

      {/* Permissions Matrix Content */}
      <div className="space-y-6">
        {modules.map(moduleName => {
          const modulePerms = permissions.filter(p => p.module === moduleName);

          return (
            <div
              key={moduleName}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden"
            >
              {/* Module Header */}
              <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-800 text-xs uppercase tracking-wider">
                    {moduleName}
                  </span>
                  <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                    {modulePerms.length}
                  </span>
                </div>
              </div>

              {/* Module Permissions List */}
              <div className="divide-y divide-slate-100">
                {modulePerms.map(perm => {
                  const isGranted = isSelectedSuperAdmin || rolePermissions.includes(perm.key as PermissionKey);
                  const isBuiltin = [
                    'companies.create', 'companies.read', 'companies.update', 'companies.delete',
                    'tasks.create', 'tasks.read', 'tasks.update', 'tasks.delete',
                    'users.create', 'users.read', 'users.update', 'users.delete',
                    'roles.manage', 'reports.view', 'audit.view', 'custom_fields.manage'
                  ].includes(perm.key);

                  return (
                    <div
                      key={perm.key}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800">
                            {language === 'ar' ? perm.nameAr : perm.nameEn}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            {perm.key}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {language === 'ar' ? perm.descriptionAr : perm.descriptionEn}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        {isSuperAdmin && !isBuiltin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomPermission(perm.key)}
                            title={isAr ? 'حذف هذه الصلاحية المخصصة' : 'Delete Custom Permission'}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={!isSuperAdmin || isSelectedSuperAdmin}
                          onClick={() => handleTogglePermission(perm.key as PermissionKey)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            isGranted
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                          } ${
                            !isSuperAdmin || isSelectedSuperAdmin ? 'cursor-default opacity-90' : 'cursor-pointer'
                          }`}
                        >
                          {isGranted ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{t('permissions.granted')}</span>
                            </>
                          ) : (
                            <>
                              <X className="w-3.5 h-3.5 text-slate-400" />
                              <span>{t('permissions.revoked')}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create System Permission */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title={isAr ? 'إنشاء صلاحية جديدة للنظام والتحكم بها' : 'Create New System Permission'}
        >
          <form onSubmit={handleCreatePermissionSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isAr ? 'المفتاح البرمجي للصلاحية (Permission Key):' : 'Permission Key (dot-notation):'}
              </label>
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g. contracts.sign or billing.export"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-purple-500 outline-hidden"
                required
              />
              <p className="text-[10px] text-slate-400 mt-1">
                {isAr ? 'يستخدم المفتاح للتحقق البرمجي مثل documents.archive' : 'Unique identifier for RBAC checks'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isAr ? 'الوحدة / الموديول (Module):' : 'Module:'}
                </label>
                <select
                  value={newModule}
                  onChange={(e) => setNewModule(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-purple-500 outline-hidden"
                >
                  <option value="operations">{isAr ? 'عمليات وتشغيل (operations)' : 'operations'}</option>
                  <option value="tasks">{isAr ? 'مهام ومسارات (tasks)' : 'tasks'}</option>
                  <option value="companies">{isAr ? 'شركات وفروع (companies)' : 'companies'}</option>
                  <option value="finance">{isAr ? 'مالية وحسابات (finance)' : 'finance'}</option>
                  <option value="reports">{isAr ? 'تقارير (reports)' : 'reports'}</option>
                  <option value="system">{isAr ? 'نظام وإعدادات (system)' : 'system'}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isAr ? 'الاسم بالعربية:' : 'Name (Arabic):'}
                </label>
                <input
                  type="text"
                  value={newNameAr}
                  onChange={(e) => setNewNameAr(e.target.value)}
                  placeholder="e.g. توقيع العقود الإلكترونية"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 outline-hidden"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isAr ? 'الاسم بالإنجليزية:' : 'Name (English):'}
              </label>
              <input
                type="text"
                value={newNameEn}
                onChange={(e) => setNewNameEn(e.target.value)}
                placeholder="e.g. Sign Digital Contracts"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isAr ? 'الوصف بالعربية:' : 'Description (Arabic):'}
              </label>
              <textarea
                value={newDescAr}
                onChange={(e) => setNewDescAr(e.target.value)}
                placeholder="صلاحية تتيح للمستخدم اعتماد وتوقيع المعاملات الرسمية..."
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl font-bold"
              >
                {t('action.cancel')}
              </button>
              <button
                type="submit"
                disabled={isCreatingPerm}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all disabled:opacity-50"
              >
                {isCreatingPerm ? '...' : (isAr ? 'إضافة الصلاحية وتفعيلها' : 'Add Permission')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
