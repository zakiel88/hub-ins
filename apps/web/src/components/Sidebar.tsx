'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

const navSections = [
    {
        title: 'Overview',
        items: [
            { label: 'Dashboard', href: '/', icon: '📊' },
        ],
    },
    {
        title: 'Commerce',
        items: [
            { label: 'Brands', href: '/brands', icon: '🏷️' },
            { label: 'Products', href: '/products', icon: '📦' },
            { label: 'Variant Groups', href: '/products/variant-groups', icon: '🎨' },
            { label: 'SKUs', href: '/products/skus', icon: '🔧' },
            { label: 'Import', href: '/products/import', icon: '📥' },
            { label: 'Pricing', href: '/pricing', icon: '💰' },
        ],
    },
    {
        title: 'Product Data',
        items: [
            { label: 'Metafields', href: '/metafields', icon: '🔖' },
            { label: 'Approval Queue', href: '/approval-queue', icon: '✅' },
        ],
    },
    {
        title: 'Operations',
        items: [
            { label: 'Stores', href: '/stores', icon: '🏪' },
            { label: 'Orders', href: '/orders', icon: '📋' },
            { label: 'Merchandise', href: '/merchandise', icon: '👕' },
            { label: 'Inventory', href: '/inventory', icon: '📦' },
            { label: 'Procurement', href: '/procurement', icon: '📝' },
            { label: 'Sync Jobs', href: '/jobs', icon: '⚙️' },
        ],
    },
    {
        title: 'Settings',
        items: [
            { label: 'Users', href: '/settings/users', icon: '👥', adminOnly: true },
            { label: 'Audit Log', href: '/settings/audit', icon: '📝' },
        ],
    },
];

const roleColors: Record<string, string> = {
    admin: '#6366f1',
    merchandising: '#10b981',
    sourcing: '#f59e0b',
};

export default function Sidebar() {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);

    // Close sidebar on route change (mobile)
    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    // Close sidebar on escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setMobileOpen(false);
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        return pathname.startsWith(href);
    };

    return (
        <>
            {/* Mobile hamburger button */}
            <button
                className="mobile-menu-btn"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle menu"
            >
                {mobileOpen ? '✕' : '☰'}
            </button>

            {/* Overlay for mobile */}
            {mobileOpen && (
                <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
            )}

            <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        INS Hub <span>v1.1</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {navSections.map((section) => {
                        const items = section.items.filter(
                            (item: any) => !item.adminOnly || user?.role === 'admin'
                        );
                        if (items.length === 0) return null;
                        return (
                            <div key={section.title} className="nav-section">
                                <div className="nav-section-title">{section.title}</div>
                                {items.map((item: any) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`nav-item ${isActive(item.href) ? 'nav-item-active' : ''}`}
                                    >
                                        <span className="nav-icon">{item.icon}</span>
                                        <span className="nav-label">{item.label}</span>
                                    </Link>
                                ))}
                            </div>
                        );
                    })}
                </nav>

                {user && (
                    <div className="sidebar-footer">
                        <div className="user-card">
                            <div className="user-avatar">
                                {user.fullName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className="user-info">
                                <div className="user-name">{user.fullName}</div>
                                <div className="user-role" style={{ color: roleColors[user.role] || '#888' }}>
                                    {user.role}
                                </div>
                            </div>
                        </div>
                        <button className="logout-btn" onClick={logout} title="Logout">
                            ⏻
                        </button>
                    </div>
                )}
            </aside>
        </>
    );
}
