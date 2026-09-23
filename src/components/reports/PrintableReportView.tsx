import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { ReportQueryResult, ReportExportFieldKey, REPORT_EXPORT_FIELDS } from '../../types/reports';
import { Printer, X, Download, ShieldCheck, Building2, Calendar, Filter, CheckCircle2, AlertTriangle } from 'lucide-react';

interface PrintableReportViewProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: ReportQueryResult;
  selectedFields: ReportExportFieldKey[];
  onDownloadPdfFile: () => void;
}

export const PrintableReportView: React.FC<PrintableReportViewProps> = ({
  isOpen,
  onClose,
  reportData,
  selectedFields,
  onDownloadPdfFile,
}) => {
  const { t, language } = useI18n();
  const isAr = language === 'ar';

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const fieldDefs = REPORT_EXPORT_FIELDS.filter(f => selectedFields.includes(f.key));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[96vh]">
        {/* Controls Bar (Hidden during window.print) */}
        <div className="p-4 border-b border-slate-200 bg-slate-100 flex items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {isAr ? 'معاينة وثيقة التقرير الرسمية للطباعة و PDF' : 'Official Report Document Print & PDF Preview'}
              </h3>
              <p className="text-xs text-slate-500">
                {isAr ? 'جاهزة للحفظ بصيغة PDF أو الطباعة المباشرة' : 'Formatted for standard A4 landscape print & PDF export'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDownloadPdfFile}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isAr ? 'تحميل كملف PDF' : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t('reports.print_report')}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Container */}
        <div className="p-6 sm:p-10 overflow-y-auto bg-white print:p-0 print:m-0 print:overflow-visible">
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-6 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900 leading-tight">
                  {t('reports.system_name')}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  {isAr
                    ? 'منصة الحوكمة المؤسسية والرقابة التشغيلية للشركات والمهام'
                    : 'Unified Enterprise Holding Group Governance & Multi-Tenant Task Execution Platform'}
                </p>
              </div>

              <div className="text-end bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-xs font-bold text-slate-800">
                  {isAr ? 'نوع التقرير التنفيذي:' : 'Report Category:'}
                </div>
                <div className="text-sm font-black text-blue-700 mt-0.5">
                  {reportData.reportType ? t(`reports.tab_${reportData.reportType.replace('_report', '')}`) : t('reports.title')}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 font-mono">
                  {reportData.generatedAt ? new Date(reportData.generatedAt).toLocaleString() : new Date().toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Audit Metadata & Applied Filters Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-xs space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-500 font-medium block">
                  {isAr ? 'نطاق الشركة التابعة:' : 'Company Scope:'}
                </span>
                <span className="font-bold text-slate-800">
                  {reportData.appliedFilters?.companyName || (isAr ? 'كافة شركات المجموعة المصرح بها' : 'All Authorized Companies')}
                </span>
              </div>

              <div>
                <span className="text-slate-500 font-medium block">
                  {isAr ? 'المسؤول المولد للتقرير:' : 'Generated By:'}
                </span>
                <span className="font-bold text-slate-800">
                  {reportData.generatedBy?.fullName || 'System'} ({reportData.generatedBy?.role || 'Admin'})
                </span>
              </div>

              <div>
                <span className="text-slate-500 font-medium block">
                  {isAr ? 'عدد السجلات المفلترة:' : 'Filtered Records Count:'}
                </span>
                <span className="font-black text-blue-700">
                  {reportData.summary?.totalTasks ?? (reportData.tasks?.length || 0)} {isAr ? 'مهمة' : 'tasks'}
                </span>
              </div>
            </div>

            {/* Active Filters Display */}
            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-700">
                {t('reports.active_filters')}:
              </span>
              {reportData.appliedFilters?.companyName && (
                <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-800">
                  {t('reports.filter_company')}: {reportData.appliedFilters.companyName}
                </span>
              )}
              {reportData.appliedFilters?.status && (
                <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-800">
                  {t('reports.filter_status')}: {reportData.appliedFilters.status}
                </span>
              )}
              {reportData.appliedFilters?.priority && (
                <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-800">
                  {t('reports.filter_priority')}: {
                    reportData.appliedFilters.priorityName || (
                      reportData.appliedFilters.priority === 'vip' || reportData.appliedFilters.priority === 'urgent' || reportData.appliedFilters.priority === 'critical' ? (isAr ? 'أولوية قصوى (VIP)' : 'VIP Critical') :
                      reportData.appliedFilters.priority === 'high' ? (isAr ? 'عالية' : 'High') :
                      reportData.appliedFilters.priority === 'medium' ? (isAr ? 'متوسطة' : 'Medium') :
                      reportData.appliedFilters.priority === 'low' ? (isAr ? 'منخفضة' : 'Low') :
                      reportData.appliedFilters.priority
                    )
                  }
                </span>
              )}
              {reportData.appliedFilters?.assignedToName && (
                <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-800">
                  {t('reports.filter_assigned_to')}: {reportData.appliedFilters.assignedToName}
                </span>
              )}
              {reportData.appliedFilters?.dateFrom && (
                <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-800">
                  {isAr ? 'من تاريخ' : 'From'}: {reportData.appliedFilters.dateFrom}
                </span>
              )}
              {reportData.appliedFilters?.dateTo && (
                <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-800">
                  {isAr ? 'إلى تاريخ' : 'To'}: {reportData.appliedFilters.dateTo}
                </span>
              )}
              {reportData.appliedFilters?.search && (
                <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-800">
                  {isAr ? 'بحث' : 'Search'}: "{reportData.appliedFilters.search}"
                </span>
              )}
              {reportData.appliedFilters?.managerName && (
                <span className="bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                  <span>👤 {isAr ? 'المدير المسؤول:' : 'Assigned Manager:'}</span>
                  <span className="underline">{reportData.appliedFilters.managerName}</span>
                </span>
              )}
              {(!reportData.appliedFilters || reportData.appliedFilters?.activeFilterCount === 0) && (
                <span className="text-slate-400 italic">
                  {isAr ? 'لا توجد فلاتر مقيدة (عرض شامل لكافة السجلات)' : 'No restrictive filters (Comprehensive extract)'}
                </span>
              )}
            </div>
          </div>

          {/* Quick KPI Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-center">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">{t('reports.total_tasks')}</span>
              <p className="text-base font-black text-slate-900">{reportData.summary?.totalTasks ?? (reportData.tasks?.length || 0)}</p>
            </div>
            <div className="bg-emerald-50/60 border border-emerald-200 p-2.5 rounded-lg text-center">
              <span className="text-[10px] font-semibold text-emerald-700 uppercase">{t('reports.completed_tasks')}</span>
              <p className="text-base font-black text-emerald-700">{reportData.summary?.completedTasks ?? 0}</p>
            </div>
            <div className="bg-blue-50/60 border border-blue-200 p-2.5 rounded-lg text-center">
              <span className="text-[10px] font-semibold text-blue-700 uppercase">{t('reports.in_progress_tasks')}</span>
              <p className="text-base font-black text-blue-700">{reportData.summary?.inProgressTasks ?? 0}</p>
            </div>
            <div className="bg-amber-50/60 border border-amber-200 p-2.5 rounded-lg text-center">
              <span className="text-[10px] font-semibold text-amber-700 uppercase">{t('reports.delayed_tasks')}</span>
              <p className="text-base font-black text-amber-700">{reportData.summary?.delayedTasks ?? 0}</p>
            </div>
            <div className="bg-rose-50/60 border border-rose-200 p-2.5 rounded-lg text-center">
              <span className="text-[10px] font-semibold text-rose-700 uppercase">{t('reports.overdue_tasks')}</span>
              <p className="text-base font-black text-rose-700">{reportData.summary?.overdueTasks ?? 0}</p>
            </div>
            <div className="bg-purple-50/60 border border-purple-200 p-2.5 rounded-lg text-center">
              <span className="text-[10px] font-semibold text-purple-700 uppercase">{isAr ? 'المعلقة / المتوقفة' : 'Paused'}</span>
              <p className="text-base font-black text-purple-700">{reportData.summary?.pausedTasks ?? 0}</p>
            </div>
          </div>

          {/* Data Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden mb-6">
            <table className="w-full text-start text-xs border-collapse table-fixed">
              <thead>
                <tr className="bg-slate-800 text-white">
                  {fieldDefs.map(f => {
                    const isCentered = ['taskCode', 'title', 'status', 'priority', 'dueDate', 'startDate', 'completionDate', 'estimatedHours', 'actualHours'].includes(f.key);
                    return (
                      <th
                        key={f.key}
                        className={`p-2.5 font-bold border-e border-slate-700 last:border-e-0 ${isCentered ? 'text-center' : 'text-start'}`}
                      >
                        {isAr ? f.labelAr : f.labelEn}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {(!reportData?.tasks || reportData.tasks.length === 0) ? (
                  <tr>
                    <td colSpan={fieldDefs?.length || 1} className="p-8 text-center text-slate-400 font-medium">
                      {t('reports.no_records_found')}
                    </td>
                  </tr>
                ) : (
                  (reportData?.tasks || []).map((task, idx) => (
                    <tr
                      key={task.id}
                      className={`border-b border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}`}
                    >
                      {fieldDefs.map(f => {
                        let content: React.ReactNode = '';
                        switch (f.key) {
                          case 'taskCode':
                            content = (
                              <div className="flex justify-center items-center">
                                <span className="inline-flex items-center justify-center font-mono font-bold text-blue-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 h-6 text-xs whitespace-nowrap">
                                  {task.taskCode}
                                </span>
                              </div>
                            );
                            break;
                          case 'title':
                            content = <div className="text-center font-semibold text-slate-900 break-words">{task.title}</div>;
                            break;
                          case 'company':
                            content = (
                              <div>
                                <span className="font-bold text-slate-800">{isAr ? task.companyNameAr : task.companyNameEn}</span>
                                <span className="text-[10px] text-slate-500 font-mono ms-1">({task.companyCode})</span>
                              </div>
                            );
                            break;
                          case 'assignedTo':
                            content = <span>{isAr ? task.assignedToNameAr : task.assignedToName}</span>;
                            break;
                          case 'status':
                            content = (
                              <div className="flex justify-center items-center">
                                <span
                                  className={`inline-flex items-center justify-center px-3 h-6 rounded-lg text-xs font-bold whitespace-nowrap border shadow-2xs ${
                                    task.status === 'completed'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : task.status === 'in_progress'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : task.status === 'delayed'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : task.status === 'cancelled'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {isAr ? task.statusLabelAr : task.statusLabelEn}
                                </span>
                              </div>
                            );
                            break;
                          case 'priority': {
                            const pSlug = String(task.priority || (task.priorityId === 'tp-4' ? 'vip' : task.priorityId === 'tp-3' ? 'high' : task.priorityId === 'tp-1' ? 'low' : 'medium')).toLowerCase();
                            const pLabel = isAr
                              ? (task.priorityLabelAr && (pSlug === 'medium' || !task.priorityLabelAr.includes('متوسط'))
                                  ? task.priorityLabelAr
                                  : (pSlug === 'vip' || pSlug === 'urgent' || pSlug === 'critical' ? 'أولوية قصوى (VIP)' : pSlug === 'high' ? 'عالية' : pSlug === 'low' ? 'منخفضة' : 'متوسطة'))
                              : (task.priorityLabelEn && (pSlug === 'medium' || !task.priorityLabelEn.includes('Medium'))
                                  ? task.priorityLabelEn
                                  : (pSlug === 'vip' || pSlug === 'urgent' || pSlug === 'critical' ? 'VIP' : pSlug === 'high' ? 'High' : pSlug === 'low' ? 'Low' : 'Medium'));
                            content = (
                              <div className="flex justify-center items-center">
                                <span
                                  className={`inline-flex items-center justify-center px-3 h-6 rounded-lg text-xs font-bold whitespace-nowrap border shadow-2xs ${
                                    pSlug === 'vip' || pSlug === 'urgent' || pSlug === 'critical'
                                      ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200'
                                      : pSlug === 'high'
                                      ? 'bg-orange-50 text-orange-700 border-orange-200'
                                      : pSlug === 'medium'
                                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {pLabel}
                                </span>
                              </div>
                            );
                            break;
                          }
                          case 'dueDate':
                            content = (
                              <div className="text-center">
                                <span className={task.daysOverdue > 0 ? 'text-rose-600 font-bold' : ''}>
                                  {task.dueDate || '-'}
                                  {task.daysOverdue > 0 && ` (+${task.daysOverdue}d)`}
                                </span>
                              </div>
                            );
                            break;
                          case 'description':
                            content = <div className="text-slate-600 text-xs leading-relaxed break-words whitespace-normal">{task.description || '-'}</div>;
                            break;
                          case 'notes':
                            content = <div className="text-slate-600 text-xs leading-relaxed break-words whitespace-normal">{task.latestNote || '-'}</div>;
                            break;
                          case 'creator':
                            content = <span>{task.creatorName}</span>;
                            break;
                          case 'startDate':
                            content = <div className="text-center">{task.startDate || '-'}</div>;
                            break;
                          case 'completionDate':
                            content = <div className="text-center">{task.completionDate || '-'}</div>;
                            break;
                          case 'statusReason':
                            content = <div className="text-slate-600 text-[11px] break-words">{task.statusReason || '-'}</div>;
                            break;
                          case 'estimatedHours':
                            content = <div className="text-center">{task.estimatedHours ? `${task.estimatedHours}h` : '-'}</div>;
                            break;
                          case 'actualHours':
                            content = <div className="text-center">{task.actualHours ? `${task.actualHours}h` : '-'}</div>;
                            break;
                          case 'createdAt':
                            content = <span>{task.createdAt}</span>;
                            break;
                          default:
                            content = '-';
                        }
                        return (
                          <td key={f.key} className="p-2.5 border-e border-slate-200 last:border-e-0 align-middle">
                            {content}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Document Footer with Certified Stamp & Pagination */}
          <div className="border-t border-slate-300 pt-4 flex items-center justify-between text-[11px] text-slate-500">
            <div>
              {isAr
                ? 'وثيقة رسمية معتمدة صادرة آلياً من النظام المركزي لإدارة الشركات والمهام'
                : 'Certified Official Document generated automatically by Central Governance Platform'}
            </div>
            <div className="font-mono">
              {isAr ? 'الصفحة 1 من 1 (نسخة إلكترونية معتمدة)' : 'Page 1 of 1 (Electronic Certified Copy)'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
