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
import { Building2 } from 'lucide-react';

interface TasksByCompanyChartProps {
  data: Array<{
    companyId: string;
    nameEn: string;
    nameAr: string;
    code: string;
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    delayed: number;
  }>;
  onSelectCompany?: (companyId: string, companyName: string, status?: string) => void;
}

export const TasksByCompanyChart: React.FC<TasksByCompanyChartProps> = ({ data, onSelectCompany }) => {
  const { t, language } = useI18n();
  const isAr = language === 'ar';

  const chartData = (data || []).map(item => ({
    companyId: item.companyId,
    name: isAr ? item.nameAr : item.nameEn,
    code: item.code,
    completed: item.completed,
    inProgress: item.inProgress,
    pending: item.pending,
    delayed: item.delayed,
    total: item.total,
  }));

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{t('chart.tasks_by_company')}</h3>
            <p className="text-[11px] text-slate-400">
              {isAr ? 'توزيع حالات المهام حسب الشركات' : 'Task status distribution per company'}
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
          {data?.length || 0} {isAr ? 'شركات' : 'Companies'}
        </span>
      </div>

      <div className="pt-4 h-72 w-full">
        {!chartData || chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            {isAr ? 'لا توجد بيانات متاحة' : 'No data available'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -15, bottom: 20 }}
              onClick={(state: any) => {
                if (onSelectCompany && state && state.activePayload && state.activePayload[0]) {
                  const item = state.activePayload[0].payload;
                  if (item?.companyId) onSelectCompany(item.companyId, item.name);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="code"
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
              <Bar
                dataKey="completed"
                name={t('widget.completed_tasks')}
                stackId="a"
                fill="#10b981"
                radius={[0, 0, 0, 0]}
                cursor="pointer"
                onClick={(entry: any) => {
                  if (onSelectCompany && entry) {
                    const cId = entry.companyId || entry.payload?.companyId;
                    const cName = entry.name || entry.payload?.name;
                    if (cId) onSelectCompany(cId, cName, 'completed');
                  }
                }}
              />
              <Bar
                dataKey="inProgress"
                name={t('widget.in_progress_tasks')}
                stackId="a"
                fill="#3b82f6"
                radius={[0, 0, 0, 0]}
                cursor="pointer"
                onClick={(entry: any) => {
                  if (onSelectCompany && entry) {
                    const cId = entry.companyId || entry.payload?.companyId;
                    const cName = entry.name || entry.payload?.name;
                    if (cId) onSelectCompany(cId, cName, 'in_progress');
                  }
                }}
              />
              <Bar
                dataKey="pending"
                name={t('widget.pending_tasks')}
                stackId="a"
                fill="#f59e0b"
                radius={[0, 0, 0, 0]}
                cursor="pointer"
                onClick={(entry: any) => {
                  if (onSelectCompany && entry) {
                    const cId = entry.companyId || entry.payload?.companyId;
                    const cName = entry.name || entry.payload?.name;
                    if (cId) onSelectCompany(cId, cName, 'pending');
                  }
                }}
              />
              <Bar
                dataKey="delayed"
                name={t('widget.delayed_tasks')}
                stackId="a"
                fill="#ea580c"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(entry: any) => {
                  if (onSelectCompany && entry) {
                    const cId = entry.companyId || entry.payload?.companyId;
                    const cName = entry.name || entry.payload?.name;
                    if (cId) onSelectCompany(cId, cName, 'delayed');
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
