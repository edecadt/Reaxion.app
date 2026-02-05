import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServiceAuthController } from './service-auth.controller';
import { ServiceAuthService } from './service-auth.service';
import { OAuth2Service } from './oauth2.service';
import { PrismaService } from '../prisma.service';
import { ServicesModule } from '../services/services.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => ServicesModule), ConfigModule, AuthModule],
  controllers: [ServiceAuthController],
  providers: [ServiceAuthService, OAuth2Service, PrismaService],
  exports: [ServiceAuthService, OAuth2Service],
})
export class ServiceAuthModule {}
