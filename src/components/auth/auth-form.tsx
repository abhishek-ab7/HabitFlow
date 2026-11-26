'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Loader2, Eye, EyeOff, User } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';

type AuthMode = 'signin' | 'signup' | 'reset';

const AUTH_MODE_COPY: Record<AuthMode, { title: string; subtitle: string }> = {
  signin: { title: 'Welcome back', subtitle: 'Sign in to sync your habits across devices' },
  signup: { title: 'Create account', subtitle: 'Start building better habits today' },
  reset: { title: 'Reset password', subtitle: 'Enter your email to receive a reset link' },
};

function AuthBrandLogo() {
  return (
    <div className="flex justify-center mb-6">
      <div className="flex items-center gap-2.5">
        <motion.div
          className="relative flex h-12 w-12 min-w-[3rem] min-h-[3rem] aspect-square items-center justify-center rounded-xl bg-primary/10 border border-primary/25 shadow-xs shrink-0 overflow-hidden"
          whileHover={{ scale: 1.05, rotate: [0, -5, 5, 0] }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'tween', duration: 0.5 }}
        >
          <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <motion.path
              d="M 16 4 A 12 12 0 1 1 15.99 4"
              stroke="url(#auth-logo-grad)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
            <motion.path
              d="M 12 16.5 L 15 19.5 L 21 12.5"
              stroke="url(#auth-logo-grad-2)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6, ease: 'easeOut' }}
            />
            <defs>
              <linearGradient id="auth-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--primary)" />
                <stop offset="100%" stopColor="var(--info)" />
              </linearGradient>
              <linearGradient id="auth-logo-grad-2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--primary)" />
                <stop offset="100%" stopColor="#14b8a6" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>
        <span className="font-bold text-2xl text-foreground tracking-tight">
          Habit<span className="text-primary">Flow</span>
        </span>
      </div>
    </div>
  );
}

function GoogleSignInSection({ isLoading, onGoogleSignIn }: { isLoading: boolean; onGoogleSignIn: () => void }) {
  return (
    <>
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-card px-2 text-muted-foreground">or continue with</span>
        </div>
      </div>

      <Button type="button" variant="outline" className="w-full" onClick={onGoogleSignIn} disabled={isLoading}>
        <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Continue with Google
      </Button>
    </>
  );
}

function AuthModeSwitch({ mode, onSwitch }: { mode: AuthMode; onSwitch: (m: AuthMode) => void }) {
  const prompt =
    mode === 'signin'
      ? { text: "Don't have an account?", action: 'Sign up', target: 'signup' as AuthMode }
      : mode === 'signup'
        ? { text: 'Already have an account?', action: 'Sign in', target: 'signin' as AuthMode }
        : { text: 'Remember your password?', action: 'Sign in', target: 'signin' as AuthMode };

  return (
    <div className="mt-6 text-center text-sm">
      <p>
        {prompt.text}{' '}
        <button type="button" onClick={() => onSwitch(prompt.target)} className="text-primary font-medium hover:underline">
          {prompt.action}
        </button>
      </p>
    </div>
  );
}

async function submitPasswordReset(params: {
  resetPassword: (email: string) => Promise<{ error: { message: string } | null }>;
  email: string;
  onSuccess: () => void;
}) {
  const { error } = await params.resetPassword(params.email);
  if (error) {
    toast.error(error.message);
    return;
  }
  toast.success('Password reset email sent! Check your inbox.');
  params.onSuccess();
}

async function submitUserSignUp(params: {
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: { message: string } | null }>;
  email: string;
  password: string;
  fullName: string;
}) {
  const trimmedName = params.fullName.trim();
  const { error } = await params.signUp(params.email, params.password, trimmedName || undefined);
  if (error) {
    toast.error(error.message);
    return;
  }
  localStorage.setItem('habitflow_just_signed_up', 'true');
  toast.success(trimmedName ? `Welcome, ${trimmedName}! Please check your email to confirm.` : 'Account created! Please check your email to confirm.');
}

async function submitUserSignIn(params: {
  signIn: (email: string, password: string) => Promise<{ error: { message: string } | null }>;
  email: string;
  password: string;
  onSuccess: () => void;
}) {
  const { error } = await params.signIn(params.email, params.password);
  if (error) {
    toast.error(error.message);
    return;
  }
  toast.success('Welcome back!');
  params.onSuccess();
}

export function AuthForm() {
  const { signIn, signUp, signInWithGoogle, resetPassword, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get('redirectedFrom') || '/dashboard';

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.push(redirectedFrom);
  }, [isAuthenticated, router, redirectedFrom]);

  const submitByMode = async () => {
    if (mode === 'reset') {
      await submitPasswordReset({ resetPassword, email, onSuccess: () => setMode('signin') });
      return;
    }
    if (mode === 'signup') {
      await submitUserSignUp({ signUp, email, password, fullName });
      return;
    }
    await submitUserSignIn({
      signIn,
      email,
      password,
      onSuccess: () => {
        router.refresh();
        router.push(redirectedFrom);
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await submitByMode();
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast.error(error.message);
      setIsLoading(false);
    }
  };

  const copy = AUTH_MODE_COPY[mode];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 landing-mesh bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="surface-hero shadow-xl p-8">
          <AuthBrandLogo />

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold">{copy.title}</h1>
            <p className="text-muted-foreground mt-2">{copy.subtitle}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name — signup only */}
            {mode === 'signup' && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                  autoComplete="name"
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            {mode !== 'reset' && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  disabled={isLoading}
                  minLength={6}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            )}

            {mode === 'signin' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setMode('reset')}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {mode === 'signin' && 'Sign in'}
                  {mode === 'signup' && 'Create account'}
                  {mode === 'reset' && 'Send reset link'}
                </>
              )}
            </Button>
          </form>

          {mode !== 'reset' && <GoogleSignInSection isLoading={isLoading} onGoogleSignIn={handleGoogleSignIn} />}

          <AuthModeSwitch mode={mode} onSwitch={setMode} />
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
}
