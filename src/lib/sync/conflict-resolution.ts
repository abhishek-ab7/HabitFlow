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
export function resolveConflict<T extends {
  updated_at?: string | null;
  updatedAt?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  completed?: boolean;
  status?: string;
}>(
  local: T,
  remote: T,
  options: ConflictResolutionOptions = {}
): ConflictResolutionResult<T> {
  
  // Strategy 0: Custom comparison (highest priority)
  if (options.customComparison) {
    const customResult = options.customComparison(local, remote);
    if (customResult && customResult !== 'equal') {
      return {
        winner: customResult,
        data: customResult === 'local' ? local : remote,
        reason: 'Custom comparison logic',
      };
    }
  }
  
  // Strategy 1: Completed always wins (for completions, milestones)
  if (options.preferCompleted && 'completed' in local && 'completed' in remote) {
    const localCompleted = local.completed === true;
    const remoteCompleted = remote.completed === true;
    
    if (localCompleted && !remoteCompleted) {
      return {
        winner: 'local',
        data: local,
        reason: '✅ Local is completed (completed always wins)',
      };
    }
    if (!localCompleted && remoteCompleted) {
      return {
        winner: 'remote',
        data: remote,
        reason: '✅ Remote is completed (completed always wins)',
      };
    }
    // Both completed or both incomplete - continue to next strategy
  }
  
  // Strategy 2: Completed status wins (for goals, tasks)
  if (options.completedStatuses && 'status' in local && 'status' in remote) {
    const localStatus = local.status as string;
    const remoteStatus = remote.status as string;
    const localIsCompleted = options.completedStatuses.includes(localStatus);
    const remoteIsCompleted = options.completedStatuses.includes(remoteStatus);
    
    if (localIsCompleted && !remoteIsCompleted) {
      return {
        winner: 'local',
        data: local,
        reason: `✅ Local has completed status: ${localStatus} (completed status wins)`,
      };
    }
    if (!localIsCompleted && remoteIsCompleted) {
      return {
        winner: 'remote',
        data: remote,
        reason: `✅ Remote has completed status: ${remoteStatus} (completed status wins)`,
      };
    }
    // Both completed or both incomplete - continue to next strategy
  }
  
  // Strategy 3: Highest value wins (for XP, gems, level)
  if (options.preferHigherValues && options.preferHigherValues.length > 0) {
    for (const field of options.preferHigherValues) {
      const localValue = (local as any)[field];
      const remoteValue = (remote as any)[field];
      
      // Only compare if both have numeric values
      if (typeof localValue === 'number' && typeof remoteValue === 'number') {
        if (localValue > remoteValue) {
          return {
            winner: 'local',
            data: local,
            reason: `🏆 Local has higher ${String(field)}: ${localValue} > ${remoteValue} (highest value wins)`,
          };
        }
        if (remoteValue > localValue) {
          return {
            winner: 'remote',
            data: remote,
            reason: `🏆 Remote has higher ${String(field)}: ${remoteValue} > ${localValue} (highest value wins)`,
          };
        }
      }
    }
    // Values equal or not comparable - continue to next strategy
  }
  
  // Strategy 4: Most recent timestamp wins
  // Try updated_at first (snake_case for remote, camelCase for local), then created_at
  const localUpdatedAt = (local as any).updated_at || (local as any).updatedAt;
  const remoteUpdatedAt = (remote as any).updated_at || (remote as any).updatedAt;
  const localCreatedAt = (local as any).created_at || (local as any).createdAt;
  const remoteCreatedAt = (remote as any).created_at || (remote as any).createdAt;
  
  const localTime = new Date(localUpdatedAt || localCreatedAt || 0).getTime();
  const remoteTime = new Date(remoteUpdatedAt || remoteCreatedAt || 0).getTime();
  
  if (localTime > remoteTime) {
    const timestamp = new Date(localTime).toISOString();
    return {
      winner: 'local',
      data: local,
      reason: `⏰ Local is newer: ${timestamp} (timestamp wins)`,
    };
  }
  
  if (remoteTime > localTime) {
    const timestamp = new Date(remoteTime).toISOString();
    return {
      winner: 'remote',
      data: remote,
      reason: `⏰ Remote is newer: ${timestamp} (timestamp wins)`,
    };
  }
  
  // Strategy 5: Equal timestamps - prefer local (tie-breaker)
  return {
    winner: 'equal',
    data: local,
    reason: '⚖️ Timestamps equal, keeping local (tie-breaker)',
  };
}

/**
 * Helper to merge gamification fields using "highest value wins"
 * This ensures users never lose progress due to sync conflicts
 */
export function mergeGamificationFields<T extends {
  xp?: number;
  level?: number;
  gems?: number;
  streakShield?: number;
}>(local: T, remote: T): T {
  return {
    ...local,
    xp: Math.max(local.xp || 0, remote.xp || 0),
    level: Math.max(local.level || 0, remote.level || 0),
    gems: Math.max(local.gems || 0, remote.gems || 0),
    streakShield: Math.max(local.streakShield || 0, remote.streakShield || 0),
  };
}
