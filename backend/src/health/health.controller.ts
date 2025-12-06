import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private healthService: HealthService) {}

  @Get('health')
  async getHealth() {
    return this.healthService.getHealth();
  }

  @Get('metrics')
  async getMetrics() {
    return this.healthService.getMetrics();
  }
}

