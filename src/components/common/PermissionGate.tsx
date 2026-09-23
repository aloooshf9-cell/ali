import React from 'react';
import { PermissionKey } from '../../types/permissions';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { ShieldAlert } from 'lucide-react';

interface PermissionGateProps {
  perm: PermissionKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showNotice?: boolean;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  perm,
  children,
  fallback,
  showNotice = false,
}) => {
  const { hasPermission } = useAuth();
  const { t } = useI18n();

  const allowed = hasPermission(perm);

  if (allowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showNotice) {
    return (
      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm flex items-center gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
        <div>
          <p className="font-semibold">{t('auth.forbidden')}</p>
          <p className="text-xs text-amber-700 font-mono mt-0.5">{perm}</p>
        </div>
      </div>
    );
  }

  return null;
};
