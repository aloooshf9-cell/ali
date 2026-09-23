import React from 'react';
import { CustomField } from '../../types/database';
import { User, Company } from '../../types/database';
import { useI18n } from '../../i18n/I18nContext';
import { Upload } from 'lucide-react';

interface DynamicFieldInputProps {
  field: CustomField;
  value: any;
  onChange: (value: any) => void;
  users?: User[];
  companies?: Company[];
}

export const DynamicFieldInput: React.FC<DynamicFieldInputProps> = ({
  field,
  value,
  onChange,
  users = [],
  companies = [],
}) => {
  const { language } = useI18n();
  const isAr = language === 'ar';
  const label = isAr ? field.nameAr : field.nameEn;
  const inputId = `custom-field-${field.fieldKey}`;

  const getOptVal = (opt: any): string => (typeof opt === 'object' && opt !== null ? opt.value : String(opt));
  const getOptLabel = (opt: any): string => {
    if (typeof opt === 'object' && opt !== null) {
      return isAr ? (opt.labelAr || opt.labelEn || opt.value) : (opt.labelEn || opt.labelAr || opt.value);
    }
    return String(opt);
  };

  const renderControl = () => {
    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            id={inputId}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-white"
            placeholder={isAr ? `أدخل ${label}...` : `Enter ${label}...`}
          />
        );

      case 'long_text':
        return (
          <textarea
            id={inputId}
            rows={3}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-white"
            placeholder={isAr ? `أدخل ${label}...` : `Enter ${label}...`}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            id={inputId}
            value={value !== undefined && value !== null ? value : ''}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            required={field.required}
            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-white"
          />
        );

      case 'date':
        return (
          <input
            type="date"
            id={inputId}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-white"
          />
        );

      case 'date_time':
        return (
          <input
            type="datetime-local"
            id={inputId}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-white"
          />
        );

      case 'dropdown':
        return (
          <select
            id={inputId}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-white"
          >
            <option value="">{isAr ? '-- اختر --' : '-- Select --'}</option>
            {(field.options || []).map((opt) => {
              const val = getOptVal(opt);
              const lbl = getOptLabel(opt);
              return (
                <option key={val} value={val}>
                  {lbl}
                </option>
              );
            })}
          </select>
        );

      case 'multi_select': {
        const selectedValues: string[] = Array.isArray(value) ? value : [];
        const toggleOption = (optVal: string) => {
          if (selectedValues.includes(optVal)) {
            onChange(selectedValues.filter((v) => v !== optVal));
          } else {
            onChange([...selectedValues, optVal]);
          }
        };

        return (
          <div className="flex flex-wrap gap-2 p-2 border border-slate-200 rounded-lg bg-slate-50/50">
            {(field.options || []).map((opt) => {
              const optVal = getOptVal(opt);
              const optLbl = getOptLabel(opt);
              const isChecked = selectedValues.includes(optVal);
              return (
                <button
                  key={optVal}
                  type="button"
                  id={`${inputId}-${optVal}`}
                  onClick={() => toggleOption(optVal)}
                  className={`px-3 py-1 text-xs rounded-md font-medium border transition-all ${
                    isChecked
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {optLbl}
                </button>
              );
            })}
          </div>
        );
      }

      case 'checkbox':
        return (
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input
              type="checkbox"
              id={inputId}
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded-sm focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-slate-700">
              {value ? (isAr ? 'نعم / مفعل' : 'Yes / Active') : (isAr ? 'لا / غير مفعل' : 'No / Inactive')}
            </span>
          </label>
        );

      case 'radio':
        return (
          <div className="flex flex-wrap gap-4 py-1">
            {(field.options || []).map((opt) => {
              const optVal = getOptVal(opt);
              const optLbl = getOptLabel(opt);
              return (
                <label key={optVal} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                  <input
                    type="radio"
                    name={field.fieldKey}
                    value={optVal}
                    checked={value === optVal}
                    onChange={() => onChange(optVal)}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span>{optLbl}</span>
                </label>
              );
            })}
          </div>
        );

      case 'user_selector':
        return (
          <select
            id={inputId}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-white"
          >
            <option value="">{isAr ? '-- حدد المستخدم --' : '-- Select User --'}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {isAr && u.fullNameAr ? u.fullNameAr : u.fullName} ({u.email})
              </option>
            ))}
          </select>
        );

      case 'company_selector':
        return (
          <select
            id={inputId}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-white"
          >
            <option value="">{isAr ? '-- حدد الشركة --' : '-- Select Company --'}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {isAr && c.nameAr ? c.nameAr : c.nameEn} ({c.code})
              </option>
            ))}
          </select>
        );

      case 'file_upload':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <label
                htmlFor={inputId}
                className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>{isAr ? 'اختيار ملف مرفق' : 'Browse File'}</span>
              </label>
              <input
                type="file"
                id={inputId}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onChange(file.name);
                  }
                }}
              />
              <span className="text-xs text-slate-600 truncate max-w-xs">
                {value ? String(value) : (isAr ? 'لم يتم اختيار ملف' : 'No file selected')}
              </span>
            </div>
          </div>
        );

      default:
        return (
          <input
            type="text"
            id={inputId}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          />
        );
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700">
          {label}
          {field.required && <span className="text-red-500 ms-1">*</span>}
        </label>
        <span className="text-[10px] font-mono text-slate-600 uppercase">
          {field.type}
        </span>
      </div>
      {renderControl()}
    </div>
  );
};
