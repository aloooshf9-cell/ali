import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { DashboardWidgetKey } from '../../types/database';
import {
  Building2,
  CheckSquare,
  Clock,
  PlayCircle,
  AlertCircle,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Sparkles,
  ShieldAlert,
  Percent,
} from 'lucide-react';

interface WidgetCardProps {
  widgetKey: DashboardWidgetKey;
  value: number;
  onClick?: () => void;
}

export const WidgetCard: React.FC<WidgetCardProps> = ({ widgetKey, value, onClick }) => {
  const { t, language } = useI18n();
  const isAr = language === 'ar';

  const getWidgetConfig = () => {
    switch (widgetKey) {
      case 'total_companies':
        return {
          title: t('widget.total_companies'),
          icon: Building2,
          iconBg: 'bg-blue-50 text-blue-600',
          borderHover: 'hover:border-blue-300',
          badgeText: isAr ? 'شركات مدارة' : 'Active tenants',
          badgeColor: 'bg-blue-50 text-blue-700',
          suffix: '',
        };
      case 'total_tasks':
        return {
          title: t('widget.total_tasks'),
          icon: CheckSquare,
          iconBg: 'bg-indigo-50 text-indigo-600',
          borderHover: 'hover:border-indigo-300',
          badgeText: isAr ? 'إجمالي المحفظة' : 'Portfolio',
          badgeColor: 'bg-indigo-50 text-indigo-700',
          suffix: '',
        };
      case 'pending_tasks':
        return {
          title: t('widget.pending_tasks'),
          icon: Clock,
          iconBg: 'bg-amber-50 text-amber-600',
          borderHover: 'hover:border-amber-300',
          badgeText: isAr ? 'بانتظار البدء' : 'Queued',
          badgeColor: 'bg-amber-50 text-amber-700',
          suffix: '',
        };
      case 'in_progress_tasks':
        return {
          title: t('widget.in_progress_tasks'),
          icon: PlayCircle,
          iconBg: 'bg-sky-50 text-sky-600',
          borderHover: 'hover:border-sky-300',
          badgeText: isAr ? 'قيد العمل' : 'Active execution',
          badgeColor: 'bg-sky-50 text-sky-700',
          suffix: '',
        };
      case 'delayed_tasks':
        return {
          title: t('widget.delayed_tasks'),
          icon: AlertCircle,
          iconBg: 'bg-orange-50 text-orange-600',
          borderHover: 'hover:border-orange-300',
          badgeText: isAr ? 'تحتاج تدخل' : 'Action needed',
          badgeColor: 'bg-orange-50 text-orange-700',
          suffix: '',
        };
      case 'completed_tasks':
        return {
          title: t('widget.completed_tasks'),
          icon: CheckCircle2,
          iconBg: 'bg-emerald-50 text-emerald-600',
          borderHover: 'hover:border-emerald-300',
          badgeText: isAr ? 'تم إنجازها' : 'Delivered',
          badgeColor: 'bg-emerald-50 text-emerald-700',
          suffix: '',
        };
      case 'paused_tasks':
        return {
          title: t('widget.paused_tasks'),
          icon: PauseCircle,
          iconBg: 'bg-slate-100 text-slate-600',
          borderHover: 'hover:border-slate-300',
          badgeText: isAr ? 'معلقة' : 'On hold',
          badgeColor: 'bg-slate-100 text-slate-700',
          suffix: '',
        };
      case 'cancelled_tasks':
        return {
          title: t('widget.cancelled_tasks'),
          icon: XCircle,
          iconBg: 'bg-rose-50 text-rose-600',
          borderHover: 'hover:border-rose-300',
          badgeText: isAr ? 'ملغية' : 'Voided',
          badgeColor: 'bg-rose-50 text-rose-700',
          suffix: '',
        };
      case 'vip_tasks':
        return {
          title: t('widget.vip_tasks'),
          icon: Sparkles,
          iconBg: 'bg-purple-50 text-purple-600',
          borderHover: 'hover:border-purple-300',
          badgeText: isAr ? 'أولوية قصوى' : 'Highest tier',
          badgeColor: 'bg-purple-100 text-purple-800 border border-purple-200',
          suffix: '',
        };
      case 'overdue_tasks':
        return {
          title: t('widget.overdue_tasks'),
          icon: ShieldAlert,
          iconBg: 'bg-red-50 text-red-600',
          borderHover: 'hover:border-red-300',
          badgeText: isAr ? 'متأخرة عن الموعد' : 'Critical SLA',
          badgeColor: 'bg-red-50 text-red-700',
          suffix: '',
        };
      case 'completion_rate':
        return {
          title: t('widget.completion_rate'),
          icon: Percent,
          iconBg: 'bg-teal-50 text-teal-600',
          borderHover: 'hover:border-teal-300',
          badgeText: isAr ? 'مؤشر الكفاءة' : 'Velocity',
          badgeColor: 'bg-teal-50 text-teal-700',
          suffix: '%',
        };
      default:
        return {
          title: widgetKey,
          icon: CheckSquare,
          iconBg: 'bg-slate-50 text-slate-600',
          borderHover: 'hover:border-slate-300',
          badgeText: '',
          badgeColor: 'bg-slate-50 text-slate-600',
          suffix: '',
        };
    }
  };

  const cfg = getWidgetConfig();
  const Icon = cfg.icon;

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs transition-all ${
        cfg.borderHover
      } ${onClick ? 'cursor-pointer hover:shadow-xs' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 line-clamp-1">{cfg.title}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            {value.toLocaleString()}
          </span>
          {cfg.suffix && (
            <span className="text-sm font-bold text-slate-500">{cfg.suffix}</span>
          )}
        </div>

        {cfg.badgeText && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badgeColor}`}>
            {cfg.badgeText}
          </span>
        )}
      </div>

      {/* Progress visual bar for completion rate */}
      {widgetKey === 'completion_rate' && (
        <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-teal-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          />
        </div>
      )}
    </div>
  );
};
