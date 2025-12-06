import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as express from 'express';

@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Only process webhook endpoint
    if (req.path === '/webhooks/meta' && req.method === 'POST') {
      express.raw({ type: 'application/json' })(req, res, () => {
        // Store raw body as buffer
        (req as any).rawBody = req.body;
        
        // Parse JSON body for normal processing
        express.json()(req, res, next);
      });
    } else {
      next();
    }
  }
}

