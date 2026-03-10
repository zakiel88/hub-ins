'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    ACTIVE: { label: 'Active', color: '#22c55e', bg: '#22c55e22' },
    DRAFT: { label: 'Draft', color: '#f59e0b', bg: '#f59e0b22' },
    ARCHIVED: { label: 'Archived', color: '#6b7280', bg: '#6b728022' },
};

const selectStyle: React.CSSProperties = {
    padding: '8px 12px',
    background: 'var(--bg-surface, #1a1a24)',
    border: '1px solid var(--border, #2a2a38)',
    borderRadius: 8,
    color: 'var(--text-primary, #f0f0f5)',
    fontSize: 13,
    cursor: 'pointer',
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    paddingRight: 28,
    minWidth: 130,
};

export default function ProductsPage() {
    const [products, setProducts] = useState<any[]>([]);
    const [meta, setMeta] = useState<any>({});
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [brands, setBrands] = useState<any[]>([]);

    // Filters
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [brandFilter, setBrandFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [hasIssues, setHasIssues] = useState(false);
    const [page, setPage] = useState(1);
    const [sortBy, setSortBy] = useState('updatedAt');
    const [sortDir, setSortDir] = useState('desc');
    const limit = 25;

    useEffect(() => {
        api.getBrands().then(res => setBrands(res.data || [])).catch(() => { });
        api.getProductsSummary().then(res => setSummary(res.data)).catch(() => { });
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {
                page: String(page), limit: String(limit), sortBy, sortDir,
            };
            if (search) params.search = search;
            if (brandFilter) params.brandId = brandFilter;
            if (statusFilter) params.status = statusFilter;
            if (categoryFilter) params.category = categoryFilter;
            if (hasIssues) params.hasIssues = 'true';

            const res = await api.getProducts(params);
            setProducts(res.data || []);
            setMeta(res.meta || {});
        } catch (e: any) {
            console.error('Failed to load products:', e);
        } finally {
            setLoading(false);
        }
    }, [page, search, brandFilter, statusFilter, categoryFilter, hasIssues, sortBy, sortDir]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSearch = () => { setSearch(searchInput); setPage(1); };
    const totalPages = meta.totalPages || 1;

    return (
        <>
            <style>{`
                .products-page select option { background: #1a1a24; color: #f0f0f5; }
                .products-page select:focus { border-color: #6366f1; outline: none; box-shadow: 0 0 0 2px rgba(99,102,241,0.2); }
                .sort-btn { background: none; border: none; color: #888; cursor: pointer; font-size: 11px; padding: 0 2px; }
                .sort-btn.active { color: #6366f1; }
            `}</style>
            <div className="products-page" style={{ padding: 32, maxWidth: 1400 }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                    <div>
                        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0 }}>
                            📦 Products
                        </h1>
                        <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
                            Master product catalog — manage products, variants, and pricing
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Link href="/products/new" style={{
                            padding: '8px 16px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                            borderRadius: 8, color: '#818cf8', textDecoration: 'none', fontSize: 13, fontWeight: 600,
                        }}>
                            ➕ New Product
                        </Link>
                        <Link href="/products/issues" style={{
                            padding: '8px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: 8, color: '#ef4444', textDecoration: 'none', fontSize: 13, fontWeight: 600,
                        }}>
                            ⚠ Issues {summary?.withOpenIssues ? `(${summary.withOpenIssues})` : ''}
                        </Link>
                    </div>
                </div>

                {/* Summary Cards */}
                {summary && (
                    <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                        {[
                            { key: '', label: 'TOTAL', value: summary.total, color: '#3b82f6' },
                            { key: 'ACTIVE', label: 'ACTIVE', value: summary.byStatus?.ACTIVE || 0, color: '#22c55e' },
                            { key: 'DRAFT', label: 'DRAFT', value: summary.byStatus?.DRAFT || 0, color: '#f59e0b' },
                            { key: 'ARCHIVED', label: 'ARCHIVED', value: summary.byStatus?.ARCHIVED || 0, color: '#6b7280' },
                        ].map(card => (
                            <button key={card.key} onClick={() => { setStatusFilter(card.key); setPage(1); }} style={{
                                background: statusFilter === card.key ? `${card.color}22` : 'var(--bg-surface, rgba(255,255,255,0.03))',
                                border: statusFilter === card.key ? `1px solid ${card.color}55` : '1px solid var(--border, rgba(255,255,255,0.06))',
                                borderRadius: 10, padding: '12px 20px', cursor: 'pointer', textAlign: 'left' as const, minWidth: 100,
                            }}>
                                <div style={{ color: '#888', fontSize: 10, fontWeight: 600, letterSpacing: '0.5px' }}>{card.label}</div>
                                <div style={{ color: card.color, fontSize: 22, fontWeight: 700 }}>{card.value}</div>
                            </button>
                        ))}
                        <button onClick={() => { setHasIssues(!hasIssues); setPage(1); }} style={{
                            background: hasIssues ? 'rgba(239,68,68,0.15)' : 'var(--bg-surface, rgba(255,255,255,0.03))',
                            border: hasIssues ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--border, rgba(255,255,255,0.06))',
                            borderRadius: 10, padding: '12px 20px', cursor: 'pointer', textAlign: 'left' as const, minWidth: 100,
                        }}>
                            <div style={{ color: '#888', fontSize: 10, fontWeight: 600, letterSpacing: '0.5px' }}>WITH ISSUES</div>
                            <div style={{ color: '#ef4444', fontSize: 22, fontWeight: 700 }}>{summary.withOpenIssues || 0}</div>
                        </button>
                        <div style={{
                            background: 'var(--bg-surface, rgba(255,255,255,0.03))',
                            border: '1px solid var(--border, rgba(255,255,255,0.06))',
                            borderRadius: 10, padding: '12px 20px', minWidth: 100,
                        }}>
                            <div style={{ color: '#888', fontSize: 10, fontWeight: 600, letterSpacing: '0.5px' }}>VARIANT GROUPS</div>
                            <div style={{ color: '#818cf8', fontSize: 22, fontWeight: 700 }}>{summary.totalVariantGroups || 0}</div>
                        </div>
                        <div style={{
                            background: 'var(--bg-surface, rgba(255,255,255,0.03))',
                            border: '1px solid var(--border, rgba(255,255,255,0.06))',
                            borderRadius: 10, padding: '12px 20px', minWidth: 100,
                        }}>
                            <div style={{ color: '#888', fontSize: 10, fontWeight: 600, letterSpacing: '0.5px' }}>TOTAL SKUS</div>
                            <div style={{ color: '#a78bfa', fontSize: 22, fontWeight: 700 }}>{summary.totalSKUs || 0}</div>
                        </div>
                    </div>
                )}

                {/* Filter Bar */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select value={brandFilter} onChange={e => { setBrandFilter(e.target.value); setPage(1); }} style={selectStyle}>
                        <option value="">All Brands</option>
                        {brands.map((b: any) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>

                    <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={selectStyle}>
                        <option value="">All Status</option>
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                        ))}
                    </select>

                    <div style={{ display: 'flex', gap: 0 }}>
                        <input
                            type="text" placeholder="Search title, style code..."
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            style={{
                                padding: '8px 14px', background: 'var(--bg-surface, rgba(255,255,255,0.06))',
                                border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: '8px 0 0 8px',
                                color: '#fff', fontSize: 13, width: 220,
                            }}
                        />
                        <button onClick={handleSearch} style={{
                            padding: '8px 14px', background: 'var(--accent, #6366f1)', border: 'none',
                            borderRadius: '0 8px 8px 0', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                        }}>🔍</button>
                    </div>
                    {search && (
                        <button onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
                            style={{
                                padding: '6px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
                                borderRadius: 8, color: '#aaa', cursor: 'pointer', fontSize: 12,
                            }}>
                            ✕ Clear
                        </button>
                    )}
                    <div style={{ marginLeft: 'auto', color: '#666', fontSize: 12 }}>
                        {meta.total || 0} products
                    </div>
                </div>

                {/* Table */}
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: 50 }}>#</th>
                                <th>
                                    Title
                                    <button className={`sort-btn ${sortBy === 'title' ? 'active' : ''}`}
                                        onClick={() => { setSortBy('title'); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                                        {sortBy === 'title' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                                    </button>
                                </th>
                                <th>Brand</th>
                                <th>Style Code</th>
                                <th>Category</th>
                                <th style={{ width: 80 }}>SKUs</th>
                                <th style={{ width: 80 }}>Issues</th>
                                <th style={{ width: 100 }}>Status</th>
                                <th style={{ width: 140 }}>
                                    Updated
                                    <button className={`sort-btn ${sortBy === 'updatedAt' ? 'active' : ''}`}
                                        onClick={() => { setSortBy('updatedAt'); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                                        {sortBy === 'updatedAt' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                                    </button>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#666' }}>⏳ Loading...</td></tr>
                            ) : products.length === 0 ? (
                                <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#666' }}>
                                    No products found. {!search && !brandFilter && !statusFilter ? 'Import from Shopify or upload intake sheet to get started.' : ''}
                                </td></tr>
                            ) : products.map((p: any, idx: number) => {
                                const statusInfo = STATUS_CONFIG[p.status] || STATUS_CONFIG.DRAFT;
                                return (
                                    <tr key={p.id} className="table-row-link">
                                        <td className="cell-muted" style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                                            {(page - 1) * limit + idx + 1}
                                        </td>
                                        <td>
                                            <Link href={`/products/${p.id}`} style={{ color: '#e0e0f0', textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
                                                {p.title}
                                            </Link>
                                            {p.season && <span style={{ marginLeft: 8, color: '#666', fontSize: 11 }}>{p.season}</span>}
                                        </td>
                                        <td>
                                            {p.brand ? (
                                                <span className="market-tag" style={{ background: '#8b5cf622', color: '#8b5cf6', border: 'none' }}>
                                                    {p.brand.name}
                                                </span>
                                            ) : <span className="cell-muted">—</span>}
                                        </td>
                                        <td className="cell-mono" style={{ fontSize: 12 }}>{p.styleCode || '—'}</td>
                                        <td className="cell-muted" style={{ fontSize: 12 }}>{p.category || p.productType || '—'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{
                                                display: 'inline-block', padding: '2px 8px', borderRadius: 6,
                                                background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontSize: 12, fontWeight: 600,
                                            }}>
                                                {p._count?.variants || 0}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {(p._count?.issues || 0) > 0 ? (
                                                <span style={{
                                                    display: 'inline-block', padding: '2px 8px', borderRadius: 6,
                                                    background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: 12, fontWeight: 600,
                                                }}>
                                                    {p._count.issues}
                                                </span>
                                            ) : <span className="cell-muted">—</span>}
                                        </td>
                                        <td>
                                            <span className="status-badge" style={{ background: statusInfo.bg, color: statusInfo.color }}>
                                                {statusInfo.label}
                                            </span>
                                        </td>
                                        <td className="cell-muted" style={{ fontSize: 12 }}>
                                            {new Date(p.updatedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-outline"
                            style={{ opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'default' : 'pointer' }}>
                            ← Prev
                        </button>
                        <span style={{ padding: '6px 14px', color: '#888', fontSize: 13 }}>
                            Page {page}/{totalPages}
                        </span>
                        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-outline"
                            style={{ opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? 'default' : 'pointer' }}>
                            Next →
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
