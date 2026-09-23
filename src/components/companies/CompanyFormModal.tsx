import React, { useState, useEffect } from 'react';
import { Company } from '../../types/database';
import { Modal } from '../common/Modal';
import { useI18n } from '../../i18n/I18nContext';
import { api } from '../../services/api';
import {
  Building2,
  Globe,
  Mail,
  Phone,
  MapPin,
  User,
  Banknote,
  Flag,
  Sparkles,
  Layers,
  FileText,
  Plus,
  Trash2,
  Check,
} from 'lucide-react';

interface CompanyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Company | null;
}

const LOGO_PRESETS = [
  { label: 'Technology / Software', url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=120&h=120&q=80' },
  { label: 'Retail & Commerce', url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=120&h=120&q=80' },
  { label: 'FinTech & Capital', url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=120&h=120&q=80' },
  { label: 'Logistics & Supply', url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=120&h=120&q=80' },
  { label: 'Health & Pharma', url: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?auto=format&fit=crop&w=120&h=120&q=80' },
];

export const CompanyFormModal: React.FC<CompanyFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}) => {
  const { language, t } = useI18n();

  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [code, setCode] = useState('');
  const [industryEn, setIndustryEn] = useState('');
  const [industryAr, setIndustryAr] = useState('');
  const [logoUrl, setLogoUrl] = useState(LOGO_PRESETS[0].url);
  const [descriptionEn, setDescriptionEn] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [managerId, setManagerId] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('IQD');
  const [country, setCountry] = useState('IQ');
  const [isActive, setIsActive] = useState(true);

  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Custom Templates / Presets (Persistent)
  const [customPresets, setCustomPresets] = useState<Array<{ label: string; url: string }>>(() => {
    try {
      const saved = localStorage.getItem('custom_company_presets');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [isAddingCustomPreset, setIsAddingCustomPreset] = useState(false);
  const [customPresetName, setCustomPresetName] = useState('');
  const [customPresetUrl, setCustomPresetUrl] = useState('');

  const handleSaveCustomPreset = () => {
    if (!customPresetName.trim()) return;
    const finalUrl = customPresetUrl.trim() || logoUrl || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=120&h=120&q=80';
    const newPreset = { label: customPresetName.trim(), url: finalUrl };
    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    try {
      localStorage.setItem('custom_company_presets', JSON.stringify(updated));
    } catch (e) {}
    setLogoUrl(finalUrl);
    if (!industryAr) setIndustryAr(customPresetName.trim());
    if (!industryEn) setIndustryEn(customPresetName.trim());
    setCustomPresetName('');
    setCustomPresetUrl('');
    setIsAddingCustomPreset(false);
  };

  const handleDeleteCustomPreset = (indexToDelete: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customPresets.filter((_, idx) => idx !== indexToDelete);
    setCustomPresets(updated);
    try {
      localStorage.setItem('custom_company_presets', JSON.stringify(updated));
    } catch (e) {}
  };

  // Reset or initialize form
  useEffect(() => {
    if (initialData) {
      setNameEn(initialData.nameEn || '');
      setNameAr(initialData.nameAr || '');
      setCode(initialData.code || '');
      setIndustryEn(initialData.industryEn || '');
      setIndustryAr(initialData.industryAr || '');
      setLogoUrl(initialData.logoUrl || LOGO_PRESETS[0].url);
      setDescriptionEn(initialData.descriptionEn || '');
      setDescriptionAr(initialData.descriptionAr || '');
      setManagerId(initialData.managerId || '');
      setContactEmail(initialData.contactEmail || '');
      setContactPhone(initialData.contactPhone || '');
      setWebsite(initialData.website || '');
      setAddress(initialData.address || '');
      setCurrency(initialData.currency || 'IQD');
      setCountry(initialData.country || 'IQ');
      setIsActive(initialData.isActive !== false);
    } else {
      setNameEn('');
      setNameAr('');
      setCode(`CMP-${Math.floor(1000 + Math.random() * 9000)}`);
      setIndustryEn('');
      setIndustryAr('');
      setLogoUrl(LOGO_PRESETS[0].url);
      setDescriptionEn('');
      setDescriptionAr('');
      setManagerId('');
      setContactEmail('');
      setContactPhone('');
      setWebsite('');
      setAddress('');
      setCurrency('IQD');
      setCountry('IQ');
      setIsActive(true);
    }
    setErrorMsg(null);
  }, [initialData, isOpen]);

  // Load available users for manager assignment
  useEffect(() => {
    if (isOpen) {
      api.getUsers().then(res => {
        setAvailableUsers(res.users || []);
      }).catch(err => {
        console.error('Failed to load users for manager selection', err);
      });
    }
  }, [isOpen]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setLogoUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!nameEn.trim() || !nameAr.trim()) {
      setErrorMsg(language === 'ar' ? 'يرجى إدخال اسم الشركة بالعربية والإنجليزية' : 'Please provide company name in both Arabic and English');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<Company> = {
        nameEn: nameEn.trim(),
        nameAr: nameAr.trim(),
        code: code.trim().toUpperCase(),
        industryEn: industryEn.trim(),
        industryAr: industryAr.trim(),
        logoUrl: logoUrl.trim(),
        descriptionEn: descriptionEn.trim(),
        descriptionAr: descriptionAr.trim(),
        managerId: managerId || undefined,
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        website: website.trim(),
        address: address.trim(),
        currency,
        country,
        isActive,
      };

      if (initialData) {
        await api.updateCompany(initialData.id, payload);
      } else {
        await api.createCompany(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || (language === 'ar' ? 'فشلت عملية حفظ الشركة' : 'Failed to save company'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? (language === 'ar' ? `تعديل شركة: ${initialData.nameAr}` : `Edit Company: ${initialData.nameEn}`) : t('company.modal_title')}
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-medium">
            {errorMsg}
          </div>
        )}

        {/* Section 1: Basic Identity */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>{language === 'ar' ? 'الهوية الأساسية للشركة' : 'Primary Company Identity'}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('company.name_ar')} *
              </label>
              <input
                type="text"
                required
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder="مثال: شركة التقنية المتطورة القابضة"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('company.name_en')} *
              </label>
              <input
                type="text"
                required
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. Apex Tech Solutions Ltd."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('company.code')} *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. TECH-01"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('company.status')}
              </label>
              <select
                value={isActive ? 'active' : 'inactive'}
                onChange={(e) => setIsActive(e.target.value === 'active')}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="active">{t('company.status_active')}</option>
                <option value="inactive">{t('company.status_inactive')}</option>
              </select>
            </div>
          </div>

          {/* Logo Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {t('company.logo')} (URL {language === 'ar' ? 'أو ملف' : 'or File'})
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="w-14 h-14 rounded-xl border border-slate-200 overflow-hidden bg-white shrink-0 flex items-center justify-center shadow-2xs">
                {logoUrl ? (
                  <img src={logoUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Building2 className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <div className="flex-1 flex flex-col gap-2 w-full">
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[11px] font-semibold text-slate-500 self-center">
                {language === 'ar' ? 'نماذج جاهزة:' : 'Presets:'}
              </span>
              {LOGO_PRESETS.map((preset, idx) => (
                <button
                  key={`default-${idx}`}
                  type="button"
                  onClick={() => {
                    setLogoUrl(preset.url);
                    if (!industryAr && language === 'ar') setIndustryAr(preset.label);
                    if (!industryEn && language !== 'ar') setIndustryEn(preset.label);
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                    logoUrl === preset.url
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {preset.label}
                </button>
              ))}

              {/* Custom Presets Created by the User */}
              {customPresets.map((preset, idx) => (
                <div
                  key={`custom-${idx}`}
                  onClick={() => {
                    setLogoUrl(preset.url);
                    if (!industryAr && language === 'ar') setIndustryAr(preset.label);
                    if (!industryEn && language !== 'ar') setIndustryEn(preset.label);
                  }}
                  className={`group/custom relative text-[11px] px-2.5 py-1 rounded-lg border flex items-center gap-1.5 cursor-pointer transition-colors ${
                    logoUrl === preset.url
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold shadow-2xs'
                      : 'border-emerald-200 bg-emerald-50/40 text-emerald-700 hover:bg-emerald-50'
                  }`}
                  title={language === 'ar' ? 'نموذج مخصص' : 'Custom Template'}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>{preset.label}</span>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteCustomPreset(idx, e)}
                    className="opacity-0 group-hover/custom:opacity-100 hover:text-red-600 transition-opacity p-0.5"
                    title={language === 'ar' ? 'حذف النموذج' : 'Delete preset'}
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              ))}

              {/* Add Custom Preset Button */}
              <button
                type="button"
                onClick={() => setIsAddingCustomPreset(!isAddingCustomPreset)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-all ${
                  isAddingCustomPreset
                    ? 'border-blue-600 bg-blue-600 text-white font-bold'
                    : 'border-dashed border-blue-400 bg-blue-50/50 text-blue-700 hover:bg-blue-100/70 font-semibold'
                }`}
              >
                <Plus className="w-3 h-3" />
                <span>{language === 'ar' ? 'إضافة مخصص' : 'Add Custom'}</span>
              </button>
            </div>

            {/* Inline Form to Add Custom Template Name and Details */}
            {isAddingCustomPreset && (
              <div className="mt-3 p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl animate-in fade-in space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900">
                    {language === 'ar' ? 'إضافة نموذج شركة مخصص جديد' : 'Create New Custom Company Template'}
                  </span>
                  <span className="text-[11px] text-blue-700">
                    {language === 'ar' ? 'يتم حفظ النموذج في النظام للاستخدام الدائم' : 'Saved for ongoing use'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {language === 'ar' ? 'اسم النموذج المخصص (مثال: مقاولات، استشارات، نقل):' : 'Custom Template Name:'}
                    </label>
                    <input
                      type="text"
                      value={customPresetName}
                      onChange={(e) => setCustomPresetName(e.target.value)}
                      placeholder={language === 'ar' ? 'اكتب اسم النموذج هنا...' : 'e.g. Real Estate & Development'}
                      className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {language === 'ar' ? 'رابط أيقونة/شعار النموذج (اختياري):' : 'Icon/Logo URL (optional):'}
                    </label>
                    <input
                      type="text"
                      value={customPresetUrl}
                      onChange={(e) => setCustomPresetUrl(e.target.value)}
                      placeholder={logoUrl || 'https://...'}
                      className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCustomPreset(false);
                      setCustomPresetName('');
                      setCustomPresetUrl('');
                    }}
                    className="px-3 py-1 text-xs text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    disabled={!customPresetName.trim()}
                    onClick={handleSaveCustomPreset}
                    className="px-3.5 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'حفظ النموذج وتطبيقه' : 'Save & Apply Template'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Management & Industry */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <User className="w-4 h-4 text-emerald-600" />
            <span>{language === 'ar' ? 'الإدارة والنشاط والقطاع' : 'Governance & Industry'}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('company.manager_select')}
              </label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="">{language === 'ar' ? '-- بدون مدير مخصص حالياً --' : '-- No Manager Assigned --'}</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {language === 'ar' && u.fullNameAr ? u.fullNameAr : u.fullName} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('company.industry')} (English)
              </label>
              <input
                type="text"
                value={industryEn}
                onChange={(e) => setIndustryEn(e.target.value)}
                placeholder="e.g. Information Technology & AI"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('company.industry')} (العربية)
              </label>
              <input
                type="text"
                value={industryAr}
                onChange={(e) => setIndustryAr(e.target.value)}
                placeholder="مثال: تقنية المعلومات والذكاء الاصطناعي"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('company.currency')}
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                >
                  <option value="IQD">IQD (د.ع - دينار عراقي)</option>
                  <option value="USD">USD ($ - دولار أمريكي)</option>
                  <option value="AED">AED (درهم إماراتي)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('company.country')}
                </label>
                <select
                  value={country}
                  onChange={(e) => {
                    const newCountry = e.target.value;
                    setCountry(newCountry);
                    if (newCountry === 'IQ' && currency !== 'USD' && currency !== 'IQD') {
                      setCurrency('IQD');
                    }
                  }}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="IQ">🇮🇶 Iraq (العراق)</option>
                  <option value="SA">🇸🇦 Saudi Arabia (المملكة العربية السعودية)</option>
                  <option value="AE">🇦🇪 United Arab Emirates (الإمارات)</option>
                  <option value="QA">🇶🇦 Qatar (قطر)</option>
                  <option value="KW">🇰🇼 Kuwait (الكويت)</option>
                  <option value="US">🇺🇸 United States (الولايات المتحدة)</option>
                  <option value="GB">🇬🇧 United Kingdom (المملكة المتحدة)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Contact Details & Descriptions */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <Mail className="w-4 h-4 text-purple-600" />
            <span>{t('company.contact_info')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('company.email')}
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="contact@company.com"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('company.phone')}
              </label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+966 11 000 0000"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('company.website')}
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://company.example.com"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('company.address')}
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Riyadh, Digital City, Tower 4"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('company.description_ar')}
              </label>
              <textarea
                rows={2}
                value={descriptionAr}
                onChange={(e) => setDescriptionAr(e.target.value)}
                placeholder="نبذة موجزة عن الشركة ومهامها..."
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('company.description_en')}
              </label>
              <textarea
                rows={2}
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                placeholder="Brief summary of company business scope..."
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden resize-none"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-sm font-bold transition-colors"
          >
            {t('action.cancel')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-xs transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : t('action.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
};
