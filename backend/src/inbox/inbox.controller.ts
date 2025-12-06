import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { InboxService } from './inbox.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('inbox')
@UseGuards(JwtAuthGuard)
export class InboxController {
  constructor(private inboxService: InboxService) {}

  @Get('conversations')
  async getConversations(
    @Query('wabaAccountId') wabaAccountId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    return this.inboxService.getConversations(
      wabaAccountId,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Get('conversations/:id')
  async getConversationMessages(
    @Param('id') id: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    return this.inboxService.getConversationMessages(id, parseInt(page), parseInt(limit));
  }
}

