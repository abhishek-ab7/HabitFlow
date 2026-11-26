/* eslint-disable @typescript-eslint/no-explicit-any */
// =============================================
// CONFLICT RESOLUTION UTILITY
// =============================================
// Intelligent conflict resolution for sync operations
// Strategy 1: Completed always wins (for boolean completed fields)
// Strategy 2: Completed status wins (for status fields)
// Strategy 3: Highest value wins (for XP/gems/level)
// Strategy 4: Most recent timestamp wins (fallback)

export interface ConflictResolutionResult<T> {
  winner: 'local' | 'remote' | 'equal';
  data: T;
  reason: string;
}

export interface ConflictResolutionOptions {
  // For items with a "completed" boolean field (completions, milestones)
  preferCompleted?: boolean;
  
  // For items with status fields (goals, tasks)
  // If status matches one of these, that version wins
  completedStatuses?: string[];
  
  // For numeric fields like XP, gems, level - highest value wins
  preferHigherValues?: Array<keyof any>;
  
  // Custom comparison function for special cases
  customComparison?: (local: any, remote: any) => 'local' | 'remote' | 'equal' | null;
}

/**
 * Resolves conflicts between local and remote versions of data
 * Uses multiple strategies in priority order:
 * 1. Custom comparison (if provided)
 * 2. Completed always wins (if preferCompleted=true)
 * 3. Completed status wins (if completedStatuses provided)
 * 4. Highest value wins (for numeric fields like XP)
 * 5. Most recent timestamp wins (using updated_at or created_at)
 * 6. Local wins (if timestamps equal - tie-breaker)
 */
type ComparableRecord = {
  updated_at?: string | null;
  updatedAt?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  completed?: boolean;
  status?: string;
};

function resolveByCompletion<T extends ComparableRecord>(
  local: T,
  remote: T,
  preferCompleted?: boolean
): ConflictResolutionResult<T> | null {
  if (!preferCompleted) return null;
  if (!('completed' in local) || !('completed' in remote)) return null;
  const localDone = local.completed === true;
  const remoteDone = remote.completed === true;
  if (localDone === remoteDone) return null;
  return localDone
    ? { winner: 'local', data: local, reason: '✅ Local is completed (completed always wins)' }
    : { winner: 'remote', data: remote, reason: '✅ Remote is completed (completed always wins)' };
}

function resolveByStatus<T extends ComparableRecord>(
  local: T,
  remote: T,
  completedStatuses?: string[]
): ConflictResolutionResult<T> | null {
  if (!completedStatuses) return null;
  if (!('status' in local) || !('status' in remote)) return null;
  const localStatus = local.status as string;
  const remoteStatus = remote.status as string;
  const localDone = completedStatuses.includes(localStatus);
  const remoteDone = completedStatuses.includes(remoteStatus);
  if (localDone === remoteDone) return null;
  return localDone
    ? { winner: 'local', data: local, reason: `✅ Local has completed status: ${localStatus} (completed status wins)` }
    : { winner: 'remote', data: remote, reason: `✅ Remote has completed status: ${remoteStatus} (completed status wins)` };
}

function compareNumericField<T>(local: T, remote: T, field: keyof any): ConflictResolutionResult<T> | null {
  const localValue = (local as any)[field];
  const remoteValue = (remote as any)[field];
  if (typeof localValue !== 'number' || typeof remoteValue !== 'number') return null;
  if (localValue === remoteValue) return null;
  const winner = localValue > remoteValue ? 'local' : 'remote';
  const high = Math.max(localValue, remoteValue);
  const low = Math.min(localValue, remoteValue);
  const label = winner === 'local' ? 'Local' : 'Remote';
  return {
    winner,
    data: winner === 'local' ? local : remote,
    reason: `🏆 ${label} has higher ${String(field)}: ${high} > ${low} (highest value wins)`,
  };
}

function resolveByHigherValue<T>(
  local: T,
  remote: T,
  fields?: Array<keyof any>
): ConflictResolutionResult<T> | null {
  if (!fields?.length) return null;
  for (const field of fields) {
    const res = compareNumericField(local, remote, field);
    if (res) return res;
  }
  return null;
}

function extractRecordTime(record: any): number {
  const raw = record.updated_at ?? record.updatedAt ?? record.created_at ?? record.createdAt ?? 0;
  return new Date(raw).getTime();
}

function resolveByTimestamp<T>(local: T, remote: T): ConflictResolutionResult<T> {
  const localTime = extractRecordTime(local);
  const remoteTime = extractRecordTime(remote);
  if (localTime > remoteTime) {
    return { winner: 'local', data: local, reason: `⏰ Local is newer: ${new Date(localTime).toISOString()} (timestamp wins)` };
  }
  if (remoteTime > localTime) {
    return { winner: 'remote', data: remote, reason: `⏰ Remote is newer: ${new Date(remoteTime).toISOString()} (timestamp wins)` };
  }
  return { winner: 'equal', data: local, reason: '⚖️ Timestamps equal, keeping local (tie-breaker)' };
}

function resolveByCustom<T>(
  local: T,
  remote: T,
  customComparison?: (local: any, remote: any) => 'local' | 'remote' | 'equal' | null
): ConflictResolutionResult<T> | null {
  if (!customComparison) return null;
  const custom = customComparison(local, remote);
  if (!custom || custom === 'equal') return null;
  return {
    winner: custom,
    data: custom === 'local' ? local : remote,
    reason: 'Custom comparison logic',
  };
}

export function resolveConflict<T extends ComparableRecord>(
  local: T,
  remote: T,
  options: ConflictResolutionOptions = {}
): ConflictResolutionResult<T> {
  const resolvers: Array<() => ConflictResolutionResult<T> | null> = [
    () => resolveByCustom(local, remote, options.customComparison),
    () => resolveByCompletion(local, remote, options.preferCompleted),
    () => resolveByStatus(local, remote, options.completedStatuses),
    () => resolveByHigherValue(local, remote, options.preferHigherValues),
  ];

  for (const check of resolvers) {
    const res = check();
    if (res) return res;
  }
  return resolveByTimestamp(local, remote);
}

function mergeStatsMap(localStats: any, remoteStats: any) {
  const mergedStats = { ...localStats, ...remoteStats };
  if (!localStats || !remoteStats) return mergedStats;
  for (const key of Object.keys(mergedStats)) {
    mergedStats[key] = Math.max(localStats[key] || 0, remoteStats[key] || 0);
  }
  return mergedStats;
}

const maxNum = (a?: number, b?: number) => Math.max(a || 0, b || 0);

export function mergeGamificationFields<T extends {
  xp?: number;
  level?: number;
  gems?: number;
  streakShield?: number;
  stats?: any;
  unlockedThemes?: string[];
}>(local: T, remote: T): T {
  const mergedThemes = Array.from(
    new Set([...(local.unlockedThemes || []), ...(remote.unlockedThemes || [])])
  );
  return {
    ...local,
    xp: maxNum(local.xp, remote.xp),
    level: maxNum(local.level, remote.level),
    gems: maxNum(local.gems, remote.gems),
    streakShield: maxNum(local.streakShield, remote.streakShield),
    stats: mergeStatsMap(local.stats, remote.stats),
    unlockedThemes: mergedThemes,
  };
}
