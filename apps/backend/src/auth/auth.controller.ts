import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  AuthResponseDto,
  ForgotPasswordDto,
  LoginDto,
  MessageResponseDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Create a new user account' })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({
    description: 'User registered successfully',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Missing required fields or invalid payload',
  })
  @ApiConflictResponse({
    description: 'Email already in use',
  })
  async register(@Body() body: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, name } = body;
    if (!email || !password) {
      throw new BadRequestException('email and password are required');
    }
    const result = await this.auth.register({ email, password, name });
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate an existing user' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'User authenticated successfully',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Missing required fields or invalid payload',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid email or password',
  })
  async login(@Body() body: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = body;
    if (!email || !password) {
      throw new BadRequestException('email and password are required');
    }
    const result = await this.auth.login({ email, password });
    return result;
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiOkResponse({
    description: 'Password reset email processed',
    type: MessageResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Missing required fields or invalid payload',
  })
  async forgotPassword(
    @Body() body: ForgotPasswordDto,
  ): Promise<MessageResponseDto> {
    const { email } = body;
    if (!email) {
      throw new BadRequestException('email is required');
    }
    const result = await this.auth.forgotPassword(email);
    return result;
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset a user password using a reset token' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiOkResponse({
    description: 'Password reset completed',
    type: MessageResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Missing required fields or invalid payload',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired reset token',
  })
  async resetPassword(
    @Body() body: ResetPasswordDto,
  ): Promise<MessageResponseDto> {
    const { token, password } = body;
    if (!token || !password) {
      throw new BadRequestException('token and password are required');
    }
    const result = await this.auth.resetPassword(token, password);
    return result;
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  async googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;
    const result = await this.auth.validateOAuthLogin(user);

    const redirectUri = (req as any).session.oauth_redirect_uri || null;

    if (redirectUri) {
      delete (req as any).session.oauth_redirect_uri;
    }

    if (redirectUri && redirectUri.startsWith('reaxion://')) {
      const webCallbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:8081'}/auth/callback?token=${result.token}&mobile_redirect=${encodeURIComponent(redirectUri)}`;
      res.redirect(webCallbackUrl);
    } else {
      const defaultRedirect = `${process.env.FRONTEND_URL || 'http://localhost:8081'}/auth/callback?token=${result.token}`;
      res.redirect(redirectUri || defaultRedirect);
    }
  }

  @Get('github')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'Initiate GitHub OAuth login' })
  async githubAuth() {}

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  async githubAuthCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;
    const result = await this.auth.validateOAuthLogin(user);

    const redirectUri = (req as any).session.oauth_redirect_uri || null;

    if (redirectUri) {
      delete (req as any).session.oauth_redirect_uri;
    }

    if (redirectUri && redirectUri.startsWith('reaxion://')) {
      const webCallbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:8081'}/auth/callback?token=${result.token}&mobile_redirect=${encodeURIComponent(redirectUri)}`;
      res.redirect(webCallbackUrl);
    } else {
      const defaultRedirect = `${process.env.FRONTEND_URL || 'http://localhost:8081'}/auth/callback?token=${result.token}`;
      res.redirect(redirectUri || defaultRedirect);
    }
  }
}
