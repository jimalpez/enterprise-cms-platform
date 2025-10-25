import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
  redisConnected: boolean;
};

let redisConnected = false;

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        console.warn(
          "Redis connection failed after 3 retries. Running without Redis.",
        );
        return null;
      }
      return Math.min(times * 200, 1000);
    },
    lazyConnect: true,
    enableOfflineQueue: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

redis.on("error", (err) => {
  redisConnected = false;
  if (!err.message.includes("ECONNREFUSED")) {
    console.error("Redis Client Error:", err.message);
  }
});

redis.on("connect", () => {
  redisConnected = true;
  console.log("Redis Client Connected");
});

redis.on("close", () => {
  redisConnected = false;
});

// Try to connect
redis.connect().catch(() => {
  console.warn(
    "⚠️  Redis is not available. Running without cache and rate limiting.",
  );
  redisConnected = false;
});

export default redis;

// Check if Redis is connected
export function isRedisConnected(): boolean {
  return redisConnected && redis.status === "ready";
}

// Rate limiting helper with fallback
export async function checkRateLimit(
  key: string,
  limit: number,
  window: number = 3600, // 1 hour in seconds
): Promise<{ allowed: boolean; remaining: number }> {
  // If Redis is not connected, allow all requests (no rate limiting)
  if (!isRedisConnected()) {
    return { allowed: true, remaining: limit };
  }

  try {
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, window);
    }

    const allowed = current <= limit;
    const remaining = Math.max(0, limit - current);

    return { allowed, remaining };
  } catch (error) {
    // If Redis fails, allow the request (fail open)
    console.warn("Rate limit check failed, allowing request");
    return { allowed: true, remaining: limit };
  }
}

// Cache helper with fallback
export async function getCached<T>(
  key: string,
  fallback: () => Promise<T>,
  ttl: number = 3600,
): Promise<T> {
  // If Redis is not connected, just call the fallback
  if (!isRedisConnected()) {
    return fallback();
  }

  try {
    const cached = await redis.get(key);

    if (cached) {
      return JSON.parse(cached);
    }

    const data = await fallback();
    await redis.setex(key, ttl, JSON.stringify(data));

    return data;
  } catch (error) {
    // If Redis fails, just return fresh data
    console.warn("Cache read failed, fetching fresh data");
    return fallback();
  }
}

export async function invalidateCache(pattern: string): Promise<void> {
  // If Redis is not connected, nothing to invalidate
  if (!isRedisConnected()) {
    return;
  }

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.warn("Cache invalidation failed");
  }
}
