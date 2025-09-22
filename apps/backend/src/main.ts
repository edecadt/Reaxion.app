import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { AppModule } from './app.module';

const loggerContext = 'Bootstrap';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: 'http://localhost:8081',
  });

  const configService = app.get(ConfigService);
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
