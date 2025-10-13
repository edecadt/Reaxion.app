import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { AuthService } from './auth.service';

type RegisterDto = { email: string; password: string; name?: string };
type LoginDto = { email: string; password: string };
type ForgotPasswordDto = { email: string };
type ResetPasswordDto = { token: string; password: string };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    const { email, password, name } = body;
    if (!email || !password) {
      throw new BadRequestException('email and password are required');
    }
    const result = await this.auth.register({ email, password, name });
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto) {
    const { email, password } = body;
    if (!email || !password) {
      throw new BadRequestException('email and password are required');
    }
    const result = await this.auth.login({ email, password });
    return result;
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    const { email } = body;
    if (!email) {
      throw new BadRequestException('email is required');
    }
    const result = await this.auth.forgotPassword(email);
    return result;
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: ResetPasswordDto) {
    const { token, password } = body;
    if (!token || !password) {
      throw new BadRequestException('token and password are required');
    }
    const result = await this.auth.resetPassword(token, password);
    return result;
  }
}
