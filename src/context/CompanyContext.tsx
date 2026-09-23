import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Company } from '../types/database';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface CompanyContextType {
  availableCompanies: Company[];
  allCompanies: Company[];
  activeCompany: Company | null;
  setActiveCompany: (company: Company | null) => void;
  archiveCompany: (id: string, permanent?: boolean) => Promise<void>;
  refreshCompanies: () => Promise<void>;
  isLoading: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompanyState] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshCompanies = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const res = await api.getCompanies();
      const list: Company[] = res.companies || [];
      setAllCompanies(list);

      const savedId = localStorage.getItem('active_company_id');
      if (savedId) {
        const found = list.find((c) => c.id === savedId && !c.isArchived);
        if (found) {
          setActiveCompanyState(found);
        } else {
          localStorage.removeItem('active_company_id');
          setActiveCompanyState(null);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshCompanies();
    } else {
      setAllCompanies([]);
      setActiveCompanyState(null);
    }
  }, [isAuthenticated, user?.id, refreshCompanies]);

  const setActiveCompany = (company: Company | null) => {
    setActiveCompanyState(company);
    if (company) {
      localStorage.setItem('active_company_id', company.id);
    } else {
      localStorage.removeItem('active_company_id');
    }
  };

  const archiveCompany = async (id: string, permanent: boolean = false) => {
    await api.archiveCompany(id, permanent);
    if (activeCompany?.id === id) {
      setActiveCompany(null);
    }
    await refreshCompanies();
  };

  const availableCompanies = allCompanies.filter((c) => !c.isArchived);

  const value: CompanyContextType = {
    availableCompanies,
    allCompanies,
    activeCompany,
    setActiveCompany,
    archiveCompany,
    refreshCompanies,
    isLoading,
  };

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
};

export const useCompany = (): CompanyContextType => {
  const ctx = useContext(CompanyContext);
  if (!ctx) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return ctx;
};
