import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwtSecret: string;

  constructor(private readonly config: ConfigService) {
    this.jwtSecret =
      this.config.get<string>('JWT_SECRET') || 'dev_secret_change_me';
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid authorization header',
      );
    }

    const token = authHeader.substring(7);

    try {
      const payload = this.verifyJwt(token);
      request.user = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private verifyJwt(token: string): { sub: number; email: string } {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [headerB64, bodyB64, signatureB64] = parts;

    if (!bodyB64 || !signatureB64) {
      throw new Error('Invalid token format');
    }

    const data = `${headerB64}.${bodyB64}`;

    const expectedSig = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(data)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (signatureB64 !== expectedSig) {
      throw new Error('Invalid signature');
    }

    const bodyJson = Buffer.from(
      bodyB64.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf-8');
    const body = JSON.parse(bodyJson);

    if (body.exp && body.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    return { sub: body.sub, email: body.email };
  }
}
