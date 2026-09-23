import React from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

interface TasksOverTimeChartProps {
  data: Array<{
    labelEn: string;
    labelAr: string;
    created: number;
    completed: number;
  }>;
  onSelectTime?: (timeLabel: string) => void;
}

export const TasksOverTimeChart: React.FC<TasksOverTimeChartProps> = ({ data, onSelectTime }) => {
  const { t, language } = useI18n();
  const isAr = language === 'ar';

  const chartData = (data || []).map(item => ({
    name: isAr ? item.labelAr : item.labelEn,
    created: item.created,
    completed: item.completed,
  }));

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{t('chart.tasks_over_time')}</h3>
            <p className="text-[11px] text-slate-400">
              {isAr ? 'مقارنة وتيرة إنشاء المهام مع وتيرة الإنجاز' : 'Task creation vs completion velocity'}
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
          {isAr ? 'آخر 6 أشهر' : 'Last 6 Months'}
        </span>
      </div>

      <div className="pt-4 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -15, bottom: 20 }}
            onClick={(state: any) => {
              if (onSelectTime && state && state.activeLabel) {
                onSelectTime(String(state.activeLabel));
              }
            }}
          >
            <defs>
              <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
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
            <Area
              type="monotone"
              dataKey="created"
              name={isAr ? 'مهام منشأة' : 'Created Tasks'}
              stroke="#6366f1"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCreated)"
            />
            <Area
              type="monotone"
              dataKey="completed"
              name={isAr ? 'مهام مكتملة' : 'Completed Tasks'}
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCompleted)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
