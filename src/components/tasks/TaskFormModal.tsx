import React, { useState, useEffect } from 'react';
import { Task, Company, User, CustomField, TaskStatusSlug, TaskPrioritySlug } from '../../types/database';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../context/AuthContext';
import { DynamicFieldInput } from './DynamicFieldInput';
import { X, AlertCircle, Sparkles, Plus, Trash2 } from 'lucide-react';

interface TaskFormModalProps {
  taskToEdit?: Task | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({ taskToEdit, onClose, onSuccess }) => {
  const { t, language } = useI18n();
  const isAr = language === 'ar';
  const { user } = useAuth();

  const isEdit = !!taskToEdit;

  // Form State
  const [title, setTitle] = useState(taskToEdit?.title || '');
  const [description, setDescription] = useState(taskToEdit?.description || '');
  const [companyId, setCompanyId] = useState(taskToEdit?.companyId || '');
  const [assignedToId, setAssignedToId] = useState(taskToEdit?.assignedToId || '');
  const [responsiblePersonId, setResponsiblePersonId] = useState(
    taskToEdit?.responsiblePerson?.fullName || taskToEdit?.responsiblePersonId || ''
  );
  const [recipientId, setRecipientId] = useState(
    taskToEdit?.recipient?.fullName || taskToEdit?.recipientId || ''
  );
  const [priority, setPriority] = useState<TaskPrioritySlug>(taskToEdit?.priority || 'medium');
  const [status, setStatus] = useState<TaskStatusSlug>(taskToEdit?.status || 'pending');
  const [startDate, setStartDate] = useState(taskToEdit?.startDate ? taskToEdit.startDate.split('T')[0] : '');
  const [dueDate, setDueDate] = useState(taskToEdit?.dueDate ? taskToEdit.dueDate.split('T')[0] : '');
  const [estimatedHours, setEstimatedHours] = useState<number | ''>(taskToEdit?.estimatedHours ?? 8);
  const [statusReason, setStatusReason] = useState(taskToEdit?.statusReason || '');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>(taskToEdit?.customFields || {});

  // Custom fields selected by user (empty by default for new tasks, preserved for edit)
  const [visibleFieldKeys, setVisibleFieldKeys] = useState<string[]>(() => {
    const cf = taskToEdit?.customFields;
    if (cf) {
      return Object.keys(cf).filter(
        (k) => cf[k] !== undefined && cf[k] !== '' && cf[k] !== null
      );
    }
    return [];
  });
  const [selectedFieldToAdd, setSelectedFieldToAdd] = useState<string>('');

  // Dependent Data
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Fetch Companies & Users
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setIsLoadingMeta(true);
        const authHeaders = getAuthHeaders();
        const [compRes, usersRes] = await Promise.all([
          fetch('/api/companies', { headers: authHeaders, credentials: 'include' }),
          fetch('/api/users', { headers: authHeaders, credentials: 'include' }),
        ]);

        if (compRes.ok) {
          const compData = await compRes.json();
          setCompanies(compData.companies || []);
          if (!companyId && compData.companies?.length > 0) {
            setCompanyId(compData.companies[0].id);
          }
        }

        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData.users || []);
        }
      } catch (err) {
        console.error('Error fetching metadata:', err);
      } finally {
        setIsLoadingMeta(false);
      }
    };

    fetchMetadata();
  }, []);

  // Fetch Custom Fields when companyId changes
  useEffect(() => {
    if (!companyId) return;

    const fetchCustomFields = async () => {
      try {
        const res = await fetch(`/api/custom-fields?companyId=${companyId}`, {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          const loadedFields: CustomField[] = data.customFields || [];
          setCustomFields(loadedFields);

          const activeFields = loadedFields.filter((f) => f.isActive !== false);

          if (!taskToEdit) {
            // New task: Default is EMPTY as requested by the user
            // ("الحقول المخصصة بالمهمة الجديدة اريدة الديفلت مالته فارغ اذا احتاجيت حقل اكدر اضيف")
            setVisibleFieldKeys([]);
            setCustomFieldValues({});
          } else {
            // Edit task: show existing task custom fields that have values
            const existingKeys = Object.keys(taskToEdit.customFields || {}).filter(
              (k) => taskToEdit.customFields[k] !== undefined && taskToEdit.customFields[k] !== null && taskToEdit.customFields[k] !== ''
            );
            setVisibleFieldKeys(existingKeys);
          }
        }
      } catch (err) {
        console.error('Failed to load custom fields:', err);
      }
    };

    fetchCustomFields();
  }, [companyId]);

  const handleAddField = (fieldKey: string) => {
    if (!fieldKey) return;
    const fieldDef = customFields.find((f) => f.fieldKey === fieldKey);
    setVisibleFieldKeys((prev) => (prev.includes(fieldKey) ? prev : [...prev, fieldKey]));
    setCustomFieldValues((prev) => ({
      ...prev,
      [fieldKey]: prev[fieldKey] !== undefined ? prev[fieldKey] : (fieldDef?.defaultValue ?? ''),
    }));
    setSelectedFieldToAdd('');
  };

  const handleAddAllFields = () => {
    const allKeys = customFields.map((f) => f.fieldKey);
    setVisibleFieldKeys(allKeys);
    setCustomFieldValues((prev) => {
      const updated = { ...prev };
      customFields.forEach((f) => {
        if (updated[f.fieldKey] === undefined && f.defaultValue !== undefined && f.defaultValue !== null) {
          updated[f.fieldKey] = f.defaultValue;
        }
      });
      return updated;
    });
  };

  const handleRemoveField = (fieldKey: string) => {
    setVisibleFieldKeys((prev) => prev.filter((k) => k !== fieldKey));
    setCustomFieldValues((prev) => {
      const copy = { ...prev };
      delete copy[fieldKey];
      return copy;
    });
  };

  const handleCustomFieldChange = (fieldKey: string, val: any) => {
    setCustomFieldValues((prev) => ({
      ...prev,
      [fieldKey]: val,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !companyId) {
      setError(isAr ? 'العنوان والشركة حقول إلزامية' : 'Title and Company are required');
      return;
    }

    if ((status === 'delayed' || status === 'paused') && !statusReason.trim()) {
      setError(t('task.status_reason_required_error'));
      return;
    }

    setIsSubmitting(true);
    try {
      const finalCustomFields: Record<string, any> = {};
      visibleFieldKeys.forEach((key) => {
        if (customFieldValues[key] !== undefined && customFieldValues[key] !== null) {
          finalCustomFields[key] = customFieldValues[key];
        }
      });

      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        companyId,
        assignedToId: assignedToId || undefined,
        responsiblePersonId: responsiblePersonId || undefined,
        recipientId: recipientId || undefined,
        priority,
        status,
        statusReason: statusReason.trim() || undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        estimatedHours: estimatedHours === '' ? undefined : Number(estimatedHours),
        customFields: finalCustomFields,
      };

      const url = isEdit ? `/api/tasks/${taskToEdit.id}` : '/api/tasks';
      const method = isEdit ? 'PATCH' : 'POST';

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
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save task');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving task');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isEdit ? (isAr ? `تعديل المهمة: ${taskToEdit.taskCode || taskToEdit.id}` : `Edit Task: ${taskToEdit.taskCode || taskToEdit.id}`) : t('task.new_task')}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {isAr ? 'أدخل البيانات الأساسية، المدراء، والحقول المخصصة' : 'Specify task attributes, managers, and dynamic custom fields'}
            </p>
          </div>
          <button
            id="close-task-form-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Core Identification */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200 pb-1.5">
              {isAr ? '1. البيانات الأساسية للمهمة' : '1. Core Details'}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('task.task_title')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  id="task-title-input"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isAr ? 'مثال: إعداد خطة تدقيق المخزون للربع الثالث' : 'e.g. Q3 Inventory Audit Plan'}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('task.company')} <span className="text-rose-500">*</span>
                </label>
                <select
                  id="task-company-select"
                  required
                  value={companyId}
                  disabled={isEdit}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white disabled:bg-slate-100"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {isAr && c.nameAr ? c.nameAr : c.nameEn} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isAr ? 'الوصف والمتطلبات:' : 'Description & Scope:'}
              </label>
              <textarea
                id="task-description-input"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={isAr ? 'اكتب نطاق عمل المهمة والتسليمات المطلوبة بالتفصيل...' : 'Detailed description and deliverables...'}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
              />
            </div>
          </div>

          {/* Section 2: People & Roles (4 Assignees) */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200 pb-1.5">
              {isAr ? '2. المدراء والمسؤوليات (4 أدوار محددة)' : '2. Management & Responsibilities (4 Specific Roles)'}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Assigned To */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('task.assigned_to')}
                </label>
                <select
                  id="task-assigned-to-select"
                  value={assignedToId}
                  onChange={(e) => setAssignedToId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white text-slate-800"
                >
                  <option value="">{isAr ? '-- غير محدد (بدون مدير) --' : '-- Unassigned (No Manager) --'}</option>
                  {users.map((u) => {
                    const roleLabel = u.roles?.map(r => isAr ? (r.nameAr || r.nameEn) : (r.nameEn || r.nameAr)).filter(Boolean).join(', ');
                    return (
                      <option key={u.id} value={u.id}>
                        {isAr ? (u.fullNameAr || u.fullName) : u.fullName} {roleLabel ? `(${roleLabel})` : ''}
                      </option>
                    );
                  })}
                  {assignedToId && !users.some(u => u.id === assignedToId) && (
                    <option value={assignedToId}>{assignedToId}</option>
                  )}
                </select>
              </div>

              {/* Responsible Person - Custom text input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('task.responsible')}
                </label>
                <input
                  type="text"
                  id="task-responsible-input"
                  value={responsiblePersonId}
                  onChange={(e) => setResponsiblePersonId(e.target.value)}
                  placeholder={isAr ? 'اكتب اسم المسؤول المباشر...' : 'Enter responsible person...'}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white text-slate-800 placeholder:text-slate-400"
                />
              </div>

              {/* Recipient - Custom text input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('task.recipient')}
                </label>
                <input
                  type="text"
                  id="task-recipient-input"
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  placeholder={isAr ? 'اكتب اسم المستلم أو الجهة المعنية...' : 'Enter recipient or department...'}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white text-slate-800 placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Status, Priority & Milestones */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200 pb-1.5">
              {isAr ? '3. الحالة والأولوية والمواعيد' : '3. Status, Priority & Schedule'}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('task.priority')}
                </label>
                <select
                  id="task-priority-select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPrioritySlug)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white font-semibold"
                >
                  <option value="vip">VIP & Critical (أولوية قصوى)</option>
                  <option value="high">{t('task.priority_high')}</option>
                  <option value="medium">{t('task.priority_medium')}</option>
                  <option value="low">{t('task.priority_low')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('task.status')}
                </label>
                <select
                  id="task-status-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatusSlug)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white font-semibold"
                >
                  <option value="pending">{t('task.status_pending')}</option>
                  <option value="in_progress">{t('task.status_in_progress')}</option>
                  <option value="delayed">{t('task.status_delayed')}</option>
                  <option value="paused">{t('task.status_paused')}</option>
                  <option value="completed">{t('task.status_completed')}</option>
                  <option value="cancelled">{t('task.status_cancelled')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('task.start_date')}
                </label>
                <input
                  type="date"
                  id="task-start-date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('task.due_date')}
                </label>
                <input
                  type="date"
                  id="task-due-date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
                />
              </div>
            </div>

            {/* If delayed or paused, show mandatory reason input */}
            {(status === 'delayed' || status === 'paused') && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 animate-in fade-in">
                <label className="block text-xs font-bold text-amber-900">
                  {t('task.status_reason')} <span className="text-rose-600">({isAr ? 'إلزامي' : 'Mandatory'})</span>
                </label>
                <input
                  type="text"
                  id="task-reason-input"
                  required
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder={isAr ? 'أدخل تفاصيل سبب تعليق أو تأخر المهمة...' : 'Document exact reason for delay/pause...'}
                  className="w-full px-3.5 py-2 text-xs border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-hidden bg-white"
                />
              </div>
            )}
          </div>

          {/* Section 4: Dynamic Custom Fields (On-demand with Add Button) */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isAr ? '4. الحقول المخصصة' : '4. Custom Fields'}</span>
                </h4>
                {visibleFieldKeys.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 font-mono">
                    {visibleFieldKeys.length}
                  </span>
                )}
              </div>

              {/* Add Field Action */}
              {customFields.filter((f) => !visibleFieldKeys.includes(f.fieldKey)).length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleAddAllFields}
                    className="text-xs font-bold px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-colors"
                  >
                    {isAr ? '+ إضافة الكل' : '+ Add All'}
                  </button>
                  <div className="relative">
                    <select
                      id="add-custom-field-select"
                      value={selectedFieldToAdd}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddField(e.target.value);
                        }
                      }}
                      className="text-xs font-bold ps-3 pe-8 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg cursor-pointer transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    >
                      <option value="">
                        {isAr ? '+ إضافة حقل مخصص...' : '+ Add Custom Field...'}
                      </option>
                      {customFields
                        .filter((f) => !visibleFieldKeys.includes(f.fieldKey))
                        .map((f) => (
                          <option key={f.id} value={f.fieldKey}>
                            {isAr ? f.nameAr : f.nameEn}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {visibleFieldKeys.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 text-center space-y-2.5">
                <p className="text-xs text-slate-500 font-medium">
                  {isAr
                    ? 'لم يتم تضمين أي حقول مخصصة لهذه المهمة حالياً.'
                    : 'No custom fields added to this task yet.'}
                </p>
                {customFields.filter((f) => !visibleFieldKeys.includes(f.fieldKey)).length > 0 && (
                  <div className="flex items-center justify-center gap-2">
                    <select
                      id="add-custom-field-select-empty"
                      value={selectedFieldToAdd}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddField(e.target.value);
                        }
                      }}
                      className="text-xs font-bold px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg cursor-pointer transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    >
                      <option value="">
                        {isAr ? '+ إضافة حقل مخصص...' : '+ Add Custom Field...'}
                      </option>
                      {customFields
                        .filter((f) => !visibleFieldKeys.includes(f.fieldKey))
                        .map((f) => (
                          <option key={f.id} value={f.fieldKey}>
                            {isAr ? f.nameAr : f.nameEn}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
                {visibleFieldKeys.map((fieldKey) => {
                  const fieldDef = customFields.find((f) => f.fieldKey === fieldKey);
                  if (!fieldDef) return null;
                  return (
                    <div
                      key={fieldDef.id}
                      className="relative p-3 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-700">
                          {isAr ? fieldDef.nameAr : fieldDef.nameEn}
                          {fieldDef.required && (
                            <span className="text-rose-500 ms-1">*</span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveField(fieldDef.fieldKey)}
                          title={isAr ? 'إزالة هذا الحقل' : 'Remove field'}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <DynamicFieldInput
                        field={fieldDef}
                        value={customFieldValues[fieldDef.fieldKey]}
                        onChange={(val) => handleCustomFieldChange(fieldDef.fieldKey, val)}
                        users={users}
                        companies={companies}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              id="cancel-task-form-btn"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            >
              {t('action.cancel')}
            </button>
            <button
              type="submit"
              id="submit-task-form-btn"
              disabled={isSubmitting}
              className="px-6 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : isEdit ? t('action.save') : t('task.new_task')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
