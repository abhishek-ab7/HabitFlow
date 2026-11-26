// Retry Logic with Exponential Backoff

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  feature?: string;
}

const RETRYABLE_ERROR_SNIPPETS = ['429', 'quota', 'RESOURCE_EXHAUSTED', 'fetch', 'network', 'ECONNREFUSED', '500', '503', 'INTERNAL'];

function isRetryableError(error: any): boolean {
  const msg = String(error?.message || '');
  return RETRYABLE_ERROR_SNIPPETS.some((snippet) => msg.includes(snippet));
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    feature = 'unknown',
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[AI] ${feature} attempt ${attempt + 1}/${maxRetries + 1}`);
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (!isRetryableError(error) || attempt === maxRetries) {
        console.error(`[AI] ${feature} failed after ${attempt + 1} attempts:`, error.message);
        throw createAIError(error, feature);
      }

      const actualDelay = Math.min(delay + Math.random() * 1000, maxDelay);
      console.warn(`[AI] ${feature} failed (attempt ${attempt + 1}), retrying in ${Math.round(actualDelay)}ms...`);
      await sleep(actualDelay);
      delay = delay * backoffMultiplier;
    }
  }

  throw lastError!;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createAIError(error: any, feature: string) {
  const message = error.message || 'Unknown error';
  
  if (message.includes('429') || message.includes('quota')) {
    return new Error(`AI rate limit exceeded for ${feature}. Please try again in a few minutes.`);
  }
  
  if (message.includes('network') || message.includes('fetch')) {
    return new Error(`Network error for ${feature}. Please check your connection.`);
  }
  
  if (message.includes('500') || message.includes('503')) {
    return new Error(`AI service temporarily unavailable for ${feature}. Please try again.`);
  }
  
  return new Error(`AI error for ${feature}: ${message}`);
}
