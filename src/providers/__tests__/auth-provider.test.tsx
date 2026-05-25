import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../auth-provider';
import * as supabaseClient from '@/lib/supabase/client';
import React from 'react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

// Mock supabase client
const mockSupabase = {
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
  },
};

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => mockSupabase,
}));

// Test component to access context
function TestComponent() {
  const { user, isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <div data-testid="loading">Loading...</div>;
  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
      <div data-testid="user-email">{user?.email || 'No User'}</div>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    expect(screen.getByTestId('loading')).toBeDefined();
  });

  it('updates state when session is found', async () => {
    const mockUser = { id: 'u1', email: 'test@example.com' };
    mockSupabase.auth.getSession.mockResolvedValueOnce({
      data: { session: { user: mockUser } }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading')).toBeNull();
    });

    expect(screen.getByTestId('auth-status').textContent).toBe('Authenticated');
    expect(screen.getByTestId('user-email').textContent).toBe('test@example.com');
  });

  it('updates state when auth state changes', async () => {
    let changeCallback: any;
    mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
      changeCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Initial load finishes
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).toBeNull();
    });

    // Trigger auth change
    const mockUser = { id: 'u2', email: 'changed@example.com' };
    
    const { act } = await import('react');
    await act(async () => {
      if (changeCallback) {
        await changeCallback('SIGNED_IN', { user: mockUser, access_token: 'abc' });
      }
    });

    await waitFor(() => {
      expect(screen.getByTestId('user-email').textContent).toBe('changed@example.com');
      expect(screen.getByTestId('auth-status').textContent).toBe('Authenticated');
    });
  });
});
