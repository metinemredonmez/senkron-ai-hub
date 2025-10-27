import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
let client: Redis | null = null;

function getClient(): Redis {
  if (!client) {
    client = new Redis(redisUrl, {
      lazyConnect: true,
    });
  }
  return client;
}

export async function pingRedis(): Promise<string> {
  const redis = getClient();
  if (redis.status === 'wait' || redis.status === 'end') {
    await redis.connect();
  }
  return redis.ping();
}

export async function getRedisKeys(pattern: string): Promise<string[]> {
  const redis = getClient();
  if (redis.status === 'wait' || redis.status === 'end') {
    await redis.connect();
  }
  return redis.keys(pattern);
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
