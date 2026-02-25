'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

/**
 * Wrap any page that requires auth.
 * Redirects to /login if no valid session. Shows spinner while checking.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, loading } = useAuth();

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            window.location.href = '/login';
        }
    }, [loading, isAuthenticated]);

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner" />
            </div>
        );
    }

    if (!isAuthenticated) return null;

    return <>{children}</>;
}
