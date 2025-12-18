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
    
    try {
      // Exchange code for access token - redirect URI must match the one used in OAuth request
      const redirectUri = this.configService.get<string>('FRONTEND_CALLBACK_URL') || 
        this.configService.get<string>('REDIRECT_URI') ||
        `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'}/onboarding/callback`;
      
      this.logger.debug(`Exchanging authorization code for access token (redirect_uri: ${redirectUri})`);
      
      const tokenResponse = await axios.get(
        `https://graph.facebook.com/v${this.metaApiVersion}/oauth/access_token`,
        {
          params: {
            client_id: this.metaAppId,
            client_secret: this.metaAppSecret,
            redirect_uri: redirectUri,
            code,
          },
        },
      );

      const accessToken = tokenResponse.data.access_token;
      this.logger.debug('Successfully obtained access token');

      // Get business info
      const businessResponse = await axios.get(
        `https://graph.facebook.com/v${this.metaApiVersion}/me/businesses`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!businessResponse.data.data || businessResponse.data.data.length === 0) {
        throw new BadRequestException('No business accounts found');
      }

      const businessId = businessResponse.data.data[0].id;

      // Get WABA info
      const wabaResponse = await axios.get(
        `https://graph.facebook.com/v${this.metaApiVersion}/${businessId}/owned_whatsapp_business_accounts`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!wabaResponse.data.data || wabaResponse.data.data.length === 0) {
        throw new BadRequestException('No WABA accounts found');
      }

      const wabaId = wabaResponse.data.data[0].id;

      // Get phone numbers
      const phoneResponse = await axios.get(
        `https://graph.facebook.com/v${this.metaApiVersion}/${wabaId}/phone_numbers`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!phoneResponse.data.data || phoneResponse.data.data.length === 0) {
        throw new BadRequestException('No phone numbers found');
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
            tokenExpiresAt: null, // TODO: Extract from token if available
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
      const errorMessage = error.response?.data?.error?.message || error.message;
      const errorCode = error.response?.data?.error?.code || error.response?.status;
      
      this.logger.error(
        `WABA callback failed for shop ${state}`,
        {
          error: errorMessage,
          code: errorCode,
          response: error.response?.data,
          stack: error.stack,
        },
      );

      // Handle specific Facebook OAuth errors
      if (error.response?.status === 400) {
        if (errorMessage?.includes('authorization code has been used') || 
            errorCode === 100) {
          throw new BadRequestException(
            'This authorization code has already been used. Please try connecting again from the onboarding page.'
          );
        }
        if (errorMessage?.includes('code')) {
          throw new BadRequestException('Invalid or expired authorization code. Please try again.');
        }
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

