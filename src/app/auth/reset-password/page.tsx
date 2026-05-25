'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, Loader2, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { getSupabaseClient } from '@/lib/supabase/client';

interface PasswordRequirement {
    label: string;
    test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
    { label: 'At least 6 characters', test: (p) => p.length >= 6 },
    { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
    { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
    { label: 'One number', test: (p) => /\d/.test(p) },
    { label: 'One special character', test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

export default function ResetPasswordPage() {
    const router = useRouter();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingSession, setIsCheckingSession] = useState(true);

    // Check if user has a valid session (from recovery link)
    useEffect(() => {
        const checkSession = async () => {
            const supabase = getSupabaseClient();
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error || !session) {
                toast.error('Invalid or expired recovery link');
                router.push('/login');
                return;
            }

            setIsCheckingSession(false);
        };

        checkSession();
    }, [router]);

    const validatePassword = (password: string): boolean => {
        return passwordRequirements.every(req => req.test(password));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Client-side validation
        if (!validatePassword(newPassword)) {
            toast.error('Password does not meet requirements');
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setIsLoading(true);

        try {
            const supabase = getSupabaseClient();
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) {
                toast.error(error.message);
            } else {
                toast.success('Password updated successfully!');
                // Redirect to dashboard after successful password reset
                router.push('/');
            }
        } catch (err) {
            toast.error('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    if (isCheckingSession) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-indigo-950/50 dark:to-slate-900">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-indigo-950/50 dark:to-slate-900">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="bg-card border border-border rounded-2xl shadow-xl p-8">
                    {/* Logo */}
                    <div className="flex justify-center mb-6">
                        <div className="flex items-center gap-2">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-purple-600 text-primary-foreground font-bold text-xl">
                                HF
                            </div>
                            <span className="font-bold text-2xl bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                                Habit Flow
                            </span>
                        </div>
                    </div>

                    {/* Title */}
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold">Reset your password</h1>
                        <p className="text-muted-foreground mt-2">
                            Enter a new password for your account
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* New Password */}
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input
                                type={showNewPassword ? 'text' : 'password'}
                                placeholder="New password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="pl-10 pr-10"
                                required
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>

                        {/* Confirm Password */}
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input
                                type={showConfirmPassword ? 'text' : 'password'}
                                placeholder="Confirm password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="pl-10 pr-10"
                                required
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>

                        {/* Password Requirements */}
                        {newPassword && (
                            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                <p className="text-sm font-medium mb-2">Password requirements:</p>
                                {passwordRequirements.map((req, index) => {
                                    const isValid = req.test(newPassword);
                                    return (
                                        <div key={index} className="flex items-center gap-2 text-sm">
                                            {isValid ? (
                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            ) : (
                                                <XCircle className="h-4 w-4 text-muted-foreground" />
                                            )}
                                            <span className={isValid ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                                                {req.label}
                                            </span>
                                        </div>
                                    );
                                })}
                                {confirmPassword && (
                                    <div className="flex items-center gap-2 text-sm pt-2 border-t border-border">
                                        {newPassword === confirmPassword ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <XCircle className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <span className={newPassword === confirmPassword ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                                            Passwords match
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                'Reset password'
                            )}
                        </Button>
                    </form>

                    {/* Back to Login */}
                    <div className="mt-6 text-center text-sm">
                        <button
                            type="button"
                            onClick={() => router.push('/login')}
                            className="text-primary font-medium hover:underline"
                        >
                            Back to login
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-sm text-muted-foreground mt-6">
                    Your password will be updated immediately after submission.
                </p>
            </motion.div>
        </div>
    );
}
