'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    DRAFT: { bg: '#1e293b', text: '#94a3b8' },
    PENDING_REVIEW: { bg: '#422006', text: '#fbbf24' },
    APPROVED: { bg: '#052e16', text: '#34d399' },
    REJECTED: { bg: '#450a0a', text: '#fca5a5' },
};

export default function ApprovalQueuePage() {
    const [items, setItems] = useState<any[]>([]);
    const [meta, setMeta] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('PENDING_REVIEW');
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<string[]>([]);
    const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [pushing, setPushing] = useState(false);
    const [stores, setStores] = useState<any[]>([]);
    const [pushStoreFilter, setPushStoreFilter] = useState('');
    const [showPushConfirm, setShowPushConfirm] = useState(false);

    // Load stores for scoped push dropdown
    useEffect(() => {
        api.getStores?.().then((res: any) => {
            setStores(res.data || []);
        }).catch(() => { });
    }, []);

    const fetchQueue = useCallback(async () => {
        try {
            setLoading(true);
            const params: Record<string, string> = { status: statusFilter, page: String(page), limit: '50' };
            const res = await api.getApprovalQueue(params);
            setItems(res.data || []);
            setMeta(res.meta || {});
            setSelected([]);
        } catch (err) {
            console.warn('Failed to load approval queue:', err);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, page]);

    useEffect(() => { fetchQueue(); }, [fetchQueue]);

    const handleApprove = async (id: string) => {
        try {
            await api.approveMetafield(id);
            fetchQueue();
        } catch (err: any) { alert(err.message); }
    };

    const handleBulkApprove = async () => {
        if (selected.length === 0) return;
        try {
            await api.bulkApproveMetafields(selected);
            fetchQueue();
        } catch (err: any) { alert(err.message); }
    };

    const handleReject = async () => {
        if (!rejectModal || !rejectReason.trim()) return;
        try {
            await api.rejectMetafield(rejectModal.id, rejectReason);
            setRejectModal(null);
            setRejectReason('');
            fetchQueue();
        } catch (err: any) { alert(err.message); }
    };

    const handleScopedPush = async (scope: 'all' | 'store') => {
        try {
            setPushing(true);
            let res;
            if (scope === 'store' && pushStoreFilter) {
                res = await api.triggerMetafieldsPush({ storeIds: [pushStoreFilter] });
            } else {
                res = await api.triggerMetafieldsPush();
            }
            alert(`Push job started: ${res.data?.jobId}`);
            setShowPushConfirm(false);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setPushing(false);
        }
    };

    const toggleSelect = (id: string) => {
        setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleAll = () => {
        if (selected.length === items.length) {
            setSelected([]);
        } else {
            setSelected(items.map(i => i.id));
        }
    };

    const totalPages = Math.ceil((meta.total || 0) / (meta.limit || 50));

    return (
        <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 28 }}>✅</span>
                    <div>
                        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Approval Queue</h1>
                        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
                            Review and approve metafield values before pushing to Shopify
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {selected.length > 0 && (
                        <button onClick={handleBulkApprove} style={{
                            padding: '8px 16px', background: 'linear-gradient(135deg, #059669, #10b981)',
                            border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13,
                        }}>✓ Approve {selected.length} selected</button>
                    )}

                    {/* Scoped push controls */}
                    <select value={pushStoreFilter} onChange={e => setPushStoreFilter(e.target.value)}
                        style={{
                            padding: '8px 10px', background: '#0f172a', border: '1px solid #334155',
                            borderRadius: 6, color: '#e2e8f0', fontSize: 12,
                        }}>
                        <option value="">All Stores</option>
                        {stores.map((s: any) => (
                            <option key={s.id} value={s.id}>{s.storeName}</option>
                        ))}
                    </select>

                    <button onClick={() => {
                        if (!pushStoreFilter) {
                            setShowPushConfirm(true); // Push All needs confirmation
                        } else {
                            handleScopedPush('store');
                        }
                    }} disabled={pushing} style={{
                        padding: '8px 16px', background: pushing ? '#334155' : 'linear-gradient(135deg, #6366f1, #818cf8)',
                        border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13,
                        opacity: pushing ? 0.6 : 1,
                    }}>{pushing ? 'Pushing...' : (pushStoreFilter ? '🚀 Push Store' : '🚀 Push All Stores')}</button>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'DRAFT'].map(s => (
                    <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }} style={{
                        padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                        background: statusFilter === s ? STATUS_COLORS[s].bg : '#1e293b',
                        color: statusFilter === s ? STATUS_COLORS[s].text : '#64748b',
                        outline: statusFilter === s ? `1px solid ${STATUS_COLORS[s].text}44` : 'none',
                    }}>{s.replace('_', ' ')}</button>
                ))}
                <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 12, lineHeight: '28px' }}>
                    {meta.total || 0} items
                </span>
            </div>

            {/* Table */}
            {loading ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>Loading...</p> : (
                <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #1e293b' }}>
                                <th style={{ padding: '10px 14px', width: 36 }}>
                                    <input type="checkbox" checked={selected.length === items.length && items.length > 0} onChange={toggleAll} />
                                </th>
                                {['Namespace.Key', 'Owner', 'Value', 'Store', 'Status', 'Submitted By', 'Date', 'Actions'].map(h => (
                                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(item => {
                                const sc = STATUS_COLORS[item.status] || STATUS_COLORS.DRAFT;
                                return (
                                    <tr key={item.id} style={{ borderBottom: '1px solid #1e293b22' }}>
                                        <td style={{ padding: '10px 14px' }}>
                                            <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleSelect(item.id)} />
                                        </td>
                                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#e2e8f0', fontSize: 13 }}>
                                            {item.definition?.namespace}.{item.definition?.key}
                                        </td>
                                        <td style={{ padding: '10px 14px' }}>
                                            <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: item.ownerType === 'PRODUCT' ? '#1e3a5f' : '#3a2e1e', color: item.ownerType === 'PRODUCT' ? '#60a5fa' : '#fbbf24' }}>
                                                {item.ownerType}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 14px', color: '#e2e8f0', fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {typeof item.valueJson === 'string' ? item.valueJson : JSON.stringify(item.valueJson)}
                                        </td>
                                        <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 12 }}>
                                            {item.store?.storeName || '🌐 Global'}
                                        </td>
                                        <td style={{ padding: '10px 14px' }}>
                                            <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: sc.bg, color: sc.text }}>
                                                {item.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 12 }}>
                                            {item.submitter?.fullName || '—'}
                                        </td>
                                        <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>
                                            {new Date(item.createdAt).toLocaleDateString()}
                                        </td>
                                        <td style={{ padding: '10px 14px' }}>
                                            {item.status === 'PENDING_REVIEW' && (
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button onClick={() => handleApprove(item.id)} style={{
                                                        padding: '4px 10px', background: '#059669', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 11,
                                                    }}>Approve</button>
                                                    <button onClick={() => setRejectModal({ id: item.id })} style={{
                                                        padding: '4px 10px', background: '#dc2626', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 11,
                                                    }}>Reject</button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {items.length === 0 && (
                                <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                                    {statusFilter === 'PENDING_REVIEW' ? 'No items pending review 🎉' : 'No items found'}
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{
                        padding: '6px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', cursor: 'pointer', fontSize: 12,
                    }}>← Prev</button>
                    <span style={{ lineHeight: '32px', color: '#94a3b8', fontSize: 12 }}>Page {page} of {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{
                        padding: '6px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', cursor: 'pointer', fontSize: 12,
                    }}>Next →</button>
                </div>
            )}

            {/* Reject Modal */}
            {rejectModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, width: 400, border: '1px solid #334155' }}>
                        <h3 style={{ color: '#e2e8f0', margin: '0 0 16px' }}>Reject Metafield Value</h3>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 11, color: '#94a3b8' }}>Rejection Reason</label>
                            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                                placeholder="Enter reason for rejection..."
                                rows={4} style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, resize: 'vertical' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button onClick={() => { setRejectModal(null); setRejectReason(''); }}
                                style={{ padding: '8px 16px', background: '#334155', border: 'none', borderRadius: 6, color: '#e2e8f0', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={handleReject} disabled={!rejectReason.trim()}
                                style={{ padding: '8px 16px', background: '#dc2626', border: 'none', borderRadius: 6, color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: rejectReason.trim() ? 1 : 0.5 }}>Reject</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Push All Confirmation Modal */}
            {showPushConfirm && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, width: 420, border: '1px solid #334155' }}>
                        <h3 style={{ color: '#fbbf24', margin: '0 0 12px' }}>⚠️ Push All Stores</h3>
                        <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 }}>
                            This will push <strong style={{ color: '#e2e8f0' }}>all approved metafields</strong> to <strong style={{ color: '#e2e8f0' }}>all active stores</strong>.
                            Products with missing required fields will be skipped.
                            <br /><br />
                            For safer pushes, select a specific store above.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button onClick={() => setShowPushConfirm(false)}
                                style={{ padding: '8px 16px', background: '#334155', border: 'none', borderRadius: 6, color: '#e2e8f0', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={() => handleScopedPush('all')} disabled={pushing}
                                style={{ padding: '8px 16px', background: '#6366f1', border: 'none', borderRadius: 6, color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                                {pushing ? 'Pushing...' : 'Confirm Push All'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
