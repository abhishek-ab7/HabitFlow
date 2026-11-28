import { NextRequest, NextResponse } from 'next/server';
import { getIstIsoDate } from '@/lib/mcp/config';
import {
  collectEnvelope80PctAlerts,
  collectStreakRecoveryAlerts,
} from '@/components/alerts/alert-proactive-collectors';
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
  Habit,
  HabitCompletion,
} from '@/lib/types';

function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get('authorization')?.trim();
  return auth === `Bearer ${secret}`;
}

interface CronUserSnapshot {
  userId: string;
  categories?: FinanceCategory[];
  accounts?: FinanceAccount[];
  transactions?: FinanceTransaction[];
  habits?: Habit[];
  completions?: HabitCompletion[];
}

/**
 * Server-side background hook for Supabase pg_cron / Vercel Cron.
 * Evaluates the exact same pure-TS 80% envelope and 3-day >14d streak recovery rules.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      todayIso?: string;
      snapshots?: CronUserSnapshot[];
    };
    const todayIso = body.todayIso || getIstIsoDate();
    const snapshots = Array.isArray(body.snapshots) ? body.snapshots.slice(0, 200) : [];

    const results = snapshots.map((snap) => {
      const envelopeAlerts = collectEnvelope80PctAlerts({
        todayIso,
        categories: snap.categories,
        accounts: snap.accounts,
        transactions: snap.transactions,
      });
      const streakAlerts = collectStreakRecoveryAlerts({
        todayIso,
        habits: snap.habits,
        completions: snap.completions,
      });
      return {
        userId: snap.userId,
        nudges: [...envelopeAlerts, ...streakAlerts],
      };
    });

    const nudgesGenerated = results.reduce((sum, r) => sum + r.nudges.length, 0);
    return NextResponse.json({
      todayIso,
      scannedUsers: results.length,
      nudgesGenerated,
      results,
    });
  } catch (err) {
    console.error('[ProactiveNudges Cron] Error:', err);
    return NextResponse.json({ error: 'Failed to evaluate proactive nudges' }, { status: 500 });
  }
}
