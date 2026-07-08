const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 300;

const buckets = new Map<string, { count: number; windowStart: number }>();

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  buckets.set(key, { count: bucket.count + 1, windowStart: bucket.windowStart });
  return true;
}
