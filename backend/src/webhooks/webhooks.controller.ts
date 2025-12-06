import { Controller, Get, Post, Body, Req, Res, Param, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('webhooks')
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Get('meta')
  verifyWebhook(@Req() req: Request, @Res() res: Response) {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    const result = this.webhooksService.verifyChallenge(mode, token, challenge);

    if (result) {
      return res.status(200).send(challenge);
    } else {
      return res.status(403).send('Forbidden');
    }
  }

  @Post('meta')
  async handleWebhook(@Req() req: Request, @Res() res: Response) {
    const signature = req.headers['x-hub-signature-256'] as string;
    
    // Get raw body from request (stored by middleware) or fallback to stringified body
    let rawBody: string;
    if ((req as any).rawBody) {
      rawBody = (req as any).rawBody;
    } else {
      // Fallback: reconstruct from parsed body (less secure but works)
      rawBody = JSON.stringify(req.body);
    }

    // Verify signature
    if (!this.webhooksService.verifySignature(signature, rawBody)) {
      return res.status(401).send('Unauthorized');
    }

    // Extract WABA ID from payload
    const entry = req.body.entry?.[0];
    const wabaId = entry?.id || req.body.object?.id;

    if (!wabaId) {
      return res.status(400).send('Missing WABA ID');
    }

    // Process asynchronously
    this.webhooksService.processWebhookEvent(wabaId, req.body, req.headers).catch(console.error);

    // Respond immediately
    return res.status(200).send('OK');
  }

  @Post('replay/:eventId')
  @UseGuards(JwtAuthGuard)
  async replayEvent(@Param('eventId') eventId: string) {
    return this.webhooksService.replayEvent(eventId);
  }
}

