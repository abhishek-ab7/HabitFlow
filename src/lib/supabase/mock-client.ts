import type { createBrowserClient } from '@supabase/ssr';
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import type { Database } from './types';

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
      key &&
      url.trim() !== '' &&
      key.trim() !== '' &&
      !url.includes('your-project') &&
      !key.includes('your-anon-key')
  );
}

const LOCAL_SIGNED_OUT_KEY = 'habitflow_local_signed_out';
const LOCAL_USER_KEY = 'habitflow_local_user';

interface LocalUserProfile {
  id: string;
  email: string;
  fullName: string;
}

const DEFAULT_LOCAL_PROFILE: LocalUserProfile = {
  id: 'local-demo-user',
  email: 'explorer@habitflow.local',
  fullName: 'HabitFlow Explorer',
};

function readLocalSignedOut(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(LOCAL_SIGNED_OUT_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeLocalSignedOut(signedOut: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (signedOut) {
      window.localStorage.setItem(LOCAL_SIGNED_OUT_KEY, 'true');
      document.cookie = `${LOCAL_SIGNED_OUT_KEY}=true; path=/; max-age=86400; samesite=lax`;
    } else {
      window.localStorage.removeItem(LOCAL_SIGNED_OUT_KEY);
      document.cookie = `${LOCAL_SIGNED_OUT_KEY}=; path=/; max-age=0; samesite=lax`;
    }
  } catch {
    // Ignore storage errors
  }
}

function readLocalProfile(): LocalUserProfile {
  if (typeof window === 'undefined') return DEFAULT_LOCAL_PROFILE;
  try {
    const raw = window.localStorage.getItem(LOCAL_USER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        id: parsed.id || DEFAULT_LOCAL_PROFILE.id,
        email: parsed.email || DEFAULT_LOCAL_PROFILE.email,
        fullName: parsed.fullName || DEFAULT_LOCAL_PROFILE.fullName,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_LOCAL_PROFILE;
}

function writeLocalProfile(profile: Partial<LocalUserProfile>): LocalUserProfile {
  const current = readLocalProfile();
  const next: LocalUserProfile = {
    id: profile.id || current.id,
    email: profile.email || current.email,
    fullName: profile.fullName || current.fullName,
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }
  return next;
}

function buildLocalSession(profile: LocalUserProfile): Session {
  const now = Math.floor(Date.now() / 1000);
  const user: User = {
    id: profile.id,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: profile.fullName },
    aud: 'authenticated',
    confirmation_sent_at: undefined,
    recovery_sent_at: undefined,
    email_change_sent_at: undefined,
    new_email: undefined,
    invited_at: undefined,
    action_link: undefined,
    email: profile.email,
    phone: '',
    created_at: new Date(0).toISOString(),
    confirmed_at: new Date(0).toISOString(),
    email_confirmed_at: new Date(0).toISOString(),
    phone_confirmed_at: undefined,
    last_sign_in_at: new Date().toISOString(),
    role: 'authenticated',
    updated_at: new Date().toISOString(),
    identities: [],
    factors: [],
    is_anonymous: false,
  };

  return {
    access_token: 'local-demo-access-token',
    refresh_token: 'local-demo-refresh-token',
    expires_in: 3600 * 24 * 7,
    expires_at: now + 3600 * 24 * 7,
    token_type: 'bearer',
    user,
  };
}

type AuthListener = (event: AuthChangeEvent, session: Session | null) => void;
const authListeners = new Set<AuthListener>();

function notifyAuthListeners(event: AuthChangeEvent, session: Session | null) {
  authListeners.forEach((listener) => {
    try {
      listener(event, session);
    } catch {
      // Ignore listener errors
    }
  });
}

function createMockQueryBuilder() {
  let isSingle = false;

  const builder: Record<string, any> = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    upsert: () => builder,
    delete: () => builder,
    eq: () => builder,
    neq: () => builder,
    gt: () => builder,
    gte: () => builder,
    lt: () => builder,
    lte: () => builder,
    like: () => builder,
    ilike: () => builder,
    is: () => builder,
    in: () => builder,
    contains: () => builder,
    containedBy: () => builder,
    range: () => builder,
    order: () => builder,
    limit: () => builder,
    filter: () => builder,
    match: () => builder,
    not: () => builder,
    or: () => builder,
    textSearch: () => builder,
    single: () => {
      isSingle = true;
      return Promise.resolve({ data: null, error: null });
    },
    maybeSingle: () => {
      isSingle = true;
      return Promise.resolve({ data: null, error: null });
    },
    then: (
      onFulfilled?: (value: { data: any; error: null; count: number }) => any,
      onRejected?: (reason: any) => any
    ) => {
      const payload = { data: isSingle ? null : [], error: null, count: 0 };
      return Promise.resolve(payload).then(onFulfilled, onRejected);
    },
  };

  return builder;
}

export function createMockSupabaseClient(): ReturnType<typeof createBrowserClient<Database>> {
  const getCurrentSession = (): Session | null => {
    if (readLocalSignedOut()) return null;
    return buildLocalSession(readLocalProfile());
  };

  const mockClient = {
    auth: {
      getSession: async () => ({
        data: { session: getCurrentSession() },
        error: null,
      }),
      getUser: async () => {
        const session = getCurrentSession();
        return {
          data: { user: session?.user ?? null },
          error: null,
        };
      },
      onAuthStateChange: (callback: AuthListener) => {
        authListeners.add(callback);
        return {
          data: {
            subscription: {
              id: 'local-auth-sub',
              callback,
              unsubscribe: () => {
                authListeners.delete(callback);
              },
            },
          },
        };
      },
      signInWithPassword: async ({ email }: { email: string; password?: string }) => {
        writeLocalSignedOut(false);
        const profile = writeLocalProfile({
          email,
          fullName: email.split('@')[0] || DEFAULT_LOCAL_PROFILE.fullName,
        });
        const session = buildLocalSession(profile);
        notifyAuthListeners('SIGNED_IN', session);
        return { data: { user: session.user, session }, error: null };
      },
      signUp: async ({
        email,
        options,
      }: {
        email: string;
        password?: string;
        options?: { data?: { full_name?: string } };
      }) => {
        writeLocalSignedOut(false);
        const profile = writeLocalProfile({
          email,
          fullName:
            options?.data?.full_name ||
            email.split('@')[0] ||
            DEFAULT_LOCAL_PROFILE.fullName,
        });
        const session = buildLocalSession(profile);
        notifyAuthListeners('SIGNED_IN', session);
        return { data: { user: session.user, session }, error: null };
      },
      signInWithOAuth: async () => {
        writeLocalSignedOut(false);
        const profile = readLocalProfile();
        const session = buildLocalSession(profile);
        notifyAuthListeners('SIGNED_IN', session);
        return { data: { provider: 'google', url: null }, error: null };
      },
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      updateUser: async ({ data }: { password?: string; data?: { full_name?: string } }) => {
        const profile = writeLocalProfile({
          fullName: data?.full_name,
        });
        const session = buildLocalSession(profile);
        return { data: { user: session.user }, error: null };
      },
      signOut: async () => {
        writeLocalSignedOut(true);
        notifyAuthListeners('SIGNED_OUT', null);
        return { error: null };
      },
      exchangeCodeForSession: async () => {
        writeLocalSignedOut(false);
        const session = buildLocalSession(readLocalProfile());
        return { data: { session, user: session.user }, error: null };
      },
    },
    from: () => createMockQueryBuilder(),
    rpc: async () => ({ data: [], error: null }),
    channel: () => {
      const ch: Record<string, any> = {
        on: () => ch,
        subscribe: (cb?: (status: string) => void) => {
          if (typeof cb === 'function') {
            setTimeout(() => cb('SUBSCRIBED'), 0);
          }
          return ch;
        },
        unsubscribe: async () => 'ok',
      };
      return ch;
    },
    removeChannel: async () => 'ok',
  };

  return mockClient as unknown as ReturnType<typeof createBrowserClient<Database>>;
}
