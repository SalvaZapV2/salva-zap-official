import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  wabaAccountId: string;

  @IsString()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsString()
  @IsOptional()
  clientMessageId?: string;
}

class SendTemplateDto {
  @IsString()
  @IsNotEmpty()
  wabaAccountId: string;

  @IsString()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsNotEmpty()
  templateName: string;

  @IsString()
  @IsNotEmpty()
  language: string;

  @IsArray()
  @IsOptional()
  parameters?: string[];

  @IsString()
  @IsOptional()
  clientMessageId?: string;
}

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Post('send')
  async sendMessage(@Body() sendMessageDto: SendMessageDto) {
    return this.messagesService.sendMessage(
      sendMessageDto.wabaAccountId,
      sendMessageDto.to,
      sendMessageDto.body,
      sendMessageDto.clientMessageId,
    );
  }

  @Post('template')
  async sendTemplate(@Body() sendTemplateDto: SendTemplateDto) {
    return this.messagesService.sendTemplateMessage(
      sendTemplateDto.wabaAccountId,
      sendTemplateDto.to,
      sendTemplateDto.templateName,
      sendTemplateDto.language,
      sendTemplateDto.parameters,
      sendTemplateDto.clientMessageId,
    );
  }
}

