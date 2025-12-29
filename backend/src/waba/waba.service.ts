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
      configService.get<string>('META_API_VERSION') || 'v21.0';
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
    // Use environment variable instead of hardcoded URL
    const redirectUri = this.frontendCallbackUrl || 'http://localhost:3001/onboarding/callback';

    // Include business_management so the Embedded Signup flow can create/select a WABA
    const scopes = [
      'whatsapp_business_messaging',
      'whatsapp_business_management',
      'business_management',
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
                  fields: 'id,name',
                },
              },
            ),
          );

          if (wabaInfoResponse.data && wabaInfoResponse.data.id) {
            wabaId = wabaInfoResponse.data.id;
            this.logger.debug(
              `Found WABA using ID from token granular scopes: ${wabaId}`,
            );
          }
        } catch (wabaIdError: any) {
          this.logger.warn(
            `Failed to access WABA using ID from token: ${wabaIdError.message}`,
          );
        }
      }

      // Method 2: Try accessing through Business Manager if we have business_management permission
      if (!wabaId && businessIds.length > 0) {
        this.logger.debug(
          `Attempting to access WABAs through Business Manager: ${businessIds[0]}`,
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
            this.logger.debug(`Found WABA through Business Manager: ${wabaId}`);
          }
        } catch (businessError: any) {
          this.logger.warn(
            `Failed to access WABA through Business Manager: ${businessError.message}`,
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
                  '1. Se sua WABA está no Business Manager:\n' +
                  '   - Acesse https://business.facebook.com/\n' +
                  '   - Vá em Configurações da Empresa > Contas > Contas do WhatsApp\n' +
                  '   - Certifique-se de que sua conta pessoal do Facebook tem acesso Admin à WABA\n' +
                  '   - Ou remova a WABA do Business Manager e conecte-a diretamente à sua conta pessoal\n\n' +
                  '2. Se você não tem uma WABA diretamente acessível:\n' +
                  '   - Crie uma nova WABA em https://business.facebook.com/\n' +
                  '   - Ou use a opção "Criar nova WABA" na tela de conexão\n\n' +
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
            errorMsg?.includes('permission') ||
            errorMsg?.includes('business_management')
          ) {
            throw new BadRequestException(
              'Unable to access WhatsApp Business Account. ' +
                'Please ensure:\n' +
                '1. Your WhatsApp Business Account is directly accessible to your Facebook account\n' +
                '2. You have granted whatsapp_business_management permission during OAuth\n' +
                '3. If your WABA is in Business Manager, ensure you have direct access or ask your admin to grant you access\n' +
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
              headers: { Authorization: `Bearer ${accessToken}`