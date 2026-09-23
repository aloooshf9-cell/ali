import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { api } from '../../services/api';
import {
  Layers,
  Lock,
  Mail,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  AlertTriangle,
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Globe,
  Award,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { SystemAboutSettings } from '../../types/database';

export const LoginForm: React.FC = () => {
  const { login, switchRolePersona } = useAuth();
  const { language, setLanguage, direction, t } = useI18n();

  const [aboutData, setAboutData] = useState<SystemAboutSettings | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchAbout = async () => {
      try {
        const res = await api.getSystemAbout();
        if (mounted && res.about) {
          setAboutData(res.about);
        }
      } catch (err) {
        // ignore errors for public page
      }
    };
    fetchAbout();
    return () => { mounted = false; };
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Forgot / Reset Password state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setAttemptsLeft(null);
    setLockoutSeconds(null);
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      const msg = err.message || t('auth.invalid_creds');
      setErrorMsg(msg);
      if (err.data?.remainingAttempts !== undefined) {
        setAttemptsLeft(err.data.remainingAttempts);
      }
      if (err.data?.remainingSeconds) {
        setLockoutSeconds(err.data.remainingSeconds);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPersona = async (persona: 'super_admin' | 'admin' | 'manager_owner') => {
    setErrorMsg(null);
    setAttemptsLeft(null);
    setLockoutSeconds(null);
    setIsLoading(true);
    try {
      await switchRolePersona?.(persona);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to authenticate persona');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotMsg(null);
    setIsForgotLoading(true);

    try {
      const res = await api.forgotPassword(forgotEmail);
      if (res.resetToken) {
        setResetToken(res.resetToken);
        setForgotStep('reset');
        setForgotMsg(
          language === 'ar'
            ? 'تم توليد رمز إعادة الضبط الآمن بنجاح. يرجى إدخال كلمة المرور الجديدة.'
            : 'Password reset token generated. Please enter your new password below.'
        );
      } else {
        setForgotMsg(res.message);
      }
    } catch (err: any) {
      setForgotError(err.message || 'Failed to generate password reset request');
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotMsg(null);
    setIsForgotLoading(true);

    try {
      const res = await api.resetPasswordWithToken({
        email: forgotEmail,
        newPassword,
        resetToken,
      });
      setForgotMsg(res.message);
      setTimeout(() => {
        setIsForgotModalOpen(false);
        setForgotStep('request');
        setForgotMsg(null);
        setEmail(forgotEmail);
        setPassword(newPassword);
      }, 2000);
    } catch (err: any) {
      setForgotError(err.message || 'Failed to reset password');
    } finally {
      setIsForgotLoading(false);
    }
  };

  const Arrow = direction === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-900/5 antialiased">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200/80 shadow-2xl p-7 sm:p-9 space-y-6">
        {/* Top bar with system brand & Language Switcher */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>{language === 'ar' ? 'بوابة تسجيل الدخول الموحدة' : 'Unified Enterprise Gateway'}</span>
          </div>
          <button
            type="button"
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Toggle Arabic / English"
          >
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <span>{language === 'ar' ? 'English (LTR)' : 'العربية (RTL)'}</span>
          </button>
        </div>

        {/* Branding & Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-500/25">
            <Layers className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {t('auth.welcome_back')}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
            {t('auth.sign_in_desc')}
          </p>
        </div>

        {/* Security Alert / Error Banner */}
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl font-medium flex items-start gap-3 shadow-xs">
            {lockoutSeconds ? (
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 flex-1">
              <p className="font-bold text-rose-900">{errorMsg}</p>
              {attemptsLeft !== null && attemptsLeft > 0 && (
                <p className="text-rose-700">
                  {language === 'ar'
                    ? `متبقي ${attemptsLeft} محاولات قبل قفل الحساب مؤقتًا لمنع التخمين.`
                    : `${attemptsLeft} attempt(s) remaining before automatic 15-minute brute-force lockout.`}
                </p>
              )}
              {lockoutSeconds && (
                <p className="text-rose-700 flex items-center gap-1.5 font-semibold">
                  <Clock className="w-3.5 h-3.5" />
                  {language === 'ar'
                    ? `الحساب مقفل مؤقتًا. انتظر ${Math.ceil(lockoutSeconds / 60)} دقيقة.`
                    : `Account locked. Please wait ${Math.ceil(lockoutSeconds / 60)} minute(s).`}
                </p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {language === 'ar' ? 'البريد الإلكتروني أو اسم المستخدم' : 'Email or Username'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={language === 'ar' ? 'admin أو البريد الإلكتروني' : 'admin or email@holding.com'}
                className="w-full ps-10 pe-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {t('auth.password_label')}
              </label>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full ps-10 pe-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-sm font-bold shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{t('auth.sign_in_btn')}</span>
                <Arrow className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Helper Note for Login Credentials */}
        <div className="hidden mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
          <div className="flex items-center justify-between font-medium mb-1">
            <span className="font-bold text-slate-700">
              {language === 'ar' ? 'حساب المدير الافتراضي:' : 'Default Admin Login:'}
            </span>
            <button
              type="button"
              onClick={() => {
                setEmail('admin');
                setPassword('7941631');
              }}
              className="text-blue-600 hover:text-blue-700 font-bold text-[11px] underline"
            >
              {language === 'ar' ? 'تعبئة تلقائية' : 'Auto Fill'}
            </button>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px] text-slate-500">
            <span>{language === 'ar' ? 'المستخدم:' : 'User:'} <strong className="text-slate-800">admin</strong></span>
            <span>{language === 'ar' ? 'الرمز:' : 'Pass:'} <strong className="text-slate-800">7941631</strong></span>
          </div>
        </div>

        {/* Security Specs Footer */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-center text-[10px] text-slate-400 font-semibold">
          <div className="p-2 bg-slate-50 rounded-xl">
            🔒 Bcrypt Hashed (Salt 10)
          </div>
          <div className="p-2 bg-slate-50 rounded-xl">
            🛡️ HttpOnly Cookie Sessions
          </div>
        </div>
      </div>

      {/* Official System Copyright Banner */}
      <div className="mt-6 text-center space-y-1">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/90 border border-slate-200 shadow-2xs text-xs font-bold text-slate-800">
          <Award className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            {aboutData 
              ? (language === 'ar' ? aboutData.copyrightTextAr : aboutData.copyrightTextEn)
              : (language === 'ar' ? 'حقوق النظام محفوظة' : 'System Rights Reserved')}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 font-medium">
          {aboutData?.systemVersion 
            ? `${language === 'ar' ? aboutData.aboutTitleAr : aboutData.aboutTitleEn} • ${aboutData.systemVersion} ${aboutData.licenseType}`
            : 'Enterprise Multi-Tenant OS • v2.5.0 Production'}
        </p>
      </div>

      {/* Forgot / Reset Password Modal */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => {
          setIsForgotModalOpen(false);
          setForgotMsg(null);
          setForgotError(null);
        }}
        title={language === 'ar' ? 'استعادة وإعادة تعيين كلمة المرور' : 'Secure Password Recovery'}
      >
        <div className="space-y-4">
          {forgotMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{forgotMsg}</span>
            </div>
          )}

          {forgotError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{forgotError}</span>
            </div>
          )}

          {forgotStep === 'request' ? (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <p className="text-xs text-slate-600">
                {language === 'ar'
                  ? 'أدخل البريد الإلكتروني للحساب وسيقوم النظام بتوليد رمز استعادة آمن محمي.'
                  : 'Enter your account email. The system will generate a cryptographically secure reset token.'}
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('auth.email_label')}
                </label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
                >
                  {t('action.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isForgotLoading}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
                >
                  {isForgotLoading ? '...' : language === 'ar' ? 'توليد رمز الاستعادة' : 'Generate Reset Token'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'ar' ? 'رمز الاستعادة (Generated Token)' : 'Reset Token'}
                </label>
                <input
                  type="text"
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setForgotStep('request')}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
                >
                  {language === 'ar' ? 'رجوع' : 'Back'}
                </button>
                <button
                  type="submit"
                  disabled={isForgotLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
                >
                  {isForgotLoading ? '...' : language === 'ar' ? 'تطبيق كلمة المرور الجديدة' : 'Commit New Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </div>
  );
};
