interface RateLimitConfig {
  windowMs: number;
  max: number;
}

interface HitRecord {
  count: number;
  expiresAt: number;
}

const rateLimiters: Record<string, RateLimitConfig> = {
  'auth:strict': { windowMs: 60_000, max: 10 },
  'write:standard': { windowMs: 60_000, max: 60 },
};

const hits = new Map<string, HitRecord>();

export function checkRateLimit(key: string, identifier: string): boolean {
  const config = rateLimiters[key];
  if (!config) return true;
  const now = Date.now();
  const mapKey = `${key}:${identifier}`;
  const record = hits.get(mapKey);
  if (!record || record.expiresAt < now) {
    hits.set(mapKey, { count: 1, expiresAt: now + config.windowMs });
    return true;
  }
  if (record.count >= config.max) {
    return false;
  }
  record.count += 1;
  hits.set(mapKey, record);
  return true;
}
