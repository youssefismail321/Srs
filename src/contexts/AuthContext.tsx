import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { Profile } from '@/types';

interface AuthContextValue {
  session: string | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<Profile>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<Profile, 'name' | 'avatar_url'>>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session: supaSession } }) => {
      if (!mounted) return;
      if (!supaSession) { setLoading(false); return; }
      try {
        const prof = await api.get<Profile>(
          `/api/users/${supaSession.user.id}`,
          supaSession.access_token,
        );
        if (mounted) {
          setSession(supaSession.access_token);
          setProfile(prof);
        }
      } catch {
        await supabase.auth.signOut();
      } finally {
        if (mounted) setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, supaSession) => {
      if (!supaSession) {
        setSession(null);
        setProfile(null);
      } else {
        setSession(supaSession.access_token);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string): Promise<Profile> {
    console.log('signIn called, API URL:', process.env.EXPO_PUBLIC_API_URL);
    try {
      const data = await api.post<{ token: string; refresh_token: string; profile: Profile }>(
        '/api/auth/login',
        { email, password },
      );
      await supabase.auth.setSession({
        access_token: data.token,
        refresh_token: data.refresh_token,
      });
      setSession(data.token);
      setProfile(data.profile);
      return data.profile;
    } catch (err) {
      console.error('AuthContext signIn error:', err);
      throw err;
    }
  }

  async function signOut(): Promise<void> {
    try {
      if (session) await api.post('/api/auth/logout', {}, session);
    } catch {}
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  async function refreshProfile(): Promise<void> {
    if (!session || !profile) return;
    try {
      const prof = await api.get<Profile>(`/api/users/${profile.id}`, session);
      setProfile(prof);
    } catch {}
  }

  async function updateProfile(
    updates: Partial<Pick<Profile, 'name' | 'avatar_url'>>,
  ): Promise<void> {
    if (!session || !profile) return;
    const updated = await api.patch<Profile>(`/api/users/${profile.id}`, updates, session);
    setProfile(updated);
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signOut, updateProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
