'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            await api.forgotPassword(email);
            setSent(true);
        } catch (err: any) {
            setError(err.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <div className="login-logo">INS</div>
                    <h1 className="login-title">Forgot Password</h1>
                    <p className="login-subtitle">Enter your email to receive a reset link</p>
                </div>

                {sent ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📧</div>
                        <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Check your email</h3>
                        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '14px' }}>
                            If <strong>{email}</strong> is registered, you&apos;ll receive a password reset link shortly.
                        </p>
                        <a href="/login" style={{ display: 'inline-block', marginTop: '20px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                            ← Back to login
                        </a>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        {error && <div className="login-error">{error}</div>}
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input
                                className="form-input"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                required
                                autoFocus
                            />
                        </div>
                        <button className="btn-primary login-btn" type="submit" disabled={loading}>
                            {loading ? 'Sending…' : 'Send Reset Link'}
                        </button>
                    </form>
                )}

                <div style={{ textAlign: 'center', marginTop: '12px' }}>
                    <a href="/login" style={{ color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none' }}>
                        ← Back to login
                    </a>
                </div>
                <div className="login-footer">
                    <span>INS Commerce Hub v1.0</span>
                </div>
            </div>
        </div>
    );
}
