import { randomUUID } from 'node:crypto';

export const SHARED_BUSY = 'Our Oddlings are busy. Please try again later.';
export function sharedConfigured(): boolean {
  return !!process.env.AI_REDIS_REST_URL && !!process.env.AI_REDIS_REST_TOKEN;
}
export async function redisCommand(...command: (string | number)[]): Promise<any> {
  if (!sharedConfigured()) throw new Error('Shared AI storage is not configured.');
  const response = await fetch(process.env.AI_REDIS_REST_URL!, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.AI_REDIS_REST_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(10000)
  });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error('Shared AI storage is unavailable.');
  return body.result;
}
const namespace = () => process.env.AI_STORAGE_NAMESPACE || 'oddlings';
const positive = (value: string | undefined, fallback: number) =>
  Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback;

// Redis evaluates this transaction on one primary. Different app instances cannot
// reserve against the same remaining budget or slot concurrently.
export const RESERVE_SCRIPT = `
local now = tonumber(ARGV[1])
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)
local used = tonumber(redis.call('HGET', KEYS[1], 'cents') or '0')
local count = tonumber(redis.call('HGET', KEYS[1], ARGV[5]) or '0')
if used + tonumber(ARGV[2]) > tonumber(ARGV[3])
or redis.call('ZCARD', KEYS[2]) >= tonumber(ARGV[4])
or count >= tonumber(ARGV[6]) then return 0 end
redis.call('HINCRBY', KEYS[1], 'cents', ARGV[2])
redis.call('HINCRBY', KEYS[1], ARGV[5], 1)
redis.call('EXPIRE', KEYS[1], 172800)
redis.call('ZADD', KEYS[2], now + 600000, ARGV[7])
redis.call('EXPIRE', KEYS[2], 1200)
return 1
`;
export async function reserveShared(kind: 'image' | 'text'): Promise<() => void> {
  const id = randomUUID();
  const prefix = namespace();
  const active = prefix + ':active';
  const now = Date.now();
  const result = await redisCommand('EVAL', RESERVE_SCRIPT, 2,
    prefix + ':usage:' + new Date(now).toISOString().slice(0,10), active,
    now, kind === 'image' ? 10 : 5, positive(process.env.AI_DAILY_BUDGET_CENTS, 2000),
    positive(process.env.AI_MAX_CONCURRENT, 4), kind, kind === 'image' ? 100 : 500, id);
  if (result !== 1) throw new Error(SHARED_BUSY);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    // A failed release conservatively keeps the slot until the lease expires.
    void redisCommand('ZREM', active, id).catch(() => {});
  };
}
export const sharedJobKey = (id: string) => namespace() + ':job:' + id;
