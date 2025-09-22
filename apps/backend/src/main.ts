import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { AppModule } from './app.module';

const loggerContext = 'Bootstrap';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const corsOriginsEnv = configService.get<string>('CORS_ORIGINS');
  const webPort = Number(configService.get<string>('WEB_PORT')) || 8081;
  const mobilePort = Number(configService.get<string>('MOBILE_PORT')) || 8082;
  const fallbackOrigins = [
    `http://localhost:${webPort}`,
    `http://localhost:${mobilePort}`,
  ];

  const allowedOrigins = (
    corsOriginsEnv ? corsOriginsEnv.split(',') : fallbackOrigins
  )
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
        callback(null, true);
        return;
      }

      Logger.warn(`Blocked CORS origin: ${requestOrigin}`, loggerContext);
      callback(new Error('Not allowed by CORS'));
    },
  });

  const rawPort = configService.get<string>('PORT');
  const parsedPort = rawPort ? Number(rawPort) : NaN;
  const listenPort = Number.isFinite(parsedPort) ? parsedPort : 4000;

  if (!rawPort) {
    Logger.warn(
      'PORT not found in environment, falling back to 4000',
      loggerContext,
    );
  } else if (!Number.isFinite(parsedPort)) {
    Logger.warn(
      `PORT is not numeric (${rawPort}), falling back to 4000`,
      loggerContext,
    );
  }

  Logger.log(`Starting backend on port ${listenPort}`, loggerContext);
  await app.listen(listenPort, '0.0.0.0');
}

void bootstrap();
