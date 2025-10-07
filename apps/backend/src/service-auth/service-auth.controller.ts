import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ServiceAuthService } from './service-auth.service';
import { OAuth2Service } from './oauth2.service';
import { ServiceRegistry } from '../services/service-registry.service';
import { ApiKeyConnectDto } from './dto/connect-service.dto';
import { OAuth2CallbackDto } from './dto/oauth2-callback.dto';
import { ServiceConnectionResponseDto } from './dto/service-connection-response.dto';
import { ConfigService } from '@nestjs/config';

@Controller('api/service-auth')
export class ServiceAuthController {
  constructor(
    private readonly serviceAuthService: ServiceAuthService,
    private readonly oauth2Service: OAuth2Service,
    private readonly serviceRegistry: ServiceRegistry,
    private readonly configService: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('connections')
  async getUserConnections(
    @CurrentUser() user: { sub: number; email: string } | { id: number },
  ): Promise<ServiceConnectionResponseDto[]> {
    const userId = 'sub' in user ? user.sub : user.id;
    const connections =
      await this.serviceAuthService.getUserConnections(userId);

    return connections.map((conn) =>
      this.serviceAuthService.toResponseDto(conn),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('connections/:serviceId')
  async getConnection(
    @CurrentUser() user: { sub: number; email: string } | { id: number },
    @Param('serviceId') serviceId: string,
  ): Promise<ServiceConnectionResponseDto | null> {
    const userId = 'sub' in user ? user.sub : user.id;
    const connection = await this.serviceAuthService.getConnection(
      userId,
      serviceId,
    );

    if (!connection) {
      return null;
    }

    return this.serviceAuthService.toResponseDto(connection);
  }

  @UseGuards(JwtAuthGuard)
  @Get('connect/:serviceId')
  async initiateOAuth2Connection(
    @CurrentUser() user: { sub: number; email: string } | { id: number },
    @Param('serviceId') serviceId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userId = 'sub' in user ? user.sub : user.id;
    const service = this.serviceRegistry
      .getSnapshot()
      .servicesById.get(serviceId);

    if (!service) {
      throw new BadRequestException(`Service ${serviceId} not found`);
    }

    if (service.auth.type !== 'oauth2') {
      throw new BadRequestException(
        `Service ${serviceId} does not support OAuth2`,
      );
    }

    const oauth2Config = this.serviceAuthService.buildOAuth2Config(
      serviceId,
      service.auth,
    );

    const authorizationUrl = this.oauth2Service.generateAuthorizationUrl(
      userId,
      serviceId,
      oauth2Config,
    );

    if (req.accepts(['json'])) {
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ authorizationUrl });
    }

    return res.redirect(authorizationUrl);
  }

  @Get('callback/:serviceId')
  async handleOAuth2Callback(
    @Param('serviceId') serviceId: string,
    @Query() query: OAuth2CallbackDto,
    @Res() res: Response,
  ) {
    if (query.error) {
      const errorMessage =
        query.error_description || query.error || 'Unknown error';
      return res.redirect(
        `${this.getFrontendUrl()}/settings/connections?error=${encodeURIComponent(errorMessage)}`,
      );
    }

    if (!query.code || !query.state) {
      throw new BadRequestException('Missing code or state parameter');
    }

    const { userId } = this.oauth2Service.validateState(query.state);

    const service = this.serviceRegistry
      .getSnapshot()
      .servicesById.get(serviceId);

    if (!service) {
      throw new BadRequestException(`Service ${serviceId} not found`);
    }

    const oauth2Config = this.serviceAuthService.buildOAuth2Config(
      serviceId,
      service.auth,
    );

    const tokenResponse = await this.oauth2Service.exchangeCodeForToken(
      query.code,
      oauth2Config,
    );

    await this.serviceAuthService.createOrUpdateOAuth2Connection(
      userId,
      serviceId,
      tokenResponse,
      oauth2Config.scopes,
    );

    const handler = this.serviceRegistry.getHandler(serviceId);
    if (handler?.onConnect) {
      try {
        const connection = await this.serviceAuthService.getConnection(
          userId,
          serviceId,
        );

        await handler.onConnect({
          serviceId,
          userId,
          logger: console,
          connection: connection
            ? {
                accessToken: connection.accessToken ?? undefined,
                refreshToken: connection.refreshToken ?? undefined,
                expiresAt: connection.expiresAt ?? undefined,
                scopes: connection.scopes,
                metadata: connection.metadata as Record<string, unknown>,
              }
            : undefined,
        });
      } catch (error) {
        console.error(
          `onConnect hook failed for ${serviceId}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    return res.redirect(
      `${this.getFrontendUrl()}/settings/connections?success=true&service=${serviceId}`,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('connect/api-key')
  async connectWithApiKey(
    @CurrentUser() user: { sub: number; email: string } | { id: number },
    @Body() body: ApiKeyConnectDto,
  ): Promise<ServiceConnectionResponseDto> {
    const userId = 'sub' in user ? user.sub : user.id;
    const service = this.serviceRegistry
      .getSnapshot()
      .servicesById.get(body.serviceId);

    if (!service) {
      throw new BadRequestException(`Service ${body.serviceId} not found`);
    }

    if (service.auth.type !== 'api_key') {
      throw new BadRequestException(
        `Service ${body.serviceId} does not support API Key authentication`,
      );
    }

    const connection =
      await this.serviceAuthService.createOrUpdateApiKeyConnection(
        userId,
        body.serviceId,
        body.apiKey,
      );

    const handler = this.serviceRegistry.getHandler(body.serviceId);
    if (handler?.onConnect) {
      try {
        await handler.onConnect({
          serviceId: body.serviceId,
          userId,
          logger: console,
          connection: {
            metadata: connection.metadata as Record<string, unknown>,
          },
        });
      } catch (error) {
        console.error(
          `onConnect hook failed for ${body.serviceId}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    return this.serviceAuthService.toResponseDto(connection);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('disconnect/:serviceId')
  async disconnectService(
    @CurrentUser() user: { sub: number; email: string } | { id: number },
    @Param('serviceId') serviceId: string,
  ): Promise<{ success: boolean }> {
    const userId = 'sub' in user ? user.sub : user.id;
    const handler = this.serviceRegistry.getHandler(serviceId);
    if (handler?.onDisconnect) {
      try {
        const connection = await this.serviceAuthService.getConnection(
          userId,
          serviceId,
        );

        if (connection) {
          await handler.onDisconnect({
            serviceId,
            userId,
            logger: console,
            connection: {
              accessToken: connection.accessToken ?? undefined,
              refreshToken: connection.refreshToken ?? undefined,
              expiresAt: connection.expiresAt ?? undefined,
              scopes: connection.scopes,
              metadata: connection.metadata as Record<string, unknown>,
            },
          });
        }
      } catch (error) {
        console.error(
          `onDisconnect hook failed for ${serviceId}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    await this.serviceAuthService.disconnectService(userId, serviceId);
    return { success: true };
  }

  private getFrontendUrl(): string {
    return (
      this.configService.get<string>('WEB_URL') ||
      `http://localhost:${this.configService.get<string>('WEB_PORT') || 8081}`
    );
  }
}
