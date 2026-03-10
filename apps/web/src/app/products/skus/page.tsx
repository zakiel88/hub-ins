'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

export default function SKUsPage() {
    const [variants, setVariants] = useState<any[]>([]);
    const [meta, setMeta] = useState<any>({ page: 1, limit: 50, total: 0, totalPages: 0 });
    const [brands, setBrands] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState('');
    const [skuSearch, setSkuSearch] = useState('');
    const [brandFilter, setBrandFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [hasIssues, setHasIssues] = useState(false);
    const [missingCost, setMissingCost] = useState(false);
    const [missingDiscount, setMissingDiscount] = useState(false);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);

    // Selection + Bulk
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [bulkAction, setBulkAction] = useState('');
    const [bulkValue, setBulkValue] = useState('');
    const [bulkDiscountType, setBulkDiscountType] = useState('PERCENT');
    const [bulkMsg, setBulkMsg] = useState('');

    // SKU lookup
    const [skuResult, setSkuResult] = useState<any>(null);
    const [skuLookupError, setSkuLookupError] = useState('');

    const fetchVariants = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {
                page: String(page), limit: String(limit),
                sortBy: 'sku', sortDir: 'asc',
            };
            if (search) params.search = search;
            if (brandFilter) params.brandId = brandFilter;
            if (statusFilter) params.status = statusFilter;
            if (hasIssues) params.hasIssues = 'true';
            if (missingCost) params.missingCost = 'true';
            if (missingDiscount) params.missingDiscount = 'true';

            const res = await api.getVariants(params);
            setVariants(res.data || []);
            setMeta(res.meta || {});
        } catch { /* ignore */ }
        setLoading(false);
    }, [page, limit, search, brandFilter, statusFilter, hasIssues, missingCost, missingDiscount]);

    useEffect(() => { fetchVariants(); }, [fetchVariants]);

    useEffect(() => {
        api.getBrands?.().then((r: any) => setBrands(r.data || [])).catch(() => { });
    }, []);

    const handleSkuLookup = async () => {
        if (!skuSearch.trim()) return;
        setSkuLookupError('');
        setSkuResult(null);
        try {
            const res = await api.getVariantBySku(skuSearch.trim());
            setSkuResult(res.data);
        } catch (err: any) {
            setSkuLookupError(err.message || 'Not found');
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelected(next);
    };

    const toggleAll = () => {
        if (selected.size === variants.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(variants.map(v => v.id)));
        }
    };

    const handleBulkAction = async () => {
        if (selected.size === 0) return;
        setBulkMsg('');

        const variantIds = Array.from(selected);
        let data: any = {};

        if (bulkAction === 'update_cost') {
            const val = parseFloat(bulkValue);
            if (isNaN(val) || val < 0) { setBulkMsg('Invalid cost value'); return; }
            data = { vendorCost: val };
        } else if (bulkAction === 'update_discount') {
            const val = parseFloat(bulkValue);
            if (isNaN(val) || val < 0) { setBulkMsg('Invalid discount value'); return; }
            data = { insDiscountType: bulkDiscountType, insDiscountValue: val };
        }

        try {
            const res = await api.globalBulkUpdateVariants(bulkAction, variantIds, data);
            setBulkMsg(`✅ ${res.updated} updated`);
            setSelected(new Set());
            fetchVariants();
        } catch (err: any) {
            setBulkMsg(`❌ ${err.message}`);
        }
    };

    const fmt = (v: any) => v != null ? `$${parseFloat(v).toFixed(2)}` : '—';
    const pct = (v: any) => v != null ? `${parseFloat(v).toFixed(1)}%` : '—';

    return (
        <div style={{ padding: '32px 40px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                        <a href="/products" style={{ color: '#818cf8', fontSize: 14 }}>← Products</a>
                    </div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>🔧 SKUs</h1>
                    <p style={{ color: '#94a3b8', margin: '4px 0 0' }}>SKU-level management, pricing, and bulk operations</p>
                </div>
                <div style={{ color: '#64748b', fontSize: 14 }}>{meta.total} SKUs total</div>
            </div>

            {/* SKU Lookup */}
            <div style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12, padding: '16px 20px', marginBottom: 16,
            }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, minWidth: 100 }}>SKU Lookup:</span>
                    <input
                        value={skuSearch} onChange={e => setSkuSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSkuLookup()}
                        placeholder="Enter exact SKU..."
                        style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 13 }}
                    />
                    <button onClick={handleSkuLookup} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#818cf8', color: 'white', fontSize: 13, cursor: 'pointer' }}>Search</button>
                    {skuResult && <button onClick={() => { setSkuResult(null); setSkuSearch(''); }} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>Clear</button>}
                </div>
                {skuLookupError && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{skuLookupError}</p>}
                {skuResult && (
                    <div style={{ marginTop: 12, padding: 12, background: 'rgba(129,140,248,0.08)', borderRadius: 8, fontSize: 13 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                            <div><span style={{ color: '#64748b' }}>SKU:</span> <strong>{skuResult.sku}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Product:</span> {skuResult.product?.title}</div>
                            <div><span style={{ color: '#64748b' }}>Brand:</span> {skuResult.product?.brand?.code || '—'}</div>
                            <div><span style={{ color: '#64748b' }}>Price:</span> {fmt(skuResult.price)} | <span style={{ color: '#64748b' }}>Cost:</span> {fmt(skuResult.vendorCost)}</div>
                        </div>
                        <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
                            <span style={{ color: '#64748b' }}>Color:</span> {skuResult.color || '—'}
                            <span style={{ color: '#64748b', marginLeft: 16 }}>Size:</span> {skuResult.size || '—'}
                            <span style={{ color: '#64748b', marginLeft: 16 }}>Margin:</span> {pct(skuResult.estimatedMargin)}
                            <span style={{ color: '#64748b', marginLeft: 16 }}>Status:</span>
                            <span style={{ color: skuResult.status === 'ACTIVE' ? '#34d399' : '#f59e0b' }}>{skuResult.status}</span>
                            <span style={{ color: '#64748b', marginLeft: 16 }}>Issues:</span> {skuResult.issues?.length || 0}
                            <span style={{ color: '#64748b', marginLeft: 16 }}>Stores:</span> {skuResult.storeMaps?.length || 0}
                        </div>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                    value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search SKU, title, color..."
                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 13, width: 220 }}
                />
                <select value={brandFilter} onChange={e => { setBrandFilter(e.target.value); setPage(1); }}
                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 13 }}>
                    <option value="">All Brands</option>
                    {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 13 }}>
                    <option value="">All Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="DRAFT">Draft</option>
                    <option value="DISCONTINUED">Discontinued</option>
                </select>
                {[
                    { label: '⚠️ Has Issues', active: hasIssues, toggle: () => { setHasIssues(!hasIssues); setPage(1); } },
                    { label: '💰 Missing Cost', active: missingCost, toggle: () => { setMissingCost(!missingCost); setPage(1); } },
                    { label: '🏷️ Missing Discount', active: missingDiscount, toggle: () => { setMissingDiscount(!missingDiscount); setPage(1); } },
                ].map(f => (
                    <button key={f.label} onClick={f.toggle} style={{
                        padding: '8px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                        border: `1px solid ${f.active ? '#818cf8' : 'rgba(255,255,255,0.1)'}`,
                        background: f.active ? 'rgba(129,140,248,0.15)' : 'transparent',
                        color: f.active ? '#818cf8' : '#94a3b8',
                    }}>{f.label}</button>
                ))}
                <select value={limit} onChange={e => { setLimit(parseInt(e.target.value)); setPage(1); }}
                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 13, marginLeft: 'auto' }}>
                    <option value="25">25/page</option>
                    <option value="50">50/page</option>
                    <option value="100">100/page</option>
                </select>
            </div>

            {/* Bulk Action Toolbar */}
            {selected.size > 0 && (
                <div style={{
                    display: 'flex', gap: 8, alignItems: 'center', padding: '12px 16px',
                    background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.3)',
                    borderRadius: 10, marginBottom: 16,
                }}>
                    <span style={{ color: '#818cf8', fontWeight: 600, fontSize: 14 }}>{selected.size} selected</span>
                    <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
                    <select value={bulkAction} onChange={e => setBulkAction(e.target.value)}
                        style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 13 }}>
                        <option value="">Choose action...</option>
                        <option value="update_cost">Set Vendor Cost</option>
                        <option value="update_discount">Set Discount</option>
                        <option value="activate">Activate</option>
                        <option value="archive">Archive (Discontinue)</option>
                        <option value="resolve_issues">Resolve Issues</option>
                    </select>
                    {(bulkAction === 'update_cost') && (
                        <input value={bulkValue} onChange={e => setBulkValue(e.target.value)} placeholder="Cost ($)"
                            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 13, width: 100 }} />
                    )}
                    {(bulkAction === 'update_discount') && (
                        <>
                            <select value={bulkDiscountType} onChange={e => setBulkDiscountType(e.target.value)}
                                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 13 }}>
                                <option value="PERCENT">Percent (%)</option>
                                <option value="FIXED">Fixed ($)</option>
                            </select>
                            <input value={bulkValue} onChange={e => setBulkValue(e.target.value)} placeholder="Value"
                                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 13, width: 80 }} />
                        </>
                    )}
                    {bulkAction && ['update_cost', 'update_discount', 'activate', 'archive', 'resolve_issues'].includes(bulkAction) && (
                        <button onClick={handleBulkAction} style={{
                            padding: '6px 18px', borderRadius: 6, border: 'none',
                            background: bulkAction === 'archive' ? '#ef4444' : '#818cf8',
                            color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        }}>Apply</button>
                    )}
                    <button onClick={() => setSelected(new Set())} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer', marginLeft: 'auto' }}>Clear Selection</button>
                    {bulkMsg && <span style={{ fontSize: 13, fontWeight: 600, color: bulkMsg.startsWith('✅') ? '#34d399' : '#ef4444' }}>{bulkMsg}</span>}
                </div>
            )}

            {/* Table */}
            <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <th style={{ padding: '10px 12px', width: 32 }}>
                                <input type="checkbox" checked={selected.size === variants.length && variants.length > 0} onChange={toggleAll} />
                            </th>
                            <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>SKU</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Product</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Brand</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Color</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Size</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Price</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Cost</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Margin</th>
                            <th style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Status</th>
                            <th style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Issues</th>
                            <th style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Stores</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr><td colSpan={12} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading...</td></tr>
                        )}
                        {!loading && variants.length === 0 && (
                            <tr><td colSpan={12} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>No SKUs found</td></tr>
                        )}
                        {!loading && variants.map(v => (
                            <tr key={v.id} style={{
                                borderTop: '1px solid rgba(255,255,255,0.04)',
                                background: selected.has(v.id) ? 'rgba(129,140,248,0.08)' : 'transparent',
                            }}>
                                <td style={{ padding: '8px 12px' }}>
                                    <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggleSelect(v.id)} />
                                </td>
                                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>{v.sku}</td>
                                <td style={{ padding: '8px 12px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    <a href={`/products/${v.product?.id || v.productId}`} style={{ color: '#818cf8', textDecoration: 'none' }}>
                                        {v.product?.title || '—'}
                                    </a>
                                </td>
                                <td style={{ padding: '8px 12px' }}>{v.product?.brand?.code || '—'}</td>
                                <td style={{ padding: '8px 12px' }}>{v.color || '—'}</td>
                                <td style={{ padding: '8px 12px' }}>{v.size || '—'}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(v.price)}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: v.vendorCost == null ? '#ef4444' : '#e2e8f0' }}>
                                    {fmt(v.vendorCost)}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: v.estimatedMargin != null && parseFloat(v.estimatedMargin) < 0 ? '#ef4444' : '#34d399' }}>
                                    {pct(v.estimatedMargin)}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                    <span style={{
                                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                                        background: v.status === 'ACTIVE' ? 'rgba(52,211,153,0.15)' : v.status === 'DRAFT' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                                        color: v.status === 'ACTIVE' ? '#34d399' : v.status === 'DRAFT' ? '#f59e0b' : '#ef4444',
                                    }}>{v.status}</span>
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'center', color: (v._count?.issues || 0) > 0 ? '#f59e0b' : '#34d399' }}>
                                    {v._count?.issues || 0}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'center', color: '#818cf8' }}>
                                    {v._count?.storeMaps || 0}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {meta.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                    <span style={{ color: '#64748b', fontSize: 13 }}>
                        Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, meta.total)} of {meta.total}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={{
                            padding: '6px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
                            background: 'transparent', color: page <= 1 ? '#374151' : '#94a3b8', fontSize: 13, cursor: page <= 1 ? 'default' : 'pointer',
                        }}>← Prev</button>
                        <span style={{ padding: '6px 12px', color: '#94a3b8', fontSize: 13 }}>Page {page} of {meta.totalPages}</span>
                        <button disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)} style={{
                            padding: '6px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
                            background: 'transparent', color: page >= meta.totalPages ? '#374151' : '#94a3b8', fontSize: 13, cursor: page >= meta.totalPages ? 'default' : 'pointer',
                        }}>Next →</button>
                    </div>
                </div>
            )}
        </div>
    );
}
