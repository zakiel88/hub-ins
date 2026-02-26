'use client';

import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/lib/auth-context';
import { AuthGuard } from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';

const NO_SIDEBAR_ROUTES = ['/login', '/forgot-password', '/reset-password'];

export function Providers({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const showSidebar = !NO_SIDEBAR_ROUTES.includes(pathname);

    return (
        <AuthProvider>
            {showSidebar ? (
                <AuthGuard>
                    <div className="layout">
                        <Sidebar />
                        <main className="main">{children}</main>
                    </div>
                </AuthGuard>
            ) : (
                children
            )}
        </AuthProvider>
    );
}
