import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('stats')
  async getStats(@Query('wabaAccountId') wabaAccountId: string) {
    if (!wabaAccountId) {
      throw new Error('wabaAccountId is required');
    }
    return this.dashboardService.getStats(wabaAccountId);
  }
}

