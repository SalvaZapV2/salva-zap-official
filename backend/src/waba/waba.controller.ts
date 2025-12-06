import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { WabaService } from './waba.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('waba')
@UseGuards(JwtAuthGuard)
export class WabaController {
  constructor(private wabaService: WabaService) {}

  @Get('embedded/start')
  async startEmbeddedSignup(@CurrentUser() user: any, @Query('shopId') shopId: string) {
    const url = await this.wabaService.getEmbeddedSignupUrl(shopId || user.id);
    return { url };
  }

  @Get('embedded/callback')
  async handleCallback(@Query('code') code: string, @Query('state') state: string) {
    if (!code) {
      return { error: 'Missing authorization code' };
    }
    const result = await this.wabaService.handleCallback(code, state);
    return result;
  }
}

