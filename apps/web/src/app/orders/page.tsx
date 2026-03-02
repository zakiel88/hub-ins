'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const ALL_STATES = [
    'NEW_FROM_SHOPIFY', 'NEEDS_CX', 'READY_FOR_MER', 'WAITING_STOCK',
    'NEEDS_PROCUREMENT', 'PROCUREMENT_IN_PROGRESS', 'READY_TO_FULFILL',
    'FULFILLED', 'ON_HOLD', 'CANCELLED',
];

const STATE_COLORS: Record<string, string> = {
    NEW_FROM_SHOPIFY: '#3b82f6', NEEDS_CX: '#f59e0b', READY_FOR_MER: '#8b5cf6',
    CHECKING_ADDRESS: '#f59e0b', MER_CHECK: '#8b5cf6',
    WAITING_PURCHASE: '#ef4444',
    READY_TO_FULFILL: '#22c55e', FULFILLED: '#10b981', ON_HOLD: '#6b7280', CANCELLED: '#991b1b',
};

const STATE_LABELS: Record<string, string> = {
    NEW_FROM_SHOPIFY: 'Đơn mới', CHECKING_ADDRESS: 'Đang check', MER_CHECK: 'MER Check',
    WAITING_PURCHASE: 'Đợi mua',
    READY_TO_FULFILL: 'Sẵn sàng', FULFILLED: 'Đã giao', ON_HOLD: 'Tạm giữ', CANCELLED: 'Đã huỷ',
};

export default function OrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stateFilter, setStateFilter] = useState('');
    const [storeFilter, setStoreFilter] = useState('');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [summary, setSummary] = useState<any>(null);
    const [stores, setStores] = useState<any[]>([]);

    const load = async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {};
            if (stateFilter) params.pipelineState = stateFilter;
            if (storeFilter) params.shopifyStoreId = storeFilter;
            if (search) params.search = search;
            const [ordRes, sumRes, storesRes] = await Promise.all([
                api.getOrders(Object.keys(params).length ? params : undefined),
                api.getPipelineSummary(),
                api.getStores().catch(() => ({ data: [] })),
            ]);
            setOrders(ordRes.data);
            setSummary(sumRes.data);
            setStores(storesRes.data || []);
        } catch { /* */ } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [stateFilter, storeFilter, search]);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput), 400);
        return () => clearTimeout(t);
    }, [searchInput]);

    const fmtPrice = (p: any) => {
        const n = typeof p === 'string' ? parseFloat(p) : (p ?? 0);
        return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };

    const timeAgo = (d: string) => {
        const diff = Date.now() - new Date(d).getTime();
        const hrs = Math.floor(diff / 3600000);
        if (hrs < 1) return `${Math.floor(diff / 60000)}m ago`;
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    };

    return (
        <div style={{ padding: 32 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>Đơn hàng</h1>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {/* Search */}
                    <input
                        type="text"
                        placeholder="🔍 Tìm Order # hoặc email..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 13, width: 220, outline: 'none' }}
                    />
                    {/* Store Filter */}
                    <select
                        value={storeFilter}
                        onChange={(e) => setStoreFilter(e.target.value)}
                        style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#ddd', fontSize: 13, cursor: 'pointer', minWidth: 160 }}
                    >
                        <option value="">Tất cả Store</option>
                        {stores.map((s: any) => (
                            <option key={s.id} value={s.id}>{s.storeName}</option>
                        ))}
                    </select>
                    <button onClick={load} style={{ padding: '8px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                        ↻ Làm mới
                    </button>
                </div>
            </div>

            {/* Pipeline State Cards — ALL states */}
            {summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 8, marginBottom: 24 }}>
                    {/* All Orders card */}
                    <div
                        onClick={() => setStateFilter('')}
                        style={{
                            padding: '12px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                            background: stateFilter === '' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                            border: stateFilter === '' ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
                            transition: 'all .2s',
                        }}
                    >
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{summary.total}</div>
                        <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>Tất cả</div>
                    </div>
                    {/* Each state */}
                    {ALL_STATES.map((state) => {
                        const count = (summary.byState || {})[state] || 0;
                        return (
                            <div
                                key={state}
                                onClick={() => setStateFilter(stateFilter === state ? '' : state)}
                                style={{
                                    padding: '12px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                                    background: stateFilter === state ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                                    border: stateFilter === state ? `1px solid ${STATE_COLORS[state]}` : '1px solid transparent',
                                    transition: 'all .2s', opacity: count === 0 && stateFilter !== state ? 0.4 : 1,
                                }}
                            >
                                <div style={{ fontSize: 22, fontWeight: 700, color: STATE_COLORS[state] }}>{count}</div>
                                <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{STATE_LABELS[state]}</div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Orders Table */}
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            {['Store', 'Order #', 'Customer', 'Country', 'Total', 'State', 'Financial', 'Fulfillment', 'Created'].map(h => (
                                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#888', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#666' }}>Đang tải...</td></tr>
                        ) : orders.length === 0 ? (
                            <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#666' }}>Không có đơn hàng</td></tr>
                        ) : orders.map((o) => (
                            <tr key={o.id} onClick={() => window.location.href = `/orders/${o.id}`}
                                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background .15s' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <td style={{ padding: '12px 14px' }}>
                                    <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                                        {o.shopifyStore?.storeName || '—'}
                                    </span>
                                </td>
                                <td style={{ padding: '12px 14px', color: '#3b82f6', fontWeight: 600 }}>{o.orderNumber}</td>
                                <td style={{ padding: '12px 14px', color: '#ddd' }}>
                                    <div>{o.customerName || '—'}</div>
                                    <div style={{ fontSize: 11, color: '#777' }}>{o.customerEmail}</div>
                                </td>
                                <td style={{ padding: '12px 14px', color: '#aaa' }}>{o.shippingCountry || '—'}</td>
                                <td style={{ padding: '12px 14px', color: '#fff', fontWeight: 600 }}>
                                    {fmtPrice(o.totalPrice)} <span style={{ color: '#666', fontWeight: 400, fontSize: 12 }}>{o.currency}</span>
                                </td>
                                <td style={{ padding: '12px 14px' }}>
                                    <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#fff', background: STATE_COLORS[o.pipelineState] || '#555' }}>
                                        {STATE_LABELS[o.pipelineState] || o.pipelineState}
                                    </span>
                                </td>
                                <td style={{ padding: '12px 14px', color: '#aaa', fontSize: 13 }}>{o.financialStatus || '—'}</td>
                                <td style={{ padding: '12px 14px', color: '#aaa', fontSize: 13 }}>{o.fulfillmentStatus || 'unfulfilled'}</td>
                                <td style={{ padding: '12px 14px', color: '#777', fontSize: 12 }}>{timeAgo(o.orderDate || o.createdAt)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
