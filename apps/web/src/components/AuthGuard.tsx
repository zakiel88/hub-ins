'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

/**
 * AuthGuard — redirects unauthenticated users to /login.
 * Wrap around any page/layout that requires authentication.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, loading } = useAuth();

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            window.location.href = '/login';
        }
    }, [loading, isAuthenticated]);

    // Show nothing while checking auth (prevents flash of protected content)
    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div className="spinner" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return null; // Will redirect via useEffect
    }

    return <>{children}</>;
}
