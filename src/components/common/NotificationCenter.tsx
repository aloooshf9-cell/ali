import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { api } from '../../services/api';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserPlus,
  MessageSquare,
  FileUp,
  FileEdit,
  Layers,
  Filter,
  ExternalLink,
  RotateCw,
} from 'lucide-react';

export interface NotificationItem {
  id: string;
  userId: string;
  taskId?: string;
  taskCode?: string;
  type:
    | 'new_task'
    | 'task_assigned'
    | 'status_changed'
    | 'task_delayed'
    | 'task_completed'
    | 'new_note'
    | 'task_updated'
    | 'file_uploaded'
    | string;
  title: string;
  titleAr?: string;
  message: string;
  messageAr?: string;
  isRead: boolean;
  actionUrl?: string;
  metadata?: any;
  createdAt: string;
}

interface NotificationCenterProps {
  onSelectTask?: (taskId: string) => void;
  isDropdown?: boolean;
  onClose?: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  onSelectTask,
  isDropdown = false,
  onClose,
}) => {
  const { language } = useI18n();
  const isAr = language === 'ar';

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | string>('all');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const res = await api.getNotifications({
        unreadOnly: activeFilter === 'unread',
        type: activeFilter !== 'all' && activeFilter !== 'unread' ? activeFilter : undefined,
      });
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // Polling every 15s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleToggleRead = async (e: React.MouseEvent, item: NotificationItem) => {
    e.stopPropagation();
    try {
      await api.markNotificationAsRead(item.id, !item.isRead);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: !item.isRead } : n))
      );
      setUnreadCount((prev) => (!item.isRead ? Math.max(0, prev - 1) : prev + 1));
    } catch (err) {
      console.error('Error toggling read status:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      // Re-fetch unread count
      const countRes = await api.getUnreadNotificationsCount();
      setUnreadCount(countRes.unreadCount);
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'new_task':
        return {
          icon: Layers,
          color: 'text-blue-600 bg-blue-50 border-blue-200',
          badgeAr: 'مهمة جديدة',
          badgeEn: 'New Task',
        };
      case 'task_assigned':
        return {
          icon: UserPlus,
          color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
          badgeAr: 'إسناد مهمة',
          badgeEn: 'Task Assigned',
        };
      case 'status_changed':
        return {
          icon: RotateCw,
          color: 'text-amber-600 bg-amber-50 border-amber-200',
          badgeAr: 'تغيير الحالة',
          badgeEn: 'Status Changed',
        };
      case 'task_delayed':
        return {
          icon: AlertTriangle,
          color: 'text-rose-600 bg-rose-50 border-rose-200',
          badgeAr: 'مهمة متأخرة',
          badgeEn: 'Task Delayed',
        };
      case 'task_completed':
        return {
          icon: CheckCircle2,
          color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
          badgeAr: 'مهمة مكتملة',
          badgeEn: 'Task Completed',
        };
      case 'new_note':
        return {
          icon: MessageSquare,
          color: 'text-sky-600 bg-sky-50 border-sky-200',
          badgeAr: 'ملاحظة جديدة',
          badgeEn: 'New Note',
        };
      case 'task_updated':
        return {
          icon: FileEdit,
          color: 'text-violet-600 bg-violet-50 border-violet-200',
          badgeAr: 'تحديث مهمة',
          badgeEn: 'Task Updated',
        };
      case 'file_uploaded':
        return {
          icon: FileUp,
          color: 'text-teal-600 bg-teal-50 border-teal-200',
          badgeAr: 'رفع ملف',
          badgeEn: 'File Uploaded',
        };
      default:
        return {
          icon: Bell,
          color: 'text-slate-600 bg-slate-50 border-slate-200',
          badgeAr: 'إشعار نظام',
          badgeEn: 'Notification',
        };
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) {
        return isAr ? 'الآن' : 'Just now';
      }
      if (diffMins < 60) {
        return isAr ? `منذ ${diffMins} دقيقة` : `${diffMins}m ago`;
      }
      if (diffHours < 24) {
        return isAr ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
      }
      if (diffDays === 1) {
        return isAr ? 'أمس' : 'Yesterday';
      }
      return date.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const filterOptions = [
    { key: 'all', labelAr: 'الكل', labelEn: 'All' },
    { key: 'unread', labelAr: 'غير المقروءة', labelEn: 'Unread' },
    { key: 'task_assigned', labelAr: 'الإسناد', labelEn: 'Assigned' },
    { key: 'status_changed', labelAr: 'تغيير الحالة', labelEn: 'Status' },
    { key: 'task_delayed', labelAr: 'المتأخرة', labelEn: 'Delayed' },
    { key: 'task_completed', labelAr: 'المكتملة', labelEn: 'Completed' },
    { key: 'new_note', labelAr: 'الملاحظات', labelEn: 'Notes' },
    { key: 'file_uploaded', labelAr: 'الملفات', labelEn: 'Files' },
  ];

  return (
    <div
      className={`flex flex-col bg-white ${
        isDropdown
          ? 'w-96 sm:w-[420px] max-h-[580px] rounded-2xl shadow-2xl border border-slate-200 overflow-hidden'
          : 'rounded-2xl border border-slate-200 shadow-xs overflow-hidden'
      }`}
    >
      {/* Header Bar */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>{isAr ? 'مركز الإشعارات' : 'Notification Center'}</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-blue-100 text-blue-700">
                  {unreadCount} {isAr ? 'جديد' : 'new'}
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-500">
              {isAr ? 'تنبيهات المهام وتحديثات مسار العمل' : 'Real-time task and workflow events'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100/80 rounded-lg transition-colors"
              title={isAr ? 'تعيين الكل كمقروء' : 'Mark all as read'}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isAr ? 'قراءة الكل' : 'Mark All Read'}</span>
            </button>
          )}

          <button
            onClick={fetchNotifications}
            disabled={isRefreshing}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title={isAr ? 'تحديث' : 'Refresh'}
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-3 py-2 border-b border-slate-100 bg-white flex items-center gap-1 overflow-x-auto no-scrollbar">
        {filterOptions.map((f) => {
          const isActive = activeFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {isAr ? f.labelAr : f.labelEn}
              {f.key === 'unread' && unreadCount > 0 && ` (${unreadCount})`}
            </button>
          );
        })}
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[420px]">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">
            <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-xs font-medium">{isAr ? 'جاري تحميل الإشعارات...' : 'Loading notifications...'}</p>
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-bold text-slate-700">
              {isAr ? 'لا توجد إشعارات في هذا القسم' : 'No notifications in this category'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isAr ? 'ستظهر هنا كافة الإشعارات عند تحديث المهام' : 'New notifications will appear here automatically'}
            </p>
          </div>
        ) : (
          (notifications || []).map((item) => {
            const config = getTypeConfig(item.type);
            const Icon = config.icon;
            return (
              <div
                key={item.id}
                onClick={() => {
                  if (item.taskId && onSelectTask) {
                    onSelectTask(item.taskId);
                    if (!item.isRead) {
                      api.markNotificationAsRead(item.id, true);
                    }
                    if (onClose) onClose();
                  }
                }}
                className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer group ${
                  !item.isRead ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'bg-white hover:bg-slate-50/80'
                }`}
              >
                {/* Type Icon */}
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${config.color}`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${config.color}`}
                      >
                        {isAr ? config.badgeAr : config.badgeEn}
                      </span>
                      {item.taskCode && (
                        <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-1 rounded">
                          {item.taskCode}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(item.createdAt)}
                    </span>
                  </div>

                  <h4
                    className={`text-xs ${
                      !item.isRead ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'
                    }`}
                  >
                    {isAr && item.titleAr ? item.titleAr : item.title}
                  </h4>

                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                    {isAr && item.messageAr ? item.messageAr : item.message}
                  </p>

                  {/* Actions Row */}
                  <div className="mt-2 flex items-center justify-between pt-1 border-t border-slate-100/60 text-[10px]">
                    <span className="text-slate-400">
                      {!item.isRead ? (
                        <span className="inline-flex items-center gap-1 text-blue-600 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                          {isAr ? 'غير مقروء' : 'Unread'}
                        </span>
                      ) : (
                        <span className="text-slate-400">{isAr ? 'تمت القراءة' : 'Read'}</span>
                      )}
                    </span>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleToggleRead(e, item);
                        }}
                        className="px-2 py-0.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
                        title={
                          item.isRead
                            ? isAr
                              ? 'تعيين كغير مقروء'
                              : 'Mark as unread'
                            : isAr
                            ? 'تعيين كمقروء'
                            : 'Mark as read'
                        }
                      >
                        {item.isRead ? isAr ? 'غير مقروء' : 'Unread' : isAr ? 'تمت القراءة' : 'Mark Read'}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDelete(e, item.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                        title={isAr ? 'حذف الإشعار' : 'Delete notification'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {isDropdown && (
        <div className="p-2.5 border-t border-slate-100 bg-slate-50 text-center">
          <p className="text-[11px] text-slate-500">
            {isAr
              ? 'يتم إرسال الإشعارات تلقائيًا عند إنشاء المهام، إسنادها، تغيير حالتها، وتأخيرها'
              : 'Notifications trigger automatically on task creation, assignment, status change, and delays'}
          </p>
        </div>
      )}
    </div>
  );
};
