import React from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';

interface TasksByStatusChartProps {
  data: Array<{
    key: string;
    nameEn: string;
    nameAr: string;
    count: number;
    color: string;
  }>;
  onSelectStatus?: (statusKey: string, statusName: string) => void;
}

export const TasksByStatusChart: React.FC<TasksByStatusChartProps> = ({ data = [], onSelectStatus }) => {
  const { t, language } = useI18n();
  const isAr = language === 'ar';

  const safeData = data || [];
  const totalTasks = safeData.reduce((acc, curr) => acc + (curr?.count || 0), 0);

  const formattedData = safeData
    .filter(item => item && item.count > 0)
    .map(item => ({
      name: isAr ? item.nameAr : item.nameEn,
      value: item.count,
      color: item.color,
      key: item.key,
    }));

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <PieIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{t('chart.tasks_by_status')}</h3>
            <p className="text-[11px] text-slate-400">
              {isAr ? 'النسبة المئوية والعدد لكل حالة' : 'Proportions across workflow stages'}
            </p>
          </div>
        </div>
        <span className="text-xs font-black px-2.5 py-1 rounded-full bg-purple-50 text-purple-700">
          {totalTasks} {isAr ? 'مهمة' : 'Tasks'}
        </span>
      </div>

      <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
        <div className="h-64 relative flex items-center justify-center">
          {formattedData.length === 0 ? (
            <div className="text-xs text-slate-400">
              {isAr ? 'لا توجد مهام' : 'No tasks'}
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                      fontSize: '12px',
                    }}
                  />
                  <Pie
                    data={formattedData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    cursor="pointer"
                    onClick={(entry) => {
                      if (onSelectStatus && entry) {
                        const targetKey = (entry as any).key || (entry as any).payload?.key;
                        const targetName = (entry as any).name || (entry as any).payload?.name;
                        if (targetKey) onSelectStatus(targetKey, targetName || targetKey);
                      }
                    }}
                  >
                    {formattedData.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={entry.color}
                        cursor="pointer"
                        className="hover:opacity-80 transition-opacity"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Centered Total Callout */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-slate-900 leading-none">{totalTasks}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                  {isAr ? 'الإجمالي' : 'Total'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Legend List */}
        <div className="space-y-1.5 pr-2 pl-2">
          {data.map((item) => {
            const percentage = totalTasks > 0 ? Math.round((item.count / totalTasks) * 100) : 0;
            return (
              <div
                key={item.key}
                onClick={() => {
                  if (onSelectStatus) {
                    onSelectStatus(item.key, isAr ? item.nameAr : item.nameEn);
                  }
                }}
                className={`flex items-center justify-between text-xs py-1.5 px-2 rounded-xl transition-all border-b border-slate-50 last:border-none ${
                  onSelectStatus
                    ? 'cursor-pointer hover:bg-slate-100/80 hover:shadow-2xs active:scale-[0.99]'
                    : ''
                }`}
                title={isAr ? `انقر لفتح مهام: ${item.nameAr}` : `Click to view tasks: ${item.nameEn}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-semibold text-slate-700">
                    {isAr ? item.nameAr : item.nameEn}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="font-bold text-slate-900">{item.count}</span>
                  <span className="text-[10px] text-slate-400">({percentage}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
