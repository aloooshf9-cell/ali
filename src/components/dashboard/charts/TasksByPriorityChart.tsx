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
  Cell,
} from 'recharts';
import { Flame } from 'lucide-react';

interface TasksByPriorityChartProps {
  data: Array<{
    key: string;
    nameEn: string;
    nameAr: string;
    count: number;
    color: string;
  }>;
  onSelectPriority?: (priorityKey: string, priorityName: string) => void;
}

export const TasksByPriorityChart: React.FC<TasksByPriorityChartProps> = ({ data = [], onSelectPriority }) => {
  const { t, language } = useI18n();
  const isAr = language === 'ar';

  const safeData = data || [];
  const chartData = safeData.map(item => ({
    name: isAr ? item.nameAr : item.nameEn,
    count: item.count,
    color: item.color,
    key: item.key,
  }));

  const totalTasks = safeData.reduce((acc, curr) => acc + (curr?.count || 0), 0);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{t('chart.tasks_by_priority')}</h3>
            <p className="text-[11px] text-slate-400">
              {isAr ? 'تصنيف المهام حسب درجة الأهمية والاستعجال' : 'Urgency and impact level allocation'}
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-700">
          {totalTasks} {isAr ? 'مهمة' : 'Tasks'}
        </span>
      </div>

      <div className="pt-4 h-64 w-full">
        {totalTasks === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            {isAr ? 'لا توجد بيانات متاحة' : 'No data available'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -15, bottom: 20 }}
              onClick={(state: any) => {
                if (onSelectPriority && state && state.activePayload && state.activePayload[0]) {
                  const item = state.activePayload[0].payload;
                  if (item?.key) onSelectPriority(item.key, item.name || item.key);
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
                formatter={(val: any) => [`${val} ${isAr ? 'مهمة' : 'Tasks'}`, isAr ? 'العدد' : 'Count']}
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  fontSize: '12px',
                }}
              />
              <Bar
                dataKey="count"
                radius={[8, 8, 0, 0]}
                cursor="pointer"
                onClick={(entry: any) => {
                  if (onSelectPriority && entry) {
                    const k = entry.key || entry.payload?.key;
                    const n = entry.name || entry.payload?.name;
                    if (k) onSelectPriority(k, n || k);
                  }
                }}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={entry.color}
                    cursor="pointer"
                    className="hover:opacity-80 transition-opacity"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Quick clickable priority pills below */}
      {safeData.length > 0 && (
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
          {safeData.map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectPriority && onSelectPriority(item.key, isAr ? item.nameAr : item.nameEn)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-slate-100 text-[11px] font-semibold text-slate-700 transition-colors"
              title={isAr ? `فتح مهام: ${item.nameAr}` : `View tasks: ${item.nameEn}`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span>{isAr ? item.nameAr : item.nameEn}</span>
              <span className="font-mono text-slate-500 font-bold">({item.count})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
