import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import * as express from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(AppModule, {
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
  const frontendUrls = (process.env.FRONTEND_URL || 'http://localhost:5173')
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
  logger.log(`Health check available at: http://localhost:${port}/health`);
}
bootstrap();

