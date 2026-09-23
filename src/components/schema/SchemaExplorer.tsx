import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { api } from '../../services/api';
import { Badge } from '../common/Badge';
import {
  Database,
  Table,
  Copy,
  Check,
  FileCode,
  Network,
  Layers,
  ArrowRight,
} from 'lucide-react';

export const SchemaExplorer: React.FC = () => {
  const { language, t } = useI18n();

  const [schemaData, setSchemaData] = useState<{
    totalEntities: number;
    entities: any[];
    sqlSchema: string;
    drizzleSchema: string;
  } | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<'entities' | 'sql' | 'drizzle'>('entities');
  const [copied, setCopied] = useState<boolean>(false);
  const [filterQuery, setFilterQuery] = useState<string>('');

  useEffect(() => {
    api.getSchemaMetadata().then(data => setSchemaData(data)).catch(err => {
      console.error('Failed to load schema:', err);
    });
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!schemaData) {
    return (
      <div className="p-8 text-center text-slate-400 font-medium">
        Loading schema inspection data...
      </div>
    );
  }

  const filteredEntities = schemaData.entities.filter(e =>
    e.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    e.labelEn.toLowerCase().includes(filterQuery.toLowerCase()) ||
    e.category.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Database className="w-6 h-6 text-blue-600" />
            <span>{t('schema.title')}</span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {t('schema.subtitle')}
          </p>
        </div>

        <Badge variant="purple" size="md">
          {schemaData.totalEntities} {language === 'ar' ? 'جداول وكيانات معيارية' : 'Normalized Entities'}
        </Badge>
      </div>

      {/* Sub-tab switcher */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('entities')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeSubTab === 'entities'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>{t('schema.view_erd')}</span>
          </button>
          <button
            onClick={() => setActiveSubTab('sql')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeSubTab === 'sql'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>{t('schema.view_sql')}</span>
          </button>
          <button
            onClick={() => setActiveSubTab('drizzle')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeSubTab === 'drizzle'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>{t('schema.view_drizzle')}</span>
          </button>
        </div>

        {activeSubTab !== 'entities' && (
          <button
            onClick={() => handleCopy(activeSubTab === 'sql' ? schemaData.sqlSchema : schemaData.drizzleSchema)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600">{t('schema.copied')}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'نسخ المخطط' : 'Copy Code'}</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Tab 1: Entities Grid & ER Breakdown */}
      {activeSubTab === 'entities' && (
        <div className="space-y-4">
          <input
            type="text"
            placeholder={t('action.search')}
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full sm:w-80 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredEntities.map((entity, idx) => (
              <div
                key={entity.name}
                className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                      #{idx + 1} {entity.name}
                    </span>
                    <Badge variant="neutral" size="sm">
                      {entity.category}
                    </Badge>
                  </div>

                  <h4 className="text-sm font-bold text-slate-800">
                    {language === 'ar' ? entity.labelAr : entity.labelEn}
                  </h4>

                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{entity.relations}</span>
                  </p>
                </div>

                <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>3NF Normalized</span>
                  <span className="font-mono font-medium text-slate-600">UUID Primary Key</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Raw SQL DDL */}
      {activeSubTab === 'sql' && (
        <div className="rounded-2xl border border-slate-200 bg-slate-900 text-slate-100 p-5 font-mono text-xs overflow-x-auto max-h-[600px] shadow-sm">
          <pre>{schemaData.sqlSchema}</pre>
        </div>
      )}

      {/* Tab 3: Drizzle ORM Schema */}
      {activeSubTab === 'drizzle' && (
        <div className="rounded-2xl border border-slate-200 bg-slate-900 text-emerald-400 p-5 font-mono text-xs overflow-x-auto max-h-[600px] shadow-sm">
          <pre>{schemaData.drizzleSchema}</pre>
        </div>
      )}
    </div>
  );
};
