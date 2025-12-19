import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionUtil } from '../common/utils/encryption.util';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WabaService {
  private readonly metaApiVersion: string;
  private readonly metaAppId: string;
  private readonly metaAppSecret: string;
  private readonly frontendCallbackUrl: string;
  private readonly logger = new Logger(WabaService.name);

  // Add a Set to track used codes (in-memory cache)
  private usedCodes = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.metaApiVersion = configService.get<string>('META_API_VERSION') || 'v21.0';
    this.metaAppId = configService.get<string>('META_APP_ID') || '';
    this.metaAppSecret = configService.get<string>('META_APP_SECRET') || '';
    this.frontendCallbackUrl = configService.get<string>('FRONTEND_CALLBACK_URL') || '';
    
    if (!this.metaAppId || !this.metaAppSecret) {
      this.logger.warn('META_APP_ID or META_APP_SECRET not configured');
    }
  }

  async getEmbeddedSignupUrl(shopId: string, state?: string): Promise<string> {
    // Use frontend callback URL for redirect - Meta will redirect user there
    const redirectUri = this.configService.get<string>('FRONTEND_CALLBACK_URL') || 
      this.configService.get<string>('REDIRECT_URI') ||
      `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'}/onboarding/callback`;
    
    const scopes = 'whatsapp_business_messaging,whatsapp_business_management,business_management';
    
    const url = `https://www.facebook.com/v${this.metaApiVersion}/dialog/oauth?` +
      `client_id=${this.metaAppId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `state=${state || shopId}&` +
      `response_type=code`;

    this.logger.debug(`Generated OAuth URL with redirect_uri: ${redirectUri}`);
    return url;
  }

  async handleCallback(code: string, state: string) {
    this.logger.log(`Processing WABA callback for shop ${state}`);
    
    // Check if code was already used
    if (this.usedCodes.has(code)) {
      this.logger.warn(`Authorization code ${code} was already used`);
      throw new BadRequestException(
        'This authorization code has already been used. Please initiate a new connection from the onboarding page.'
      );
    }
    
    try {
      // Exchange code for access token
      const redirectUri = this.configService.get<string>('FRONTEND_CALLBACK_URL') || 
        this.configService.get<string>('REDIRECT_URI') ||
        `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'}/onboarding/callback`;
      
      this.logger.debug(`Exchanging authorization code for access token (redirect_uri: ${redirectUri})`);
      
      let tokenResponse;
      try {
        tokenResponse = await axios.get(
          `https://graph.facebook.com/v${this.metaApiVersion}/oauth/access_token`,
          {
            params: {
              client_id: this.metaAppId,
              client_secret: this.metaAppSecret,
              redirect_uri: redirectUri,
              code,
            },
            timeout: 30000, // 30 second timeout
          },
        );
        this.logger.debug('Token exchange request completed');
      } catch (tokenError: any) {
        this.logger.error('Token exchange failed', {
          error: tokenError.message,
          code: tokenError.code,
          status: tokenError.response?.status,
          data: tokenError.response?.data,
        });
        throw tokenError;
      }

      // Mark code as used immediately after successful exchange
      this.usedCodes.add(code);
      
      // Clean up old codes periodically (optional - to prevent memory leak)
      // You could also use a TTL-based cache like Redis in production
      
      if (!tokenResponse.data || !tokenResponse.data.access_token) {
        this.logger.error('Token response missing access_token', {
          response: tokenResponse.data,
        });
        throw new BadRequestException('Invalid response from Meta API: missing access token');
      }
      
      const accessToken = tokenResponse.data.access_token;
      this.logger.debug('Successfully obtained access token');

      let wabaId: string | null = null;
      let businessId: string | null = null;

      // Try Method 1: Get WABA accounts directly from user (doesn't require business_management)
      try {
        const directWabaResponse = await axios.get(
          `https://graph.facebook.com/v${this.metaApiVersion}/me/owned_whatsapp_business_accounts`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: {
              fields: 'id,name',
            },
            timeout: 30000, // 30 second timeout
          },
        );

        if (directWabaResponse.data.data && directWabaResponse.data.data.length > 0) {
          wabaId = directWabaResponse.data.data[0].id;
          this.logger.debug(`Found WABA directly: ${wabaId}`);
        }
      } catch (directError: any) {
        this.logger.debug('Direct WABA fetch failed, trying business approach:', directError.message);
      }

      // Method 2: Try through businesses (requires business_management permission)
      if (!wabaId) {
        try {
          const businessResponse = await axios.get(
            `https://graph.facebook.com/v${this.metaApiVersion}/me/businesses`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              timeout: 30000, // 30 second timeout
            },
          );

          if (!businessResponse.data.data || businessResponse.data.data.length === 0) {
            throw new BadRequestException(
              'No business accounts found. Please ensure you are an admin of a Facebook Business account and have granted business_management permission.'
            );
          }

          businessId = businessResponse.data.data[0].id;
          this.logger.debug(`Found business: ${businessId}`);

          // Get WABA info from business
          const wabaResponse = await axios.get(
            `https://graph.facebook.com/v${this.metaApiVersion}/${businessId}/owned_whatsapp_business_accounts`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              timeout: 30000, // 30 second timeout
            },
          );

          if (!wabaResponse.data.data || wabaResponse.data.data.length === 0) {
            throw new BadRequestException(
              'No WABA accounts found in your business. Please ensure you have a WhatsApp Business Account connected to your Facebook Business account.'
            );
          }

          wabaId = wabaResponse.data.data[0].id;
        } catch (businessError: any) {
          const errorMsg = businessError.response?.data?.error?.message || businessError.message;
          const errorCode = businessError.response?.data?.error?.code;
          
          if (errorMsg.includes('business_management') || errorCode === 200) {
            throw new BadRequestException(
              'Missing business_management permission. ' +
              'Please go to Facebook Developer Console > Permissions and request Advanced Access for business_management. ' +
              'Then reconnect and ensure you grant all requested permissions. ' +
              'You must also be an admin of the Facebook Business account.'
            );
          }
          throw businessError;
        }
      }

      if (!wabaId) {
        throw new BadRequestException('No WABA accounts found. Please ensure you have a WhatsApp Business Account.');
      }

      // Get phone numbers
      const phoneResponse = await axios.get(
        `https://graph.facebook.com/v${this.metaApiVersion}/${wabaId}/phone_numbers`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 30000, // 30 second timeout
        },
      );

      if (!phoneResponse.data.data || phoneResponse.data.data.length === 0) {
        throw new BadRequestException('No phone numbers found in WABA account');
      }

      const phoneId = phoneResponse.data.data[0].id;
      const displayNumber = phoneResponse.data.data[0].display_phone_number || phoneResponse.data.data[0].verified_name;

      // Encrypt and store token
      const encryptedToken = EncryptionUtil.encrypt(accessToken);

      // Check if WABA already exists
      const existingWaba = await this.prisma.wabaAccount.findUnique({
        where: { wabaId },
      });

      let wabaAccount;
      if (existingWaba) {
        wabaAccount = await this.prisma.wabaAccount.update({
          where: { wabaId },
          data: {
            shopId: state,
            phoneId,
            displayNumber,
            encryptedToken,
            tokenExpiresAt: null,
          },
        });
      } else {
        wabaAccount = await this.prisma.wabaAccount.create({
          data: {
            shopId: state,
            wabaId,
            phoneId,
            displayNumber,
            encryptedToken,
          },
        });
      }

      // Register webhook (async, don't wait)
      this.registerWebhook(wabaId, accessToken).catch((err) => {
        this.logger.error(`Failed to register webhook for WABA ${wabaId}:`, err);
      });

      this.logger.log(`Successfully connected WABA ${wabaId} for shop ${state}`);

      return {
        wabaId: wabaAccount.wabaId,
        phoneId: wabaAccount.phoneId,
        displayNumber: wabaAccount.displayNumber,
        webhookVerified: wabaAccount.webhookVerified,
      };
    } catch (error) {
      // Mark code as used if we got a code reuse error
      if (error.response?.data?.error?.code === 100 && 
          error.response?.data?.error?.error_subcode === 36009) {
        this.usedCodes.add(code);
      }
      
      const errorMessage = error.response?.data?.error?.message || error.message;
      const errorCode = error.response?.data?.error?.code || error.response?.status;
      const errorSubcode = error.response?.data?.error?.error_subcode;
      
      // Handle timeout errors
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        this.logger.error(`Request timeout during WABA callback for shop ${state}`);
        throw new BadRequestException(
          'Request to Meta API timed out. Please try again. If the problem persists, check your network connection.'
        );
      }
      
      // Handle specific OAuth code reuse error
      if (errorCode === 100 && errorSubcode === 36009) {
        this.logger.warn(`Authorization code already used for shop ${state}`);
        throw new BadRequestException(
          'This authorization code has already been used. Please go back to the onboarding page and start a new connection.'
        );
      }
      
      this.logger.error(
        `WABA callback failed for shop ${state}`,
        {
          error: errorMessage,
          code: errorCode,
          subcode: errorSubcode,
          axiosError: error.code,
          response: error.response?.data,
          stack: error.stack,
        },
      );

      // Re-throw BadRequestException as-is (it already has a good message)
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(`Failed to process WABA connection: ${errorMessage}`);
    }
  }

  private async registerWebhook(wabaId: string, accessToken: string) {
    try {
      const webhookUrl = this.configService.get<string>('WEBHOOK_PUBLIC_URL') || 
        `${process.env.APP_URL || 'http://localhost:3000'}/webhooks/meta`;
      const verifyToken = this.configService.get<string>('META_VERIFY_TOKEN') || 'default-verify-token';

      // 1. Register app-level subscription (if using App Access Token)
      try {
        await axios.post(
          `https://graph.facebook.com/v${this.metaApiVersion}/${this.metaAppId}/subscriptions`,
          {
            object: 'whatsapp_business_account',
            callback_url: webhookUrl,
            verify_token: verifyToken,
            fields: ['messages', 'message_status'],
          },
          {
            params: {
              access_token: `${this.metaAppId}|${this.metaAppSecret}`, // App Access Token
            },
          },
        );
        this.logger.log('App-level webhook subscription registered successfully');
      } catch (appError) {
        this.logger.warn(
          `App-level subscription failed (this is often expected), trying WABA-level: ${appError.message}`,
        );
      }

      // 2. Subscribe WABA to app (WABA-level subscription)
      try {
        await axios.post(
          `https://graph.facebook.com/v${this.metaApiVersion}/${wabaId}/subscribed_apps`,
          {
            subscribed_fields: ['messages', 'message_status'],
          },
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: {
              access_token: accessToken,
            },
          },
        );
        
        this.logger.log(`Webhook registered successfully for WABA ${wabaId}`);
        
        // Update webhook verified status
        await this.prisma.wabaAccount.update({
          where: { wabaId },
          data: { webhookVerified: true },
        });
      } catch (wabaError) {
        this.logger.error(
          `Failed to subscribe WABA ${wabaId} to webhooks`,
          {
            error: wabaError.response?.data || wabaError.message,
            code: wabaError.response?.status,
          },
        );
        throw wabaError;
      }
    } catch (error) {
      this.logger.error(`Webhook registration error for WABA ${wabaId}:`, {
        error: error.response?.data || error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

