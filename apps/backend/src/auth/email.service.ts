import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend | null = null;
  private fromEmail: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    console.log('EmailService: RESEND_API_KEY exists:', !!apiKey);
    if (apiKey) {
      this.resend = new Resend(apiKey);
      console.log('EmailService: Resend client initialized');
    }
    this.fromEmail =
      this.config.get<string>('EMAIL_FROM') || 'onboarding@resend.dev';
    console.log('EmailService: Using from email:', this.fromEmail);
  }

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    console.log('sendPasswordResetEmail called for:', to);
    if (!this.resend) {
      console.warn('Resend not configured, skipping email send');
      console.log(`Reset token for ${to}: ${resetToken}`);
      return;
    }

    const resetUrl = `${this.config.get<string>('WEB_URL') || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;
    console.log('Reset URL:', resetUrl);

    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: 'Reset your Reaxion password',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>Reset your password</h1>
            <p>You requested to reset your password. Click the button below to create a new password:</p>
            <p style="margin: 30px 0;">
              <a href="${resetUrl}"
                 style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Reset Password
              </a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="color: #666; word-break: break-all;">${resetUrl}</p>
            <p style="color: #999; font-size: 14px; margin-top: 40px;">
              This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        `,
      });
      console.log('Password reset email sent successfully:', result);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }
}
