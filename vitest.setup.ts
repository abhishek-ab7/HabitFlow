import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { vi, beforeEach } from 'vitest';

// Set up mock window APIs for JSDOM
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

(globalThis as any).jest = vi;

// Global Supabase client mock with default authenticated session
const mockSupabase = {
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: {
        session: {
          user: { id: 'test-user', email: 'test@example.com' },
          access_token: 'mock-token'
        }
      },
      error: null
    }),
    getUser: vi.fn().mockResolvedValue({
      data: {
        user: { id: 'test-user', email: 'test@example.com' }
      },
      error: null
    }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    }),
  },
  channel: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  }),
  removeChannel: vi.fn(),
  from: vi.fn().mockImplementation(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  })),
};

// Mock the Supabase client globally
vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => mockSupabase,
  createClient: () => mockSupabase,
}));

// We also mock it with relative path to avoid caching issues with different resolutions
vi.mock('../../supabase/client', () => ({
  getSupabaseClient: () => mockSupabase,
  createClient: () => mockSupabase,
}));

// Dynamic store tracking for Zustand resets without importing store modules early.
// This intercepts Zustand's `create` function to register reset callbacks.
const storeResetFns = new Set<() => void>();

vi.mock('zustand', async (importOriginal) => {
  const actual = await importOriginal<typeof import('zustand')>();
  
  // Wrap actual.create
  const createMock = <T>(stateCreator: any) => {
    const store = actual.create(stateCreator);
    const initialState = store.getState();
    storeResetFns.add(() => {
      store.setState(initialState, true);
    });
    return store;
  };

  return {
    ...actual,
    create: createMock,
  };
});

/**
 * Resets all dynamically registered Zustand stores.
 */
export function resetAllStores() {
  storeResetFns.forEach((reset) => reset());
}

// Reset stores and clear mocks before each test
beforeEach(() => {
  resetAllStores();
  vi.clearAllMocks();
});
