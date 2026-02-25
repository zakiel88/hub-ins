'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function PricingPage() {
    const [prices, setPrices] = useState<any[]>([]);
    const [meta, setMeta] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [marketFilter, setMarketFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [reviewingId, setReviewingId] = useState<string | null>(null);
    const [reviewNotes, setReviewNotes] = useState('');

    // Create modal
    const [showCreate, setShowCreate] = useState(false);
    const [saving, setSaving] = useState(false);
    const [colorways, setColorways] = useState<any[]>([]);
    const [priceForm, setPriceForm] = useState({
        colorwayId: '', market: 'USA', currency: 'USD', retailPrice: '', comparePrice: '',
    });

    const MARKETS = [
        { code: 'USA', flag: '🇺🇸', currency: 'USD' },
        { code: 'EU', flag: '🇪🇺', currency: 'EUR' },
        { code: 'VN', flag: '🇻🇳', currency: 'VND' },
        { code: 'JP', flag: '🇯🇵', currency: 'JPY' },
        { code: 'KR', flag: '🇰🇷', currency: 'KRW' },
    ];

    const load = async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {};
            if (marketFilter) params.market = marketFilter;
            if (statusFilter) params.status = statusFilter;
            const res = await api.getPricing(Object.keys(params).length ? params : undefined);
            setPrices(res.data);
            setMeta(res.meta);
        } catch {
            window.location.href = '/login';
        } finally {
            setLoading(false);
        }
    };

    const loadColorways = async () => {
        try { const res = await api.getColorways(); setColorways(res.data); } catch { /* */ }
    };

    useEffect(() => { load(); }, [marketFilter, statusFilter]);

    const handleReview = async (id: string, status: 'approved' | 'rejected') => {
        try {
            await api.reviewPrice(id, { status, reviewNotes: reviewNotes || undefined });
            setReviewingId(null);
            setReviewNotes('');
            load();
        } catch (err: any) { alert(err.message); }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.createPrice({
                colorwayId: priceForm.colorwayId,
                market: priceForm.market,
                currency: priceForm.currency,
                retailPrice: parseFloat(priceForm.retailPrice),
                comparePrice: priceForm.comparePrice ? parseFloat(priceForm.comparePrice) : undefined,
            });
            setShowCreate(false);
            setPriceForm({ colorwayId: '', market: 'USA', currency: 'USD', retailPrice: '', comparePrice: '' });
            load();
        } catch (err: any) { alert(err.message); }
        finally { setSaving(false); }
    };

    const openCreate = () => {
        loadColorways();
        setShowCreate(true);
    };

    const handleMarketChange = (market: string) => {
        const m = MARKETS.find((m) => m.code === market);
        setPriceForm({ ...priceForm, market, currency: m?.currency || 'USD' });
    };

    const statusClass = (status: string) => {
        const map: Record<string, string> = {
            draft: 'badge-warning', approved: 'badge-success',
            rejected: 'badge-error', published: 'badge-info',
        };
        return `status-badge ${map[status] || 'badge-muted'}`;
    };

    return (
        <>
            <div className="page-header">
                <div className="page-header-row">
                    <div>
                        <h1 className="page-title">Pricing</h1>
                        <p className="page-subtitle">Multi-market price management & review</p>
                    </div>
                    <button className="btn-primary btn-sm" onClick={openCreate}>+ New Price</button>
                </div>
            </div>

            <div className="page-content">
                <div className="toolbar">
                    <div className="filter-row">
                        <select className="form-select" value={marketFilter}
                            onChange={(e) => setMarketFilter(e.target.value)}>
                            <option value="">All Markets</option>
                            {MARKETS.map((m) => <option key={m.code} value={m.code}>{m.flag} {m.code}</option>)}
                        </select>
                        <select className="form-select" value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="">All Status</option>
                            <option value="draft">Draft</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="published">Published</option>
                        </select>
                    </div>
                    {meta && <div className="toolbar-meta">{meta.total} price{meta.total !== 1 ? 's' : ''}</div>}
                </div>

                {loading ? (
                    <div className="page-loading"><div className="spinner" /></div>
                ) : prices.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">💰</div>
                        <div className="empty-state-text">No prices found. Create a price or adjust filters.</div>
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>SKU</th>
                                    <th>Product</th>
                                    <th>Brand</th>
                                    <th>Market</th>
                                    <th>Retail Price</th>
                                    <th>Compare</th>
                                    <th>Currency</th>
                                    <th>Status</th>
                                    <th>Reviewer</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {prices.map((p) => (
                                    <tr key={p.id}>
                                        <td><code className="code-tag">{p.colorway?.sku}</code></td>
                                        <td>{p.colorway?.product?.name}</td>
                                        <td><code className="code-tag">{p.colorway?.product?.collection?.brand?.code}</code></td>
                                        <td><span className="market-tag">{p.market}</span></td>
                                        <td className="cell-mono cell-price">{p.retailPrice}</td>
                                        <td className="cell-mono cell-muted">{p.comparePrice || '—'}</td>
                                        <td>{p.currency}</td>
                                        <td><span className={statusClass(p.status)}>{p.status}</span></td>
                                        <td className="cell-muted">{p.reviewer?.fullName || '—'}</td>
                                        <td>
                                            {p.status === 'draft' && (
                                                reviewingId === p.id ? (
                                                    <div className="review-actions">
                                                        <input className="form-input form-input-sm" placeholder="Notes (optional)"
                                                            value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
                                                        <button className="btn-sm btn-success" onClick={() => handleReview(p.id, 'approved')}>✓</button>
                                                        <button className="btn-sm btn-error" onClick={() => handleReview(p.id, 'rejected')}>✗</button>
                                                        <button className="btn-sm btn-ghost" onClick={() => setReviewingId(null)}>Cancel</button>
                                                    </div>
                                                ) : (
                                                    <button className="btn-sm btn-ghost" onClick={() => setReviewingId(p.id)}>Review</button>
                                                )
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Price Modal */}
            {showCreate && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">New Price</h2>
                            <button className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">SKU (Colorway) *</label>
                                    <select className="form-select" required value={priceForm.colorwayId}
                                        onChange={(e) => setPriceForm({ ...priceForm, colorwayId: e.target.value })}>
                                        <option value="">Select SKU…</option>
                                        {colorways.map((cw) => (
                                            <option key={cw.id} value={cw.id}>
                                                {cw.sku} — {cw.product?.name} ({cw.color}/{cw.size})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Market *</label>
                                        <select className="form-select" required value={priceForm.market}
                                            onChange={(e) => handleMarketChange(e.target.value)}>
                                            {MARKETS.map((m) => <option key={m.code} value={m.code}>{m.flag} {m.code}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Currency</label>
                                        <input className="form-input" value={priceForm.currency} readOnly />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Retail Price *</label>
                                        <input className="form-input" type="number" step="0.01" required placeholder="0.00"
                                            value={priceForm.retailPrice}
                                            onChange={(e) => setPriceForm({ ...priceForm, retailPrice: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Compare Price</label>
                                        <input className="form-input" type="number" step="0.01" placeholder="Optional strikethrough"
                                            value={priceForm.comparePrice}
                                            onChange={(e) => setPriceForm({ ...priceForm, comparePrice: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                                <button type="submit" className="btn-primary btn-sm" disabled={saving}>
                                    {saving ? 'Creating…' : 'Create Price'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
