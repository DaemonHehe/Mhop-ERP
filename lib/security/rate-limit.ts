import { headers } from "next/headers";

type Bucket = { count: number; resetsAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;

function makeRoom(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetsAt <= now) buckets.delete(key);
  }
  if (buckets.size >= MAX_BUCKETS) {
    const oldest = buckets.keys().next().value;
    if (oldest) buckets.delete(oldest);
  }
}

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
) {
  const current = buckets.get(key);
  if (!current || current.resetsAt <= now) {
    makeRoom(now);
    buckets.set(key, { count: 1, resetsAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

async function requestRateLimitKey(scope: string, discriminator = "") {
  const requestHeaders = await headers();
  const forwarded = requestHeaders
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const ip = forwarded || requestHeaders.get("x-real-ip") || "local";
  return `${scope}:${ip}:${discriminator}`;
}

export async function allowRequest(
  scope: string,
  limit: number,
  windowMs: number,
  discriminator = "",
) {
  return consumeRateLimit(
    await requestRateLimitKey(scope, discriminator),
    limit,
    windowMs,
  );
}

export async function clearRequestRateLimit(
  scope: string,
  discriminator = "",
) {
  resetRateLimit(await requestRateLimitKey(scope, discriminator));
}

export function clearRateLimitsForTests() {
  buckets.clear();
}
