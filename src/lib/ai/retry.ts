// Retry Logic with Exponential Backoff

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  feature?: string;
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
    feature = 'unknown'
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[AI] ${feature} attempt ${attempt + 1}/${maxRetries + 1}`);
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      const isRateLimit = error.message?.includes('429') || 
                          error.message?.includes('quota') ||
                          error.message?.includes('RESOURCE_EXHAUSTED');
      const isNetworkError = error.message?.includes('fetch') ||
                              error.message?.includes('network') ||
                              error.message?.includes('ECONNREFUSED');
      const isServerError = error.message?.includes('500') ||
                             error.message?.includes('503') ||
                             error.message?.includes('INTERNAL');

      const shouldRetry = isRateLimit || isNetworkError || isServerError;

      if (!shouldRetry || attempt === maxRetries) {
        console.error(`[AI] ${feature} failed after ${attempt + 1} attempts:`, error.message);
        throw createAIError(error, feature);
      }

      // Exponential backoff
      const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
      const actualDelay = Math.min(delay + jitter, maxDelay);
      
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
