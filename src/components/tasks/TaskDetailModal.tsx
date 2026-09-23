import React, { useState, useEffect } from 'react';
import { Task, CustomField, TaskTimelineEvent, TaskNote, TaskAttachment } from '../../types/database';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { PermissionKey } from '../../types/permissions';
import { DynamicFieldDisplay } from './DynamicFieldDisplay';
import { StatusChangeModal } from './StatusChangeModal';
import {
  X,
  Calendar,
  Building2,
  User as UserIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Paperclip,
  History,
  MessageSquare,
  SlidersHorizontal,
  Send,
  Upload,
  Download,
  Shield,
  Trash2,
  Edit,
  ArrowRight,
  PauseCircle,
  PlayCircle,
  XCircle,
  Lock,
  FileCheck,
  AlertTriangle,
} from 'lucide-react';

interface TaskDetailModalProps {
  taskId: string;
  onClose: () => void;
  onTaskUpdated: () => void;
  onEditTask?: (task: Task) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  taskId,
  onClose,
  onTaskUpdated,
  onEditTask,
}) => {
  const { t, language } = useI18n();
  const isAr = language === 'ar';
  const { hasPermission } = useAuth();

  const [task, setTask] = useState<Task | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'custom_fields' | 'notes' | 'attachments' | 'timeline'>('overview');
  
  // Modals inside details
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Note form state
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Attachment upload form state
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentFileName, setAttachmentFileName] = useState('');
  const [isPrivateAttachment, setIsPrivateAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentSuccess, setAttachmentSuccess] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'png', 'jpg', 'jpeg', 'svg', 'webp', 'txt', 'csv', 'zip'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB Limit

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Fetch full task data
  const fetchTaskDetails = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/tasks/${taskId}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load task');
      const data = await res.json();
      setTask(data.task);

      // Also fetch custom fields for this company
      if (data.task?.companyId) {
        const cfRes = await fetch(`/api/custom-fields?companyId=${data.task.companyId}`, {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        if (cfRes.ok) {
          const cfData = await cfRes.json();
          setCustomFields(cfData.customFields || []);
        }
      }
    } catch (err) {
      console.error('Error fetching task details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTaskDetails();
  }, [taskId]);

  // Handle Note Submission
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim() || !task) return;

    setIsSubmittingNote(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({
          content: newNoteContent.trim(),
          isInternalOnly: isInternalNote,
        }),
      });

      if (!res.ok) throw new Error('Failed to add note');
      setNewNoteContent('');
      setIsInternalNote(false);
      await fetchTaskDetails();
      onTaskUpdated();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Helper to read File as Base64 Data URL
  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  // Handle Attachment Upload with Security (Size Limit, Allowed Types, Privacy)
  const handleUploadAttachments = async (fileList: FileList | File[]) => {
    if (!task) return;
    setAttachmentError(null);
    setAttachmentSuccess(null);
    setIsUploadingAttachment(true);

    try {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      for (const file of files) {
        // 1. Validate File Size
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(
            isAr
              ? `حجم الملف (${file.name}) يتجاوز الحد الأقصى المسموح به (10 ميغابايت).`
              : `File (${file.name}) exceeds the 10MB maximum size limit.`
          );
        }

        // 2. Validate Allowed File Types
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          throw new Error(
            isAr
              ? `نوع الملف .${ext} غير مسموح به. الصيغ المقبولة: ${ALLOWED_EXTENSIONS.join(', ')}`
              : `File type .${ext} is not permitted. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
          );
        }

        // 3. Read Base64 Data
        const fileData = await readFileAsDataUrl(file);

        // 4. Secure POST
        const res = await fetch(`/api/tasks/${task.id}/attachments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          credentials: 'include',
          body: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || 'application/octet-stream',
            fileUrl: `/uploads/${file.name}`,
            isPrivate: isPrivateAttachment,
            fileData,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || (isAr ? 'فشل رفع الملف' : 'Failed to upload file'));
        }
      }

      setAttachmentSuccess(
        isAr ? `تم رفع ${files.length} ملف/ملفات بنجاح وتوثيقها في سجل التدقيق.` : `Successfully uploaded ${files.length} file(s).`
      );
      setAttachmentFileName('');
      await fetchTaskDetails();
      onTaskUpdated();
    } catch (err: any) {
      console.error('Attachment upload error:', err);
      setAttachmentError(err.message || (isAr ? 'حدث خطأ أثناء رفع الملف' : 'Failed to upload attachment'));
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  // Handle Secure Attachment Download with Authorization Check
  const handleDownloadAttachment = async (att: TaskAttachment) => {
    if (!task) return;
    setAttachmentError(null);
    setDownloadingId(att.id);

    try {
      const res = await api.downloadTaskAttachment(task.id, att.id);
      const downloadData = res.attachment;

      // Create download trigger
      const downloadHref = downloadData.fileData || downloadData.fileUrl || '#';
      const a = document.createElement('a');
      a.href = downloadHref;
      a.download = downloadData.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Download error:', err);
      if (err.status === 403 || err.message?.includes('Denied') || err.message?.includes('Unauthorized')) {
        setAttachmentError(
          isAr
            ? 'تم رفض الوصول: هذا ملف خاص/سري وليس لديك الصلاحية الأمنية لتحميله.'
            : 'Access Denied: You do not have authorization to access this confidential/private file.'
        );
      } else {
        setAttachmentError(err.message || (isAr ? 'فشل تحميل الملف' : 'Failed to download file'));
      }
    } finally {
      setDownloadingId(null);
    }
  };

  // Handle Attachment Deletion
  const handleDeleteAttachment = async (attId: string) => {
    if (!task) return;
    if (!window.confirm(isAr ? 'هل أنت متأكد من حذف هذا المرفق نهائيًا؟' : 'Are you sure you want to delete this attachment?')) {
      return;
    }

    try {
      await api.deleteTaskAttachment(task.id, attId);
      await fetchTaskDetails();
      onTaskUpdated();
    } catch (err: any) {
      console.error('Delete attachment error:', err);
      setAttachmentError(err.message || 'Failed to delete attachment');
    }
  };

  // Handle Task Delete / Archive
  const handleDeleteTask = async () => {
    if (!task || !window.confirm(t('task.confirm_delete'))) return;

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete task');
      onTaskUpdated();
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-3 relative shadow-2xl">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 end-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-600">{isAr ? 'جاري تحميل تفاصيل المهمة...' : 'Loading task details...'}</p>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full flex flex-col items-center text-center gap-4 relative shadow-2xl border border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 end-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {isAr ? 'لم يتم العثور على المهمة' : 'Task Not Found'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {isAr
                ? 'المهمة المطلوبة غير متوفرة أو تم نقلها أو تحتاج إلى صلاحيات إضافية.'
                : 'The requested task is unavailable or requires additional permissions.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
          >
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    );
  }

  // Priority Helpers
  const priorityBadge = () => {
    const slug = task.priority || 'medium';
    switch (slug) {
      case 'vip':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-100 text-rose-800 border border-rose-200">VIP</span>;
      case 'high':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-orange-100 text-orange-800 border border-orange-200">{t('task.priority_high')}</span>;
      case 'medium':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-100 text-blue-800 border border-blue-200">{t('task.priority_medium')}</span>;
      case 'low':
      default:
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 border border-slate-200">{t('task.priority_low')}</span>;
    }
  };

  // Status Helpers
  const statusBadge = () => {
    const slug = task.status || 'pending';
    switch (slug) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t('task.status_completed')}
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-blue-100 text-blue-800 border border-blue-200">
            <PlayCircle className="w-3.5 h-3.5" />
            {t('task.status_in_progress')}
          </span>
        );
      case 'delayed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5" />
            {t('task.status_delayed')}
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-amber-100 text-amber-800 border border-amber-200">
            <PauseCircle className="w-3.5 h-3.5" />
            {t('task.status_paused')}
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
            <XCircle className="w-3.5 h-3.5" />
            {t('task.status_cancelled')}
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
            <Clock className="w-3.5 h-3.5" />
            {t('task.status_pending')}
          </span>
        );
    }
  };

  const isOverdue = task.dueDate && task.status !== 'completed' && new Date(task.dueDate) < new Date();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="px-2.5 py-1 rounded-lg bg-slate-200/80 font-mono text-xs font-bold text-slate-800">
              {task.taskCode || task.id}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 line-clamp-1">{task.title}</h2>
              <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-slate-600" />
                <span>{isAr && task.company?.nameAr ? task.company.nameAr : task.company?.nameEn || 'Corporate'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {priorityBadge()}
            {statusBadge()}

            <button
              id="open-status-change-modal-btn"
              onClick={() => setShowStatusModal(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              {t('task.change_status')}
            </button>

            {hasPermission(PermissionKey.TASKS_EDIT) && onEditTask && (
              <button
                id="edit-task-btn"
                onClick={() => {
                  onClose();
                  onEditTask(task);
                }}
                className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title={t('action.edit')}
              >
                <Edit className="w-4 h-4" />
              </button>
            )}

            {hasPermission(PermissionKey.TASKS_DELETE) && (
              <button
                id="delete-task-btn"
                onClick={handleDeleteTask}
                className="p-1.5 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title={t('action.delete')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              id="close-task-detail-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 hover:bg-slate-200/60 transition-colors ms-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 border-b border-slate-200 bg-white overflow-x-auto">
          <button
            id="tab-overview"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{isAr ? 'نظرة عامة والمسؤوليات' : 'Overview & Assignments'}</span>
          </button>

          <button
            id="tab-custom-fields"
            onClick={() => setActiveTab('custom_fields')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'custom_fields'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>{t('task.custom_fields')}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600">
              {Object.keys(task.customFields || {}).length}
            </span>
          </button>

          <button
            id="tab-notes"
            onClick={() => setActiveTab('notes')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'notes'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>{t('task.notes')}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600">
              {task.notes?.length || 0}
            </span>
          </button>

          <button
            id="tab-attachments"
            onClick={() => setActiveTab('attachments')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'attachments'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Paperclip className="w-4 h-4" />
            <span>{t('task.attachments')}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600">
              {task.attachments?.length || 0}
            </span>
          </button>

          <button
            id="tab-timeline"
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'timeline'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="w-4 h-4" />
            <span>{t('task.timeline')}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600">
              {task.timeline?.length || 0}
            </span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: OVERVIEW & ASSIGNMENTS */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Status Reason Banner if present */}
              {task.statusReason && (
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                  task.status === 'delayed'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : task.status === 'paused'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}>
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider mb-0.5">
                      {t('task.status_reason')}
                    </h4>
                    <p className="text-xs leading-relaxed font-medium">{task.statusReason}</p>
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-1.5">
                  {isAr ? 'وصف المهمة والمتطلبات التنفيذية:' : 'Description & Scope:'}
                </h4>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {task.description || (isAr ? 'لا يوجد وصف تفصيلي للمهمة.' : 'No detailed description.')}
                </div>
              </div>

              {/* 4 Assignees / Roles Grid */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-3">
                  {isAr ? 'الأشخاص والمسؤوليات المحددة:' : 'People & Assigned Roles:'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Assigned To */}
                  <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {task.assignedTo?.fullName?.charAt(0) || 'U'}
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[11px] font-semibold text-slate-600">{t('task.assigned_to')}</span>
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {isAr && task.assignedTo?.fullNameAr ? task.assignedTo.fullNameAr : task.assignedTo?.fullName || (isAr ? 'غير محدد' : 'Unassigned')}
                      </p>
                      <span className="text-[10px] text-slate-600 truncate block">{task.assignedTo?.email}</span>
                    </div>
                  </div>

                  {/* Responsible Person */}
                  <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {task.responsiblePerson?.fullName?.charAt(0) || 'R'}
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[11px] font-semibold text-slate-600">{t('task.responsible')}</span>
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {isAr && task.responsiblePerson?.fullNameAr ? task.responsiblePerson.fullNameAr : task.responsiblePerson?.fullName || (isAr ? 'غير محدد' : 'Unassigned')}
                      </p>
                      <span className="text-[10px] text-slate-600 truncate block">{task.responsiblePerson?.email}</span>
                    </div>
                  </div>

                  {/* Recipient */}
                  <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {task.recipient?.fullName?.charAt(0) || 'E'}
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[11px] font-semibold text-slate-600">{t('task.recipient')}</span>
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {isAr && task.recipient?.fullNameAr ? task.recipient.fullNameAr : task.recipient?.fullName || (isAr ? 'غير محدد' : 'Unassigned')}
                      </p>
                      <span className="text-[10px] text-slate-600 truncate block">{task.recipient?.email}</span>
                    </div>
                  </div>

                  {/* Created By */}
                  <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {task.creator?.fullName?.charAt(0) || 'C'}
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[11px] font-semibold text-slate-600">{t('task.created_by')}</span>
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {isAr && task.creator?.fullNameAr ? task.creator.fullNameAr : task.creator?.fullName || 'System'}
                      </p>
                      <span className="text-[10px] text-slate-600 truncate block">{task.creator?.email}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dates & Metrics */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-3">
                  {isAr ? 'التواريخ والجدول الزمني للإنجاز:' : 'Schedules & Milestones:'}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="block text-[11px] font-semibold text-slate-600 mb-1">{t('task.start_date')}</span>
                    <p className="text-xs font-bold text-slate-900 font-mono">
                      {task.startDate ? new Date(task.startDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US') : '-'}
                    </p>
                  </div>

                  <div className={`p-3 border rounded-xl ${isOverdue ? 'bg-rose-50 border-rose-300' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="block text-[11px] font-semibold text-slate-600">{t('task.due_date')}</span>
                      {isOverdue && (
                        <span className="text-[10px] font-bold text-rose-600">{t('task.overdue')}</span>
                      )}
                    </div>
                    <p className={`text-xs font-bold font-mono ${isOverdue ? 'text-rose-700' : 'text-slate-900'}`}>
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US') : '-'}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="block text-[11px] font-semibold text-slate-600 mb-1">{t('task.completion_date')}</span>
                    <p className="text-xs font-bold text-emerald-700 font-mono">
                      {task.completionDate ? new Date(task.completionDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US') : (isAr ? 'لم تكتمل بعد' : 'In Progress')}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="block text-[11px] font-semibold text-slate-600 mb-1">{isAr ? 'الساعات التقديرية / الفعلية' : 'Estimated / Actual'}</span>
                    <p className="text-xs font-bold text-slate-800 font-mono">
                      {task.estimatedHours || 0}h / {task.actualHours || 0}h
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DYNAMIC CUSTOM FIELDS */}
          {activeTab === 'custom_fields' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{t('task.custom_fields')}</h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {isAr
                      ? 'الحقول الديناميكية المهيأة لهذه الشركة ونوع المهمة'
                      : 'Dynamic attributes configured for this company workspace'}
                  </p>
                </div>
              </div>

              {customFields.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <SlidersHorizontal className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">
                    {isAr ? 'لا توجد حقول ديناميكية معرفة لهذه الشركة' : 'No dynamic custom fields configured for this company'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {customFields.map((field) => (
                    <DynamicFieldDisplay
                      key={field.id}
                      field={field}
                      value={task.customFields ? task.customFields[field.fieldKey] : undefined}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: NOTES & DISCUSSION */}
          {activeTab === 'notes' && (
            <div className="space-y-6">
              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-800">{t('task.add_note')}</h4>
                <textarea
                  rows={2}
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder={isAr ? 'اكتب ملاحظة أو توجيه تنفيذي حول سير المهمة...' : 'Add a note or operational feedback...'}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
                  required
                />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={isInternalNote}
                      onChange={(e) => setIsInternalNote(e.target.checked)}
                      className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded"
                    />
                    <Shield className="w-3.5 h-3.5 text-amber-600" />
                    <span className="font-medium">{t('task.internal_note')}</span>
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmittingNote || !newNoteContent.trim()}
                    className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 shadow-2xs self-end"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isAr ? 'إرسال الملاحظة' : 'Post Note'}</span>
                  </button>
                </div>
              </form>

              {/* Notes List */}
              <div className="space-y-3">
                {(!task.notes || task.notes.length === 0) ? (
                  <p className="text-xs text-slate-600 text-center py-6">
                    {isAr ? 'لا توجد ملاحظات مسجلة حتى الآن.' : 'No notes recorded yet.'}
                  </p>
                ) : (
                  task.notes.map((note) => (
                    <div
                      key={note.id}
                      className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                        note.isInternalOnly
                          ? 'bg-amber-50/50 border-amber-200'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{note.authorName}</span>
                          {note.isInternalOnly && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-300">
                              {isAr ? 'سري / داخلي' : 'Internal'}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-600 font-mono">
                          {new Date(note.createdAt).toLocaleString(isAr ? 'ar-SA' : 'en-US')}
                        </span>
                      </div>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ATTACHMENTS */}
          {activeTab === 'attachments' && (
            <div className="space-y-6">
              {/* Alert Feedback Messages */}
              {attachmentError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">{isAr ? 'تنبيه أمني / خطأ في المرفقات' : 'Security / Attachment Notice'}</p>
                    <p className="mt-0.5">{attachmentError}</p>
                  </div>
                  <button
                    onClick={() => setAttachmentError(null)}
                    className="text-rose-500 hover:text-rose-800 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {attachmentSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{attachmentSuccess}</span>
                  </div>
                  <button
                    onClick={() => setAttachmentSuccess(null)}
                    className="text-emerald-500 hover:text-emerald-800 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Drag and Drop Box & Upload Controls */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (e.dataTransfer.files?.length) {
                    handleUploadAttachments(e.dataTransfer.files);
                  }
                }}
                className={`p-6 border-2 border-dashed rounded-2xl text-center transition-all ${
                  isDragOver ? 'border-blue-500 bg-blue-50/50' : 'border-slate-300 bg-slate-50/60'
                }`}
              >
                <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">
                  {isAr ? 'اسحب وأفلت ملفات متعددة هنا أو استعرض جهازك' : t('task.drag_drop')}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {isAr
                    ? 'الصيغ المسموح بها: PDF, DOCX, XLSX, PNG, JPG, CSV, ZIP (الحد الأقصى: 10 ميغابايت لكل ملف)'
                    : 'Permitted types: PDF, DOCX, XLSX, PNG, JPG, CSV, ZIP (Max 10MB per file)'}
                </p>

                {/* Private / Confidential File Toggle */}
                <div className="mt-3 inline-flex items-center justify-center">
                  <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 shadow-2xs hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={isPrivateAttachment}
                      onChange={(e) => setIsPrivateAttachment(e.target.checked)}
                      className="w-3.5 h-3.5 text-blue-600 rounded"
                    />
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span className="font-semibold">
                      {isAr ? 'ملف سري / خاص (Private - صلاحية محددة فقط)' : 'Confidential / Private File (Restricted Access)'}
                    </span>
                  </label>
                </div>

                <div className="mt-3.5">
                  <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer shadow-xs transition-colors">
                    <Paperclip className="w-4 h-4" />
                    <span>{isUploadingAttachment ? (isAr ? 'جاري الرفع والتوثيق...' : 'Uploading...') : (isAr ? 'اختيار ملفات للرفع' : 'Select Files')}</span>
                    <input
                      type="file"
                      multiple
                      disabled={isUploadingAttachment}
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length) {
                          handleUploadAttachments(e.target.files);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Attachments List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>{t('task.attachments')}</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-mono">
                      {task.attachments?.length || 0}
                    </span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {isAr ? 'محمي بنظام التحقق من الصلاحيات' : 'Secured via Role-Based Access'}
                  </span>
                </div>

                {(!task.attachments || task.attachments.length === 0) ? (
                  <div className="p-6 border border-slate-200 rounded-xl bg-slate-50/50 text-center">
                    <Paperclip className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                    <p className="text-xs text-slate-500 font-medium">
                      {isAr ? 'لا توجد مرفقات مسجلة لهذه المهمة حتى الآن.' : 'No files attached to this task yet.'}
                    </p>
                  </div>
                ) : (
                  task.attachments.map((att) => (
                    <div
                      key={att.id}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                        att.isPrivate
                          ? 'bg-amber-50/40 border-amber-200/80 hover:border-amber-300'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            att.isPrivate ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600'
                          }`}
                        >
                          {att.isPrivate ? <Lock className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-slate-900 truncate">{att.fileName}</p>
                            {att.isPrivate && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                {isAr ? 'سري / خاص' : 'Private'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            <span className="font-mono">{((att.fileSize || 0) / 1024).toFixed(1)} KB</span>
                            <span>•</span>
                            <span>{att.uploaderName || 'User'}</span>
                            <span>•</span>
                            <span className="font-mono">{new Date(att.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleDownloadAttachment(att)}
                          disabled={downloadingId === att.id}
                          className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                          title={isAr ? 'تحميل آمن بعد التحقق من الصلاحية' : 'Secure Authorized Download'}
                        >
                          <Download className={`w-4 h-4 ${downloadingId === att.id ? 'animate-bounce text-blue-600' : ''}`} />
                        </button>

                        <button
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title={isAr ? 'حذف المرفق' : 'Delete attachment'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: TIMELINE & ACTIVITY LOG */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-800 mb-3">{t('task.timeline')}</h4>
              
              {(!task.timeline || task.timeline.length === 0) ? (
                <p className="text-xs text-slate-600 text-center py-6">
                  {isAr ? 'لا توجد أحداث مسجلة في الجدول الزمني.' : 'No timeline events recorded.'}
                </p>
              ) : (
                <div className="relative border-s-2 border-slate-200 ms-3 space-y-6 pb-2">
                  {task.timeline.map((event) => {
                    let IconComponent = History;
                    let iconColor = 'bg-blue-600 text-white';

                    if (event.type === 'created') {
                      IconComponent = FileText;
                      iconColor = 'bg-emerald-600 text-white';
                    } else if (event.type === 'status_changed') {
                      IconComponent = PlayCircle;
                      iconColor = 'bg-purple-600 text-white';
                    } else if (event.type === 'note_added') {
                      IconComponent = MessageSquare;
                      iconColor = 'bg-blue-600 text-white';
                    } else if (event.type === 'attachment_added') {
                      IconComponent = Paperclip;
                      iconColor = 'bg-amber-600 text-white';
                    } else if (event.type === 'completed') {
                      IconComponent = CheckCircle2;
                      iconColor = 'bg-emerald-600 text-white';
                    }

                    return (
                      <div key={event.id} className="relative ps-6 group">
                        {/* Timeline Node Icon */}
                        <div className={`absolute -start-[13px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center shadow-xs ${iconColor}`}>
                          <IconComponent className="w-3 h-3" />
                        </div>

                        <div className="p-3.5 bg-slate-50/90 border border-slate-200 rounded-xl space-y-1">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="text-xs font-bold text-slate-900">
                              {event.userName || 'System User'}
                            </span>
                            <span className="text-[11px] font-mono text-slate-600">
                              {event.date} {event.time}
                            </span>
                          </div>

                          <p className="text-xs text-slate-700 leading-relaxed">
                            {event.details}
                          </p>

                          {event.oldValue && event.newValue && (
                            <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-slate-600">
                              <span className="px-1.5 py-0.5 bg-slate-200/60 rounded line-through">{event.oldValue}</span>
                              <ArrowRight className="w-3 h-3 text-slate-600" />
                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold">{event.newValue}</span>
                            </div>
                          )}

                          {event.reason && (
                            <div className="mt-1 p-2 bg-amber-50 border border-amber-200/70 rounded-lg text-[11px] text-amber-900 font-medium">
                              <span className="font-bold">{isAr ? 'السبب الموثق: ' : 'Documented Reason: '}</span>
                              {event.reason}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-600 font-mono">
            {isAr ? 'آخر تحديث: ' : 'Last Updated: '}
            {new Date(task.updatedAt).toLocaleString(isAr ? 'ar-SA' : 'en-US')}
          </span>

          <button
            id="modal-footer-close-btn"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            {t('action.cancel')}
          </button>
        </div>

        {/* Nested Status Change Modal */}
        {showStatusModal && (
          <StatusChangeModal
            task={task}
            onClose={() => setShowStatusModal(false)}
            onSuccess={(updatedTask) => {
              setTask(updatedTask);
              onTaskUpdated();
              fetchTaskDetails();
            }}
          />
        )}
      </div>
    </div>
  );
};
