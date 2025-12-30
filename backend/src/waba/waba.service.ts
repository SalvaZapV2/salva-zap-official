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
    this.metaApiVersion =
      configService.get<string>('META_API_VERSION') || '21.0';
    this.metaAppId = configService.get<string>('META_APP_ID') || '';
    this.metaAppSecret = configService.get<string>('META_APP_SECRET') || '';
    this.frontendCallbackUrl =
      configService.get<string>('FRONTEND_CALLBACK_URL') || '';

    if (!this.metaAppId || !this.metaAppSecret) {
      this.logger.warn('META_APP_ID or META_APP_SECRET not configured');
    }
  }

  async getEmbeddedSignupUrl(
    shopId: string,
    connectionType: 'new' | 'existing' = 'new',
    state?: string,
  ): Promise<string> {
    // Use environment variable for production - localhost is only for local development
    const redirectUri = this.frontendCallbackUrl || 'http://localhost:3001/onboarding/callback';

    // Request only required permissions per stage1_requirements.txt
    // business_management is NOT required, but we try to use it as fallback if available
    const scopes = [
      'whatsapp_business_messaging',
      'whatsapp_business_management',
      // Note: business_management is optional - we handle gracefully if not granted
    ].join(',');

    // Request re-consent and explicit prompt so Meta shows the Embedded Signup UI when needed
    const params = new URLSearchParams();
    params.append('client_id', this.metaAppId);
    params.append('redirect_uri', redirectUri);
    params.append('scope', scopes);
    params.append('state', state || `${shopId}:${connectionType}`);
    params.append('response_type', 'code');
    params.append('auth_type', 'rerequest');
    params.append('prompt', 'consent');
    params.append('display', 'page');

    const url = `https://www.facebook.com/v${this.metaApiVersion}/dialog/oauth?${params.toString()}`;

    this.logger.debug(
      `Generated OAuth URL with redirect_uri: ${redirectUri}, connectionType: ${connectionType}`,
    );
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
          { error: error.message, code: error.code },
        );

        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * attempt),
        );
      }
    }

    throw lastError;
  }

  async handleCallback(code: string, state: string) {
    this.logger.log(`Processing WABA callback for shop ${state}`);

    // Parse state param (expected format: "<shopId>:<connectionType>")
    const parts = (state || '').split(':');
    const shopId = parts[0] || state || null;
    const connectionType = (parts[1] as 'new' | 'existing') || 'new';

    // Validate shop exists (shopId is required to link the WABA to an existing Shop)
    if (!shopId) {
      this.logger.warn('Missing shopId in state parameter');
      throw new BadRequestException(
        'Missing shop identifier in OAuth state parameter. Please start the connection from the onboarding page.',
      );
    }

    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      this.logger.warn(`Shop not found: ${shopId}`);
      throw new BadRequestException(
        'Invalid shop identifier. Please select a valid shop and try again.',
      );
    }

    // Check if code was already used
    if (this.usedCodes.has(code)) {
      this.logger.warn(`Authorization code ${code} was already used`);
      throw new BadRequestException(
        'This authorization code has already been used. Please initiate a new connection from the onboarding page.',
      );
    }

    try {
      // Exchange code for access token
      // Use environment variable instead of hardcoded URL
      const redirectUri = this.frontendCallbackUrl || 'http://localhost:3001/onboarding/callback';

      this.logger.debug(
        `Exchanging authorization code for access token (redirect_uri: ${redirectUri})`,
      );

      const axiosConfig = {
        timeout: 60000, // 60 second timeout
      };

      const tokenResponse = await this.axiosWithRetry(
        () =>
          axios.get(
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

      // Obtain access token (short-lived)
      let accessToken = tokenResponse.data.access_token;
      let tokenExpiresAt: Date | null = null;
      this.logger.debug('Successfully obtained access token');

      // Try to exchange the short-lived token for a long-lived token (recommended)
      try {
        const exchangeResp = await this.axiosWithRetry(() =>
          axios.get(
            `https://graph.facebook.com/v${this.metaApiVersion}/oauth/access_token`,
            {
              timeout: 60000,
              params: {
                grant_type: 'fb_exchange_token',
                client_id: this.metaAppId,
                client_secret: this.metaAppSecret,
                fb_exchange_token: accessToken,
              },
            },
          ),
        );

        if (exchangeResp.data && exchangeResp.data.access_token) {
          accessToken = exchangeResp.data.access_token;
          if (exchangeResp.data.expires_in) {
            tokenExpiresAt = new Date(
              Date.now() + exchangeResp.data.expires_in * 1000,
            );
          }
          this.logger.debug(
            `Exchanged token for long-lived token (expires_in=${exchangeResp.data.expires_in})`,
          );
        }
      } catch (exchangeError: any) {
        this.logger.warn(
          'Failed to exchange token for long-lived token:',
          exchangeError.message || exchangeError,
        );
      }

      // Get token debug info to extract WABA IDs from granular scopes
      let tokenDebugInfo: any = null;
      let wabaIdsFromToken: string[] = [];
      let businessIds: string[] = [];

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
        tokenDebugInfo = debugResponse.data.data;
        this.logger.debug(
          'Token debug info:',
          JSON.stringify(tokenDebugInfo, null, 2),
        );

        // Extract WABA IDs from granular_scopes
        if (tokenDebugInfo?.granular_scopes) {
          for (const scope of tokenDebugInfo.granular_scopes) {
            if (
              scope.scope === 'whatsapp_business_management' &&
              scope.target_ids
            ) {
              wabaIdsFromToken = scope.target_ids;
              this.logger.debug(
                `Found WABA IDs from token: ${wabaIdsFromToken.join(', ')}`,
              );
            }
            if (scope.scope === 'business_management' && scope.target_ids) {
              businessIds = scope.target_ids;
              this.logger.debug(
                `Found Business IDs from token: ${businessIds.join(', ')}`,
              );
            }
          }
        }
      } catch (debugError) {
        this.logger.warn('Failed to debug token:', debugError.message);
      }

      // Get WABA accounts - try multiple methods
      let wabaId: string | null = null;

      // Method 1: Try to use WABA IDs directly from token granular scopes
      if (wabaIdsFromToken.length > 0) {
        this.logger.debug(
          `Attempting to use WABA IDs from token granular scopes: ${wabaIdsFromToken[0]}`,
        );
        try {
          // Try to get WABA info directly using the ID from granular scopes
          const wabaInfoResponse = await this.axiosWithRetry(() =>
            axios.get(
              `https://graph.facebook.com/v${this.metaApiVersion}/${wabaIdsFromToken[0]}`,
              {
                timeout: 60000,
                headers: { Authorization: `Bearer ${accessToken}` },
                params: {
                  fields: 'id,name,business',
                },
              },
            ),
          );

          if (wabaInfoResponse.data && wabaInfoResponse.data.id) {
            wabaId = wabaInfoResponse.data.id;
            this.logger.debug(
              `Found WABA using ID from token granular scopes: ${wabaId}`,
            );
            // Extract Business ID from WABA if available
            if (wabaInfoResponse.data.business?.id) {
              businessIds = [wabaInfoResponse.data.business.id];
              this.logger.debug(
                `Found Business ID from WABA: ${businessIds[0]}`,
              );
            }
          }
        } catch (wabaIdError: any) {
          this.logger.warn(
            `Failed to access WABA using ID from token: ${wabaIdError.message}`,
          );
        }
      }

      // Method 2: Try accessing through Business ID if available (optional fallback)
      // Note: business_management permission is NOT required per Stage 1 requirements
      // This is only used if the token happens to include business_management scope
      if (!wabaId && businessIds.length > 0) {
        this.logger.debug(
          `Attempting to access WABAs via Business ID (optional fallback): ${businessIds[0]}`,
        );
        try {
          const businessWabaResponse = await this.axiosWithRetry(() =>
            axios.get(
              `https://graph.facebook.com/v${this.metaApiVersion}/${businessIds[0]}/owned_whatsapp_business_accounts`,
              {
                timeout: 60000,
                headers: { Authorization: `Bearer ${accessToken}` },
                params: {
                  fields: 'id,name',
                },
              },
            ),
          );

          if (
            businessWabaResponse.data.data &&
            businessWabaResponse.data.data.length > 0
          ) {
            wabaId = businessWabaResponse.data.data[0].id;
            this.logger.debug(`Found WABA via Business ID fallback: ${wabaId}`);
          }
        } catch (businessError: any) {
          // Silently fail - this is an optional fallback method
          this.logger.debug(
            `Optional Business ID fallback failed (expected if business_management not granted): ${businessError.message}`,
          );
        }
      }

      // Method 3: Try direct access via /me/owned_whatsapp_business_accounts (original method)
      if (!wabaId) {
        try {
          const directWabaResponse = await this.axiosWithRetry(() =>
            axios.get(
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

          if (
            directWabaResponse.data.data &&
            directWabaResponse.data.data.length > 0
          ) {
            wabaId = directWabaResponse.data.data[0].id;
            this.logger.debug(`Found WABA directly: ${wabaId}`);
          }
        } catch (directError: any) {
          const errorMsg =
            directError.response?.data?.error?.message || directError.message;
          const errorCode = directError.response?.data?.error?.code;

          this.logger.error('Direct WABA access failed:', {
            error: errorMsg,
            code: errorCode,
            response: directError.response?.data,
          });

          // Handle specific error codes
          if (errorCode === 100) {
            // Extract connection type from state if available
            const connectionType = state?.includes(':')
              ? state.split(':')[1]
              : 'new';
            const shopIdFromState = state?.includes(':')
              ? state.split(':')[0]
              : state;

            if (connectionType === 'existing') {
              throw new BadRequestException(
                'Não foi possível acessar sua WABA existente.\n\n' +
                  'SOLUÇÃO: Certifique-se de que sua WABA está diretamente acessível à sua conta pessoal do Facebook:\n\n' +
                  '1. Acesse https://business.facebook.com/\n' +
                  '2. Vá em Configurações da Empresa > Contas > Contas do WhatsApp\n' +
                  '3. Certifique-se de que sua conta pessoal do Facebook tem acesso direto à WABA\n' +
                  '4. Ou use a opção "Criar nova WABA" na tela de conexão para criar uma nova conta\n\n' +
                  'Depois, tente conectar novamente.',
              );
            } else {
              // For 'new' connections, instead of throwing an error, guide the frontend to
              // continue the Embedded Signup flow. Return an object indicating the frontend
              // should re-open the signup URL to let the user complete creation.
              const signupUrl = await this.getEmbeddedSignupUrl(
                shopIdFromState || state,
                'new',
              );

              this.logger.log(
                'User needs to complete Embedded Signup flow; returning actionable response',
              );

              return {
                needsEmbeddedSignup: true,
                message:
                  'Sua conta do Facebook não tem acesso direto a uma Conta WhatsApp Business. ' +
                  'Por favor, complete o processo de Cadastro Incorporado do Meta para criar uma nova WABA.',
                signupUrl,
              };
            }
          }

          if (
            errorCode === 200 ||
            errorMsg?.includes('permission')
          ) {
            throw new BadRequestException(
              'Unable to access WhatsApp Business Account. ' +
                'Please ensure:\n' +
                '1. Your WhatsApp Business Account is directly accessible to your Facebook account\n' +
                '2. You have granted whatsapp_business_management and whatsapp_business_messaging permissions during OAuth\n' +
                '3. Complete the Embedded Signup flow if creating a new WABA\n' +
                '4. Try disconnecting and reconnecting your WABA account',
            );
          }

          throw new BadRequestException(
            `Failed to access WhatsApp Business Account: ${errorMsg || 'Unknown error'}. ` +
              'Please ensure your WABA is directly accessible to your Facebook account. ' +
              "If you don't have a WABA yet, you can create one during the Embedded Signup flow.",
          );
        }
      }

      if (!wabaId) {
        throw new BadRequestException(
          'No WhatsApp Business Account found. ' +
            'Please ensure you have a WhatsApp Business Account that is directly accessible to your Facebook account.',
        );
      }

      // Get WABA details including Business ID if not already found
      let businessId: string | null = null;
      let messagingEnabled = false;
      
      if (businessIds.length > 0) {
        businessId = businessIds[0];
        messagingEnabled = true; // If we have businessId, messaging is enabled
        this.logger.debug(
          `Using Business ID from token: ${businessId}`,
        );
      } else {
        // Try to get Business ID from WABA account details
        try {
          const wabaDetailsResponse = await this.axiosWithRetry(() =>
            axios.get(
              `https://graph.facebook.com/v${this.metaApiVersion}/${wabaId}`,
              {
                timeout: 60000,
                headers: { Authorization: `Bearer ${accessToken}` },
                params: {
                  fields: 'id,name,business,message_templates',
                },
              },
            ),
          );

          if (wabaDetailsResponse.data?.business?.id) {
            businessId = wabaDetailsResponse.data.business.id;
            this.logger.debug(
              `Found Business ID from WABA details: ${businessId}`,
            );
          }

          // Check if messaging is enabled (WABA exists and has access)
          if (wabaDetailsResponse.data?.id) {
            messagingEnabled = true;
            this.logger.debug(`Messaging enabled for WABA ${wabaId}`);
          }
        } catch (wabaDetailsError: any) {
          this.logger.warn(
            `Failed to fetch WABA details: ${wabaDetailsError.message}`,
          );
          // Continue anyway - messaging might still work
          messagingEnabled = true; // Assume enabled if WABA exists
        }
      }

      // Get phone numbers
      let phoneId: string | null = null;
      let displayNumber: string | null = null;
      let hasPhoneNumbers = false;

      try {
        const phoneResponse = await this.axiosWithRetry(() =>
          axios.get(
            `https://graph.facebook.com/v${this.metaApiVersion}/${wabaId}/phone_numbers`,
            {
              timeout: 60000,
              headers: { Authorization: `Bearer ${accessToken}` },
            },
          ),
        );

        if (phoneResponse.data.data && phoneResponse.data.data.length > 0) {
          phoneId = phoneResponse.data.data[0].id;
          displayNumber =
            phoneResponse.data.data[0].display_phone_number ||
            phoneResponse.data.data[0].verified_name ||
            phoneResponse.data.data[0].id;
          hasPhoneNumbers = true;
          this.logger.debug(
            `Found phone number: ${displayNumber} (ID: ${phoneId})`,
          );
        } else {
          this.logger.warn(
            `No phone numbers found in WABA ${wabaId}. WABA will be saved but user needs to add phone numbers.`,
          );
        }
      } catch (phoneError: any) {
        this.logger.warn(
          `Failed to fetch phone numbers for WABA ${wabaId}:`,
          phoneError.message,
        );
        // Continue without phone numbers - user can add them later
      }

      // If no phone numbers found, use placeholder values
      if (!hasPhoneNumbers) {
        phoneId = `pending-${wabaId}`;
        displayNumber = 'No phone number - Add one in Meta Business Manager';
        this.logger.log(
          `WABA ${wabaId} connected without phone numbers. User needs to add phone numbers via Meta Business Manager.`,
        );
      }

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
            shopId: shopId,
            businessId: businessId || null,
            phoneId,
            displayNumber,
            encryptedToken,
            tokenExpiresAt: tokenExpiresAt || null,
            messagingEnabled: messagingEnabled || hasPhoneNumbers, // Enable if we have phone numbers
          },
        });
      } else {
        wabaAccount = await this.prisma.wabaAccount.create({
          data: {
            shopId: shopId,
            wabaId,
            businessId: businessId || null,
            phoneId,
            displayNumber,
            encryptedToken,
            tokenExpiresAt: tokenExpiresAt || null,
            messagingEnabled: messagingEnabled || hasPhoneNumbers, // Enable if we have phone numbers
          },
        });
      }

      // Register webhook (async, don't wait)
      this.registerWebhook(wabaId, accessToken).catch((err) => {
        this.logger.error(
          `Failed to register webhook for WABA ${wabaId}:`,
          err,
        );
      });

      this.logger.log(
        `Successfully connected WABA ${wabaId} for shop ${shopId}${hasPhoneNumbers ? '' : ' (no phone numbers - user needs to add them)'}`,
      );

      // Get shop name for user feedback
      const shop = await this.prisma.shop.findUnique({
        where: { id: shopId },
        select: { name: true },
      });

      return {
        wabaId: wabaAccount.wabaId,
        businessId: wabaAccount.businessId,
        phoneId: wabaAccount.phoneId,
        displayNumber: wabaAccount.displayNumber,
        webhookVerified: wabaAccount.webhookVerified,
        messagingEnabled: wabaAccount.messagingEnabled,
        hasPhoneNumbers,
        needsPhoneNumber: !hasPhoneNumbers,
        shopName: shop?.name || 'Unknown Shop',
        shopId: shopId,
      };
    } catch (error: any) {
      // Mark code as unused if we failed before using it
      this.usedCodes.delete(code);

      const errorMsg =
        error.response?.data?.error?.message || error.message || 'Unknown error';
      const errorCode = error.response?.data?.error?.code;

      this.logger.error(`WABA callback failed for shop ${state}`, {
        error: errorMsg,
        code: errorCode,
        response: error.response?.data,
        stack: error.stack,
      });

      throw new BadRequestException(
        `Failed to process WABA connection: ${errorMsg}`,
      );
    }
  }

  /**
   * Register webhook for a WABA account
   */
  private async registerWebhook(wabaId: string, accessToken: string) {
    try {
      // Subscribe to webhook fields for the WABA
      // Note: callback_url and verify_token are configured in Facebook Developer Console, not via API
      const response = await axios.post(
        `https://graph.facebook.com/v${this.metaApiVersion}/${wabaId}/subscribed_apps`,
        {
          subscribed_fields: ['messages', 'message_template_status_update'],
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: {
            access_token: accessToken,
          },
        },
      );

      // Update webhook verified status in database
      await this.prisma.wabaAccount.update({
        where: { wabaId },
        data: { webhookVerified: true },
      });

      this.logger.log(`Webhook registered successfully for WABA ${wabaId}`);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      this.logger.error(
        `Failed to register webhook for WABA ${wabaId}:`,
        error.response?.data || error.message,
      );
      // Don't throw - webhook registration failure shouldn't break the connection flow
      // The webhook can be registered later via the UI
    }
  }

  /**
   * Register webhook for a WABA account by account ID
   */
  async registerWebhookForAccount(accountId: string) {
    // Find the WABA account by ID
    const wabaAccount = await this.prisma.wabaAccount.findUnique({
      where: { id: accountId },
    });

    if (!wabaAccount) {
      throw new BadRequestException(`WABA account not found: ${accountId}`);
    }

    // Decrypt the access token
    const accessToken = EncryptionUtil.decrypt(wabaAccount.encryptedToken);

    // Register the webhook
    await this.registerWebhook(wabaAccount.wabaId, accessToken);
  }

  /**
   * Refresh access token for a WABA account
   */
  async refreshTokenForAccount(accountId: string) {
    const wabaAccount = await this.prisma.wabaAccount.findUnique({
      where: { id: accountId },
    });

    if (!wabaAccount) {
      throw new BadRequestException(`WABA account not found: ${accountId}`);
    }

    // Decrypt the current token
    const currentToken = EncryptionUtil.decrypt(wabaAccount.encryptedToken);

    try {
      // Exchange for long-lived token
      const exchangeResp = await axios.get(
        `https://graph.facebook.com/v${this.metaApiVersion}/oauth/access_token`,
        {
          timeout: 60000,
          params: {
            grant_type: 'fb_exchange_token',
            client_id: this.metaAppId,
            client_secret: this.metaAppSecret,
            fb_exchange_token: currentToken,
          },
        },
      );

      if (exchangeResp.data && exchangeResp.data.access_token) {
        const newToken = exchangeResp.data.access_token;
        const encryptedToken = EncryptionUtil.encrypt(newToken);
        
        let tokenExpiresAt: Date | null = null;
        if (exchangeResp.data.expires_in) {
          tokenExpiresAt = new Date(
            Date.now() + exchangeResp.data.expires_in * 1000,
          );
        }

        // Update in database
        const updated = await this.prisma.wabaAccount.update({
          where: { id: accountId },
          data: {
            encryptedToken,
            tokenExpiresAt,
          },
        });

        return {
          id: updated.id,
          wabaId: updated.wabaId,
          tokenExpiresAt: updated.tokenExpiresAt,
        };
      }

      throw new BadRequestException('Failed to refresh token: No access token in response');
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      this.logger.error(`Failed to refresh token for account ${accountId}:`, errorMsg);
      throw new BadRequestException(`Failed to refresh token: ${errorMsg}`);
    }
  }

  /**
   * Sync phone numbers from Meta for a WABA account
   */
  async syncPhoneNumbersForAccount(accountId: string) {
    const wabaAccount = await this.prisma.wabaAccount.findUnique({
      where: { id: accountId },
    });

    if (!wabaAccount) {
      throw new BadRequestException(`WABA account not found: ${accountId}`);
    }

    // Decrypt the access token
    const accessToken = EncryptionUtil.decrypt(wabaAccount.encryptedToken);

    try {
      // Fetch phone numbers from Meta
      const phoneResponse = await this.axiosWithRetry(() =>
        axios.get(
          `https://graph.facebook.com/v${this.metaApiVersion}/${wabaAccount.wabaId}/phone_numbers`,
          {
            timeout: 60000,
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        ),
      );

      let phoneId: string | null = null;
      let displayNumber: string | null = null;
      let hasPhoneNumbers = false;

      if (phoneResponse.data.data && phoneResponse.data.data.length > 0) {
        phoneId = phoneResponse.data.data[0].id;
        displayNumber =
          phoneResponse.data.data[0].display_phone_number ||
          phoneResponse.data.data[0].verified_name ||
          phoneResponse.data.data[0].id;
        hasPhoneNumbers = true;
        this.logger.debug(
          `Synced phone number: ${displayNumber} (ID: ${phoneId}) for WABA ${wabaAccount.wabaId}`,
        );
      } else {
        // No phone numbers found
        phoneId = `pending-${wabaAccount.wabaId}`;
        displayNumber = 'No phone number - Add one in Meta Business Manager';
        this.logger.warn(
          `No phone numbers found when syncing for WABA ${wabaAccount.wabaId}`,
        );
      }

      // Update the account with latest phone number info
      const updated = await this.prisma.wabaAccount.update({
        where: { id: accountId },
        data: {
          phoneId,
          displayNumber,
        },
      });

      return {
        id: updated.id,
        wabaId: updated.wabaId,
        phoneId: updated.phoneId,
        displayNumber: updated.displayNumber,
        hasPhoneNumbers,
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      this.logger.error(
        `Failed to sync phone numbers for account ${accountId}:`,
        errorMsg,
      );
      throw new BadRequestException(
        `Failed to sync phone numbers: ${errorMsg}`,
      );
    }
  }

  /**
   * Disconnect (delete) a WABA account
   */
  async disconnectAccount(accountId: string) {
    const wabaAccount = await this.prisma.wabaAccount.findUnique({
      where: { id: accountId },
    });

    if (!wabaAccount) {
      throw new BadRequestException(`WABA account not found: ${accountId}`);
    }

    // Delete the WABA account (cascade will delete related records)
    await this.prisma.wabaAccount.delete({
      where: { id: accountId },
    });

    this.logger.log(
      `WABA account ${accountId} (WABA ID: ${wabaAccount.wabaId}) disconnected successfully`,
    );

    return { success: true };
  }
}