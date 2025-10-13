import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'Email address used for account creation',
    example: 'user@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Password for the new account',
    example: 'StrongP@ssw0rd!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    description: 'Display name of the user',
    example: 'Jane Doe',
  })
  @IsOptional()
  @IsString()
  name?: string;
}

export class LoginDto {
  @ApiProperty({
    description: 'Email address associated with the account',
    example: 'user@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Account password',
    example: 'StrongP@ssw0rd!',
  })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Email address to send the password reset link to',
    example: 'user@example.com',
  })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Reset token received via email',
    example: '0f3c867419b44b8f8a430dc19b2d3998',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({
    description: 'New password to set for the account',
    example: 'NewStrongP@ssw0rd!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class AuthUserDto {
  @ApiProperty({
    description: 'Unique identifier of the authenticated user',
    example: 12,
  })
  id!: number;

  @ApiProperty({
    description: 'Email address of the authenticated user',
    example: 'user@example.com',
  })
  email!: string;

  @ApiPropertyOptional({
    description: 'Display name of the user',
    example: 'Jane Doe',
    nullable: true,
  })
  name?: string | null;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT authentication token',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsImlhdCI6MTY5NjAwMDAwMCwiZXhwIjoxNjk2NjA0ODAwfQ.zP49vXg...',
  })
  token!: string;

  @ApiProperty({
    description: 'Authenticated user payload',
    type: () => AuthUserDto,
  })
  user!: AuthUserDto;
}

export class MessageResponseDto {
  @ApiProperty({
    description: 'Human readable response message',
    example: 'If the email exists, a reset link has been sent',
  })
  message!: string;
}
