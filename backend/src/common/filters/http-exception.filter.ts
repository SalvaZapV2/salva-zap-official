import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Check if this is an API route - always return JSON for API routes
    const isApiRoute = request.path.startsWith('/api') || request.path.startsWith('/webhooks');
    const acceptHeader = request.headers.accept || '';
    const isApiCall = isApiRoute || acceptHeader.includes('application/json');

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;
        error = responseObj.error || exception.name;
        details = responseObj;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
      details = {
        stack: process.env.NODE_ENV === 'development' ? exception.stack : undefined,
      };
    }

    // Log error details
    const errorLog = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error,
      ...(details && { details }),
    };

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url}`, errorLog);
    } else {
      this.logger.warn(`${request.method} ${request.url}`, errorLog);
    }

    // Always return JSON for API routes to prevent HTML fallback
    if (isApiCall) {
      response.setHeader('Content-Type', 'application/json');
      return response.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message,
        error,
        ...(process.env.NODE_ENV === 'development' && details && { details }),
      });
    }

    // For non-API routes, return JSON anyway (but could redirect if needed)
    response.setHeader('Content-Type', 'application/json');
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      error,
      ...(process.env.NODE_ENV === 'development' && details && { details }),
    });
  }
}

