import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';

export interface OAuth2Config {
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationParams?: Record<string, string>;
  tokenParams?: Record<string, string>;
}

export interface OAuth2TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

@Injectable()
export class OAuth2Service {
  private readonly logger = new Logger(OAuth2Service.name);
  private readonly stateStore = new Map<
    string,
    { userId: number; serviceId: string; expiresAt: number }
  >();

  constructor(private readonly configService: ConfigService) {
    setInterval(() => this.cleanupExpiredStates(), 10 * 60 * 1000);
  }

  generateAuthorizationUrl(
    userId: number,
    serviceId: string,
    config: OAuth2Config,
  ): string {
    const state = this.generateState(userId, serviceId);

    const url = new URL(config.authorizationUrl);
    const params = new URLSearchParams(url.search);

    params.set('client_id', config.clientId);
    params.set('redirect_uri', config.redirectUri);
    params.set('response_type', 'code');
    params.set('scope', config.scopes.join(' '));
    params.set('state', state);

    if (config.authorizationParams) {
      for (const [key, value] of Object.entries(config.authorizationParams)) {
        params.set(key, value);
      }
    }

    url.search = params.toString();
    this.logger.log(
      `Generated authorization URL for user ${userId}, service ${serviceId}`,
    );

    return url.toString();
  }

  validateState(state: string): { userId: number; serviceId: string } {
    const stored = this.stateStore.get(state);

    if (!stored) {
      throw new UnauthorizedException('Invalid or expired state parameter');
    }

    if (Date.now() > stored.expiresAt) {
      this.stateStore.delete(state);
      throw new UnauthorizedException('State parameter has expired');
    }

    this.stateStore.delete(state);
    return { userId: stored.userId, serviceId: stored.serviceId };
  }

  async exchangeCodeForToken(
    code: string,
    config: OAuth2Config,
  ): Promise<OAuth2TokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    if (config.tokenParams) {
      for (const [key, value] of Object.entries(config.tokenParams)) {
        params.set(key, value);
      }
    }

    try {
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Token exchange failed: ${response.status} - ${errorText}`,
        );
        throw new BadRequestException(
          `Failed to exchange authorization code: ${response.status}`,
        );
      }

      const data = (await response.json()) as OAuth2TokenResponse;

      if (!data.access_token) {
        throw new BadRequestException(
          'Token response missing access_token field',
        );
      }

      this.logger.log('Successfully exchanged authorization code for token');
      return data;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Token exchange error: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException('Failed to exchange authorization code');
    }
  }

  async refreshAccessToken(
    refreshToken: string,
    config: OAuth2Config,
  ): Promise<OAuth2TokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    if (config.tokenParams) {
      for (const [key, value] of Object.entries(config.tokenParams)) {
        params.set(key, value);
      }
    }

    try {
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Token refresh failed: ${response.status} - ${errorText}`,
        );
        throw new UnauthorizedException('Failed to refresh access token');
      }

      const data = (await response.json()) as OAuth2TokenResponse;

      if (!data.access_token) {
        throw new UnauthorizedException(
          'Token response missing access_token field',
        );
      }

      this.logger.log('Successfully refreshed access token');
      return data;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error(
        `Token refresh error: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new UnauthorizedException('Failed to refresh access token');
    }
  }

  private generateState(userId: number, serviceId: string): string {
    const state = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    this.stateStore.set(state, { userId, serviceId, expiresAt });
    return state;
  }

  private cleanupExpiredStates(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [state, data] of this.stateStore.entries()) {
      if (now > data.expiresAt) {
        this.stateStore.delete(state);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired OAuth2 states`);
    }
  }
}
