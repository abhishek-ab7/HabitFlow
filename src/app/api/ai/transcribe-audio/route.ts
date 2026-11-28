import { NextRequest, NextResponse } from 'next/server';
import { resolveGeminiApiKeys, runWithGeminiFailover } from '@/lib/ai/gemini-server';
import { resolveGeminiModel } from '@/lib/ai/model-router';
import { rateLimit, rateLimitResponse } from '@/lib/security/rate-limit';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav'];

function isAllowedAudioMime(mime: string): boolean {
  const lower = mime.toLowerCase();
  return ALLOWED_MIME_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limitResult = await rateLimit(req, { limit: 20, windowMs: 60 * 1000 });
    if (!limitResult.success) return rateLimitResponse(limitResult.retryAfter);

    const body = (await req.json().catch(() => null)) as {
      audioBase64?: unknown;
      mimeType?: unknown;
    } | null;

    const rawBase64 = typeof body?.audioBase64 === 'string' ? body.audioBase64.trim() : '';
    const mimeType = typeof body?.mimeType === 'string' ? body.mimeType.trim() : 'audio/webm';
    if (!rawBase64) {
      return NextResponse.json({ error: 'audioBase64 is required' }, { status: 400 });
    }
    if (!isAllowedAudioMime(mimeType)) {
      return NextResponse.json({ error: 'Unsupported audio MIME type' }, { status: 400 });
    }

    const cleanBase64 = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
    const approxBytes = Math.ceil((cleanBase64.length * 3) / 4);
    if (approxBytes > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Audio recording exceeds 4 MB limit' }, { status: 413 });
    }

    if (resolveGeminiApiKeys().length === 0) {
      return NextResponse.json({ error: 'Audio transcription unavailable' }, { status: 503 });
    }

    const model = resolveGeminiModel('fast');
    const transcript = await runWithGeminiFailover(async (ai) => {
      const res = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'Transcribe this short Hinglish/English personal life log (expenses, meals, workouts, water, steps, tasks) into clean plain text only. Preserve numbers and Indian currency/merchant names accurately. Return ONLY the transcript text with no quotes or markdown.',
              },
              { inlineData: { data: cleanBase64, mimeType } },
            ],
          },
        ],
      });
      return res.text?.trim() || '';
    });

    return NextResponse.json({ transcript });
  } catch (err) {
    console.error('[TranscribeAudio API] Error:', err);
    return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 });
  }
}
