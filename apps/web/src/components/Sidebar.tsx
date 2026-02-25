'use client';

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
            { label: 'Catalog', href: '/catalog', icon: '📦' },
            { label: 'Pricing', href: '/pricing', icon: '💰' },
        ],
    },
    {
        title: 'Operations',
        items: [
            { label: 'Stores', href: '/stores', icon: '🏪' },
            { label: 'Orders', href: '/orders', icon: '🛒' },
            { label: 'Inventory', href: '/inventory', icon: '📋' },
        ],
    },
    {
        title: 'Settings',
        items: [
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

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        return pathname.startsWith(href);
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    INS Hub <span>v1.0</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {navSections.map((section) => (
                    <div key={section.title} className="nav-section">
                        <div className="nav-section-title">{section.title}</div>
                        {section.items.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`nav-item ${isActive(item.href) ? 'nav-item-active' : ''}`}
                            >
                                <span className="nav-icon">{item.icon}</span>
                                {item.label}
                            </Link>
                        ))}
                    </div>
                ))}
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
    );
}
