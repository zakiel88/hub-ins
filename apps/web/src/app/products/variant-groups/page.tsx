'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

export default function VariantGroupsPage() {
    const [groups, setGroups] = useState<any[]>([]);
    const [meta, setMeta] = useState<any>({ page: 1, limit: 25, total: 0, totalPages: 0 });
    const [brands, setBrands] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [search, setSearch] = useState('');
    const [brandFilter, setBrandFilter] = useState('');
    const [colorFilter, setColorFilter] = useState('');
    const [materialFilter, setMaterialFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [hasIssues, setHasIssues] = useState(false);
    const [page, setPage] = useState(1);
    const [limit] = useState(25);

    const fetchGroups = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = { page: String(page), limit: String(limit) };
            if (search) params.search = search;
            if (brandFilter) params.brandId = brandFilter;
            if (colorFilter) params.color = colorFilter;
            if (materialFilter) params.material = materialFilter;
            if (statusFilter) params.status = statusFilter;
            if (hasIssues) params.hasIssues = 'true';

            const res = await api.getVariantGroups(params);
            setGroups(res.data || []);
            setMeta(res.meta || {});
        } catch { /* ignore */ }
        setLoading(false);
    }, [page, limit, search, brandFilter, colorFilter, materialFilter, statusFilter, hasIssues]);

    useEffect(() => { fetchGroups(); }, [fetchGroups]);

    useEffect(() => {
        api.getBrands?.().then((r: any) => setBrands(r.data || [])).catch(() => { });
    }, []);

    const fmt = (v: any) => v != null ? `$${parseFloat(v).toFixed(2)}` : '—';

    const inputStyle = {
        padding: '8px 12px', borderRadius: 6,
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 13,
    };

    return (
        <div style={{ padding: '32px 40px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                        <a href="/products" style={{ color: '#818cf8', fontSize: 14 }}>← Products</a>
                    </div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>🎨 Variant Groups</h1>
                    <p style={{ color: '#94a3b8', margin: '4px 0 0' }}>
                        Product variants grouped by color and material — INS internal grouping
                    </p>
                </div>
                <div style={{ color: '#64748b', fontSize: 14 }}>{meta.total} groups</div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                    value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search product, SKU, color..."
                    style={{ ...inputStyle, width: 220 }}
                />
                <select value={brandFilter} onChange={e => { setBrandFilter(e.target.value); setPage(1); }}
                    style={inputStyle}>
                    <option value="">All Brands</option>
                    {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <input
                    value={colorFilter} onChange={e => { setColorFilter(e.target.value); setPage(1); }}
                    placeholder="Filter by color..."
                    style={{ ...inputStyle, width: 140 }}
                />
                <input
                    value={materialFilter} onChange={e => { setMaterialFilter(e.target.value); setPage(1); }}
                    placeholder="Filter by material..."
                    style={{ ...inputStyle, width: 140 }}
                />
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                    style={inputStyle}>
                    <option value="">All Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="DRAFT">Draft</option>
                    <option value="DISCONTINUED">Discontinued</option>
                </select>
                <button onClick={() => { setHasIssues(!hasIssues); setPage(1); }} style={{
                    padding: '8px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                    border: `1px solid ${hasIssues ? '#818cf8' : 'rgba(255,255,255,0.1)'}`,
                    background: hasIssues ? 'rgba(129,140,248,0.15)' : 'transparent',
                    color: hasIssues ? '#818cf8' : '#94a3b8',
                }}>⚠️ Has Issues</button>
            </div>

            {/* Groups Grid */}
            {loading && (
                <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>Loading variant groups...</div>
            )}

            {!loading && groups.length === 0 && (
                <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>No variant groups found</div>
            )}

            {!loading && groups.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
                    {groups.map((g: any) => {
                        const hasErrors = g.issueFlags?.some((f: string) => f.includes('MISSING_SKU') || f.includes('MARGIN_NEGATIVE'));
                        return (
                            <div key={g.id} style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: `1px solid ${g.issueCount > 0 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'}`,
                                borderRadius: 12, padding: 20, transition: 'border-color 0.2s',
                            }}>
                                {/* Group Header */}
                                <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
                                    {/* Color swatch / image */}
                                    <div style={{
                                        width: 52, height: 52, borderRadius: 8, flexShrink: 0,
                                        background: g.imageUrl
                                            ? `url(${g.imageUrl}) center/cover no-repeat`
                                            : 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        {!g.imageUrl && <span style={{ fontSize: 20 }}>🎨</span>}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>
                                            {g.groupName}
                                        </div>
                                        <a href={`/products/${g.productId}`} style={{
                                            color: '#818cf8', textDecoration: 'none', fontSize: 13,
                                            display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {g.productTitle}
                                        </a>
                                        {g.styleCode && (
                                            <span style={{ color: '#64748b', fontSize: 11, fontFamily: 'monospace' }}>{g.styleCode}</span>
                                        )}
                                    </div>
                                    {/* Brand badge */}
                                    {g.brand?.code && (
                                        <span style={{
                                            padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                                            background: 'rgba(129,140,248,0.15)', color: '#818cf8',
                                            height: 'fit-content', flexShrink: 0,
                                        }}>{g.brand.code}</span>
                                    )}
                                </div>

                                {/* Stats Row */}
                                <div style={{
                                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                                    gap: 8, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.04)',
                                    fontSize: 12,
                                }}>
                                    <div>
                                        <div style={{ color: '#64748b', marginBottom: 2 }}>SKUs</div>
                                        <div style={{ fontWeight: 700, color: '#e2e8f0' }}>{g.skuCount}</div>
                                    </div>
                                    <div>
                                        <div style={{ color: '#64748b', marginBottom: 2 }}>Price Range</div>
                                        <div style={{ fontWeight: 600, color: '#e2e8f0' }}>
                                            {g.priceMin != null ? `${fmt(g.priceMin)}–${fmt(g.priceMax)}` : '—'}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ color: '#64748b', marginBottom: 2 }}>Status</div>
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            {(g.statuses || []).map((s: string) => (
                                                <span key={s} style={{
                                                    padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                                                    background: s === 'ACTIVE' ? 'rgba(52,211,153,0.15)' : s === 'DRAFT' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                                                    color: s === 'ACTIVE' ? '#34d399' : s === 'DRAFT' ? '#f59e0b' : '#ef4444',
                                                }}>{s}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ color: '#64748b', marginBottom: 2 }}>Issues</div>
                                        <div style={{
                                            fontWeight: 700,
                                            color: g.issueCount > 0 ? (hasErrors ? '#ef4444' : '#f59e0b') : '#34d399',
                                        }}>
                                            {g.issueCount > 0 ? `${g.issueCount} ⚠️` : '✓'}
                                        </div>
                                    </div>
                                </div>

                                {/* Size Run Tags */}
                                {g.sizeRun?.length > 0 && (
                                    <div style={{
                                        display: 'flex', gap: 4, flexWrap: 'wrap',
                                        padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.04)',
                                    }}>
                                        <span style={{ color: '#64748b', fontSize: 11, marginRight: 4, lineHeight: '20px' }}>Sizes:</span>
                                        {g.sizeRun.map((s: string) => (
                                            <span key={s} style={{
                                                padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                                background: 'rgba(99,102,241,0.1)', color: '#818cf8',
                                            }}>{s}</span>
                                        ))}
                                    </div>
                                )}
                                {g.issueFlags?.length > 0 && (
                                    <div style={{
                                        display: 'flex', gap: 4, flexWrap: 'wrap',
                                        padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.04)',
                                    }}>
                                        {g.issueFlags.map((flag: string) => (
                                            <span key={flag} style={{
                                                padding: '1px 6px', borderRadius: 3, fontSize: 10,
                                                background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
                                                fontFamily: 'monospace',
                                            }}>{flag}</span>
                                        ))}
                                    </div>
                                )}

                                {/* Group Details */}
                                <div style={{
                                    display: 'flex', gap: 16, paddingTop: 8,
                                    borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: 12,
                                }}>
                                    <div>
                                        <span style={{ color: '#64748b' }}>Color: </span>
                                        <span style={{ color: '#e2e8f0' }}>{g.color}</span>
                                    </div>
                                    {g.material && (
                                        <div>
                                            <span style={{ color: '#64748b' }}>Material: </span>
                                            <span style={{ color: '#e2e8f0' }}>{g.material}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {meta.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
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
