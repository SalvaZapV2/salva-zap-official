import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignCostService } from './campaign-cost.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { IsString, IsArray, IsOptional } from 'class-validator';

class CreateCampaignDto {
  @IsString()
  wabaAccountId: string;

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsArray()
  contactNumbers: string[];
}

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(
    private campaignsService: CampaignsService,
    private campaignCostService: CampaignCostService,
  ) {}

  @Post()
  async create(@Body() createCampaignDto: CreateCampaignDto) {
    return this.campaignsService.create(
      createCampaignDto.wabaAccountId,
      createCampaignDto.templateId || null,
      createCampaignDto.contactNumbers,
    );
  }

  @Get()
  async findAll(@Query('wabaAccountId') wabaAccountId: string) {
    return this.campaignsService.findAll(wabaAccountId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(id);
  }

  @Get('cost')
  async calculateCost(
    @Query('templateId') templateId: string | null,
    @Query('contactCount') contactCount: string,
  ) {
    const count = parseInt(contactCount, 10);
    if (isNaN(count) || count < 1) {
      throw new Error('Invalid contact count');
    }
    return this.campaignCostService.calculateCost(templateId || null, count);
  }
}

