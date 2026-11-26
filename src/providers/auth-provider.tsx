'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
}

const AUTH_REFRESH_EVENTS = new Set(['SIGNED_IN', 'SIGNED_OUT', 'PASSWORD_RECOVERY']);

async function unregisterClientServiceWorkers() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
  } catch (error) {
    console.error('Failed to unregister service worker on sign out:', error);
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);

        if (AUTH_REFRESH_EVENTS.has(event)) {
          router.refresh();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: fullName ? { full_name: fullName } : undefined,
      },
    });

    return { error };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();

    // Stop sync timers, realtime channels, and clear local state cleanly
    try {
      const [{ getSyncEngine }, { useUserStore }] = await Promise.all([
        import('@/lib/sync'),
        import('@/lib/stores/user-store'),
      ]);
      getSyncEngine().reset();
      useUserStore.getState().cleanupRealtimeSubscription();
    } catch {
      // Non-blocking in test/offline environments
    }

    // Phase 1: Clear client-side session immediately (fast path)
    await supabase.auth.signOut();

    // Phase 2: Clear server-side HttpOnly cookies via the server route.
    // Use keepalive:true so the request completes even if the page navigates away.
    // This is fire-and-forget — failures are silently ignored since the client
    // session is already cleared. Cookies will expire naturally if this fails.
    fetch('/auth/signout', {
      method: 'POST',
      keepalive: true,
    }).catch(() => {
      // Intentionally silent — client is already signed out
    });

    await unregisterClientServiceWorkers();

    // Navigate immediately — don't wait for server response
    router.push('/login');
  }, [router]);

  const resetPassword = useCallback(async (email: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });
    return { error };
  }, []);

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      isLoading,
      isAuthenticated: !!session,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      resetPassword,
    }),
    [user, session, isLoading, signUp, signIn, signInWithGoogle, signOut, resetPassword]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
