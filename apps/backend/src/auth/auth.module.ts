import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

import { PrismaService } from '../prisma.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { EmailService } from './email.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { GithubStrategy } from './strategies/github.strategy';
import { OAuthRedirectMiddleware } from './oauth-redirect.middleware';

@Module({
  imports: [ConfigModule, PassportModule],
  providers: [
    PrismaService,
    AuthService,
    EmailService,
    GoogleStrategy,
    GithubStrategy,
  ],
  controllers: [AuthController],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(OAuthRedirectMiddleware)
      .forRoutes('auth/google', 'auth/github');
  }
}
