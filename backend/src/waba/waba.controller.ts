import { Controller, Get, Query, UseGuards, Post, Param, Delete } from '@nestjs/common';
import { WabaService } from './waba.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('waba')
@UseGuards(JwtAuthGuard)
export class WabaController {
  constructor(private wabaService: WabaService) {}

  @Get('embedded/start')
  async startEmbeddedSignup(
    @CurrentUser() user: any,
    @Query('shopId') shopId: string,
    @Query('connectionType') connectionType: 'new' | 'existing' = 'new',
  ) {
    const url = await this.wabaService.getEmbeddedSignupUrl(
      shopId || user.id,
      connectionType,
    );
    return { url };
  }

  @Get('embedded/callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    if (!code) {
      return { error: 'Missing authorization code' };
    }
    const result = await this.wabaService.handleCallback(code, state);
    return result;
  }

  @Post(':id/webhook/register')
  async registerWebhook(@Param('id') id: string) {
    // Register webhook for the specified WABA account id
    await this.wabaService.registerWebhookForAccount(id);
    // Return simple success object
    return { success: true };
  }

  @Post(':id/refresh')
  async refreshToken(@Param('id') id: string) {
    // Refresh the access token for the WABA account
    const result = await this.wabaService.refreshTokenForAccount(id);
    return result;
  }

  @Post(':id/sync-phone-numbers')
  async syncPhoneNumbers(@Param('id') id: string) {
    // Sync phone numbers from Meta for the WABA account
    const result = await this.wabaService.syncPhoneNumbersForAccount(id);
    return result;
  }

  @Delete(':id')
  async disconnect(@Param('id') id: string) {
    // Disconnect (delete) the WABA account
    await this.wabaService.disconnectAccount(id);
    return { success: true, message: 'WABA account disconnected successfully' };
  }
}
