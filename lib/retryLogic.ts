/**
 * Retry logic with exponential backoff
 * Used for transient failures (455, 429 with stock replenishment, network timeouts)
 */

interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatuses: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryableStatuses: [429, 455], // Out of stock, provider down
};

export class RetryableError extends Error {
  constructor(
    public statusCode: number,
    public originalError: Error,
    public attempt: number
  ) {
    super(`Retry attempt ${attempt}: ${originalError.message}`);
    this.name = 'RetryableError';
  }
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig
): number {
  const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(exponentialDelay, config.maxDelayMs);
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const statusCode = error.response?.status || error.statusCode || 500;

      // Check if error is retryable
      if (!finalConfig.retryableStatuses.includes(statusCode)) {
        throw error; // Non-retryable, fail immediately
      }

      // If this was the last attempt, throw
      if (attempt === finalConfig.maxAttempts) {
        throw new RetryableError(statusCode, error, attempt);
      }

      // Calculate backoff and wait
      const delayMs = calculateBackoffDelay(attempt, finalConfig);
      console.log(
        `Retry attempt ${attempt}/${finalConfig.maxAttempts} after ${delayMs}ms. Error: ${statusCode} - ${error.message}`
      );
      await sleep(delayMs);
    }
  }

  throw lastError || new Error('Retry exhausted without error object');
}

/**
 * Classify errors as retryable or permanent
 * Retryable: transient failures that might succeed later (429, 455, timeout)
 * Permanent: configuration/validation errors (400, 402, invalid code)
 */
export function isRetryable(statusCode: number): boolean {
  return [429, 455, 503, 504].includes(statusCode); // Stock, provider, service unavailable, gateway timeout
}

export function isPermanentFailure(statusCode: number): boolean {
  return [400, 402, 404, 410].includes(statusCode); // Invalid, wallet, not found, gone
}

/**
 * Determine if an order should be retried based on its age and error
 * Orders expire ~20 minutes after creation; don't retry very old orders
 */
export function shouldRetryOrder(
  createdAt: Date,
  statusCode: number,
  maxAgeMinutes: number = 15
): boolean {
  const ageMinutes = (Date.now() - createdAt.getTime()) / 1000 / 60;

  // Don't retry if order is too old (likely expired in Mobimatter)
  if (ageMinutes > maxAgeMinutes) {
    console.warn(`Order too old (${ageMinutes.toFixed(1)}m), creating new order instead of retrying`);
    return false;
  }

  // Only retry if error is transient
  return isRetryable(statusCode);
}
