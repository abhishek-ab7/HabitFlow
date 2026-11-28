import { NextRequest, NextResponse } from 'next/server';
import {
  WeeklyReviewDigestInputSchema,
  runWeeklyReviewGraph,
} from '@/lib/ai/graphs/weekly-review';
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limitResult = await rateLimit(req, { limit: 15, windowMs: 60 * 1000 });
    if (!limitResult.success) return rateLimitResponse(limitResult.retryAfter);

    const body = await req.json();
    const parsed = WeeklyReviewDigestInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid weekly review digest payload' }, { status: 400 });
    }

    const result = await runWeeklyReviewGraph(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[WeeklyReview API] Error:', err);
    return NextResponse.json({ error: 'Unable to generate weekly review' }, { status: 400 });
  }
}
