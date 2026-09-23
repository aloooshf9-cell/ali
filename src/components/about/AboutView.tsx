import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { SystemAboutSettings } from '../../types/database';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import {
  Shield,
  Award,
  User,
  Code2,
  Server,
  Database,
  Cpu,
  Mail,
  Edit3,
  CheckCircle2,
  Layers,
  Sparkles,
  Lock,
  Globe2,
  Terminal,
} from 'lucide-react';

interface AboutViewProps {
  onClose?: () => void;
  isModal?: boolean;
}

export const AboutView: React.FC<AboutViewProps> = ({ onClose, isModal = false }) => {
  const { user } = useAuth();
  const { t, language } = useI18n();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [aboutData, setAboutData] = useState<SystemAboutSettings>({
    aboutTitleAr: 'منظومة إدارة الشركات والعمليات المؤسسية',
    aboutTitleEn: 'Holding Enterprise Multi-Tenant OS',
    aboutDescriptionAr:
      'منصة رقمية موحدة متقدمة لحوكمة مجموعات الشركات، إدارة الصلاحيات الدقيقة، تنظيم مسارات العمل والمهام، والتقارير التنفيذية بأعلى معايير الأمان والامتثال المؤسسي.',
    aboutDescriptionEn:
      'A unified enterprise SaaS platform for managing corporate groups, granular permissions, automated workflows, executive reporting, and cross-company governance.',
    copyrightTextAr: 'حقوق النظام محفوظة للمهندس علي أحمد عنيد',
    copyrightTextEn: 'System Rights Reserved to Engineer Ali Ahmed Aneed',
    developerNameAr: 'المهندس علي أحمد عنيد',
    developerNameEn: 'Eng. Ali Ahmed Aneed',
    systemVersion: 'v2.5.0 Enterprise Release',
    licenseType: 'Enterprise Proprietary Commercial License',
    supportEmail: 'allawi.aneed95@gmail.com',
    updatedAt: new Date().toISOString(),
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formData, setFormData] = useState<SystemAboutSettings>(aboutData);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchAbout = async () => {
      try {
        setLoading(true);
        const res = await api.getSystemAbout();
        if (mounted && res.about) {
          setAboutData(res.about);
          setFormData(res.about);
        }
      } catch (err: any) {
        // fallback to defaults
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchAbout();
    return () => {
      mounted = false;
    };
  }, []);

  const handleOpenEdit = () => {
    setFormData({ ...aboutData });
    setIsEditModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const res = await api.updateSystemAbout(formData);
      if (res.success && res.about) {
        setAboutData(res.about);
        toast.success(t('about.update_success'));
        setIsEditModalOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message || t('error.general'));
    } finally {
      setIsSaving(false);
    }
  };

  const title = language === 'ar' ? aboutData.aboutTitleAr : aboutData.aboutTitleEn;
  const description = language === 'ar' ? aboutData.aboutDescriptionAr : aboutData.aboutDescriptionEn;
  const copyright = language === 'ar' ? aboutData.copyrightTextAr : aboutData.copyrightTextEn;
  const developer = language === 'ar' ? aboutData.developerNameAr : aboutData.developerNameEn;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 end-0 -mt-8 -me-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 start-0 -mb-8 -ms-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 shrink-0 border border-white/10">
              <Layers className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="primary" size="sm">
                  {aboutData.systemVersion}
                </Badge>
                <Badge variant="purple" size="sm">
                  Enterprise Tier
                </Badge>
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3" />
                  Certified Architecture
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">{title}</h2>
              <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">{description}</p>
            </div>
          </div>

          {/* Super Admin Edit Action */}
          {user?.isSuperAdmin && (
            <div className="shrink-0 flex items-center gap-3">
              <button
                id="edit-about-system-btn"
                onClick={handleOpenEdit}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all active:scale-95"
              >
                <Edit3 className="w-4 h-4" />
                <span>{t('about.edit_btn')}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Primary Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Official Copyright Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-blue-300 transition-all">
          <div className="absolute top-0 end-0 w-32 h-32 bg-blue-50/50 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </span>
              <Badge variant="primary" size="sm">
                IP Protected
              </Badge>
            </div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              {language === 'ar' ? 'بيان حقوق الملكية الفكرية' : 'Intellectual Property Notice'}
            </h3>
            <p className="text-lg sm:text-xl font-black text-slate-900 leading-snug tracking-tight mb-3">
              "{copyright}"
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              {language === 'ar'
                ? 'جميع الحقوق المادية والمعنوية، الكود المصدري، والتصميم المعماري لهذا النظام مسجلة ومملوكة قانونيًا وفق تراخيص البرمجيات المؤسسية.'
                : 'All rights, source architecture, relational schema, and proprietary software rights are reserved under enterprise software compliance.'}
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{t('about.license')}:</span>
            <span className="font-semibold text-slate-800">{aboutData.licenseType}</span>
          </div>
        </div>

        {/* Lead Architect & Developer Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-indigo-300 transition-all">
          <div className="absolute top-0 end-0 w-32 h-32 bg-indigo-50/50 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <User className="w-5 h-5" />
              </span>
              <Badge variant="purple" size="sm">
                Principal Engineer
              </Badge>
            </div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              {t('about.developer')}
            </h3>
            <div className="flex items-center gap-3.5 mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-slate-900 to-indigo-950 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                ع.ع
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900">{developer}</h4>
                <p className="text-xs font-semibold text-indigo-600">
                  Lead Full-Stack & Solutions Architect
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {language === 'ar'
                ? 'مهندس برمجيات متخصص في بناء المنظومات السحابية المعقدة، الأنظمة متعددة المستأجرين (Multi-Tenant)، وحوكمة الصلاحيات المؤسسية الدقيقة.'
                : 'Software Engineer specialized in high-performance cloud architectures, multi-tenant enterprise platforms, and granular role-based access control.'}
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              {t('about.support')}:
            </span>
            <a
              href={`mailto:${aboutData.supportEmail}`}
              className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              {aboutData.supportEmail}
            </a>
          </div>
        </div>
      </div>

      {/* Technical Specifications Bento Grid */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">{t('about.system_specs')}</h3>
            <p className="text-xs text-slate-500">
              {language === 'ar'
                ? 'المعمارية التقنية للمنظومة والمعايير الهندسية المعتمدة'
                : 'Enterprise platform specifications and architectural pillars'}
            </p>
          </div>
          <Badge variant="primary" size="md">
            Production Grade
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Frontend Pillar */}
          <div className="p-5 rounded-xl bg-slate-50/70 border border-slate-200/60 space-y-3">
            <div className="flex items-center gap-2.5 text-blue-700 font-bold text-sm">
              <Code2 className="w-4 h-4" />
              <span>{t('about.frontend_stack')}</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              React 18 + TypeScript + Vite + Tailwind CSS. Multi-Language engine (Arabic RTL / English
              LTR) with seamless directional rendering and responsive layout adaptation.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
                React 18
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
                TypeScript
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
                Tailwind CSS
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
                Lucide Icons
              </span>
            </div>
          </div>

          {/* Backend Pillar */}
          <div className="p-5 rounded-xl bg-slate-50/70 border border-slate-200/60 space-y-3">
            <div className="flex items-center gap-2.5 text-indigo-700 font-bold text-sm">
              <Server className="w-4 h-4" />
              <span>{t('about.backend_stack')}</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Node.js + Express REST API. Robust session tokens, bcrypt encryption, rate limiting, and
              strict tenant isolation preventing cross-company data leakage.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
                Express Server
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
                Rate Limiter
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
                Bcrypt Hashing
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
                Tenant Isolation
              </span>
            </div>
          </div>

          {/* Database & Audit Pillar */}
          <div className="p-5 rounded-xl bg-slate-50/70 border border-slate-200/60 space-y-3">
            <div className="flex items-center gap-2.5 text-emerald-700 font-bold text-sm">
              <Database className="w-4 h-4" />
              <span>{t('about.database_stack')}</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              17 normalized relational entities with foreign keys, immutable audit logging with diff
              comparisons, custom metadata fields, and executive export engines.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
                17 Tables
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
                Audit Trail
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
                Excel & PDF
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
                Dynamic Fields
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Super Admin Edit Modal */}
      {isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={t('about.edit_modal_title')}
          maxWidth="2xl"
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{t('about.superadmin_badge')}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('about.field_title_ar')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.aboutTitleAr}
                  onChange={(e) => setFormData({ ...formData, aboutTitleAr: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('about.field_title_en')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.aboutTitleEn}
                  onChange={(e) => setFormData({ ...formData, aboutTitleEn: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Copyright Text - Explicit requirement */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('about.field_copy_ar')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.copyrightTextAr}
                  onChange={(e) => setFormData({ ...formData, copyrightTextAr: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('about.field_copy_en')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.copyrightTextEn}
                  onChange={(e) => setFormData({ ...formData, copyrightTextEn: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Developer Names */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('about.field_dev_ar')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.developerNameAr}
                  onChange={(e) => setFormData({ ...formData, developerNameAr: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('about.field_dev_en')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.developerNameEn}
                  onChange={(e) => setFormData({ ...formData, developerNameEn: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Descriptions */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('about.field_desc_ar')}
              </label>
              <textarea
                rows={2}
                value={formData.aboutDescriptionAr}
                onChange={(e) => setFormData({ ...formData, aboutDescriptionAr: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('about.field_desc_en')}
              </label>
              <textarea
                rows={2}
                value={formData.aboutDescriptionEn}
                onChange={(e) => setFormData({ ...formData, aboutDescriptionEn: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Version & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('about.field_version')}
                </label>
                <input
                  type="text"
                  value={formData.systemVersion}
                  onChange={(e) => setFormData({ ...formData, systemVersion: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('about.field_support_email')}
                </label>
                <input
                  type="email"
                  value={formData.supportEmail}
                  onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {t('action.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>{t('action.save')}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
