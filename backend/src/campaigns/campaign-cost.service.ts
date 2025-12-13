import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface MetaPrice {
  currency: string;
  pricing_model: string;
  pricing_tiers: Array<{
    category: string;
    unit_price: number;
  }>;
}

interface ExchangeRate {
  USD: number;
  BRL: number;
  timestamp: number;
}

@Injectable()
export class CampaignCostService {
  private readonly logger = new Logger(CampaignCostService.name);
  private readonly redis: Redis;
  private readonly metaApiVersion: string;
  private readonly metaAppId: string;
  private readonly metaAppSecret: string;

  // Cache TTLs in seconds
  private readonly META_PRICE_TTL = 24 * 60 * 60; // 24 hours
  private readonly FX_RATE_TTL = 6 * 60 * 60; // 6 hours

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);
    this.metaApiVersion = configService.get<string>('META_API_VERSION') || 'v21.0';
    this.metaAppId = configService.get<string>('META_APP_ID') || '';
    this.metaAppSecret = configService.get<string>('META_APP_SECRET') || '';
  }

  async calculateCost(templateId: string | null, contactCount: number): Promise<{
    totalCost: number;
    costPerMessage: number;
    currency: string;
    breakdown: {
      messageCount: number;
      costPerUnit: number;
    };
    // Additional fields for backwards compatibility
    usdCost: number;
    brlCost: number;
    pricingModel: string;
    contactCount: number;
  }> {
    try {
      // Get Meta pricing (cached)
      const pricing = await this.getMetaPricing();
      
      // Get exchange rate (cached)
      const exchangeRate = await this.getExchangeRate();

      // Calculate cost based on pricing model
      // For conversation-based pricing (most common)
      const conversationPrice = pricing.pricing_tiers.find(
        tier => tier.category === 'CONVERSATION'
      )?.unit_price || 0.005; // Default: $0.005 per conversation

      // Template messages are typically conversation-based
      const usdCost = contactCount * conversationPrice;
      const brlCost = usdCost * exchangeRate.BRL;

      return {
        totalCost: Math.round(usdCost * 10000) / 10000, // Round to 4 decimals
        costPerMessage: conversationPrice,
        currency: pricing.currency || 'USD',
        breakdown: {
          messageCount: contactCount,
          costPerUnit: conversationPrice,
        },
        // Additional fields for backwards compatibility
        usdCost: Math.round(usdCost * 10000) / 10000,
        brlCost: Math.round(brlCost * 100) / 100,
        pricingModel: pricing.pricing_model || 'conversation',
        contactCount,
      };
    } catch (error) {
      this.logger.error('Error calculating campaign cost:', error);
      // Return default pricing if cache/API fails
      const defaultPricePerMessage = 0.005;
      const defaultUsdCost = contactCount * defaultPricePerMessage;
      return {
        totalCost: defaultUsdCost,
        costPerMessage: defaultPricePerMessage,
        currency: 'USD',
        breakdown: {
          messageCount: contactCount,
          costPerUnit: defaultPricePerMessage,
        },
        // Additional fields for backwards compatibility
        usdCost: defaultUsdCost,
        brlCost: contactCount * 0.025, // Default ~R$0.025 per message (assuming ~5 BRL/USD)
        pricingModel: 'conversation',
        contactCount,
      };
    }
  }

  private async getMetaPricing(): Promise<MetaPrice> {
    const cacheKey = 'meta:pricing';
    
    // Try to get from cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from Meta API (or use default)
    // Note: Meta pricing API might require app access token
    // For now, use default pricing structure
    const defaultPricing: MetaPrice = {
      currency: 'USD',
      pricing_model: 'conversation',
      pricing_tiers: [
        {
          category: 'CONVERSATION',
          unit_price: 0.005, // $0.005 per conversation
        },
      ],
    };

    // Cache for 24 hours
    await this.redis.setex(cacheKey, this.META_PRICE_TTL, JSON.stringify(defaultPricing));

    return defaultPricing;
  }

  private async getExchangeRate(): Promise<ExchangeRate> {
    const cacheKey = 'fx:rate:usd-brl';
    
    // Try to get from cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const rate = JSON.parse(cached);
      // Check if still valid (within TTL)
      const age = Date.now() - rate.timestamp;
      if (age < this.FX_RATE_TTL * 1000) {
        return rate;
      }
    }

    // Fetch exchange rate (using a free API or default)
    // For production, use a reliable FX API
    const defaultRate: ExchangeRate = {
      USD: 1,
      BRL: 5.0, // Default rate, should be fetched from API
      timestamp: Date.now(),
    };

    try {
      // TODO: Fetch from actual exchange rate API
      // For now, use default
      const rate = defaultRate;
      
      // Cache for 6 hours
      await this.redis.setex(cacheKey, this.FX_RATE_TTL, JSON.stringify(rate));
      
      return rate;
    } catch (error) {
      this.logger.warn('Failed to fetch exchange rate, using default:', error);
      return defaultRate;
    }
  }
}

