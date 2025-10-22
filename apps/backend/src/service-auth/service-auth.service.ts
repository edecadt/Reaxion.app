import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ServiceConnection } from '@prisma/client';
import { OAuth2Service, OAuth2TokenResponse } from './oauth2.service';
import { ServiceRegistry } from '../services/service-registry.service';
import { ConfigService } from '@nestjs/config';
import { ServiceConnectionResponseDto } from './dto/service-connection-response.dto';
import type { ServiceManifest } from '../services/manifest.types';
import type { OAuth2Config } from './oauth2.service';

@Injectable()
export class ServiceAuthService {
  private readonly logger = new Logger(ServiceAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth2Service: OAuth2Service,
    private readonly serviceRegistry: ServiceRegistry,
    private readonly configService: ConfigService,
  ) {}

  async getConnection(
    userId: number,
    serviceId: string,
  ): Promise<ServiceConnection | null> {
    return this.prisma.serviceConnection.findUnique({
      where: {
        userId_serviceId: {
          userId,
          serviceId,
        },
      },
    });
  }

  async getConnectionOrThrow(
    userId: number,
    serviceId: string,
  ): Promise<ServiceConnection> {
    const connection = await this.getConnection(userId, serviceId);

    if (!connection) {
      throw new NotFoundException(
        `No connection found for service ${serviceId}`,
      );
    }

    return connection;
  }

  async getUserConnections(userId: number): Promise<ServiceConnection[]> {
    return this.prisma.serviceConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createOrUpdateOAuth2Connection(
    userId: number,
    serviceId: string,
    tokenResponse: OAuth2TokenResponse,
    requestedScopes: string[],
  ): Promise<ServiceConnection> {
    const existingConnection = await this.getConnection(userId, serviceId);

    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;

    const scopes = tokenResponse.scope
      ? tokenResponse.scope.split(' ')
      : requestedScopes;

    const hasRefreshTokenField = Object.prototype.hasOwnProperty.call(
      tokenResponse,
      'refresh_token',
    );

    let refreshToken: string | null = existingConnection?.refreshToken ?? null;

    if (hasRefreshTokenField) {
      const providedRefreshToken = tokenResponse.refresh_token;

      if (typeof providedRefreshToken === 'string') {
        refreshToken =
          providedRefreshToken.length > 0 ? providedRefreshToken : refreshToken;
      } else if (providedRefreshToken === null) {
        refreshToken = null;
      }
    }

    const data = {
      authType: 'oauth2',
      accessToken: tokenResponse.access_token,
      refreshToken,
      expiresAt,
      scopes,
      metadata: {},
    };

    const connection = await this.prisma.serviceConnection.upsert({
      where: {
        userId_serviceId: {
          userId,
          serviceId,
        },
      },
      create: {
        userId,
        serviceId,
        ...data,
      },
      update: data,
    });

    this.logger.log(
      `Created/updated OAuth2 connection for user ${userId}, service ${serviceId}`,
    );

    return connection;
  }

  async createOrUpdateApiKeyConnection(
    userId: number,
    serviceId: string,
    apiKey: string,
  ): Promise<ServiceConnection> {
    const connection = await this.prisma.serviceConnection.upsert({
      where: {
        userId_serviceId: {
          userId,
          serviceId,
        },
      },
      create: {
        userId,
        serviceId,
        authType: 'api_key',
        apiKey,
        metadata: {},
      },
      update: {
        apiKey,
      },
    });

    this.logger.log(
      `Created/updated API Key connection for user ${userId}, service ${serviceId}`,
    );

    return connection;
  }

  async refreshOAuth2TokenIfNeeded(
    connection: ServiceConnection,
  ): Promise<ServiceConnection> {
    if (connection.authType !== 'oauth2') {
      return connection;
    }

    if (!this.isTokenExpired(connection)) {
      return connection;
    }

    if (!connection.refreshToken) {
      throw new BadRequestException(
        'OAuth2 token expired and no refresh token available. Please reconnect.',
      );
    }

    this.logger.log(
      `Refreshing OAuth2 token for service ${connection.serviceId}`,
    );

    const service = this.serviceRegistry
      .getSnapshot()
      .servicesById.get(connection.serviceId);

    if (!service) {
      throw new NotFoundException(
        `Service ${connection.serviceId} not found in registry`,
      );
    }

    const oauth2Config = this.buildOAuth2Config(service.id, service.auth);

    const tokenResponse = await this.oauth2Service.refreshAccessToken(
      connection.refreshToken,
      oauth2Config,
    );

    return this.createOrUpdateOAuth2Connection(
      connection.userId,
      connection.serviceId,
      tokenResponse,
      connection.scopes,
    );
  }

  async disconnectService(userId: number, serviceId: string): Promise<void> {
    const connection = await this.getConnection(userId, serviceId);

    if (!connection) {
      throw new NotFoundException(
        `No connection found for service ${serviceId}`,
      );
    }

    await this.prisma.serviceConnection.delete({
      where: {
        id: connection.id,
      },
    });

    this.logger.log(`Disconnected service ${serviceId} for user ${userId}`);
  }

  isTokenExpired(connection: ServiceConnection): boolean {
    if (!connection.expiresAt) {
      return false;
    }

    const bufferMs = 5 * 60 * 1000;
    return Date.now() >= connection.expiresAt.getTime() - bufferMs;
  }

  buildOAuth2Config(
    serviceId: string,
    auth: ServiceManifest['auth'],
  ): OAuth2Config {
    if (!auth || auth.type !== 'oauth2') {
      throw new BadRequestException(
        `Service ${serviceId} does not support OAuth2`,
      );
    }

    const clientIdEnvVar =
      auth.clientIdEnvVar ?? `${serviceId.toUpperCase()}_CLIENT_ID`;
    const clientSecretEnvVar =
      auth.clientSecretEnvVar ?? `${serviceId.toUpperCase()}_CLIENT_SECRET`;

    const clientId = this.configService.get<string>(clientIdEnvVar);
    const clientSecret = this.configService.get<string>(clientSecretEnvVar);

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        `OAuth2 credentials not configured for service ${serviceId}. Set ${clientIdEnvVar} and ${clientSecretEnvVar}`,
      );
    }

    const backendUrl =
      this.configService.get<string>('BACKEND_URL') ||
      `http://localhost:${this.configService.get<string>('PORT') || 8080}`;

    const redirectUri = `${backendUrl}/api/service-auth/callback/${serviceId}`;

    return {
      authorizationUrl: auth.authorizationUrl,
      tokenUrl: auth.tokenUrl,
      scopes: auth.scopes,
      clientId,
      clientSecret,
      redirectUri,
      authorizationParams: auth.authorizationParams,
      tokenParams: auth.tokenParams,
    };
  }

  toResponseDto(connection: ServiceConnection): ServiceConnectionResponseDto {
    return {
      id: connection.id,
      serviceId: connection.serviceId,
      authType: connection.authType,
      scopes: connection.scopes,
      isExpired: this.isTokenExpired(connection),
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    };
  }
}
