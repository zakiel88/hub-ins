'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

const STATE_COLORS: Record<string, string> = {
    NEW_FROM_SHOPIFY: '#3b82f6', NEEDS_CX: '#f59e0b', READY_FOR_MER: '#8b5cf6',
    WAITING_STOCK: '#06b6d4', NEEDS_PROCUREMENT: '#ef4444', PROCUREMENT_IN_PROGRESS: '#f97316',
    READY_TO_FULFILL: '#22c55e', ON_HOLD: '#6b7280', CANCELLED: '#991b1b',
};

const STATE_LABELS: Record<string, string> = {
    NEW_FROM_SHOPIFY: 'Đơn mới', NEEDS_CX: 'Cần CX', READY_FOR_MER: 'Chờ MER',
    WAITING_STOCK: 'Chờ hàng', NEEDS_PROCUREMENT: 'Cần mua', PROCUREMENT_IN_PROGRESS: 'Đang mua',
    READY_TO_FULFILL: 'Sẵn sàng giao', ON_HOLD: 'Tạm giữ', CANCELLED: 'Đã huỷ',
};

export default function DashboardPage() {
    const { user } = useAuth();
    const [stats, setStats] = useState<any>(null);
    const [pipeline, setPipeline] = useState<any>(null);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [brands, products, colorways, pricing, pipeRes] = await Promise.all([
                    api.getBrands().catch(() => ({ data: [], meta: { total: 0 } })),
                    api.getProducts().catch(() => ({ data: [], meta: { total: 0 } })),
                    api.getColorways().catch(() => ({ data: [], meta: { total: 0 } })),
                    api.getPricing().catch(() => ({ data: [], meta: { total: 0 } })),
                    api.getPipelineSummary().catch(() => ({ data: { total: 0, byState: {} } })),

                ]);
                setStats({
                    brands: brands.meta?.total ?? brands.data?.length ?? 0,
                    products: products.meta?.total ?? products.data?.length ?? 0,
                    colorways: colorways.meta?.total ?? colorways.data?.length ?? 0,
                    prices: pricing.meta?.total ?? pricing.data?.length ?? 0,
                });
                setPipeline(pipeRes.data);

            } catch { /* */ }
            finally { setLoading(false); }
        };
        load();
    }, []);

    return (
        <>
            <div className="page-header">
                <div className="page-header-row">
                    <div>
                        <h1 className="page-title">
                            {user ? `Chào ${user.fullName?.split(' ').pop()}` : 'Dashboard'}
                        </h1>
                        <p className="page-subtitle">Tổng quan hệ thống INS Hub</p>
                    </div>
                </div>
            </div>

            <div className="page-content">
                {loading ? (
                    <div className="page-loading"><div className="spinner" /></div>
                ) : (
                    <>
                        {/* Catalog Stats */}
                        <div className="stats-grid">
                            <div className="stat-card stat-accent-1">
                                <div className="stat-label">Thương hiệu</div>
                                <div className="stat-value">{stats?.brands ?? 0}</div>
                                <div className="stat-change positive">danh mục</div>
                            </div>
                            <div className="stat-card stat-accent-2">
                                <div className="stat-label">Sản phẩm</div>
                                <div className="stat-value">{stats?.products ?? 0}</div>
                                <div className="stat-change positive">trong catalog</div>
                            </div>
                            <div className="stat-card stat-accent-3">
                                <div className="stat-label">SKUs</div>
                                <div className="stat-value">{stats?.colorways ?? 0}</div>
                                <div className="stat-change positive">colorways</div>
                            </div>
                            <div className="stat-card stat-accent-4">
                                <div className="stat-label">Giá</div>
                                <div className="stat-value">{stats?.prices ?? 0}</div>
                                <div className="stat-change positive">market prices</div>
                            </div>
                        </div>

                        {/* Order Pipeline */}
                        {pipeline && (
                            <div className="card" style={{ marginTop: 24 }}>
                                <div className="card-header">
                                    <h3 className="card-title">🛒 Pipeline đơn hàng</h3>
                                    <a href="/orders" style={{ color: '#3b82f6', fontSize: 13, textDecoration: 'none' }}>Xem tất cả →</a>
                                </div>
                                <div className="card-body">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                                        <div style={{ fontSize: 36, fontWeight: 800, color: '#fff' }}>{pipeline.total}</div>
                                        <div style={{ color: '#888', fontSize: 14 }}>tổng đơn</div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                                        {Object.entries(pipeline.byState || {}).filter(([, v]) => (v as number) > 0).map(([state, count]) => (
                                            <a key={state} href={`/orders?state=${state}`} style={{ textDecoration: 'none', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, borderLeft: `3px solid ${STATE_COLORS[state] || '#555'}` }}>
                                                <div style={{ fontSize: 20, fontWeight: 700, color: STATE_COLORS[state] || '#fff' }}>{count as number}</div>
                                                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{STATE_LABELS[state] || state}</div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="dashboard-grid" style={{ marginTop: 20 }}>


                            {/* Quick Actions */}
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">⚡ Thao tác nhanh</h3>
                                </div>
                                <div className="card-body">
                                    <div className="quick-actions">
                                        <a href="/orders" className="quick-action-item">
                                            <span className="qa-icon">🛒</span>
                                            <span className="qa-label">Đơn hàng</span>
                                        </a>

                                        <a href="/procurement" className="quick-action-item">
                                            <span className="qa-icon">📝</span>
                                            <span className="qa-label">Mua hàng</span>
                                        </a>
                                        <a href="/stores" className="quick-action-item">
                                            <span className="qa-icon">🏪</span>
                                            <span className="qa-label">Stores</span>
                                        </a>
                                        <a href="/inventory" className="quick-action-item">
                                            <span className="qa-icon">📋</span>
                                            <span className="qa-label">Tồn kho</span>
                                        </a>
                                        <a href="/catalog" className="quick-action-item">
                                            <span className="qa-icon">📦</span>
                                            <span className="qa-label">Catalog</span>
                                        </a>
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
