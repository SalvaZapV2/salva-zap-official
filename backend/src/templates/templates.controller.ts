import { Controller, Get, Post, Body, Param, Patch, UseGuards, Query } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

class SubmitTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  language: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsOptional()
  @IsArray()
  components?: any[];
}

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private templatesService: TemplatesService) {}

  @Get()
  async findAll(@Query('wabaAccountId') wabaAccountId: string) {
    return this.templatesService.findAll(wabaAccountId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Post('submit')
  async submitTemplate(@Body() submitTemplateDto: SubmitTemplateDto, @Query('wabaAccountId') wabaAccountId: string) {
    return this.templatesService.submitTemplate(wabaAccountId, submitTemplateDto);
  }

  @Patch(':id')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; history?: any },
  ) {
    return this.templatesService.updateStatus(id, body.status, body.history);
  }
}

