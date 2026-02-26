'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { api } from '@/lib/api';

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm) { setError('Passwords do not match'); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters'); return; }

        setError(''); setLoading(true);
        try {
            const res = await api.resetPassword(token || '', password);
            if (res.success) {
                setSuccess(true);
            } else {
                setError(res.message || 'Reset failed');
            }
        } catch (err: any) {
            setError(err.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="login-page">
                <div className="login-card">
                    <div className="login-header">
                        <div className="login-logo">INS</div>
                        <h1 className="login-title">Invalid Link</h1>
                    </div>
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '12px' }}>❌</div>
                        <p style={{ color: 'var(--text-muted)' }}>This reset link is invalid or has expired.</p>
                        <a href="/forgot-password" style={{ display: 'inline-block', marginTop: '16px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                            Request a new link →
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <div className="login-logo">INS</div>
                    <h1 className="login-title">Reset Password</h1>
                    <p className="login-subtitle">Enter your new password</p>
                </div>

                {success ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '12px' }}>✅</div>
                        <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Password Reset!</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Your password has been changed successfully.</p>
                        <a href="/login" style={{
                            display: 'inline-block', marginTop: '20px', padding: '10px 24px',
                            background: 'var(--primary)', color: '#fff', borderRadius: '8px',
                            textDecoration: 'none', fontWeight: 600,
                        }}>
                            Sign In →
                        </a>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        {error && <div className="login-error">{error}</div>}
                        <div className="form-group">
                            <label className="form-label">New Password</label>
                            <input
                                className="form-input"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Min 6 characters"
                                required
                                minLength={6}
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Confirm Password</label>
                            <input
                                className="form-input"
                                type="password"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                placeholder="Repeat password"
                                required
                            />
                        </div>
                        <button className="btn-primary login-btn" type="submit" disabled={loading}>
                            {loading ? 'Resetting…' : '🔑 Reset Password'}
                        </button>
                    </form>
                )}

                <div className="login-footer">
                    <span>INS Commerce Hub v1.0</span>
                </div>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="login-page"><div className="login-card">
                <div className="page-loading"><div className="spinner" /></div>
            </div></div>
        }>
            <ResetPasswordForm />
        </Suspense>
    );
}
