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
    
    // Remove business_management - only use direct access method
    const scopes = 'whatsapp_business_messaging,whatsapp_business_management';
    
    const url = `https://www.facebook.com/v${this.metaApiVersion}/dialog/oauth?` +
      `client_id=${this.metaAppId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `state=${state || shopId}&` +
      `response_type=code`;

    this.logger.debug(`Generated OAuth URL with redirect_uri: ${redirectUri}`);
    return url;
  }

  /**
   * Make an axios request with retry logic for transient network errors
   */
  private async axiosWithRetry<T>(
    requestFn: () => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 1000,
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a retryable error
        const isRetryable = 
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNRESET' ||
          error.code === 'ENOTFOUND' ||
          error.code === 'ECONNREFUSED' ||
          (error.response?.status >= 500 && error.response?.status < 600) ||
          error.message?.includes('timeout') ||
          error.message?.includes('ETIMEDOUT');
        
        if (!isRetryable || attempt === maxRetries) {
          throw error;
        }
        
        this.logger.warn(
          `Request failed (attempt ${attempt}/${maxRetries}), retrying in ${retryDelay}ms...`,
          { error: error.message, code: error.code }
        );
        
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
    
    throw lastError;
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
      
      const axiosConfig = {
        timeout: 60000, // 60 second timeout
      };
      
      const tokenResponse = await this.axiosWithRetry(
        () => axios.get(
          `https://graph.facebook.com/v${this.metaApiVersion}/oauth/access_token`,
          {
            ...axiosConfig,
            params: {
              client_id: this.metaAppId,
              client_secret: this.metaAppSecret,
              redirect_uri: redirectUri,
              code,
            },
          },
        ),
        3, // max retries
        2000, // initial retry delay (2 seconds)
      );

      // Mark code as used immediately after successful exchange
      this.usedCodes.add(code);
      
      const accessToken = tokenResponse.data.access_token;
      this.logger.debug('Successfully obtained access token');

      // Debug: Check token permissions (optional, for debugging)
      try {
        const debugResponse = await axios.get(
          `https://graph.facebook.com/v${this.metaApiVersion}/debug_token`,
          {
            params: {
              input_token: accessToken,
              access_token: `${this.metaAppId}|${this.metaAppSecret}`, // App access token
            },
          },
        );
        this.logger.debug('Token debug info:', JSON.stringify(debugResponse.data.data, null, 2));
      } catch (debugError) {
        this.logger.warn('Failed to debug token:', debugError.message);
      }

      // Get WABA accounts directly from user (only method - no business_management needed)
      let wabaId: string | null = null;
      
      try {
        const directWabaResponse = await this.axiosWithRetry(
          () => axios.get(
            `https://graph.facebook.com/v${this.metaApiVersion}/me/owned_whatsapp_business_accounts`,
            {
              timeout: 60000,
              headers: { Authorization: `Bearer ${accessToken}` },
              params: {
                fields: 'id,name',
              },
            },
          ),
        );

        if (directWabaResponse.data.data && directWabaResponse.data.data.length > 0) {
          wabaId = directWabaResponse.data.data[0].id;
          this.logger.debug(`Found WABA directly: ${wabaId}`);
        } else {
          throw new BadRequestException(
            'No WhatsApp Business Accounts found. ' +
            'Please ensure you completed the Embedded Signup flow and created/selected a WhatsApp Business Account. ' +
            'If your WABA is managed through Facebook Business Manager, you may need to ensure you have direct access or contact your Business Manager admin.'
          );
        }
      } catch (directError: any) {
        const errorMsg = directError.response?.data?.error?.message || directError.message;
        const errorCode = directError.response?.data?.error?.code;
        
        this.logger.error('Direct WABA access failed:', {
          error: errorMsg,
          code: errorCode,
          response: directError.response?.data,
        });

        // Handle specific error codes
        if (errorCode === 100) {
          // Error 100: Field doesn't exist on User node - user doesn't have WABA directly accessible
          // This means the user either doesn't have a WABA or didn't complete Embedded Signup properly
          throw new BadRequestException(
            'Your Facebook account does not have direct access to a WhatsApp Business Account. ' +
            'This usually means you need to create a WABA or ensure it\'s directly accessible.\n\n' +
            'IMPORTANT: When connecting via Embedded Signup, you MUST:\n' +
            '1. Complete the ENTIRE Embedded Signup flow (don\'t just authorize permissions)\n' +
            '2. Create or select a WhatsApp Business Account during the flow\n' +
            '3. Accept all terms and conditions\n' +
            '4. Complete phone number verification if prompted\n\n' +
            'If you already have a WABA in Business Manager:\n' +
            '1. Go to https://business.facebook.com/\n' +
            '2. Navigate to Business Settings > Accounts > WhatsApp Accounts\n' +
            '3. Ensure your personal Facebook account has Admin access to the WABA\n' +
            '4. Or create a new WABA directly under your personal account\n\n' +
            'Then try connecting again.'
          );
        }

        if (errorCode === 200 || errorMsg?.includes('permission') || errorMsg?.includes('business_management')) {
          throw new BadRequestException(
            'Unable to access WhatsApp Business Account. ' +
            'Please ensure:\n' +
            '1. Your WhatsApp Business Account is directly accessible to your Facebook account\n' +
            '2. You have granted whatsapp_business_management permission during OAuth\n' +
            '3. If your WABA is in Business Manager, ensure you have direct access or ask your admin to grant you access\n' +
            '4. Try disconnecting and reconnecting your WABA account'
          );
        }

        throw new BadRequestException(
          `Failed to access WhatsApp Business Account: ${errorMsg || 'Unknown error'}. ` +
          'Please ensure your WABA is directly accessible to your Facebook account. ' +
          'If you don\'t have a WABA yet, you can create one during the Embedded Signup flow.'
        );
      }

      if (!wabaId) {
        throw new BadRequestException(
          'No WhatsApp Business Account found. ' +
          'Please ensure you have a WhatsApp Business Account that is directly accessible to your Facebook account.'
        );
      }

      // Get phone numbers
      const phoneResponse = await this.axiosWithRetry(
        () => axios.get(
          `https://graph.facebook.com/v${this.metaApiVersion}/${wabaId}/phone_numbers`,
          {
            timeout: 60000,
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        ),
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
        await this.axiosWithRetry(
          () => axios.post(
            `https://graph.facebook.com/v${this.metaApiVersion}/${this.metaAppId}/subscriptions`,
            {
              object: 'whatsapp_business_account',
              callback_url: webhookUrl,
              verify_token: verifyToken,
              fields: ['messages', 'message_status'],
            },
            {
              timeout: 60000,
              params: {
                access_token: `${this.metaAppId}|${this.metaAppSecret}`, // App Access Token
              },
            },
          ),
        );
        this.logger.log('App-level webhook subscription registered successfully');
      } catch (appError) {
        this.logger.warn(
          `App-level subscription failed (this is often expected), trying WABA-level: ${appError.message}`,
        );
      }

      // 2. Subscribe WABA to app (WABA-level subscription)
      try {
        await this.axiosWithRetry(
          () => axios.post(
            `https://graph.facebook.com/v${this.metaApiVersion}/${wabaId}/subscribed_apps`,
            {
              subscribed_fields: ['messages', 'message_status'],
            },
            {
              timeout: 60000,
              headers: { Authorization: `Bearer ${accessToken}` },
              params: {
                access_token: accessToken,
              },
            },
          ),
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

