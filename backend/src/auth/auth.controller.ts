import { Controller, Post, Body, Get, Query, UseGuards, Request, Res, HttpException, Put } from '@nestjs/common';
import { Response } from 'express';
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
  async login(@Request() req) {
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
  ) {
    const frontendCallbackUrl = this.configService.get<string>('FRONTEND_CALLBACK_URL') || 
      `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'}/onboarding/callback`;

    // Handle OAuth errors from Meta
    if (error) {
      const errorParams = new URLSearchParams({
        error: error || 'unknown_error',
        error_reason: errorReason || '',
        error_description: errorDescription || 'An error occurred during OAuth authentication',
      });
      return res.redirect(`${frontendCallbackUrl}?${errorParams.toString()}`);
    }

    // Handle missing authorization code
    if (!code) {
      const errorParams = new URLSearchParams({
        error: 'missing_code',
        error_description: 'No authorization code received from Meta',
      });
      return res.redirect(`${frontendCallbackUrl}?${errorParams.toString()}`);
    }

    try {
      // Process the callback
      const result = await this.wabaService.handleCallback(code, state);
      
      // Redirect to frontend with success (frontend will handle showing the result)
      // We can pass the result as query params or let frontend fetch it
      const successParams = new URLSearchParams({
        success: 'true',
        code: code, // Pass code so frontend can verify
      });
      return res.redirect(`${frontendCallbackUrl}?${successParams.toString()}`);
    } catch (error) {
      // Redirect to frontend with error details
      const errorMessage = error instanceof HttpException 
        ? error.message 
        : error.message || 'Failed to process OAuth callback';
      
      const errorParams = new URLSearchParams({
        error: 'callback_processing_error',
        error_description: encodeURIComponent(errorMessage),
      });
      return res.redirect(`${frontendCallbackUrl}?${errorParams.toString()}`);
    }
  }
}

