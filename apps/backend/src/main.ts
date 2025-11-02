import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import session from 'express-session';

import { AppModule } from './app.module';

const loggerContext = 'Bootstrap';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(
    session({
      secret:
        configService.get<string>('SESSION_SECRET') ||
        'reaxion-oauth-secret-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 600000,
        secure: process.env.NODE_ENV === 'production',
      },
    }),
  );

  app.enableCors({
    origin: true,
    credentials: true,
  });

  const rawPort = configService.get<string>('PORT');
  const parsedPort = rawPort ? Number(rawPort) : NaN;
  const listenPort = Number.isFinite(parsedPort) ? parsedPort : 4000;

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Reaxion API')
    .setDescription(
      'Comprehensive API documentation for the Reaxion automation backend.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'JWT access token',
        in: 'header',
      },
      'access-token',
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig, {
    deepScanRoutes: true,
  });
  SwaggerModule.setup('docs', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
    customSiteTitle: 'Reaxion API Docs',
  });

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
