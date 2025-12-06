import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to capture raw body for webhook signature verification
 * This must be applied before JSON body parsing
 */
@Injectable()
export class WebhookRawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Only for webhook POST endpoint
    if (req.path === '/webhooks/meta' && req.method === 'POST') {
      let rawBody = '';
      
      req.setEncoding('utf8');
      req.on('data', (chunk) => {
        rawBody += chunk;
      });
      
      req.on('end', () => {
        // Store raw body for signature verification
        (req as any).rawBody = rawBody;
        next();
      });
    } else {
      next();
    }
  }
}

