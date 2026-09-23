import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser } from '../types/auth';
import { PermissionKey } from '../types/permissions';
import { api } from '../services/api';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  switchRolePersona: (persona: 'super_admin' | 'admin' | 'manager_owner') => Promise<void>;
  hasPermission: (perm: PermissionKey) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.getMe();
      if (res && res.user) {
        setUser(res.user);
      } else {
        setUser(null);
        localStorage.removeItem('auth_token');
      }
    } catch {
      setUser(null);
      localStorage.removeItem('auth_token');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      setIsLoading(true);
      try {
        const res = await api.getMe();
        if (isMounted) {
          if (res && res.user) {
            setUser(res.user);
          } else {
            setUser(null);
          }
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    if (res.token) {
      localStorage.setItem('auth_token', res.token);
    }
    if (res.user) {
      setUser(res.user);
    }
    return res;
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('active_company_id');
      setUser(null);
    }
  };

  const switchRolePersona = async (persona: 'super_admin' | 'admin' | 'manager_owner') => {
    const res = await api.switchPersona(persona);
    if (res.token) {
      localStorage.setItem('auth_token', res.token);
    }
    if (res.user) {
      setUser(res.user);
    }
  };

  const hasPermission = useCallback(
    (perm: PermissionKey): boolean => {
      if (!user) return false;
      if (user.isSuperAdmin) return true;
      if (!user.permissions || !Array.isArray(user.permissions)) return false;
      return user.permissions.includes(perm);
    },
    [user]
  );

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    switchRolePersona,
    hasPermission,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
