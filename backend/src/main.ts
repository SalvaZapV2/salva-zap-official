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
  app.use(express.json({ 
    verify: (req: any, res, buf) => {
      // Store raw body for signature verification on webhook endpoint
      if (req.path === '/webhooks/meta' && req.method === 'POST') {
        req.rawBody = buf.toString('utf8');
      }
    }
  }));
  
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

  // Serve built frontend from / (production)
  const frontendPath = path.join(__dirname, '..', 'frontend');
  app.use(express.static(frontendPath));

  // SPA fallback: for non-API GET requests, serve index.html
  const httpAdapter = app.getHttpAdapter().getInstance();
  httpAdapter.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/webhooks')) {
      return next();
    }
    return res.sendFile(path.join(frontendPath, 'index.html'));
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

  const port = process.env.APP_PORT || 3001;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Health check available at: http://localhost:${port}/api/health`);
}
bootstrap();

