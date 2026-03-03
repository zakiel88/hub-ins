'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

const ITEM_STATE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    PENDING: { label: 'Chưa kiểm', color: '#888', bg: '#88888822' },
    IN_STOCK: { label: 'Có hàng ✓', color: '#22c55e', bg: '#22c55e22' },
    NEEDS_PURCHASE: { label: 'Cần mua', color: '#ef4444', bg: '#ef444422' },
};

const ORDER_STATE_LABELS: Record<string, { label: string; color: string }> = {
    NEW_FROM_SHOPIFY: { label: 'Đơn mới', color: '#3b82f6' },
    CHECKING_ADDRESS: { label: 'Check ĐC', color: '#f59e0b' },
    MER_CHECK: { label: 'MER Check', color: '#8b5cf6' },
    WAITING_PURCHASE: { label: 'Đợi mua', color: '#ef4444' },
    READY_TO_FULFILL: { label: 'Sẵn sàng', color: '#22c55e' },
    FULFILLED: { label: 'Đã giao', color: '#10b981' },
    ON_HOLD: { label: 'Tạm giữ', color: '#6b7280' },
    CANCELLED: { label: 'Đã huỷ', color: '#991b1b' },
};

/* Dark-themed select styling */
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
    minWidth: 140,
};

export default function MerchandisePage() {
    const [items, setItems] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [brands, setBrands] = useState<any[]>([]);
    const [stores, setStores] = useState<any[]>([]);

    // Filters
    const [itemState, setItemState] = useState('');
    const [orderState, setOrderState] = useState('');
    const [storeFilter, setStoreFilter] = useState('');
    const [brandFilter, setBrandFilter] = useState('');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [includeFulfilled, setIncludeFulfilled] = useState(false);
    const [page, setPage] = useState(1);
    const limit = 50;

    // Selection
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // Fetch brands on mount
    useEffect(() => {
        api.getBrands().then(res => {
            setBrands(res.data || []);
        }).catch(() => { });
        api.getStores().then((res: any) => {
            setStores(res.data || []);
        }).catch(() => { });
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.getMerchandise({
                itemState: itemState || undefined,
                orderState: orderState || undefined,
                storeId: storeFilter || undefined,
                brandId: brandFilter || undefined,
                search: search || undefined,
                includeFulfilled,
                page,
                limit,
            });
            setItems(res.data || []);
            setTotal(res.total || 0);
            setSummary(res.summary || {});
            setSelected(new Set());
        } catch (e: any) {
            console.error('Failed to load merchandise:', e);
        } finally {
            setLoading(false);
        }
    }, [itemState, orderState, storeFilter, brandFilter, search, includeFulfilled, page]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSearch = () => {
        setSearch(searchInput);
        setPage(1);
    };

    const getBrand = (li: any) => {
        if (li.brand?.name) return li.brand.name;
        if (li.sku && li.sku.includes('-')) return li.sku.split('-')[0];
        return null;
    };

    // Selection handlers
    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selected.size === items.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(items.map(i => i.id)));
        }
    };

    const isAllSelected = items.length > 0 && selected.size === items.length;

    const handleBulkAction = async (newState: string) => {
        if (selected.size === 0) return;
        try {
            for (const id of selected) {
                await api.updateMerchandiseItemState(id, newState);
            }
            setSelected(new Set());
            fetchData();
        } catch (e: any) {
            console.error('Bulk action failed:', e);
            alert('Lỗi: ' + e.message);
        }
    };

    const totalPages = Math.ceil(total / limit);
    const totalPending = summary.PENDING || 0;
    const totalInStock = summary.IN_STOCK || 0;
    const totalNeedsPurchase = summary.NEEDS_PURCHASE || 0;
    const totalAll = totalPending + totalInStock + totalNeedsPurchase;

    return (
        <>
            {/* Scoped dark-themed select style */}
            <style>{`
                .mer-page select option {
                    background: #1a1a24;
                    color: #f0f0f5;
                    padding: 8px;
                }
                .mer-page select option:checked {
                    background: #6366f1;
                    color: #fff;
                }
                .mer-page select:focus {
                    border-color: #6366f1;
                    outline: none;
                    box-shadow: 0 0 0 2px rgba(99,102,241,0.2);
                }
            `}</style>
            <div className="mer-page" style={{ padding: 32, maxWidth: 1400 }}>
                <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0 }}>
                        👕 Merchandise
                    </h1>
                    <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
                        Tất cả sản phẩm trong đơn hàng — check stock, báo mua
                    </div>
                </div>

                {/* Summary Cards */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                    {[
                        { key: '', label: 'TẤT CẢ', value: totalAll, color: '#3b82f6' },
                        { key: 'PENDING', label: 'CHƯA KIỂM', value: totalPending, color: '#888' },
                        { key: 'IN_STOCK', label: 'CÓ HÀNG', value: totalInStock, color: '#22c55e' },
                        { key: 'NEEDS_PURCHASE', label: 'CẦN MUA', value: totalNeedsPurchase, color: '#ef4444' },
                    ].map(card => (
                        <button key={card.key} onClick={() => { setItemState(card.key); setPage(1); }} style={{
                            background: itemState === card.key ? `${card.color}22` : 'var(--bg-surface, rgba(255,255,255,0.03))',
                            border: itemState === card.key ? `1px solid ${card.color}55` : '1px solid var(--border, rgba(255,255,255,0.06))',
                            borderRadius: 10, padding: '12px 20px', cursor: 'pointer', textAlign: 'left' as const, minWidth: 110,
                        }}>
                            <div style={{ color: '#888', fontSize: 10, fontWeight: 600 }}>{card.label}</div>
                            <div style={{ color: card.color, fontSize: 22, fontWeight: 700 }}>{card.value}</div>
                        </button>
                    ))}
                </div>

                {/* Filters Bar */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select value={storeFilter} onChange={e => { setStoreFilter(e.target.value); setPage(1); }} style={selectStyle}>
                        <option value="">Tất cả Store</option>
                        {stores.map((s: any) => (
                            <option key={s.id} value={s.id}>{s.name || s.shopDomain}</option>
                        ))}
                    </select>

                    <select value={brandFilter} onChange={e => { setBrandFilter(e.target.value); setPage(1); }} style={selectStyle}>
                        <option value="">Tất cả Brand</option>
                        {brands.map((b: any) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>

                    <select value={orderState} onChange={e => { setOrderState(e.target.value); setPage(1); }} style={selectStyle}>
                        <option value="">Trạng thái đơn</option>
                        {Object.entries(ORDER_STATE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                        ))}
                    </select>

                    <select value={itemState} onChange={e => { setItemState(e.target.value); setPage(1); }} style={selectStyle}>
                        <option value="">Trạng thái SP</option>
                        {Object.entries(ITEM_STATE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                        ))}
                    </select>

                    <div style={{ display: 'flex', gap: 0 }}>
                        <input
                            type="text" placeholder="Tìm SKU, sản phẩm, order#..."
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            style={{ padding: '8px 14px', background: 'var(--bg-surface, rgba(255,255,255,0.06))', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: '8px 0 0 8px', color: '#fff', fontSize: 13, width: 200 }}
                        />
                        <button onClick={handleSearch} style={{ padding: '8px 14px', background: 'var(--accent, #6366f1)', border: 'none', borderRadius: '0 8px 8px 0', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>🔍</button>
                    </div>
                    {search && (
                        <button onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
                            style={{ padding: '6px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, color: '#aaa', cursor: 'pointer', fontSize: 12 }}>
                            ✕ Xoá
                        </button>
                    )}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#888', fontSize: 12 }}>
                        <input type="checkbox" checked={includeFulfilled} onChange={e => { setIncludeFulfilled(e.target.checked); setPage(1); }} style={{ accentColor: '#10b981' }} />
                        Xem cả đã hoàn thành
                    </label>
                    <div style={{ marginLeft: 'auto', color: '#666', fontSize: 12 }}>
                        {total} sản phẩm{!includeFulfilled ? ' (đang xử lý)' : ''}
                    </div>
                </div>

                {/* Bulk Actions Bar */}
                {selected.size > 0 && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', marginBottom: 12,
                        background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10,
                    }}>
                        <span style={{ color: '#818cf8', fontSize: 13, fontWeight: 600 }}>
                            ✓ {selected.size} sản phẩm được chọn
                        </span>
                        <button onClick={() => handleBulkAction('IN_STOCK')} style={{
                            padding: '6px 14px', background: '#22c55e22', border: '1px solid #22c55e44',
                            borderRadius: 6, color: '#22c55e', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        }}>✓ Check Stock — Có hàng</button>
                        <button onClick={() => handleBulkAction('NEEDS_PURCHASE')} style={{
                            padding: '6px 14px', background: '#ef444422', border: '1px solid #ef444444',
                            borderRadius: 6, color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        }}>⚠ Cần mua</button>
                        <button onClick={() => handleBulkAction('PENDING')} style={{
                            padding: '6px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 6, color: '#888', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        }}>↩ Reset</button>
                        <button onClick={() => setSelected(new Set())} style={{
                            padding: '6px 14px', background: 'transparent', border: 'none',
                            color: '#666', cursor: 'pointer', fontSize: 12, marginLeft: 'auto',
                        }}>✕ Bỏ chọn</button>
                    </div>
                )}

                {/* Table */}
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: 40, textAlign: 'center', padding: '10px 8px' }}>
                                    <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        onChange={toggleSelectAll}
                                        style={{ accentColor: '#6366f1', cursor: 'pointer', width: 16, height: 16 }}
                                    />
                                </th>
                                <th style={{ width: 50 }}>STT</th>
                                <th>Order</th>
                                <th>Brand</th>
                                <th>Sản phẩm</th>
                                <th>SKU</th>
                                <th style={{ width: 40 }}>SL</th>
                                <th style={{ width: 80 }}>Giá</th>
                                <th style={{ width: 100 }}>Trạng Thái</th>
                                <th style={{ width: 100 }}>Trạng Thái Đơn</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#666' }}>⏳ Đang tải...</td></tr>
                            ) : items.length === 0 ? (
                                <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#666' }}>Không có sản phẩm nào</td></tr>
                            ) : items.map((li: any, idx: number) => {
                                const brand = getBrand(li);
                                const itemInfo = ITEM_STATE_LABELS[li.itemState] || ITEM_STATE_LABELS.PENDING;
                                const orderInfo = ORDER_STATE_LABELS[li.order?.pipelineState] || { label: li.order?.pipelineState, color: '#888' };
                                const rowNum = (page - 1) * limit + idx + 1;
                                const isSelected = selected.has(li.id);
                                return (
                                    <tr key={li.id} className={isSelected ? 'table-row-link' : ''} style={{
                                        background: isSelected ? 'rgba(99,102,241,0.08)' : undefined,
                                    }}>
                                        <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelect(li.id)}
                                                style={{ accentColor: '#6366f1', cursor: 'pointer', width: 16, height: 16 }}
                                            />
                                        </td>
                                        <td className="cell-muted" style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                                            {rowNum}
                                        </td>
                                        <td>
                                            <Link href={`/orders/${li.order?.id}`} style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
                                                {li.order?.orderNumber}
                                            </Link>
                                        </td>
                                        <td>
                                            {brand ? (
                                                <span className="market-tag" style={{ background: '#8b5cf622', color: '#8b5cf6', border: 'none' }}>{brand}</span>
                                            ) : <span className="cell-muted">—</span>}
                                        </td>
                                        <td className="cell-primary" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {li.title}
                                        </td>
                                        <td className="cell-mono">{li.sku || '—'}</td>
                                        <td className="cell-primary" style={{ fontWeight: 600 }}>{li.quantity}</td>
                                        <td className="cell-muted">${parseFloat(li.unitPrice).toFixed(2)}</td>
                                        <td>
                                            <span className="status-badge" style={{ background: itemInfo.bg, color: itemInfo.color }}>
                                                {itemInfo.label}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="status-badge" style={{ background: orderInfo.color + '22', color: orderInfo.color }}>
                                                {orderInfo.label}
                                            </span>
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
                            ← Trước
                        </button>
                        <span style={{ padding: '6px 14px', color: '#888', fontSize: 13 }}>
                            Trang {page}/{totalPages}
                        </span>
                        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-outline"
                            style={{ opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? 'default' : 'pointer' }}>
                            Sau →
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
