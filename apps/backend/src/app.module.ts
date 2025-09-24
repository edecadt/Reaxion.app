import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join, resolve } from 'node:path';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ServiceLoader } from './services/service-loader.service';
import { ServiceRegistry } from './services/service-registry.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '..', '.env.local'),
        join(__dirname, '..', '.env.development'),
        join(__dirname, '..', '.env'),
        resolve(process.cwd(), 'apps', 'backend', '.env.local'),
        resolve(process.cwd(), 'apps', 'backend', '.env.development'),
        resolve(process.cwd(), 'apps', 'backend', '.env'),
        resolve(process.cwd(), '.env.local'),
        resolve(process.cwd(), '.env.development'),
        resolve(process.cwd(), '.env'),
      ],
    }),
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, ServiceLoader, ServiceRegistry],
})
export class AppModule {}
