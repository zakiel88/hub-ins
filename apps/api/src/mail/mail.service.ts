import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly resend: Resend;
    private readonly fromEmail: string;
    private readonly appUrl: string;

    constructor() {
        this.resend = new Resend(process.env.RESEND_API_KEY);
        this.fromEmail = process.env.MAIL_FROM || 'INS Hub <onboarding@resend.dev>';
        this.appUrl = process.env.APP_URL || 'http://localhost:3000';
    }

    /** Send welcome email when admin creates a new user */
    async sendWelcomeEmail(to: string, fullName: string, tempPassword: string) {
        try {
            this.logger.log(`Sending welcome email to ${to} from ${this.fromEmail}`);
            const res = await this.resend.emails.send({
                from: this.fromEmail,
                to,
                subject: '🎉 Welcome to INS Commerce Hub',
                html: this.welcomeTemplate(fullName, to, tempPassword),
            });
            this.logger.log(`Welcome email result: ${JSON.stringify(res)}`);
        } catch (err: any) {
            this.logger.error(`Failed to send welcome email to ${to}: ${err.message}`);
            this.logger.error(`Full error: ${JSON.stringify(err)}`);
        }
    }

    /** Send password reset link */
    async sendPasswordResetEmail(to: string, fullName: string, token: string) {
        const resetUrl = `${this.appUrl}/reset-password?token=${token}`;
        try {
            this.logger.log(`Sending reset email to ${to} from ${this.fromEmail}`);
            const res = await this.resend.emails.send({
                from: this.fromEmail,
                to,
                subject: '🔑 Reset your INS Hub password',
                html: this.resetTemplate(fullName, resetUrl),
            });
            this.logger.log(`Reset email result: ${JSON.stringify(res)}`);
        } catch (err: any) {
            this.logger.error(`Failed to send reset email to ${to}: ${err.message}`);
            this.logger.error(`Full error: ${JSON.stringify(err)}`);
        }
    }

    // ──────────── HTML Templates ────────────

    private baseStyle = `
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        max-width: 520px; margin: 0 auto; padding: 32px;
        background: #0f0f23; color: #e2e8f0; border-radius: 12px;
    `;

    private btnStyle = `
        display: inline-block; padding: 12px 28px; border-radius: 8px;
        background: #6366f1; color: #ffffff; text-decoration: none;
        font-weight: 600; font-size: 14px;
    `;

    private welcomeTemplate(name: string, email: string, password: string) {
        return `
        <div style="${this.baseStyle}">
            <div style="text-align:center; margin-bottom:24px;">
                <div style="display:inline-block; padding:8px 16px; background:#6366f1; border-radius:8px; font-weight:700; color:#fff; font-size:18px;">INS</div>
            </div>
            <h2 style="color:#f1f5f9; margin:0 0 8px;">Welcome, ${name}! 👋</h2>
            <p style="color:#94a3b8; line-height:1.6;">Your INS Commerce Hub account has been created. Use the credentials below to sign in:</p>
            <div style="background:#1a1a3e; border:1px solid #2d2d5e; border-radius:8px; padding:16px; margin:20px 0;">
                <div style="margin-bottom:8px;"><span style="color:#94a3b8;">Email:</span> <strong style="color:#e2e8f0;">${email}</strong></div>
                <div><span style="color:#94a3b8;">Password:</span> <strong style="color:#fbbf24;">${password}</strong></div>
            </div>
            <p style="color:#f87171; font-size:13px;">⚠️ Please change your password after first login.</p>
            <div style="text-align:center; margin:24px 0;">
                <a href="${this.appUrl}/login" style="${this.btnStyle}">Sign In to INS Hub →</a>
            </div>
            <hr style="border:none; border-top:1px solid #2d2d5e; margin:24px 0;" />
            <p style="color:#64748b; font-size:12px; text-align:center;">INS Commerce Hub • INECSO</p>
        </div>`;
    }

    private resetTemplate(name: string, resetUrl: string) {
        return `
        <div style="${this.baseStyle}">
            <div style="text-align:center; margin-bottom:24px;">
                <div style="display:inline-block; padding:8px 16px; background:#6366f1; border-radius:8px; font-weight:700; color:#fff; font-size:18px;">INS</div>
            </div>
            <h2 style="color:#f1f5f9; margin:0 0 8px;">Reset Password</h2>
            <p style="color:#94a3b8; line-height:1.6;">Hi ${name}, we received a request to reset your password. Click the button below:</p>
            <div style="text-align:center; margin:28px 0;">
                <a href="${resetUrl}" style="${this.btnStyle}">🔑 Reset My Password</a>
            </div>
            <p style="color:#94a3b8; font-size:13px; line-height:1.5;">This link expires in <strong style="color:#fbbf24;">1 hour</strong>. If you didn't request this, you can safely ignore this email.</p>
            <hr style="border:none; border-top:1px solid #2d2d5e; margin:24px 0;" />
            <p style="color:#64748b; font-size:12px; text-align:center;">INS Commerce Hub • INECSO</p>
        </div>`;
    }
}
