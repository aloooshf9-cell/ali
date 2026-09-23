import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { REPORT_EXPORT_FIELDS, ReportExportFieldKey } from '../../types/reports';
import { User } from '../../types/database';
import {
  Check,
  CheckSquare,
  Square,
  X,
  Download,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  UserCheck,
  Sparkles,
} from 'lucide-react';

interface SelectFieldsModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportFormat: 'excel' | 'pdf';
  totalFilteredRecords: number;
  onConfirm: (selectedFieldKeys: ReportExportFieldKey[], selectedManagerId?: string) => void;
  isLoading?: boolean;
  users?: User[];
  currentManagerId?: string;
}

export const SelectFieldsModal: React.FC<SelectFieldsModalProps> = ({
  isOpen,
  onClose,
  exportFormat,
  totalFilteredRecords,
  onConfirm,
  isLoading = false,
  users = [],
  currentManagerId = 'all',
}) => {
  const { t, language } = useI18n();
  const isAr = language === 'ar';

  const [selectedManagerId, setSelectedManagerId] = useState<string>(currentManagerId || 'all');
  const [selectedKeys, setSelectedKeys] = useState<Set<ReportExportFieldKey>>(() => {
    const defaults = REPORT_EXPORT_FIELDS.filter(f => f.defaultSelected).map(f => f.key);
    return new Set(defaults);
  });

  useEffect(() => {
    if (isOpen) {
      setSelectedManagerId(currentManagerId || 'all');
    }
  }, [isOpen, currentManagerId]);

  if (!isOpen) return null;

  const toggleField = (key: ReportExportFieldKey) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedKeys(next);
  };

  const selectAll = () => {
    setSelectedKeys(new Set(REPORT_EXPORT_FIELDS.map(f => f.key)));
  };

  const clearAll = () => {
    setSelectedKeys(new Set());
  };

  const handleConfirm = () => {
    if (selectedKeys.size === 0) return;
    onConfirm(Array.from(selectedKeys), selectedManagerId);
  };

  const coreFields = REPORT_EXPORT_FIELDS.filter(f => f.category === 'core');
  const detailFields = REPORT_EXPORT_FIELDS.filter(f => f.category === 'details');
  const metaFields = REPORT_EXPORT_FIELDS.filter(f => f.category === 'meta');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
              exportFormat === 'excel' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            }`}>
              {exportFormat === 'excel' ? <FileSpreadsheet className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {t('reports.select_fields_modal_title')} ({exportFormat === 'excel' ? 'Excel .xlsx' : 'PDF Document'})
              </h3>
              <p className="text-xs text-slate-500">{t('reports.select_fields_desc')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Manager Filter Selection Box */}
          {users.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 border border-blue-200 rounded-2xl space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">
                      {isAr ? 'تحديد مدير معين لتصدير التقرير (اختياري):' : 'Select Specific Manager for Export (Optional):'}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      {isAr
                        ? 'يمكنك سحب تقرير الـ PDF أو Excel حصرياً لمهام هذا المدير المختار'
                        : 'Export report exclusively for the selected manager’s tasks'}
                    </span>
                  </div>
                </div>
                {selectedManagerId !== 'all' && (
                  <span className="px-2.5 py-1 text-[11px] font-black bg-blue-600 text-white rounded-lg shadow-xs flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {isAr ? 'تقرير مخصص' : 'Custom Dossier'}
                  </span>
                )}
              </div>

              <select
                value={selectedManagerId}
                onChange={(e) => setSelectedManagerId(e.target.value)}
                className="w-full text-xs font-bold bg-white border border-blue-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs transition-all"
              >
                <option value="all">
                  {isAr ? '📋 جميع المدراء (تصدير مهام كل المدراء أو الفلترة الحالية)' : '📋 All Managers (Export all / current filtered)'}
                </option>
                {users.map((u) => {
                  const roleLabel = u.roles?.map(r => isAr ? (r.nameAr || r.nameEn) : (r.nameEn || r.nameAr)).filter(Boolean).join(', ');
                  return (
                    <option key={u.id} value={u.id}>
                      👤 {isAr ? (u.fullNameAr || u.fullName) : u.fullName} {roleLabel ? `— (${roleLabel})` : ''}
                    </option>
                  );
                })}
              </select>

              {selectedManagerId !== 'all' && (
                <div className="text-[11px] text-blue-800 bg-white/80 backdrop-blur-xs px-3 py-2 rounded-xl border border-blue-200/60 flex items-center gap-2 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>
                    {isAr
                      ? 'سيتم تصفية البيانات واستخراج التقرير وتضمين اسم وترويسة المدير المختار في ملف الـ PDF بأعلى درجات الفخامة والدقة.'
                      : 'The exported report and PDF dossier will be custom-generated exclusively for this manager with verified executive headers.'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Notice: Only filtered records exported */}
          <div className="flex items-start gap-3 p-3.5 bg-blue-50 border border-blue-200/80 rounded-xl text-xs text-blue-800">
            <AlertCircle className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold">
                {isAr ? 'ضمان دقة البيانات وحوكمتها:' : 'Data Reliability & Governance Guarantee:'}
              </p>
              <p className="mt-0.5 text-blue-700 leading-relaxed">
                {t('reports.only_filtered_notice').replace('{count}', totalFilteredRecords.toString())}
              </p>
            </div>
          </div>

          {/* Quick Selection Toolbar */}
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="text-xs font-semibold text-slate-700">
              {t('reports.selected_count')
                .replace('{count}', selectedKeys.size.toString())
                .replace('{total}', REPORT_EXPORT_FIELDS.length.toString())}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors flex items-center gap-1.5"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                {t('reports.select_all')}
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5"
              >
                <Square className="w-3.5 h-3.5" />
                {t('reports.clear_all')}
              </button>
            </div>
          </div>

          {/* Core Fields Group */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              {isAr ? 'الحقول الأساسية (موصى بها)' : 'Core Primary Fields (Recommended)'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {coreFields.map(f => {
                const checked = selectedKeys.has(f.key);
                return (
                  <label
                    key={f.key}
                    onClick={() => toggleField(f.key)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition-all ${
                      checked
                        ? 'border-blue-500 bg-blue-50/50 text-blue-900 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                          checked ? 'bg-blue-600 text-white' : 'border border-slate-300'
                        }`}
                      >
                        {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <span className="text-sm font-semibold">{isAr ? f.labelAr : f.labelEn}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{f.key}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Details Fields Group */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              {isAr ? 'التفاصيل والملاحظات' : 'Detailed Attributes & Notes'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {detailFields.map(f => {
                const checked = selectedKeys.has(f.key);
                return (
                  <label
                    key={f.key}
                    onClick={() => toggleField(f.key)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition-all ${
                      checked
                        ? 'border-blue-500 bg-blue-50/50 text-blue-900 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                          checked ? 'bg-blue-600 text-white' : 'border border-slate-300'
                        }`}
                      >
                        {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <span className="text-sm font-medium">{isAr ? f.labelAr : f.labelEn}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{f.key}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Metadata & Hours Group */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              {isAr ? 'بيانات الإنشاء ومؤشرات الساعات' : 'Creation Meta & Work Hours'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {metaFields.map(f => {
                const checked = selectedKeys.has(f.key);
                return (
                  <label
                    key={f.key}
                    onClick={() => toggleField(f.key)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition-all ${
                      checked
                        ? 'border-blue-500 bg-blue-50/50 text-blue-900 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                          checked ? 'bg-blue-600 text-white' : 'border border-slate-300'
                        }`}
                      >
                        {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <span className="text-sm font-medium">{isAr ? f.labelAr : f.labelEn}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{f.key}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            {t('reports.cancel')}
          </button>

          <button
            type="button"
            disabled={selectedKeys.size === 0 || isLoading}
            onClick={handleConfirm}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm text-white shadow-md transition-all flex items-center gap-2 ${
              selectedKeys.size === 0 || isLoading
                ? 'bg-slate-300 cursor-not-allowed shadow-none'
                : exportFormat === 'excel'
                ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-emerald-500/20'
                : 'bg-rose-600 hover:bg-rose-700 active:scale-95 shadow-rose-500/20'
            }`}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>
              {t('reports.confirm_export')} ({selectedKeys.size})
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
