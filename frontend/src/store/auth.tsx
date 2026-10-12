import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getToken, setToken } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import type { AuthUser, Role, SchoolMembership } from '@/types';

interface MeResponse {
  user: AuthUser;
  memberships: SchoolMembership[];
}

interface AuthContextValue {
  user: AuthUser | null;
  memberships: SchoolMembership[];
  isLoading: boolean;
  isAuthenticated: boolean;
  hasRole: (...roles: Role[]) => boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (name: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api.get<MeResponse>('/auth/me').then((r) => r.data),
    enabled: Boolean(getToken()),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const user = data?.user ?? null;
  const memberships = useMemo(() => data?.memberships ?? [], [data?.memberships]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<{ user: AuthUser; token: string }>('/auth/login', { email, password });
      setToken(res.data.token);
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      await queryClient.fetchQuery({ queryKey: queryKeys.me, queryFn: () => api.get<MeResponse>('/auth/me').then((r) => r.data) });
      return res.data.user;
    },
    [queryClient],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await api.post<{ user: AuthUser; token: string }>('/auth/register', { name, email, password });
      setToken(res.data.token);
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      await queryClient.fetchQuery({ queryKey: queryKeys.me, queryFn: () => api.get<MeResponse>('/auth/me').then((r) => r.data) });
      return res.data.user;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore network errors on logout
    }
    setToken(null);
    queryClient.clear();
  }, [queryClient]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.me });
  }, [queryClient]);

  const hasRole = useCallback((...roles: Role[]) => (user ? roles.includes(user.role) : false), [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      memberships,
      isLoading,
      isAuthenticated: Boolean(user),
      hasRole,
      login,
      register,
      logout,
      refresh,
    }),
    [user, memberships, isLoading, hasRole, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
