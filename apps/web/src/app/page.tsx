'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

export default function DashboardPage() {
    const { user } = useAuth();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [brands, products, colorways, pricing] = await Promise.all([
                    api.getBrands().catch(() => ({ data: [], meta: { total: 0 } })),
                    api.getProducts().catch(() => ({ data: [], meta: { total: 0 } })),
                    api.getColorways().catch(() => ({ data: [], meta: { total: 0 } })),
                    api.getPricing().catch(() => ({ data: [], meta: { total: 0 } })),
                ]);
                setStats({
                    brands: brands.meta?.total ?? brands.data?.length ?? 0,
                    products: products.meta?.total ?? products.data?.length ?? 0,
                    colorways: colorways.meta?.total ?? colorways.data?.length ?? 0,
                    prices: pricing.meta?.total ?? pricing.data?.length ?? 0,
                });
            } catch {
                // stats stay null, show defaults
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    return (
        <>
            <div className="page-header">
                <div className="page-header-row">
                    <div>
                        <h1 className="page-title">
                            {user ? `Welcome back, ${user.fullName?.split(' ')[0]}` : 'Dashboard'}
                        </h1>
                        <p className="page-subtitle">INS Commerce Hub overview — your operational command center</p>
                    </div>
                </div>
            </div>

            <div className="page-content">
                {loading ? (
                    <div className="page-loading"><div className="spinner" /></div>
                ) : (
                    <>
                        <div className="stats-grid">
                            <div className="stat-card stat-accent-1">
                                <div className="stat-label">Brands</div>
                                <div className="stat-value">{stats?.brands ?? 0}</div>
                                <div className="stat-change positive">active portfolio</div>
                            </div>
                            <div className="stat-card stat-accent-2">
                                <div className="stat-label">Products</div>
                                <div className="stat-value">{stats?.products ?? 0}</div>
                                <div className="stat-change positive">in catalog</div>
                            </div>
                            <div className="stat-card stat-accent-3">
                                <div className="stat-label">SKUs</div>
                                <div className="stat-value">{stats?.colorways ?? 0}</div>
                                <div className="stat-change positive">colorways</div>
                            </div>
                            <div className="stat-card stat-accent-4">
                                <div className="stat-label">Prices</div>
                                <div className="stat-value">{stats?.prices ?? 0}</div>
                                <div className="stat-change positive">market prices</div>
                            </div>
                        </div>

                        <div className="dashboard-grid">
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">⚡ Quick Actions</h3>
                                </div>
                                <div className="card-body">
                                    <div className="quick-actions">
                                        <a href="/brands" className="quick-action-item">
                                            <span className="qa-icon">🏷️</span>
                                            <span className="qa-label">Manage Brands</span>
                                        </a>
                                        <a href="/catalog" className="quick-action-item">
                                            <span className="qa-icon">📦</span>
                                            <span className="qa-label">Browse Catalog</span>
                                        </a>
                                        <a href="/pricing" className="quick-action-item">
                                            <span className="qa-icon">💰</span>
                                            <span className="qa-label">Review Pricing</span>
                                        </a>
                                        <a href="/inventory" className="quick-action-item">
                                            <span className="qa-icon">📋</span>
                                            <span className="qa-label">Check Inventory</span>
                                        </a>
                                        <a href="/orders" className="quick-action-item">
                                            <span className="qa-icon">🛒</span>
                                            <span className="qa-label">View Orders</span>
                                        </a>
                                    </div>
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">📋 System Status</h3>
                                </div>
                                <div className="card-body">
                                    <div className="status-list">
                                        <div className="status-row">
                                            <span className="status-dot online"></span>
                                            <span className="status-label">API Server</span>
                                            <span className="status-value">Operational</span>
                                        </div>
                                        <div className="status-row">
                                            <span className="status-dot online"></span>
                                            <span className="status-label">Database</span>
                                            <span className="status-value">Connected</span>
                                        </div>
                                        <div className="status-row">
                                            <span className="status-dot offline"></span>
                                            <span className="status-label">Shopify Sync</span>
                                            <span className="status-value">Not connected</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
