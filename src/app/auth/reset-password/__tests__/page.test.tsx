import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResetPasswordPage from '../page';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// vi.hoisted() ensures these are available inside vi.mock factories (which are hoisted)
const { mockToastError, mockToastSuccess, mockOnAuthStateChangeFn, mockGetSessionFn, mockUpdateUserFn } =
  vi.hoisted(() => ({
    mockToastError: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockOnAuthStateChangeFn: vi.fn(),
    mockGetSessionFn: vi.fn(),
    mockUpdateUserFn: vi.fn(),
  }));

vi.mock('sonner', () => ({
  toast: { error: mockToastError, success: mockToastSuccess },
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: {
      onAuthStateChange: (...args: any[]) => mockOnAuthStateChangeFn(...args),
      getSession: (...args: any[]) => mockGetSessionFn(...args),
      updateUser: (...args: any[]) => mockUpdateUserFn(...args),
    },
  }),
}));

// ── Shared setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Helpers ────────────────────────────────────────────────────────────────

/** Stub onAuthStateChange to fire the given event immediately on subscription */
function stubAuthEvent(event: string, session: object | null = null) {
  mockOnAuthStateChangeFn.mockImplementation((callback: (...args: any[]) => any) => {
    callback(event, session);
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
}

/** Stub onAuthStateChange to never fire (used for timeout-path tests) */
function stubNoAuthEvent() {
  mockOnAuthStateChangeFn.mockImplementation(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  }));
}

// ── Session Guard Tests (use fake timers for timeout tests) ────────────────

describe('ResetPasswordPage — session guard', () => {
  it('shows a spinner while session is being determined', () => {
    stubNoAuthEvent();
    render(<ResetPasswordPage />);
    expect(screen.queryByPlaceholderText('New password')).not.toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows the reset form when PASSWORD_RECOVERY event fires', async () => {
    stubAuthEvent('PASSWORD_RECOVERY');
    render(<ResetPasswordPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('New password')).toBeInTheDocument();
    });
  });

  it('redirects to /login when a normal SIGNED_IN event fires (non-recovery user blocked)', async () => {
    stubAuthEvent('SIGNED_IN', { user: { email: 'normal@test.com' } });
    render(<ResetPasswordPage />);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'));
    expect(mockToastError).toHaveBeenCalledWith(
      'Please use a password reset link from your email.'
    );
  });

  describe('5-second timeout fallback', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('redirects to /login after timeout if no session exists', async () => {
      stubNoAuthEvent();
      mockGetSessionFn.mockResolvedValue({ data: { session: null }, error: null });

      render(<ResetPasswordPage />);

      await act(async () => {
        vi.advanceTimersByTime(5100);
      });

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'));
      expect(mockToastError).toHaveBeenCalledWith('Invalid or expired recovery link');
    });

    it('shows form after timeout if a session exists (event fired before subscription)', async () => {
      stubNoAuthEvent();
      mockGetSessionFn.mockResolvedValue({
        data: { session: { user: { email: 'user@test.com' } } },
        error: null,
      });

      render(<ResetPasswordPage />);

      await act(async () => {
        vi.advanceTimersByTime(5100);
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('New password')).toBeInTheDocument();
      });
    });

    it('redirects to /login after timeout if getSession returns an error', async () => {
      stubNoAuthEvent();
      mockGetSessionFn.mockResolvedValue({
        data: { session: null },
        error: { message: 'Network error' },
      });

      render(<ResetPasswordPage />);

      await act(async () => {
        vi.advanceTimersByTime(5100);
      });

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'));
      expect(mockToastError).toHaveBeenCalledWith('Invalid or expired recovery link');
    });
  });
});

// ── Form Validation Tests (real timers — no fake timer conflicts) ──────────

describe('ResetPasswordPage — form validation', () => {
  // Use userEvent.setup with delay:null to avoid internal timer dependencies
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    // Always show the form in these tests
    stubAuthEvent('PASSWORD_RECOVERY');
  });

  async function renderAndWaitForForm() {
    render(<ResetPasswordPage />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('New password')).toBeInTheDocument()
    );
  }

  it('shows password requirements checklist when the user starts typing', async () => {
    await renderAndWaitForForm();
    await user.type(screen.getByPlaceholderText('New password'), 'abc');
    expect(screen.getByText('At least 6 characters')).toBeInTheDocument();
    expect(screen.getByText('One uppercase letter')).toBeInTheDocument();
  });

  it('prevents submit when passwords do not match', async () => {
    await renderAndWaitForForm();

    await user.type(screen.getByPlaceholderText('New password'), 'ValidPass1!');
    await user.type(screen.getByPlaceholderText('Confirm password'), 'Different1!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(mockToastError).toHaveBeenCalledWith('Passwords do not match');
    expect(mockUpdateUserFn).not.toHaveBeenCalled();
  });

  it('prevents submit when password does not meet requirements', async () => {
    await renderAndWaitForForm();

    await user.type(screen.getByPlaceholderText('New password'), 'weak');
    await user.type(screen.getByPlaceholderText('Confirm password'), 'weak');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(mockToastError).toHaveBeenCalledWith('Password does not meet requirements');
    expect(mockUpdateUserFn).not.toHaveBeenCalled();
  });

  it('calls updateUser and redirects to /dashboard on successful password reset', async () => {
    mockUpdateUserFn.mockResolvedValue({ error: null });
    await renderAndWaitForForm();

    const validPassword = 'ValidPass1!';
    await user.type(screen.getByPlaceholderText('New password'), validPassword);
    await user.type(screen.getByPlaceholderText('Confirm password'), validPassword);
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() =>
      expect(mockUpdateUserFn).toHaveBeenCalledWith({ password: validPassword })
    );
    expect(mockToastSuccess).toHaveBeenCalledWith('Password updated successfully!');
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('shows an error toast when updateUser fails', async () => {
    mockUpdateUserFn.mockResolvedValue({ error: { message: 'Password too weak' } });
    await renderAndWaitForForm();

    const validPassword = 'ValidPass1!';
    await user.type(screen.getByPlaceholderText('New password'), validPassword);
    await user.type(screen.getByPlaceholderText('Confirm password'), validPassword);
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith('Password too weak')
    );
    expect(mockPush).not.toHaveBeenCalledWith('/');
  });

  it('toggles password visibility when the eye button is clicked', async () => {
    await renderAndWaitForForm();

    const newPasswordInput = screen.getByPlaceholderText('New password');
    expect(newPasswordInput).toHaveAttribute('type', 'password');

    // Click the first toggle button (new password field)
    const toggleButtons = screen.getAllByRole('button', { name: '' });
    await user.click(toggleButtons[0]);

    expect(newPasswordInput).toHaveAttribute('type', 'text');
  });
});
