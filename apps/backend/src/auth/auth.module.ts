import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaService } from '../prisma.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { EmailService } from './email.service';

@Module({
  imports: [ConfigModule],
  providers: [PrismaService, AuthService, EmailService],
  controllers: [AuthController],
})
export class AuthModule {}
