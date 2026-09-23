import React from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Users } from 'lucide-react';

interface TasksByUserChartProps {
  data: Array<{
    userId: string;
    nameEn: string;
    nameAr: string;
    avatarUrl?: string;
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
  }>;
  onSelectUser?: (userId: string, userName: string) => void;
}

export const TasksByUserChart: React.FC<TasksByUserChartProps> = ({ data, onSelectUser }) => {
  const { t, language } = useI18n();
  const isAr = language === 'ar';

  const chartData = (data || []).slice(0, 6).map(item => ({
    userId: item.userId,
    name: (isAr ? item.nameAr : item.nameEn).split(' ')[0], // First name for clean axis
    fullName: isAr ? item.nameAr : item.nameEn,
    completed: item.completed,
    inProgress: item.inProgress,
    pending: item.pending,
    total: item.total,
  }));

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{t('chart.tasks_by_user')}</h3>
            <p className="text-[11px] text-slate-400">
              {isAr ? 'توزيع عبء العمل والمهام على المسؤولين' : 'Workload allocation & progress by member'}
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700">
          {data?.length || 0} {isAr ? 'أعضاء' : 'Members'}
        </span>
      </div>

      <div className="pt-4 h-64 w-full">
        {!chartData || chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            {isAr ? 'لا توجد مهام مسندة بعد' : 'No assigned tasks recorded'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -15, bottom: 20 }}
              onClick={(state: any) => {
                if (onSelectUser && state && state.activePayload && state.activePayload[0]) {
                  const item = state.activePayload[0].payload;
                  if (item?.userId) onSelectUser(item.userId, item.fullName || item.name);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(val: any, name: any) => [val, name]}
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  fontSize: '12px',
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
              />
              <Bar
                dataKey="completed"
                name={t('widget.completed_tasks')}
                stackId="userStack"
                fill="#10b981"
                cursor="pointer"
                onClick={(entry: any) => {
                  if (onSelectUser && entry) {
                    const uId = entry.userId || entry.payload?.userId;
                    const uName = entry.fullName || entry.payload?.fullName || entry.name;
                    if (uId) onSelectUser(uId, uName);
                  }
                }}
              />
              <Bar
                dataKey="inProgress"
                name={t('widget.in_progress_tasks')}
                stackId="userStack"
                fill="#3b82f6"
                cursor="pointer"
                onClick={(entry: any) => {
                  if (onSelectUser && entry) {
                    const uId = entry.userId || entry.payload?.userId;
                    const uName = entry.fullName || entry.payload?.fullName || entry.name;
                    if (uId) onSelectUser(uId, uName);
                  }
                }}
              />
              <Bar
                dataKey="pending"
                name={t('widget.pending_tasks')}
                stackId="userStack"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(entry: any) => {
                  if (onSelectUser && entry) {
                    const uId = entry.userId || entry.payload?.userId;
                    const uName = entry.fullName || entry.payload?.fullName || entry.name;
                    if (uId) onSelectUser(uId, uName);
                  }
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
