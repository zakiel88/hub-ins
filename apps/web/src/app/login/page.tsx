'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
            window.location.href = '/';
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <div className="login-logo">INS</div>
                    <h1 className="login-title">Commerce Hub</h1>
                    <p className="login-subtitle">Sign in to manage your operations</p>
                </div>
                <form onSubmit={handleSubmit}>
                    {error && <div className="login-error">{error}</div>}
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            className="form-input"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@ins.vn"
                            required
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            className="form-input"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <button className="btn-primary login-btn" type="submit" disabled={loading}>
                        {loading ? 'Signing in…' : 'Sign In'}
                    </button>
                </form>
                <div style={{ textAlign: 'center', marginTop: '12px' }}>
                    <a href="/forgot-password" style={{ color: 'var(--primary)', fontSize: '13px', textDecoration: 'none' }}>
                        Forgot password?
                    </a>
                </div>
                <div className="login-footer">
                    <span>INS Commerce Hub v1.0</span>
                </div>
            </div>
        </div>
    );
}
