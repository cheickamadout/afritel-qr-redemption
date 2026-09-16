/**
 * Polling logic for redemption status with exponential backoff
 * Gradually increases poll interval to reduce server load while waiting for completion
 */

interface PollerConfig {
  initialIntervalMs: number; // Start polling frequently
  maxIntervalMs: number; // Slow down over time
  backoffMultiplier: number; // Increase interval by this factor each time
  timeoutMs: number; // Give up after this long
  maxAttempts: number; // Hard limit on attempts
}

const DEFAULT_POLLER_CONFIG: PollerConfig = {
  initialIntervalMs: 2000, // Start at 2 seconds
  maxIntervalMs: 10000, // Max 10 seconds
  backoffMultiplier: 1.5, // Slow down poll rate over time
  timeoutMs: 60000, // 60 second timeout
  maxAttempts: 30,
};

export interface PollStatus {
  isComplete: boolean;
  isTimeout: boolean;
  attempts: number;
  elapsedMs: number;
  nextPollMs?: number;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function calculateNextPollingInterval(
  attempt: number,
  config: PollerConfig
): number {
  const exponentialInterval = config.initialIntervalMs * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(exponentialInterval, config.maxIntervalMs);
}

/**
 * Poll a status endpoint with exponential backoff
 * Useful for waiting for async operations (eSIM creation)
 */
export async function pollStatus<T>(
  endpoint: string,
  isComplete: (data: T) => boolean,
  config: Partial<PollerConfig> = {}
): Promise<{ data: T; attempts: number; elapsedMs: number } | null> {
  const finalConfig = { ...DEFAULT_POLLER_CONFIG, ...config };
  const startTime = Date.now();
  let attempt = 0;

  while (attempt < finalConfig.maxAttempts) {
    attempt++;
    const elapsedMs = Date.now() - startTime;

    // Check timeout
    if (elapsedMs > finalConfig.timeoutMs) {
      console.warn(`Polling timeout after ${elapsedMs}ms and ${attempt} attempts`);
      return null;
    }

    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        if (isComplete(data)) {
          console.log(`Polling complete in ${elapsedMs}ms after ${attempt} attempts`);
          return { data, attempts: attempt, elapsedMs };
        }
      }
    } catch (error) {
      console.error(`Polling error on attempt ${attempt}:`, error);
    }

    // Calculate next poll interval
    const nextIntervalMs = calculateNextPollingInterval(attempt, finalConfig);
    console.log(`Poll attempt ${attempt}/${finalConfig.maxAttempts}, next in ${nextIntervalMs}ms`);
    await sleep(nextIntervalMs);
  }

  console.warn(`Polling exhausted after ${attempt} attempts and ${Date.now() - startTime}ms`);
  return null;
}
