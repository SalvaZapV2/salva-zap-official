import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

/**
 * Token bucket rate limiter using Redis
 * Implements per-phone-number rate limiting for WhatsApp messaging
 */
@Injectable()
export class RateLimiterUtil {
  private readonly redis: Redis;
  private readonly defaultRate: number;
  private readonly logger = new Logger(RateLimiterUtil.name);

  constructor(private configService: ConfigService) {
    const redisUrl = configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);
    this.defaultRate = parseInt(configService.get<string>('RATE_LIMIT_DEFAULT') || '10');
  }

  /**
   * Token bucket algorithm for rate limiting
   * @param phoneId - Unique identifier for the phone number (for per-phone rate limiting)
   * @param maxTokens - Maximum tokens in bucket (rate limit per second)
   * @param refillRate - Tokens to add per second
   * @returns true if allowed, false if rate limited
   */
  async checkRateLimit(
    phoneId: string,
    maxTokens: number = this.defaultRate,
    refillRate: number = this.defaultRate,
  ): Promise<boolean> {
    const key = `rate_limit:${phoneId}`;
    const now = Date.now();
    const windowMs = 1000; // 1 second window

    try {
      // Use Lua script for atomic operation
      const script = `
        local key = KEYS[1]
        local maxTokens = tonumber(ARGV[1])
        local refillRate = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        local windowMs = tonumber(ARGV[4])
        
        local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
        local tokens = tonumber(bucket[1]) or maxTokens
        local lastRefill = tonumber(bucket[2]) or now
        
        -- Refill tokens based on time passed
        local timePassed = (now - lastRefill) / 1000 -- Convert to seconds
        local tokensToAdd = math.floor(timePassed * refillRate)
        tokens = math.min(maxTokens, tokens + tokensToAdd)
        
        -- Check if we can consume a token
        if tokens >= 1 then
          tokens = tokens - 1
          redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', now)
          redis.call('EXPIRE', key, math.ceil(maxTokens / refillRate) + 1)
          return 1
        else
          redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', now)
          redis.call('EXPIRE', key, math.ceil(maxTokens / refillRate) + 1)
          return 0
        end
      `;

      const result = await this.redis.eval(
        script,
        1,
        key,
        maxTokens.toString(),
        refillRate.toString(),
        now.toString(),
        windowMs.toString(),
      ) as number;

      return result === 1;
    } catch (error) {
      this.logger.error(`Rate limit check failed for ${phoneId}:`, error);
      // On error, allow the request (fail open)
      return true;
    }
  }

  /**
   * Wait until rate limit allows the request
   * @param phoneId - Phone identifier
   * @param maxTokens - Max tokens
   * @param refillRate - Refill rate per second
   * @param maxWaitMs - Maximum time to wait in milliseconds
   */
  async waitForRateLimit(
    phoneId: string,
    maxTokens: number = this.defaultRate,
    refillRate: number = this.defaultRate,
    maxWaitMs: number = 5000,
  ): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 50; // Check every 50ms

    while (Date.now() - startTime < maxWaitMs) {
      const allowed = await this.checkRateLimit(phoneId, maxTokens, refillRate);
      if (allowed) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    // If still rate limited after max wait, throw error
    throw new Error(`Rate limit exceeded for ${phoneId} after ${maxWaitMs}ms wait`);
  }
}

