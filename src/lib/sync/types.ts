export interface ISynchronizer {
  domainName: string;
  sync(userId: string): Promise<{ pushed: number; pulled: number; status: 'success' | 'partial_failure' }>;
}

export interface SyncReport {
  timestamp: string;
  globalStatus: 'healthy' | 'degraded' | 'failed';
  details: Record<string, { status: 'success' | 'failed'; error?: string; pushed: number; pulled: number }>;
}
