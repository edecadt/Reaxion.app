import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { EmailService } from './email.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const name = input.name?.trim() || null;

    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await this.hashPassword(input.password);

    const user = await this.prisma.user.create({
      data: { email, name, passwordHash },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      name: user.name ?? null,
    });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name ?? null },
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const ok = await this.verifyPassword(input.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      name: user.name ?? null,
    });

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
        else resolve(dk);
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
        else resolve(dk);
      });
    });
    return crypto.timingSafeEqual(derivedKey, expected);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true },
    });

    if (!user) {
      return { message: 'If the email exists, a reset link has been sent' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });

    await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { resetToken: token },
      select: { id: true, resetTokenExpiry: true },
    });

    if (!user || !user.resetTokenExpiry) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    if (user.resetTokenExpiry < new Date()) {
      throw new UnauthorizedException('Reset token has expired');
    }

    const passwordHash = await this.hashPassword(newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return { message: 'Password reset successfully' };
  }

  async validateOAuthLogin(oauthUser: {
    email: string;
    name: string;
    picture?: string;
    provider: string;
  }): Promise<AuthResult> {
    const email = oauthUser.email.trim().toLowerCase();

    let user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name: oauthUser.name,
          passwordHash: '',
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });
    }

    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      name: user.name ?? null,
    });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name ?? null },
    };
  }
}
