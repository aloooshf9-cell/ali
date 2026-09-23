import React, { useState } from 'react';
import { Task, TaskStatusSlug } from '../../types/database';
import { useI18n } from '../../i18n/I18nContext';
import { AlertCircle, CheckCircle2, Clock, PauseCircle, PlayCircle, X, XCircle } from 'lucide-react';

interface StatusChangeModalProps {
  task: Task;
  onClose: () => void;
  onSuccess: (updatedTask: Task) => void;
}

export const StatusChangeModal: React.FC<StatusChangeModalProps> = ({ task, onClose, onSuccess }) => {
  const { t, language } = useI18n();
  const isAr = language === 'ar';

  const [selectedStatus, setSelectedStatus] = useState<TaskStatusSlug>(task.status || 'pending');
  const [reason, setReason] = useState<string>(task.statusReason || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statuses: Array<{ slug: TaskStatusSlug; labelAr: string; labelEn: string; icon: any; colorClass: string }> = [
    { slug: 'pending', labelAr: 'قيد الانتظار', labelEn: 'Pending', icon: Clock, colorClass: 'border-slate-300 text-slate-700 bg-slate-50' },
    { slug: 'in_progress', labelAr: 'قيد التنفيذ', labelEn: 'In Progress', icon: PlayCircle, colorClass: 'border-blue-300 text-blue-700 bg-blue-50' },
    { slug: 'delayed', labelAr: 'متأخرة', labelEn: 'Delayed', icon: AlertCircle, colorClass: 'border-rose-300 text-rose-700 bg-rose-50' },
    { slug: 'paused', labelAr: 'متوقفة مؤقتاً', labelEn: 'Paused', icon: PauseCircle, colorClass: 'border-amber-300 text-amber-700 bg-amber-50' },
    { slug: 'completed', labelAr: 'مكتملة', labelEn: 'Completed', icon: CheckCircle2, colorClass: 'border-emerald-300 text-emerald-700 bg-emerald-50' },
    { slug: 'cancelled', labelAr: 'ملغاة', labelEn: 'Cancelled', icon: XCircle, colorClass: 'border-slate-300 text-slate-700 bg-slate-100' },
  ];

  const handleSelectStatus = (slug: TaskStatusSlug) => {
    setSelectedStatus(slug);
  };

  const isReasonMandatory = selectedStatus === 'delayed' || selectedStatus === 'paused';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isReasonMandatory && !reason.trim()) {
      setError(t('task.status_reason_required_error'));
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/tasks/${task.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          status: selectedStatus,
          reason: reason.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to change task status');
      }

      onSuccess(data.task);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {t('task.change_status')} - {task.taskCode || task.id}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">{task.title}</p>
          </div>
          <button
            id="close-status-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              {isAr ? 'اختر الحالة الجديدة:' : 'Select Target Status:'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {statuses.map((item) => {
                const isSelected = selectedStatus === item.slug;
                const Icon = item.icon;
                return (
                  <button
                    key={item.slug}
                    type="button"
                    id={`status-option-${item.slug}`}
                    onClick={() => handleSelectStatus(item.slug)}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all text-start ${
                      isSelected
                        ? 'ring-2 ring-blue-600 border-transparent shadow-xs ' + item.colorClass
                        : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{isAr ? item.labelAr : item.labelEn}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="status-reason-input" className="text-xs font-bold text-slate-700">
                {t('task.status_reason')}
                {isReasonMandatory && (
                  <span className="text-rose-600 ms-1 font-bold">({isAr ? 'إلزامي' : 'Mandatory'})</span>
                )}
              </label>
              {isReasonMandatory && (
                <span className="text-[11px] text-rose-600 font-medium">
                  {isAr ? 'مطلوب لحالتي متأخرة أو متوقفة' : 'Required for Delayed / Paused'}
                </span>
              )}
            </div>
            <textarea
              id="status-reason-input"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                isReasonMandatory
                  ? (isAr ? 'أدخل سبب التأخير أو الإيقاف المؤقت بدقة مع خطة المتابعة...' : 'Provide specific justification for delay or pausing...')
                  : (isAr ? 'ملاحظة إضافية حول سبب التحديث (اختياري)...' : 'Optional note explaining status transition...')
              }
              className={`w-full px-3.5 py-2.5 text-xs rounded-xl border outline-hidden transition-all bg-white ${
                isReasonMandatory && !reason.trim()
                  ? 'border-amber-400 focus:ring-2 focus:ring-amber-500'
                  : 'border-slate-300 focus:ring-2 focus:ring-blue-500'
              }`}
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              id="cancel-status-btn"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              {t('action.cancel')}
            </button>
            <button
              type="submit"
              id="submit-status-btn"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              {isSubmitting ? (isAr ? 'جارٍ التحديث...' : 'Updating...') : t('action.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
