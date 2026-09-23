import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { REPORT_EXPORT_FIELDS, ReportExportFieldKey, ReportQueryResult } from '../types/reports';

function formatExportValue(row: any, key: ReportExportFieldKey, isArabic: boolean): string {
  if (!row) return '-';

  switch (key) {
    case 'taskCode':
      return row.taskCode || row.id || '-';
    case 'title':
      return row.title || '-';
    case 'companyName':
    case 'company':
      if (row.company && typeof row.company === 'object') {
        return (isArabic && row.company.nameAr ? row.company.nameAr : (row.company.nameEn || row.company.nameAr || '-'));
      }
      return row.companyName || row.companyNameAr || row.companyNameEn || '-';
    case 'status':
      if (row.status && typeof row.status === 'object') {
        return (isArabic ? row.status.nameAr : row.status.nameEn) || row.status.slug || '-';
      }
      if (isArabic) {
        if (row.statusLabelAr) return row.statusLabelAr;
        if (row.status === 'completed') return 'مكتملة';
        if (row.status === 'in_progress') return 'قيد التنفيذ';
        if (row.status === 'delayed') return 'متأخرة';
        if (row.status === 'paused') return 'متوقفة مؤقتاً';
        if (row.status === 'cancelled') return 'ملغاة';
        if (row.status === 'pending') return 'قيد الانتظار';
      }
      return row.statusLabelEn || row.status || '-';
    case 'priority': {
      if (row.priority && typeof row.priority === 'object') {
        return (isArabic ? row.priority.nameAr : row.priority.nameEn) || row.priority.slug || '-';
      }
      let slug = String(row.priority || (row.priorityId === 'tp-4' ? 'vip' : row.priorityId === 'tp-3' ? 'high' : row.priorityId === 'tp-1' ? 'low' : 'medium')).toLowerCase();
      if (slug === 'urgent' || slug === 'critical') slug = 'vip';

      if (isArabic) {
        if (slug === 'vip') return 'VIP - أولوية قصوى';
        if (slug === 'high') return 'عالية';
        if (slug === 'low') return 'منخفضة';
        if (slug === 'medium') return 'متوسطة';
        if (row.priorityLabelAr) return row.priorityLabelAr;
      } else {
        if (slug === 'vip') return 'VIP';
        if (slug === 'high') return 'High';
        if (slug === 'low') return 'Low';
        if (slug === 'medium') return 'Medium';
        if (row.priorityLabelEn) return row.priorityLabelEn;
      }
      return row.priorityLabelEn || row.priority || '-';
    }
    case 'assigneeName':
    case 'assignedTo':
      if (row.assignedTo && typeof row.assignedTo === 'object') {
        return (isArabic && row.assignedTo.fullNameAr ? row.assignedTo.fullNameAr : (row.assignedTo.fullName || '-'));
      }
      return row.assignedToName || row.assigneeName || (isArabic ? 'غير مسند' : 'Unassigned');
    case 'responsiblePersonId':
      if (row.responsiblePerson && typeof row.responsiblePerson === 'object') {
        return row.responsiblePerson.fullName || '-';
      }
      return row.responsiblePersonId || '-';
    case 'dueDate':
      return row.dueDate ? new Date(row.dueDate).toLocaleDateString(isArabic ? 'ar-SA' : 'en-US') : '-';
    case 'startDate':
      return row.startDate ? new Date(row.startDate).toLocaleDateString(isArabic ? 'ar-SA' : 'en-US') : '-';
    case 'completionDate':
      return row.completionDate ? new Date(row.completionDate).toLocaleDateString(isArabic ? 'ar-SA' : 'en-US') : '-';
    case 'estimatedHours':
      return row.estimatedHours ? `${row.estimatedHours}h` : '-';
    case 'actualHours':
      return row.actualHours ? `${row.actualHours}h` : '-';
    case 'description':
      return row.description || '-';
    case 'statusReason':
      return row.statusReason || '-';
    case 'creatorName':
    case 'creator':
      if (row.creator && typeof row.creator === 'object') {
        return row.creator.fullName || '-';
      }
      return row.creatorName || '-';
    case 'createdAt':
      return row.createdAt ? new Date(row.createdAt).toLocaleDateString(isArabic ? 'ar-SA' : 'en-US') : '-';
    case 'updatedAt':
      return row.updatedAt ? new Date(row.updatedAt).toLocaleDateString(isArabic ? 'ar-SA' : 'en-US') : '-';
    case 'customFields':
      if (row.customFields && typeof row.customFields === 'object') {
        return Object.entries(row.customFields)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ') || '-';
      }
      return '-';
    default: {
      const val = row[key];
      if (val === null || val === undefined) return '-';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    }
  }
}

function getColumnWeight(key: ReportExportFieldKey): number {
  switch (key) {
    case 'taskCode':
      return 9;
    case 'title':
      return 18;
    case 'companyName':
    case 'company':
      return 12;
    case 'status':
      return 11;
    case 'priority':
      return 10;
    case 'assigneeName':
    case 'assignedTo':
      return 12;
    case 'dueDate':
    case 'startDate':
    case 'completionDate':
    case 'createdAt':
    case 'updatedAt':
      return 10;
    case 'estimatedHours':
    case 'actualHours':
      return 7;
    case 'description':
      return 24; // Generous width for intelligent description adaptation
    case 'statusReason':
      return 14;
    default:
      return 10;
  }
}

function calculateColumnPercentages(fields: { key: ReportExportFieldKey }[]): Record<string, string> {
  const totalWeight = fields.reduce((sum, f) => sum + getColumnWeight(f.key), 0);
  const result: Record<string, string> = {};
  fields.forEach(f => {
    const pct = ((getColumnWeight(f.key) / totalWeight) * 100).toFixed(2);
    result[f.key] = `${pct}%`;
  });
  return result;
}

function renderExportTableCell(row: any, key: ReportExportFieldKey, isArabic: boolean): string {
  if (!row) return `<div style="text-align: center; color: #94a3b8;">-</div>`;

  // 1. Status Column - Styled as beautiful rounded pills matching Image 2
  if (key === 'status') {
    let slug = '';
    let label = '';
    if (row.status && typeof row.status === 'object') {
      slug = (row.status.slug || '').toLowerCase();
      label = isArabic ? (row.status.nameAr || row.status.nameEn || slug) : (row.status.nameEn || row.status.slug);
    } else {
      slug = String(row.status || '').toLowerCase();
      if (isArabic) {
        if (row.statusLabelAr) label = row.statusLabelAr;
        else if (slug === 'completed') label = 'مكتملة';
        else if (slug === 'in_progress') label = 'قيد التنفيذ';
        else if (slug === 'delayed') label = 'متأخرة';
        else if (slug === 'paused') label = 'متوقفة مؤقتاً';
        else if (slug === 'cancelled') label = 'ملغاة';
        else if (slug === 'pending') label = 'قيد الانتظار';
        else label = row.status || '-';
      } else {
        label = row.statusLabelEn || row.status || '-';
      }
    }

    // High fidelity color palettes matching user's Image 2
    let bg = '#eff6ff';
    let text = '#1d4ed8';
    let border = '#bfdbfe';

    if (slug === 'completed' || label.includes('مكتمل')) {
      bg = '#dcfce7'; // green-100
      text = '#15803d'; // green-700
      border = '#bbf7d0';
    } else if (slug === 'in_progress' || label.includes('تنفيذ')) {
      bg = '#dbeafe'; // blue-100
      text = '#1d4ed8'; // blue-700
      border = '#bfdbfe';
    } else if (slug === 'delayed' || label.includes('متأخر')) {
      bg = '#fef3c7'; // amber-100
      text = '#b45309'; // amber-700
      border = '#fde68a';
    } else if (slug === 'paused' || label.includes('متوقف') || label.includes('معلق')) {
      bg = '#f1f5f9'; // slate-100
      text = '#475569'; // slate-700
      border = '#cbd5e1';
    } else if (slug === 'cancelled' || label.includes('ملغ') || label.includes('تجاوزت') || label.includes('حرجة')) {
      bg = '#ffe4e6'; // rose-100
      text = '#be123c'; // rose-700
      border = '#fecdd3';
    } else if (slug === 'pending' || label.includes('انتظار')) {
      bg = '#f8fafc';
      text = '#475569';
      border = '#e2e8f0';
    }

    return `
      <div style="text-align: center; width: 100%; margin: 0 auto; line-height: 1;">
        <span style="display: inline-block; text-align: center; vertical-align: middle; background-color: ${bg}; color: ${text}; border: 1px solid ${border}; border-radius: 6px; min-width: 68px; padding: 4px 8px 3px 8px; font-size: 11px; font-weight: 700; white-space: nowrap; line-height: 1.2; box-sizing: border-box; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
          ${label}
        </span>
      </div>
    `;
  }

  // 2. Priority Column - Styled as beautiful rounded pills matching Image 2
  if (key === 'priority') {
    let slug = '';
    let label = '';
    if (row.priority && typeof row.priority === 'object') {
      slug = (row.priority.slug || '').toLowerCase();
      label = isArabic ? (row.priority.nameAr || row.priority.nameEn || slug) : (row.priority.nameEn || row.priority.slug);
    } else {
      slug = String(row.priority || (row.priorityId === 'tp-4' ? 'vip' : row.priorityId === 'tp-3' ? 'high' : row.priorityId === 'tp-1' ? 'low' : 'medium')).toLowerCase();
      if (slug === 'urgent' || slug === 'critical') slug = 'vip';

      if (isArabic) {
        if (slug === 'vip') label = 'VIP - أولوية قصوى';
        else if (slug === 'high') label = 'عالية';
        else if (slug === 'low') label = 'منخفضة';
        else if (slug === 'medium') label = 'متوسطة';
        else if (row.priorityLabelAr) label = row.priorityLabelAr;
        else label = row.priority || '-';
      } else {
        if (slug === 'vip') label = 'VIP';
        else if (slug === 'high') label = 'High';
        else if (slug === 'low') label = 'Low';
        else if (slug === 'medium') label = 'Medium';
        else if (row.priorityLabelEn) label = row.priorityLabelEn;
        else label = row.priority || '-';
      }
    }

    // High fidelity color palettes matching user's Image 2
    let bg = '#eff6ff';
    let text = '#2563eb';
    let border = '#bfdbfe';

    if (slug === 'vip' || label.includes('VIP') || label.includes('قصوى')) {
      bg = '#fae8ff'; // fuchsia-100
      text = '#86198f'; // fuchsia-700
      border = '#f5d0fe';
    } else if (slug === 'high' || label.includes('عالية')) {
      bg = '#ffedd5'; // orange-100
      text = '#c2410c'; // orange-700
      border = '#fed7aa';
    } else if (slug === 'medium' || label.includes('متوسط')) {
      bg = '#e0e7ff'; // indigo-100
      text = '#3730a3'; // indigo-700
      border = '#c7d2fe';
    } else if (slug === 'low' || label.includes('منخفض')) {
      bg = '#f1f5f9'; // slate-100
      text = '#475569'; // slate-700
      border = '#e2e8f0';
    }

    return `
      <div style="text-align: center; width: 100%; margin: 0 auto; line-height: 1;">
        <span style="display: inline-block; text-align: center; vertical-align: middle; background-color: ${bg}; color: ${text}; border: 1px solid ${border}; border-radius: 6px; min-width: 68px; padding: 4px 8px 3px 8px; font-size: 11px; font-weight: 700; white-space: nowrap; line-height: 1.2; box-sizing: border-box; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
          ${label}
        </span>
      </div>
    `;
  }

  // 3. Task Code - monospace badge starting with 0-index
  if (key === 'taskCode') {
    const code = row.taskCode || row.id || '-';
    return `
      <div style="text-align: center; width: 100%; margin: 0 auto; line-height: 1;">
        <span style="display: inline-block; text-align: center; vertical-align: middle; font-family: 'Consolas', 'Courier New', monospace; font-weight: 800; color: #1e40af; background-color: #f0fdf4; border: 1px solid #bbf7d0; min-width: 68px; padding: 4px 8px 3px 8px; border-radius: 6px; font-size: 11px; white-space: nowrap; line-height: 1.2; box-sizing: border-box;">
          ${code}
        </span>
      </div>
    `;
  }

  // 4. Dates - format cleanly and prevent awkward wrapping
  if (key === 'dueDate' || key === 'startDate' || key === 'completionDate' || key === 'createdAt' || key === 'updatedAt') {
    const rawVal = row[key];
    if (!rawVal) return `<div style="text-align: center; color: #94a3b8;">-</div>`;
    const d = new Date(rawVal);
    const dateFormatted = !isNaN(d.getTime())
      ? `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
      : String(rawVal);
    return `
      <div style="text-align: center; white-space: nowrap; font-family: monospace; font-size: 11px; font-weight: 600; color: #334155;">
        ${dateFormatted}
      </div>
    `;
  }

  // 5. Title - Centered cell as requested
  if (key === 'title') {
    return `<div style="font-weight: 700; color: #0f172a; line-height: 1.45; font-size: 11px; text-align: center; word-break: break-word; padding: 2px 4px;">${row.title || '-'}</div>`;
  }

  // 6. Company
  if (key === 'company' || key === 'companyName') {
    let name = '';
    if (row.company && typeof row.company === 'object') {
      name = isArabic && row.company.nameAr ? row.company.nameAr : (row.company.nameEn || row.company.nameAr || '-');
    } else {
      name = row.companyName || row.companyNameAr || row.companyNameEn || '-';
    }
    return `<div style="font-weight: 700; color: #1e293b; text-align: center; white-space: nowrap; font-size: 11px;">${name}</div>`;
  }

  // 7. Assignee
  if (key === 'assigneeName' || key === 'assignedTo') {
    let name = '';
    if (row.assignedTo && typeof row.assignedTo === 'object') {
      name = isArabic && row.assignedTo.fullNameAr ? row.assignedTo.fullNameAr : (row.assignedTo.fullName || '-');
    } else {
      name = row.assignedToName || row.assigneeName || (isArabic ? 'غير مسند' : 'Unassigned');
    }
    const isUnassigned = name === 'غير مسند' || name === 'Unassigned';
    return `<div style="text-align: center; font-size: 11px; color: ${isUnassigned ? '#94a3b8' : '#1e293b'}; font-weight: ${isUnassigned ? 'normal' : '700'}; white-space: nowrap;">${name}</div>`;
  }

  // 8. Description - Smart adaptive full text wrap, no cutoff
  if (key === 'description') {
    return `<div style="font-size: 10.5px; color: #475569; line-height: 1.5; text-align: ${isArabic ? 'right' : 'left'}; word-break: break-word; overflow-wrap: break-word; white-space: normal; padding: 2px 4px;">${row.description || '-'}</div>`;
  }

  // 9. Hours
  if (key === 'estimatedHours' || key === 'actualHours') {
    const val = row[key];
    if (val === null || val === undefined) return `<div style="text-align: center; color: #94a3b8;">-</div>`;
    return `<div style="text-align: center; font-weight: 700; font-family: monospace; color: #1e293b; font-size: 11px;">${val}h</div>`;
  }

  // Fallback default
  const formattedVal = formatExportValue(row, key, isArabic);
  return `<div style="font-size: 11px; color: #334155; line-height: 1.4; text-align: ${isArabic ? 'right' : 'left'};">${formattedVal}</div>`;
}

/**
 * Sanitizes cloned document for html2canvas to eliminate modern CSS colors like oklch()
 * which crash older/standard html2canvas CSS parsers.
 */
function sanitizeClonedDoc(clonedDoc: Document): void {
  try {
    const styles = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
    styles.forEach((el) => {
      try {
        if (el.tagName.toLowerCase() === 'link') {
          // Remove remote stylesheet links to prevent CORS and unsupported css functions
          el.remove();
        } else if (el.textContent && el.textContent.includes('oklch')) {
          // Replace oklch(...) occurrences with safe hex fallback
          el.textContent = el.textContent.replace(/oklch\([^)]+\)/gi, '#475569');
        }
      } catch {
        // ignore
      }
    });

    // Check all elements in clonedDoc for any inline style with oklch
    const allElements = clonedDoc.querySelectorAll('*');
    allElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.style) {
        for (let i = 0; i < htmlEl.style.length; i++) {
          const prop = htmlEl.style[i];
          const val = htmlEl.style.getPropertyValue(prop);
          if (val && val.includes('oklch')) {
            htmlEl.style.setProperty(prop, '#334155');
          }
        }
      }
    });

    if (clonedDoc.documentElement) {
      clonedDoc.documentElement.style.backgroundColor = '#ffffff';
      clonedDoc.documentElement.style.color = '#0f172a';
    }
  } catch (e) {
    console.warn('CSS sanitization warning:', e);
  }
}

export async function generateReportPdf(
  reportData: ReportQueryResult,
  selectedFields: ReportExportFieldKey[],
  isArabic: boolean = false,
  managerName?: string
): Promise<void> {
  const isAllCompanies = !reportData.filters?.companyId || reportData.filters.companyId === 'all';
  const selectedCompanyName = reportData.appliedFilters?.companyName || (isArabic ? 'جميع الشركات' : 'All Companies');
  const effectiveManagerName = managerName || (reportData.appliedFilters as any)?.managerName;
  
  const title = isArabic
    ? (effectiveManagerName
        ? `تقرير المهام التشغيلية - المدير: ${effectiveManagerName}`
        : `تقرير المهام التشغيلية - ${selectedCompanyName}`)
    : (effectiveManagerName
        ? `Executive Operations Dossier - Manager: ${effectiveManagerName}`
        : `Operations & Tasks Report - ${selectedCompanyName}`);

  const tasksList = reportData.tasks || reportData.data || [];
  const recordsCount = reportData.filteredCount || tasksList.length;

  const summary = reportData.summary || {
    totalTasks: recordsCount,
    completedTasks: tasksList.filter((t: any) => t.status === 'completed').length,
    inProgressTasks: tasksList.filter((t: any) => t.status === 'in_progress').length,
    delayedTasks: tasksList.filter((t: any) => t.status === 'delayed' || t.isDelayed).length,
    overdueTasks: tasksList.filter((t: any) => t.daysOverdue > 0).length,
  };

  const pausedCount = tasksList.filter((t: any) => t.status === 'paused').length;
  const cancelledCount = tasksList.filter((t: any) => t.status === 'cancelled').length;

  const subtitle = `${isArabic ? 'تاريخ التوليد:' : 'Generated on:'} ${new Date().toLocaleString(isArabic ? 'ar-SA' : 'en-US')} | ${
    isArabic ? 'إجمالي السجلات:' : 'Total Records:'
  } ${recordsCount}${effectiveManagerName ? ` | ${isArabic ? 'المدير المعين:' : 'Assigned Manager:'} ${effectiveManagerName}` : ''}`;

  const activeFields = REPORT_EXPORT_FIELDS.filter((f) => selectedFields.includes(f.key));
  const colWidths = calculateColumnPercentages(activeFields);
  const tableData = tasksList;

  // Helper to render table thead
  const renderTheadHtml = () => `
    <thead>
      <tr>
        ${activeFields
          .map((f) => {
            const width = colWidths[f.key] || '10%';
            return `<th style="background-color: #0f172a; color: #ffffff; padding: 8px 6px; border: 1px solid #94a3b8; font-weight: 800; font-size: 11px; text-align: center; width: ${width}; box-sizing: border-box; overflow: hidden; word-break: break-word;">
              ${isArabic ? f.labelAr : f.labelEn}
            </th>`;
          })
          .join('')}
      </tr>
    </thead>
  `;

  // Helper to render table rows
  const renderRowsHtml = (rows: any[], startIndex: number = 0) => {
    if (rows.length === 0) {
      return `<tr><td colspan="${activeFields.length}" style="padding: 24px; text-align: center; color: #94a3b8; font-weight: bold;">${
        isArabic ? 'لا توجد بيانات مطابقة لخيارات التصفية' : 'No records found matching filters'
      }</td></tr>`;
    }
    return rows
      .map((row: any, i: number) => {
        const globalIdx = startIndex + i;
        const bg = globalIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
        return `<tr style="background-color: ${bg};">
          ${activeFields
            .map((f) => {
              const width = colWidths[f.key] || '10%';
              return `<td style="padding: 6px 4px; border: 1px solid #cbd5e1; vertical-align: middle; text-align: center; width: ${width}; box-sizing: border-box; overflow: hidden; word-break: break-word;">${renderExportTableCell(row, f.key, isArabic)}</td>`;
            })
            .join('')}
        </tr>`;
      })
      .join('');
  };

  // 1. Measure DOM elements to determine exact row heights and available page height
  let rowHeights: number[] = [];
  let p1HeaderHeight = 285;
  let p2HeaderHeight = 90;

  const measureDiv = document.createElement('div');
  measureDiv.id = 'pdf-measure-staging';
  measureDiv.style.position = 'fixed';
  measureDiv.style.left = '-9999px';
  measureDiv.style.top = '0';
  measureDiv.style.width = '1280px';
  measureDiv.style.padding = '24px 28px';
  measureDiv.style.boxSizing = 'border-box';
  measureDiv.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Arabic', Tahoma, Arial, sans-serif";
  measureDiv.dir = isArabic ? 'rtl' : 'ltr';

  measureDiv.innerHTML = `
    <div id="measure-p1-top">
      <!-- Executive Header -->
      <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h1 style="font-size: 19px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">${title}</h1>
            <p style="font-size: 11px; color: #475569; margin: 0;">${subtitle}</p>
            ${effectiveManagerName ? `
              <div style="display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 3px 10px; font-size: 11px; font-weight: 800; color: #166534;">
                <span>👤 ${isArabic ? 'التقرير مخصص للمدير المسؤول:' : 'Executive Dossier for Manager:'}</span>
                <strong style="color: #0f172a; text-decoration: underline;">${effectiveManagerName}</strong>
              </div>
            ` : ''}
          </div>
          <div style="text-align: ${isArabic ? 'left' : 'right'}; font-size: 11px; color: #64748b;">
            <div style="font-weight: bold; color: #0f172a; font-size: 11px;">${isArabic ? 'النظام المركزي لإدارة الشركات والمهام' : 'Central Enterprise Management'}</div>
            <div>${isArabic ? 'نطاق التقرير:' : 'Scope:'} <strong style="color: #1e293b;">${selectedCompanyName}</strong></div>
            ${effectiveManagerName ? `<div>${isArabic ? 'المدير المسؤول:' : 'Assigned Manager:'} <strong style="color: #166534;">${effectiveManagerName}</strong></div>` : ''}
            <div style="margin-top: 2px; font-size: 10px; color: #94a3b8;">${isArabic ? 'نسخة مصدقة' : 'Verified Copy'}</div>
          </div>
        </div>
      </div>

      <!-- KPI Summary -->
      <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 12px;">
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; text-align: center;">
          <div style="font-size: 9px; font-weight: bold; color: #475569; text-transform: uppercase;">${isArabic ? 'إجمالي المهام' : 'Total Tasks'}</div>
          <div style="font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 1px;">${summary.totalTasks}</div>
        </div>
        <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 8px; text-align: center;">
          <div style="font-size: 9px; font-weight: bold; color: #1d4ed8; text-transform: uppercase;">${isArabic ? 'قيد التنفيذ' : 'In Progress'}</div>
          <div style="font-size: 18px; font-weight: 900; color: #1d4ed8; margin-top: 1px;">${summary.inProgressTasks}</div>
        </div>
        <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px; text-align: center;">
          <div style="font-size: 9px; font-weight: bold; color: #b45309; text-transform: uppercase;">${isArabic ? 'متأخرة' : 'Delayed'}</div>
          <div style="font-size: 18px; font-weight: 900; color: #b45309; margin-top: 1px;">${summary.delayedTasks}</div>
        </div>
        <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 8px; text-align: center;">
          <div style="font-size: 9px; font-weight: bold; color: #be123c; text-transform: uppercase;">${isArabic ? 'تجاوزت الاستحقاق' : 'Overdue'}</div>
          <div style="font-size: 18px; font-weight: 900; color: #be123c; margin-top: 1px;">${summary.overdueTasks}</div>
        </div>
        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 8px; text-align: center;">
          <div style="font-size: 9px; font-weight: bold; color: #047857; text-transform: uppercase;">${isArabic ? 'المكتملة' : 'Completed'}</div>
          <div style="font-size: 18px; font-weight: 900; color: #047857; margin-top: 1px;">${summary.completedTasks}</div>
        </div>
        <div style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; text-align: center;">
          <div style="font-size: 9px; font-weight: bold; color: #475569; text-transform: uppercase;">${isArabic ? 'معلقة / ملغاة' : 'Paused / Cancelled'}</div>
          <div style="font-size: 18px; font-weight: 900; color: #475569; margin-top: 1px;">${pausedCount + cancelledCount}</div>
        </div>
      </div>

      <!-- Analytics Bar -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; color: #334155; margin-bottom: 6px;">
          <span>${isArabic ? 'مخطط التوزيع الإحصائي لحالات المهام:' : 'Task Status Distribution:'}</span>
          <span>${isArabic ? `مجموع المهام: ${recordsCount}` : `Total Tasks: ${recordsCount}`}</span>
        </div>
        <div style="height: 12px; border-radius: 6px; overflow: hidden; display: flex; background-color: #e2e8f0;">
          ${recordsCount > 0 ? `
            <div style="width: ${(summary.completedTasks / recordsCount) * 100}%; background-color: #10b981;"></div>
            <div style="width: ${(summary.inProgressTasks / recordsCount) * 100}%; background-color: #3b82f6;"></div>
            <div style="width: ${(summary.delayedTasks / recordsCount) * 100}%; background-color: #f59e0b;"></div>
            <div style="width: ${(summary.overdueTasks / recordsCount) * 100}%; background-color: #ef4444;"></div>
            <div style="width: ${(pausedCount / recordsCount) * 100}%; background-color: #94a3b8;"></div>
            <div style="width: ${(cancelledCount / recordsCount) * 100}%; background-color: #64748b;"></div>
          ` : `<div style="width: 100%; background-color: #cbd5e1;"></div>`}
        </div>
      </div>
    </div>

    <div id="measure-p2-top">
      <div style="border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${title}</div>
        <div style="font-size: 11px; color: #64748b;">${selectedCompanyName}</div>
      </div>
    </div>

    <!-- Table to measure row heights accurately -->
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; box-sizing: border-box;">
      <tbody id="measure-tbody">
        ${renderRowsHtml(tableData, 0)}
      </tbody>
    </table>
  `;

  document.body.appendChild(measureDiv);

  try {
    const p1El = measureDiv.querySelector('#measure-p1-top') as HTMLElement;
    const p2El = measureDiv.querySelector('#measure-p2-top') as HTMLElement;
    if (p1El) p1HeaderHeight = p1El.offsetHeight;
    if (p2El) p2HeaderHeight = p2El.offsetHeight;

    const rowTrs = measureDiv.querySelectorAll('#measure-tbody tr');
    rowHeights = Array.from(rowTrs).map((tr) => (tr as HTMLElement).offsetHeight || 40);
  } catch (err) {
    console.warn('Measurement error, using defaults:', err);
    rowHeights = tableData.map(() => 40);
  } finally {
    if (document.body.contains(measureDiv)) {
      document.body.removeChild(measureDiv);
    }
  }

  // 2. Compute exact page partition so NO ROW is ever cut in half
  // A4 Landscape at 1280px width is: 1280 * (210 / 297) = 905px height
  // Total padding is 24px * 2 = 48px, footer is ~36px, buffer is ~24px
  const USABLE_PAGE_HEIGHT = 905 - 48 - 36 - 20; // ~801px available
  const theadHeight = 38;

  const page1MaxContentHeight = USABLE_PAGE_HEIGHT - p1HeaderHeight - theadHeight;
  const page2MaxContentHeight = USABLE_PAGE_HEIGHT - p2HeaderHeight - theadHeight;

  interface PageData {
    rows: any[];
    startIndex: number;
    isFirstPage: boolean;
  }

  const pages: PageData[] = [];
  let currentRows: any[] = [];
  let currentAccumulated = 0;
  let isFirst = true;
  let currentStartIndex = 0;

  for (let i = 0; i < tableData.length; i++) {
    const row = tableData[i];
    const rHeight = rowHeights[i] || 40;
    const maxLimit = isFirst ? page1MaxContentHeight : page2MaxContentHeight;

    if (currentRows.length > 0 && currentAccumulated + rHeight > maxLimit) {
      pages.push({
        rows: currentRows,
        startIndex: currentStartIndex,
        isFirstPage: isFirst,
      });
      currentRows = [row];
      currentAccumulated = rHeight;
      currentStartIndex = i;
      isFirst = false;
    } else {
      currentRows.push(row);
      currentAccumulated += rHeight;
    }
  }

  if (currentRows.length > 0 || pages.length === 0) {
    pages.push({
      rows: currentRows,
      startIndex: currentStartIndex,
      isFirstPage: isFirst,
    });
  }

  const totalPages = pages.length;

  // 3. Generate each page cleanly into jsPDF
  try {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
      if (pIdx > 0) {
        doc.addPage();
      }

      const page = pages[pIdx];
      const pageNumber = pIdx + 1;

      const pageContainer = document.createElement('div');
      pageContainer.id = `pdf-page-container-${pIdx}`;
      pageContainer.style.position = 'fixed';
      pageContainer.style.left = '0';
      pageContainer.style.top = '0';
      pageContainer.style.zIndex = '-9999';
      pageContainer.style.opacity = '1';
      pageContainer.style.pointerEvents = 'none';
      pageContainer.style.width = '1280px';
      pageContainer.style.height = '905px';
      pageContainer.style.boxSizing = 'border-box';
      pageContainer.style.backgroundColor = '#ffffff';
      pageContainer.style.color = '#0f172a';
      pageContainer.style.padding = '24px 28px';
      pageContainer.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Arabic', Tahoma, Arial, sans-serif";
      pageContainer.style.display = 'flex';
      pageContainer.style.flexDirection = 'column';
      pageContainer.style.justifyContent = 'space-between';
      pageContainer.dir = isArabic ? 'rtl' : 'ltr';

      let pageHtml = `
        <div style="flex: 1; display: flex; flex-direction: column;">
      `;

      if (page.isFirstPage) {
        pageHtml += `
          <!-- Executive Header -->
          <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <h1 style="font-size: 19px; font-weight: 800; color: #0f172a; margin: 0 0 3px 0;">${title}</h1>
                <p style="font-size: 11px; color: #475569; margin: 0;">${subtitle}</p>
                ${effectiveManagerName ? `
                  <div style="display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 3px 10px; font-size: 11px; font-weight: 800; color: #166534;">
                    <span>👤 ${isArabic ? 'التقرير مخصص للمدير المسؤول:' : 'Executive Dossier for Manager:'}</span>
                    <strong style="color: #0f172a; text-decoration: underline;">${effectiveManagerName}</strong>
                  </div>
                ` : ''}
              </div>
              <div style="text-align: ${isArabic ? 'left' : 'right'}; font-size: 11px; color: #64748b;">
                <div style="font-weight: bold; color: #0f172a; font-size: 11px;">${isArabic ? 'النظام المركزي لإدارة الشركات والمهام' : 'Central Enterprise Management'}</div>
                <div>${isArabic ? 'نطاق التقرير:' : 'Scope:'} <strong style="color: #1e293b;">${selectedCompanyName}</strong></div>
                ${effectiveManagerName ? `<div>${isArabic ? 'المدير المسؤول:' : 'Assigned Manager:'} <strong style="color: #166534;">${effectiveManagerName}</strong></div>` : ''}
                <div style="margin-top: 2px; font-size: 10px; color: #94a3b8;">${isArabic ? 'نسخة مصدقة' : 'Verified Copy'}</div>
              </div>
            </div>
          </div>

          <!-- KPI Summary -->
          <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 10px;">
            <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px; text-align: center;">
              <div style="font-size: 9px; font-weight: bold; color: #475569; text-transform: uppercase;">${isArabic ? 'إجمالي المهام' : 'Total Tasks'}</div>
              <div style="font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 1px;">${summary.totalTasks}</div>
            </div>
            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 6px; text-align: center;">
              <div style="font-size: 9px; font-weight: bold; color: #1d4ed8; text-transform: uppercase;">${isArabic ? 'قيد التنفيذ' : 'In Progress'}</div>
              <div style="font-size: 18px; font-weight: 900; color: #1d4ed8; margin-top: 1px;">${summary.inProgressTasks}</div>
            </div>
            <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 6px; text-align: center;">
              <div style="font-size: 9px; font-weight: bold; color: #b45309; text-transform: uppercase;">${isArabic ? 'متأخرة' : 'Delayed'}</div>
              <div style="font-size: 18px; font-weight: 900; color: #b45309; margin-top: 1px;">${summary.delayedTasks}</div>
            </div>
            <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 6px; text-align: center;">
              <div style="font-size: 9px; font-weight: bold; color: #be123c; text-transform: uppercase;">${isArabic ? 'تجاوزت الاستحقاق' : 'Overdue'}</div>
              <div style="font-size: 18px; font-weight: 900; color: #be123c; margin-top: 1px;">${summary.overdueTasks}</div>
            </div>
            <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 6px; text-align: center;">
              <div style="font-size: 9px; font-weight: bold; color: #047857; text-transform: uppercase;">${isArabic ? 'المكتملة' : 'Completed'}</div>
              <div style="font-size: 18px; font-weight: 900; color: #047857; margin-top: 1px;">${summary.completedTasks}</div>
            </div>
            <div style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px; text-align: center;">
              <div style="font-size: 9px; font-weight: bold; color: #475569; text-transform: uppercase;">${isArabic ? 'معلقة / ملغاة' : 'Paused / Cancelled'}</div>
              <div style="font-size: 18px; font-weight: 900; color: #475569; margin-top: 1px;">${pausedCount + cancelledCount}</div>
            </div>
          </div>

          <!-- Analytics Bar -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 12px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; color: #334155; margin-bottom: 4px;">
              <span>${isArabic ? 'مخطط التوزيع الإحصائي لحالات المهام:' : 'Task Status Distribution:'}</span>
              <span>${isArabic ? `مجموع المهام: ${recordsCount}` : `Total Tasks: ${recordsCount}`}</span>
            </div>
            <div style="height: 10px; border-radius: 5px; overflow: hidden; display: flex; background-color: #e2e8f0;">
              ${recordsCount > 0 ? `
                <div style="width: ${(summary.completedTasks / recordsCount) * 100}%; background-color: #10b981;"></div>
                <div style="width: ${(summary.inProgressTasks / recordsCount) * 100}%; background-color: #3b82f6;"></div>
                <div style="width: ${(summary.delayedTasks / recordsCount) * 100}%; background-color: #f59e0b;"></div>
                <div style="width: ${(summary.overdueTasks / recordsCount) * 100}%; background-color: #ef4444;"></div>
                <div style="width: ${(pausedCount / recordsCount) * 100}%; background-color: #94a3b8;"></div>
                <div style="width: ${(cancelledCount / recordsCount) * 100}%; background-color: #64748b;"></div>
              ` : `<div style="width: 100%; background-color: #cbd5e1;"></div>`}
            </div>
          </div>
        `;
      } else {
        // Subsequent Pages Continuation Header
        pageHtml += `
          <div style="border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 13px; font-weight: 800; color: #0f172a;">
                ${title} <span style="font-size: 11px; font-weight: 700; color: #2563eb; margin-${isArabic ? 'right' : 'left'}: 8px;">(${isArabic ? 'متابعة جدول المهام التشغيلية' : 'Tasks Schedule Continuation'})</span>
              </div>
              <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
                ${subtitle}
              </div>
            </div>
            <div style="text-align: ${isArabic ? 'left' : 'right'}; font-size: 10px; color: #64748b;">
              <span style="font-weight: bold; color: #0f172a;">${selectedCompanyName}</span>
              ${effectiveManagerName ? ` | <span style="color: #166534; font-weight: bold;">👤 ${effectiveManagerName}</span>` : ''}
              <span style="color: #94a3b8; margin-${isArabic ? 'right' : 'left'}: 6px;">[${isArabic ? 'نسخة مصدقة' : 'Verified Copy'}]</span>
            </div>
          </div>
        `;
      }

      // Add Data Table with Table Header on EVERY page!
      pageHtml += `
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; box-sizing: border-box;">
            ${renderTheadHtml()}
            <tbody>
              ${renderRowsHtml(page.rows, page.startIndex)}
            </tbody>
          </table>
        </div>

        <!-- Official Page Footer -->
        <div style="margin-top: auto; padding-top: 10px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748b;">
          <span>${isArabic ? 'تم الإصدار آلياً بواسطة المنظومة المركزية لحوكمة الشركات' : 'Generated automatically by Enterprise Governance System'}</span>
          <span style="font-weight: 800; color: #0f172a; background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 2px 10px;">
            ${isArabic ? `صفحة ${pageNumber} من ${totalPages}` : `Page ${pageNumber} of ${totalPages}`}
          </span>
          <span>${isArabic ? 'وثيقة حوكمة رسمية معتمدة' : 'Official Verified Report'}</span>
        </div>
      `;

      pageContainer.innerHTML = pageHtml;
      document.body.appendChild(pageContainer);

      const canvas = await html2canvas(pageContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 1280,
        scrollX: 0,
        scrollY: 0,
        onclone: sanitizeClonedDoc,
      });

      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');

      document.body.removeChild(pageContainer);
    }

    const safeDate = new Date().toISOString().substring(0, 10);
    const cleanCompName = selectedCompanyName.replace(/[^\w\s\u0600-\u06FF]/gi, '').trim().replace(/\s+/g, '_');
    const cleanMgrName = effectiveManagerName ? effectiveManagerName.replace(/[^\w\s\u0600-\u06FF]/gi, '').trim().replace(/\s+/g, '_') : '';
    const outputFilename = cleanMgrName
      ? `Manager_${cleanMgrName}_Tasks_${safeDate}.pdf`
      : `Operations_Report_${cleanCompName}_${safeDate}.pdf`;
    doc.save(outputFilename);
  } catch (err) {
    console.error('PDF Generation error caught, applying fallback print:', err);
    window.print();
  }
}

/**
 * Exports a specific DOM element (like Company Analysis dashboard) to a multi-page PDF document
 */
export async function exportElementToPdf(
  element: HTMLElement,
  fileName: string = 'Company_Analysis_Report',
  isArabic: boolean = false
): Promise<void> {
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      onclone: sanitizeClonedDoc,
    });

    const imgData = canvas.toDataURL('image/png');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 8;
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = (canvas.height * contentWidth) / canvas.width;

    let heightLeft = contentHeight;
    let position = margin;

    doc.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight, undefined, 'FAST');
    heightLeft -= (pageHeight - margin * 2);

    while (heightLeft > 0) {
      position = heightLeft - contentHeight + margin;
      doc.addPage();
      doc.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight, undefined, 'FAST');
      heightLeft -= (pageHeight - margin * 2);
    }

    const safeDate = new Date().toISOString().substring(0, 10);
    doc.save(`${fileName}_${safeDate}.pdf`);
  } catch (err) {
    console.error('Export element to PDF failed:', err);
    window.print();
  }
}
