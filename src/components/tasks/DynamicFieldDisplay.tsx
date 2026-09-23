import React from 'react';
import { CustomField } from '../../types/database';
import { useI18n } from '../../i18n/I18nContext';
import { FileText, CheckCircle2, XCircle } from 'lucide-react';

interface DynamicFieldDisplayProps {
  field: CustomField;
  value: any;
}

export const DynamicFieldDisplay: React.FC<DynamicFieldDisplayProps> = ({ field, value }) => {
  const { language } = useI18n();
  const isAr = language === 'ar';
  const label = isAr ? field.nameAr : field.nameEn;

  if (value === undefined || value === null || value === '') {
    return (
      <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
        <span className="block text-xs font-semibold text-slate-600 mb-1">{label}</span>
        <span className="text-xs text-slate-600 italic">{isAr ? 'غير محدد' : 'Not set'}</span>
      </div>
    );
  }

  const renderValue = () => {
    switch (field.type) {
      case 'checkbox':
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            {value ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">{isAr ? 'نعم / مكتمل' : 'Yes / Active'}</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-slate-600" />
                <span className="text-slate-600">{isAr ? 'لا / غير مكتمل' : 'No / Inactive'}</span>
              </>
            )}
          </div>
        );

      case 'multi_select':
        if (Array.isArray(value)) {
          return (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {value.map((v, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-md"
                >
                  {v}
                </span>
              ))}
            </div>
          );
        }
        return <span className="text-xs text-slate-800 font-medium">{String(value)}</span>;

      case 'file_upload':
        return (
          <div className="flex items-center gap-2 mt-1">
            <FileText className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-xs font-medium text-blue-700 underline truncate">
              {String(value)}
            </span>
          </div>
        );

      case 'number':
        return (
          <span className="text-sm font-semibold font-mono text-slate-800">
            {Number(value).toLocaleString()}
          </span>
        );

      case 'date':
      case 'date_time':
        return (
          <span className="text-xs font-medium text-slate-700">
            {new Date(value).toLocaleString(isAr ? 'ar-SA' : 'en-US')}
          </span>
        );

      case 'long_text':
        return (
          <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed mt-1 bg-white p-2 rounded-lg border border-slate-200">
            {String(value)}
          </p>
        );

      default:
        return (
          <span className="text-xs font-medium text-slate-800">
            {String(value)}
          </span>
        );
    }
  };

  return (
    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl transition-colors hover:border-slate-300">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        <span className="text-[10px] uppercase font-mono text-slate-600 bg-slate-200/60 px-1.5 py-0.5 rounded">
          {field.type}
        </span>
      </div>
      <div className="mt-1">{renderValue()}</div>
    </div>
  );
};
