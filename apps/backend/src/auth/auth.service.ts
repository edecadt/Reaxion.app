import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import crypto from 'node:crypto';

type RegisterInput = {
  email: string;
  password: string;
  name?: string | null;
};

type LoginInput = {
  email: string;
  password: string;
};

type AuthResult = {
  token: string;
  user: {
    id: number;
    email: string;
    name: string | null;
  };
};

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.jwtSecret =
      this.config.get<string>('JWT_SECRET') || 'dev_secret_change_me';
    this.jwtExpiresIn = this.config.get<string>('JWT_EXPIRES_IN') || '7d';
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const name = input.name?.trim() || null;

    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await this.hashPassword(input.password);

    const user = await (this.prisma.user as any).create({
      data: { email, name, passwordHash },
    });

    const token = this.signJwt({ sub: user.id, email: user.email });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name ?? null },
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const user = (await this.prisma.user.findUnique({
      where: { email },
    })) as any;
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const ok = await this.verifyPassword(input.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = this.signJwt({ sub: user.id, email: user.email });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name ?? null },
    };
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16);
    const N = 16384,
      r = 8,
      p = 1,
      keylen = 64;
    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(password, salt, keylen, { N, r, p }, (err, dk) => {
        if (err) reject(err);
        else resolve(dk as Buffer);
      });
    });
    return `scrypt:${salt.toString('hex')}:${derivedKey.toString('hex')}`;
  }

  private async verifyPassword(
    password: string,
    stored: string,
  ): Promise<boolean> {
    const [scheme, saltHex, hashHex] = stored.split(':');
    if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const N = 16384,
      r = 8,
      p = 1,
      keylen = expected.length;
    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(password, salt, keylen, { N, r, p }, (err, dk) => {
        if (err) reject(err);
        else resolve(dk as Buffer);
      });
    });
    return crypto.timingSafeEqual(derivedKey, expected);
  }

  private signJwt(payload: Record<string, unknown>): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const exp = this.computeExpiry(now, this.jwtExpiresIn);
    const body = { iat: now, exp, ...payload } as Record<string, unknown>;

    const base64url = (obj: unknown) =>
      Buffer.from(JSON.stringify(obj))
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    const h = base64url(header);
    const b = base64url(body);
    const data = `${h}.${b}`;
    const sig = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(data)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    return `${data}.${sig}`;
  }

  private computeExpiry(now: number, expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return now + 7 * 24 * 3600;
    const value = Number(match[1]);
    const unit = match[2];
    const mult =
      unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
    return now + value * mult;
  }
}
