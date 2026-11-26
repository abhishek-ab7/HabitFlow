/* eslint-disable @typescript-eslint/no-explicit-any */
export function str(v: unknown, fallback = ''): string {
  return v ? String(v) : fallback;
}

export function optStr(v: unknown): string | undefined {
  return v ? String(v) : undefined;
}

export function nullStr(v: unknown): string | null {
  return v !== null && v !== undefined && v !== '' ? String(v) : null;
}

export function num(v: unknown, fallback = 0): number {
  if (v == null || v === '') return fallback;
  return Number(v);
}

export function optNum(v: unknown): number | undefined {
  return v !== null && v !== undefined ? Number(v) : undefined;
}

export function nullNum(v: unknown): number | null {
  return v !== null && v !== undefined ? Number(v) : null;
}

export function bool(v: unknown, fallback = false): boolean {
  if (v === null || v === undefined) return fallback;
  return Boolean(v);
}

export function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

export function arrOr<T>(v: unknown, fallback: T[]): T[] {
  return Array.isArray(v) ? (v as T[]) : fallback;
}

export function rowIdentity(r: Record<string, any>, fallbackUserId = '') {
  return {
    id: String(r.id),
    userId: String(r.user_id || fallbackUserId),
  };
}

export function rowTimestamps(r: Record<string, any>, fallbackNow?: string) {
  const now = fallbackNow || new Date().toISOString();
  return {
    deletedAt: (r.deleted_at as string) || null,
    generationCounter: Number(r.generation_counter || 1),
    createdAt: (r.created_at || r.updated_at || now) as string,
    updatedAt: (r.updated_at || r.created_at || now) as string,
  };
}
