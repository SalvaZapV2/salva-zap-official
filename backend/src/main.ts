import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, RequestMethod } from '@nestjs/common';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import * as express from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false, // Disable default body parser
  });

  // Configure body parser with raw body capture for webhook endpoint
  app.use(
    express.json({
      verify: (req: any, res, buf) => {
        // Store raw body for signature verification on webhook endpoint
        if (req.path === '/webhooks/meta' && req.method === 'POST') {
          req.rawBody = buf.toString('utf8');
        }
      },
    }),
  );

  // Enable CORS for frontend (supports comma-separated list)
  const frontendUrls = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
  app.enableCors({
    origin: frontendUrls,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-hub-signature-256'],
  });

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // All API routes under /api, but keep Meta webhooks at /webhooks/meta (no prefix)
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'webhooks/meta', method: RequestMethod.GET },
      { path: 'webhooks/meta', method: RequestMethod.POST },
    ],
  });

  // Handle WebDAV and uncommon HTTP methods (typically from bots/scanners)
  // PROPFIND, MKCOL, MOVE, COPY, LOCK, UNLOCK, etc. - return silent 404
  const webdavMethods = [
    'PROPFIND',
    'MKCOL',
    'MOVE',
    'COPY',
    'LOCK',
    'UNLOCK',
    'PROPPATCH',
    'SEARCH',
  ];
  app.use((req, res, next) => {
    if (webdavMethods.includes(req.method)) {
      return res.status(404).end();
    }
    next();
  });

  // Serve built frontend from / (production)
  const frontendPath = path.join(__dirname, '..', 'frontend');
  app.use(express.static(frontendPath));

  // SPA fallback: for non-API GET requests, serve index.html
  const httpAdapter = app.getHttpAdapter().getInstance();

  // Handle direct OAuth redirects that target backend paths without the global '/api' prefix
  // Some Meta redirect URIs may be set to '/auth/embedded/callback' or '/waba/embedded/callback' which
  // won't match the controller routes (they are mounted under '/api'). Forward those requests to the
  // API endpoints so the existing controllers handle them properly.
  httpAdapter.get('/auth/embedded/callback', (req, res) => {
    const query = req.url.includes('?')
      ? req.url.slice(req.url.indexOf('?'))
      : '';
    return res.redirect(302, `/api/auth/embedded/callback${query}`);
  });

  httpAdapter.get('/waba/embedded/callback', (req, res) => {
    const query = req.url.includes('?')
      ? req.url.slice(req.url.indexOf('?'))
      : '';
    return res.redirect(302, `/api/waba/embedded/callback${query}`);
  });

  // Safe SPA fallback: only attempt to send index.html if it exists
  const indexFile = path.join(frontendPath, 'index.html');
  httpAdapter.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/webhooks')) {
      return next();
    }
    try {
      const fs = require('fs');
      if (!fs.existsSync(indexFile)) {
        // Frontend not present in this environment; return helpful message instead of crashing
        return res
          .status(404)
          .send(
            'Frontend not built here. Visit the frontend dev server or build the frontend.',
          );
      }
      return res.sendFile(indexFile);
    } catch (err) {
      // In case of any error, avoid throwing a server error and provide a helpful response
      Logger.warn(
        'Unable to serve frontend index.html: ' + (err?.message || String(err)),
      );
      return res.status(404).send('Frontend not available');
    }
  });

  // Handle POST requests to root and common bot scanner paths
  // These are typically from bots/scanners and can be safely ignored
  const botScannerPaths = [
    '/',
    '/xmlrpc.php',
    '/wp-admin',
    '/wp-login.php',
    '/.env',
    '/admin',
    '/administrator',
  ];
  botScannerPaths.forEach((path) => {
    httpAdapter.post(path, (req, res) => {
      // Silently return 404 for bot scanners to reduce log noise
      res.status(404).json({
        error: 'Not Found',
        message: 'Endpoint not found',
      });
    });
  });

  // Handle POST requests to static asset paths (e.g., /_next, /_next/*, /static, /static/*)
  // These are typically from bots/scanners probing for Next.js installations
  // This middleware runs before the exception filter, so it won't log warnings
  app.use((req, res, next) => {
    if (
      req.method === 'POST' &&
      (req.path.startsWith('/_next') || req.path.startsWith('/static'))
    ) {
      return res.status(404).end();
    }
    next();
  });

  // Verify database connection
  const prismaService = app.get(PrismaService);
  try {
    const isHealthy = await prismaService.isHealthy();
    if (isHealthy) {
      logger.log('✓ Database connection verified');
    } else {
      logger.warn('⚠ Database connection check failed');
    }
  } catch (error) {
    logger.error('✗ Database connection error:', error.message);
    logger.warn('Application will continue, but database operations may fail');
  }

  const port = process.env.APP_PORT || 3000;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Health check available at: http://localhost:${port}/api/health`);
}
bootstrap();
