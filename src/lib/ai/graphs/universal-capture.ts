import { resolveGeminiApiKeys } from '@/lib/ai/gemini-server';
import { parseUniversalCapture } from '@/lib/quick-capture/universal-parser';
import { extractDomainsInParallel, routeCaptureDomains } from './capture-extractors';
import type { CaptureGraphInput, CaptureGraphResult } from './capture-state';
import { validateCaptureActions } from './capture-validator';

/**
 * 5-Node Universal Capture State Graph (Pure TS, zero DOM/Next imports):
 *   Node 1: Deterministic Intent Router (0ms)
 *   Node 2: Parallel Per-Domain Gemini Extractors (Promise.all + Zod v4 + XML isolation)
 *   Node 3: Deterministic FK & 24h Duplicate Validator
 *   Node 4 / Node 5: AWAITING_HUMAN vs READY_TO_COMMIT gate
 */
export async function runUniversalCaptureGraph(input: CaptureGraphInput): Promise<CaptureGraphResult> {
  const { rawText, todayIso, context, recentTransactions = [] } = input;
  const deterministic = parseUniversalCapture(rawText, context);
  const detectedDomains = routeCaptureDomains(rawText, deterministic.actions);

  let finalActions = deterministic.actions;
  let source: 'gemini' | 'deterministic' = 'deterministic';
  let detectedDate = deterministic.detectedDate;

  if (resolveGeminiApiKeys().length > 0) {
    try {
      const aiActions = await extractDomainsInParallel({
        domains: detectedDomains,
        rawText,
        todayIso,
        context,
        deterministicActions: deterministic.actions,
      });
      if (aiActions.length > 0) {
        finalActions = aiActions;
        source = 'gemini';
        detectedDate = todayIso;
      }
    } catch {
      // Graceful fallback to deterministic Hinglish parser
    }
  }

  const validation = validateCaptureActions({
    actions: finalActions,
    context,
    recentTransactions,
  });

  return {
    actions: finalActions,
    detectedDate,
    summary: deterministic.summary,
    source,
    status: validation.status,
    detectedDomains,
    overallConfidence: validation.overallConfidence,
    ambiguities: validation.ambiguities,
    duplicateWarnings: validation.duplicateWarnings,
  };
}
