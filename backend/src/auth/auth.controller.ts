import { Controller, Post, Body, Get, Query, UseGuards, Req, Res, HttpException, Put } from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { WabaService } from '../waba/waba.service';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

class UpdateEmailDto {
  @IsEmail()
  email: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private wabaService: WabaService,
    private configService: ConfigService,
  ) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    const user = await this.authService.register(registerDto.email, registerDto.password);
    return this.authService.login(user);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req: Request) {
    return this.authService.login(req.user);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: any) {
    return {
      id: user.id,
      email: user.email,
    };
  }

  @Put('email')
  @UseGuards(JwtAuthGuard)
  async updateEmail(@CurrentUser() user: any, @Body() updateEmailDto: UpdateEmailDto) {
    return this.authService.updateEmail(user.id, updateEmailDto.email);
  }

  @Get('embedded/callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_reason') errorReason: string,
    @Query('error_description') errorDescription: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const frontendCallbackUrl = this.configService.get<string>('FRONTEND_CALLBACK_URL') || 
      `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'}/onboarding/callback`;

    // Check if this is an API call (from frontend) or a redirect (from Facebook)
    // GET requests from frontend will have Accept: application/json header
    // Direct browser redirects from Facebook won't have this header
    const acceptHeader = req.headers.accept || '';
    const contentType = req.headers['content-type'] || '';
    const isApiCall = acceptHeader.includes('application/json') || 
                      contentType.includes('application/json') ||
                      req.query['api'] === 'true' ||
                      req.headers['x-requested-with'] === 'XMLHttpRequest';
    
    // Ensure JSON response for API calls
    if (isApiCall) {
      res.setHeader('Content-Type', 'application/json');
    }

    // Handle OAuth errors from Meta
    if (error) {
      if (isApiCall) {
        return res.status(400).json({
          error: error || 'unknown_error',
          error_reason: errorReason || '',
          error_description: errorDescription || 'An error occurred during OAuth authentication',
        });
      }
      const errorParams = new URLSearchParams({
        error: error || 'unknown_error',
        error_reason: errorReason || '',
        error_description: errorDescription || 'An error occurred during OAuth authentication',
      });
      return res.redirect(`${frontendCallbackUrl}?${errorParams.toString()}`);
    }

    // Handle missing authorization code
    if (!code) {
      if (isApiCall) {
        return res.status(400).json({
          error: 'missing_code',
          error_description: 'No authorization code received from Meta',
        });
      }
      const errorParams = new URLSearchParams({
        error: 'missing_code',
        error_description: 'No authorization code received from Meta',
      });
      return res.redirect(`${frontendCallbackUrl}?${errorParams.toString()}`);
    }

    try {
      // Process the callback
      const result = await this.wabaService.handleCallback(code, state);
      
      if (isApiCall) {
        // Return JSON for API calls
        return res.json({
          success: true,
          ...result,
        });
      }
      
      // Redirect for direct Facebook redirects
      const successParams = new URLSearchParams({
        success: 'true',
        code: code,
      });
      return res.redirect(`${frontendCallbackUrl}?${successParams.toString()}`);
    } catch (error) {
      const errorMessage = error instanceof HttpException 
        ? error.message 
        : error.message || 'Failed to process OAuth callback';
      
      // Log the error for debugging
      console.error('OAuth callback error:', {
        message: errorMessage,
        code: error instanceof HttpException ? error.getStatus() : 500,
        stack: error.stack,
        isApiCall,
      });
      
      if (isApiCall) {
        // Always return JSON for API calls
        const statusCode = error instanceof HttpException ? error.getStatus() : 500;
        return res.status(statusCode).json({
          error: 'callback_processing_error',
          error_description: errorMessage,
        });
      }
      
      const errorParams = new URLSearchParams({
        error: 'callback_processing_error',
        error_description: encodeURIComponent(errorMessage),
      });
      return res.redirect(`${frontendCallbackUrl}?${errorParams.toString()}`);
    }
  }
}

