import React, { useState, useEffect } from 'react';
import { CustomField, CustomFieldType, Company } from '../../types/database';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../context/AuthContext';
import { PermissionKey } from '../../types/permissions';
import {
  SlidersHorizontal,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Building2,
  Shield,
  Layers,
} from 'lucide-react';

interface CustomFieldManagerProps {
  onClose?: () => void;
}

export const CustomFieldManager: React.FC<CustomFieldManagerProps> = ({ onClose }) => {
  const { t, language } = useI18n();
  const isAr = language === 'ar';
  const { user, hasPermission } = useAuth();

  const [fields, setFields] = useState<CustomField[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State for New/Edit Field
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);

  // Form states
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [fieldKey, setFieldKey] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [optionsStr, setOptionsStr] = useState('');
  const [required, setRequired] = useState(false);
  const [defaultValue, setDefaultValue] = useState('');
  const [visibility, setVisibility] = useState<'all' | 'internal' | 'admin_only' | string>('all');
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fieldTypes: Array<{ type: CustomFieldType; labelAr: string; labelEn: string }> = [
    { type: 'text', labelAr: 'نص قصير (Text)', labelEn: 'Short Text' },
    { type: 'long_text', labelAr: 'نص متعدد الأسطر (Long Text)', labelEn: 'Long Text / Paragraph' },
    { type: 'number', labelAr: 'رقم (Number)', labelEn: 'Number' },
    { type: 'date', labelAr: 'تاريخ (Date)', labelEn: 'Date' },
    { type: 'date_time', labelAr: 'تاريخ ووقت (Date & Time)', labelEn: 'Date & Time' },
    { type: 'dropdown', labelAr: 'قائمة منسدلة (Dropdown)', labelEn: 'Dropdown Single Select' },
    { type: 'multi_select', labelAr: 'اختيار متعدد (Multi Select)', labelEn: 'Multi Select' },
    { type: 'checkbox', labelAr: 'مربع اختيار (Checkbox)', labelEn: 'Checkbox (Yes/No)' },
    { type: 'radio', labelAr: 'أزرار اختيار أحادي (Radio)', labelEn: 'Radio Group' },
    { type: 'user_selector', labelAr: 'محدد مستخدم (User Selector)', labelEn: 'User Selector' },
    { type: 'company_selector', labelAr: 'محدد شركة (Company Selector)', labelEn: 'Company Selector' },
    { type: 'file_upload', labelAr: 'رفع ملف (File Upload)', labelEn: 'File Upload' },
  ];

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchFieldsAndCompanies = async () => {
    try {
      setIsLoading(true);
      const authHeaders = getAuthHeaders();
      const [fieldsRes, compRes] = await Promise.all([
        fetch('/api/custom-fields', { headers: authHeaders, credentials: 'include' }),
        fetch('/api/companies', { headers: authHeaders, credentials: 'include' }),
      ]);

      if (fieldsRes.ok) {
        const data = await fieldsRes.json();
        setFields(data.customFields || []);
      }
      if (compRes.ok) {
        const cData = await compRes.json();
        setCompanies(cData.companies || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load fields');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFieldsAndCompanies();
  }, []);

  const openCreateModal = () => {
    setEditingField(null);
    setNameAr('');
    setNameEn('');
    setFieldKey('');
    setType('text');
    setOptionsStr('');
    setRequired(false);
    setDefaultValue('');
    setVisibility('all');
    setSelectedCompanies([]);
    setSelectedRoles([]);
    setSortOrder(fields.length + 1);
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (f: CustomField) => {
    setEditingField(f);
    setNameAr(f.nameAr);
    setNameEn(f.nameEn);
    setFieldKey(f.fieldKey);
    setType(f.type);
    setOptionsStr((f.options || []).join(', '));
    setRequired(f.required);
    setDefaultValue(f.defaultValue || '');
    setVisibility(f.visibility || 'all');
    setSelectedCompanies(f.companyIds || []);
    setSelectedRoles(f.roleSlugs || []);
    setSortOrder(f.sortOrder || 0);
    setIsActive(f.isActive !== false);
    setIsModalOpen(true);
  };

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const parsedOptions = ['dropdown', 'multi_select', 'radio'].includes(type)
        ? optionsStr
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined;

      const payload = {
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim(),
        fieldKey: fieldKey.trim() || nameEn.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        type,
        options: parsedOptions,
        required,
        defaultValue: defaultValue.trim() || undefined,
        visibility,
        companyIds: selectedCompanies,
        roleSlugs: selectedRoles,
        sortOrder: Number(sortOrder),
        isActive,
      };

      const url = editingField ? `/api/custom-fields/${editingField.id}` : '/api/custom-fields';
      const method = editingField ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save custom field');

      setIsModalOpen(false);
      fetchFieldsAndCompanies();
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من حذف هذا الحقل المخصص؟' : 'Are you sure you want to delete this custom field?')) {
      return;
    }

    try {
      const res = await fetch(`/api/custom-fields/${fieldId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete custom field');
      fetchFieldsAndCompanies();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">
              {isAr ? 'نظام الحقول المخصصة الديناميكية (Dynamic Custom Fields)' : 'Dynamic Custom Fields System'}
            </h2>
          </div>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            {isAr
              ? 'إنشاء وإدارة 12 نوعاً من الحقول الديناميكية للمهام، مع تحكم دقيق بمستوى الرؤية، الشركات المستهدفة، والصلاحيات'
              : 'Configure 12 dynamic field types for task workflows with company scoping, role visibility, and validations'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              {isAr ? 'العودة للمهام' : 'Back to Tasks'}
            </button>
          )}

          {(user?.isSuperAdmin || hasPermission(PermissionKey.CUSTOM_FIELDS_MANAGE)) && (
            <button
              id="create-custom-field-btn"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{isAr ? 'إنشاء حقل ديناميكي جديد' : 'New Custom Field'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Fields Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-600 flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>{isAr ? 'جاري تحميل الحقول...' : 'Loading custom fields...'}</span>
          </div>
        ) : fields.length === 0 ? (
          <div className="p-12 text-center text-slate-600">
            <SlidersHorizontal className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-semibold">{isAr ? 'لا توجد حقول مخصصة مسجلة' : 'No custom fields configured'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3.5 text-start">{isAr ? 'الاسم بالعربية' : 'Arabic Name'}</th>
                  <th className="p-3.5 text-start">{isAr ? 'الاسم بالإنجليزية' : 'English Name'}</th>
                  <th className="p-3.5 text-start">{isAr ? 'المعرف البرمجي' : 'Field Key'}</th>
                  <th className="p-3.5 text-start">{isAr ? 'النوع' : 'Type'}</th>
                  <th className="p-3.5 text-center">{isAr ? 'إلزامي' : 'Required'}</th>
                  <th className="p-3.5 text-start">{isAr ? 'الشركات' : 'Companies'}</th>
                  <th className="p-3.5 text-center">{isAr ? 'الرؤية' : 'Visibility'}</th>
                  <th className="p-3.5 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="p-3.5 text-end">{isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fields.map((field) => (
                  <tr key={field.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">{field.nameAr}</td>
                    <td className="p-3.5 font-semibold text-slate-800">{field.nameEn}</td>
                    <td className="p-3.5 font-mono text-[11px] text-blue-700 bg-blue-50/50 px-2 rounded">
                      {field.fieldKey}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-700 font-semibold uppercase">
                        {field.type}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      {field.required ? (
                        <span className="text-rose-600 font-bold">{isAr ? 'نعم' : 'Yes'}</span>
                      ) : (
                        <span className="text-slate-600">{isAr ? 'لا' : 'No'}</span>
                      )}
                    </td>
                    <td className="p-3.5 text-slate-600">
                      {!field.companyIds || field.companyIds.length === 0 ? (
                        <span className="text-emerald-700 font-semibold">{isAr ? 'كافة الشركات' : 'All Companies'}</span>
                      ) : (
                        <span>{field.companyIds.length} {isAr ? 'شركات محددة' : 'companies'}</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {field.visibility}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      {field.isActive !== false ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {isAr ? 'نشط' : 'Active'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-600 font-semibold">
                          <XCircle className="w-3.5 h-3.5" />
                          {isAr ? 'معطل' : 'Inactive'}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-end">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(field)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title={t('action.edit')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {(user?.isSuperAdmin || hasPermission(PermissionKey.CUSTOM_FIELDS_MANAGE)) && (
                          <button
                            onClick={() => handleDeleteField(field.id)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title={t('action.delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingField
                    ? (isAr ? `تعديل الحقل المخصص: ${editingField.nameAr}` : `Edit Custom Field: ${editingField.nameEn}`)
                    : (isAr ? 'إنشاء حقل ديناميكي مخصص جديد' : 'Create Dynamic Custom Field')}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  {isAr ? 'حدد النوع والخصائص والشروط' : 'Define schema, field type, and tenant rules'}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveField} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isAr ? 'الاسم بالعربية' : 'Name (Arabic)'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    placeholder="مثال: رقم أمر الشراء"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isAr ? 'الاسم بالإنجليزية' : 'Name (English)'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nameEn}
                    onChange={(e) => {
                      setNameEn(e.target.value);
                      if (!editingField && !fieldKey) {
                        setFieldKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                      }
                    }}
                    placeholder="e.g. Purchase Order Number"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isAr ? 'المعرف البرمجي (Field Key)' : 'Field Key (Unique)'}
                  </label>
                  <input
                    type="text"
                    disabled={!!editingField}
                    value={fieldKey}
                    onChange={(e) => setFieldKey(e.target.value)}
                    placeholder="po_number"
                    className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isAr ? 'نوع الحقل (12 نوعاً مدعوماً)' : 'Field Type (12 Supported Types)'} <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as CustomFieldType)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
                  >
                    {fieldTypes.map((ft) => (
                      <option key={ft.type} value={ft.type}>
                        {isAr ? ft.labelAr : ft.labelEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Options for Dropdown / MultiSelect / Radio */}
              {['dropdown', 'multi_select', 'radio'].includes(type) && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isAr ? 'الخيارات المتاحة (افصل بينها بفواصل)' : 'Options (Comma-separated)'}
                  </label>
                  <input
                    type="text"
                    value={optionsStr}
                    onChange={(e) => setOptionsStr(e.target.value)}
                    placeholder={isAr ? 'خيار 1, خيار 2, خيار 3' : 'Option A, Option B, Option C'}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
                  />
                </div>
              )}

              {/* Required & Active Checkboxes */}
              <div className="flex flex-wrap gap-6 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={required}
                    onChange={(e) => setRequired(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="font-semibold text-slate-800">{isAr ? 'حقل إلزامي (Required)' : 'Required Field'}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="font-semibold text-slate-800">{isAr ? 'حقل نشط (Active)' : 'Active Status'}</span>
                </label>
              </div>

              {/* Visibility & Scope */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isAr ? 'مستوى الرؤية (Visibility)' : 'Visibility Level'}
                  </label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as any)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
                  >
                    <option value="all">{isAr ? 'الجميع (All Users)' : 'All Users'}</option>
                    <option value="internal">{isAr ? 'داخلي للموظفين (Internal Only)' : 'Internal Only'}</option>
                    <option value="admin_only">{isAr ? 'المسؤولون فقط (Admin Only)' : 'Admin Only'}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isAr ? 'الترتيب (Sort Order)' : 'Sort Order'}
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
                  />
                </div>
              </div>

              {/* Companies Scope */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  {isAr ? 'تخصيص الحقل لشركات محددة (اتركه فارغاً ليعمل في كافة الشركات):' : 'Company Scoping (leave empty for all companies):'}
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {companies.map((c) => {
                    const isSelected = selectedCompanies.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedCompanies(selectedCompanies.filter((id) => id !== c.id));
                          } else {
                            setSelectedCompanies([...selectedCompanies, c.id]);
                          }
                        }}
                        className={`px-3 py-1 text-xs rounded-lg font-medium border transition-all ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {isAr && c.nameAr ? c.nameAr : c.nameEn}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  {t('action.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : t('action.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
