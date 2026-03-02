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

export default function MerchandisePage() {
    const [items, setItems] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    // Filters
    const [itemState, setItemState] = useState('');
    const [orderState, setOrderState] = useState('');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [includeFulfilled, setIncludeFulfilled] = useState(false);
    const [page, setPage] = useState(1);
    const limit = 50;

    // Selection
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.getMerchandise({
                itemState: itemState || undefined,
                orderState: orderState || undefined,
                search: search || undefined,
                includeFulfilled,
                page,
                limit,
            });
            setItems(res.data || []);
            setTotal(res.total || 0);
            setSummary(res.summary || {});
            setSelected(new Set()); // clear selection on new data
        } catch (e: any) {
            console.error('Failed to load merchandise:', e);
        } finally {
            setLoading(false);
        }
    }, [itemState, orderState, search, includeFulfilled, page]);

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
        <div style={{ padding: 32, maxWidth: 1400 }}>
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
                <button onClick={() => { setItemState(''); setPage(1); }} style={{
                    background: !itemState ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                    border: !itemState ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10, padding: '12px 20px', cursor: 'pointer', textAlign: 'left' as const, minWidth: 110,
                }}>
                    <div style={{ color: '#888', fontSize: 10, fontWeight: 600 }}>TẤT CẢ</div>
                    <div style={{ color: '#3b82f6', fontSize: 22, fontWeight: 700 }}>{totalAll}</div>
                </button>
                <button onClick={() => { setItemState('PENDING'); setPage(1); }} style={{
                    background: itemState === 'PENDING' ? 'rgba(136,136,136,0.15)' : 'rgba(255,255,255,0.03)',
                    border: itemState === 'PENDING' ? '1px solid rgba(136,136,136,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10, padding: '12px 20px', cursor: 'pointer', textAlign: 'left' as const, minWidth: 110,
                }}>
                    <div style={{ color: '#888', fontSize: 10, fontWeight: 600 }}>CHƯA KIỂM</div>
                    <div style={{ color: '#888', fontSize: 22, fontWeight: 700 }}>{totalPending}</div>
                </button>
                <button onClick={() => { setItemState('IN_STOCK'); setPage(1); }} style={{
                    background: itemState === 'IN_STOCK' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)',
                    border: itemState === 'IN_STOCK' ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10, padding: '12px 20px', cursor: 'pointer', textAlign: 'left' as const, minWidth: 110,
                }}>
                    <div style={{ color: '#888', fontSize: 10, fontWeight: 600 }}>CÓ HÀNG</div>
                    <div style={{ color: '#22c55e', fontSize: 22, fontWeight: 700 }}>{totalInStock}</div>
                </button>
                <button onClick={() => { setItemState('NEEDS_PURCHASE'); setPage(1); }} style={{
                    background: itemState === 'NEEDS_PURCHASE' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.03)',
                    border: itemState === 'NEEDS_PURCHASE' ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10, padding: '12px 20px', cursor: 'pointer', textAlign: 'left' as const, minWidth: 110,
                }}>
                    <div style={{ color: '#888', fontSize: 10, fontWeight: 600 }}>CẦN MUA</div>
                    <div style={{ color: '#ef4444', fontSize: 22, fontWeight: 700 }}>{totalNeedsPurchase}</div>
                </button>
            </div>

            {/* Filters Bar */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={orderState} onChange={e => { setOrderState(e.target.value); setPage(1); }}
                    style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13 }}>
                    <option value="">Tất cả trạng thái đơn</option>
                    {Object.entries(ORDER_STATE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
                <select value={itemState} onChange={e => { setItemState(e.target.value); setPage(1); }}
                    style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13 }}>
                    <option value="">Tất cả trạng thái SP</option>
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
                        style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px 0 0 8px', color: '#fff', fontSize: 13, width: 240 }}
                    />
                    <button onClick={handleSearch} style={{ padding: '8px 14px', background: '#3b82f6', border: 'none', borderRadius: '0 8px 8px 0', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>🔍</button>
                </div>
                {search && (
                    <button onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
                        style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#aaa', cursor: 'pointer', fontSize: 12 }}>
                        ✕ Xoá tìm kiếm
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
                        padding: '5px 12px', background: '#22c55e22', border: '1px solid #22c55e44',
                        borderRadius: 6, color: '#22c55e', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    }}>✓ Check Stock — Có hàng</button>
                    <button onClick={() => handleBulkAction('NEEDS_PURCHASE')} style={{
                        padding: '5px 12px', background: '#ef444422', border: '1px solid #ef444444',
                        borderRadius: 6, color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    }}>⚠ Cần mua</button>
                    <button onClick={() => handleBulkAction('PENDING')} style={{
                        padding: '5px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 6, color: '#888', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    }}>↩ Reset</button>
                    <button onClick={() => setSelected(new Set())} style={{
                        padding: '5px 12px', background: 'transparent', border: 'none',
                        color: '#666', cursor: 'pointer', fontSize: 12, marginLeft: 'auto',
                    }}>✕ Bỏ chọn</button>
                </div>
            )}

            {/* Table */}
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <th style={{ padding: '10px 8px', textAlign: 'center', width: 40 }}>
                                    <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        onChange={toggleSelectAll}
                                        style={{ accentColor: '#6366f1', cursor: 'pointer', width: 16, height: 16 }}
                                    />
                                </th>
                                {['STT', 'Order', 'Brand', 'Sản phẩm', 'SKU', 'SL', 'Giá', 'Trạng Thái', 'Trạng Thái Đơn'].map(h => (
                                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#888', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                                ))}
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
                                    <tr key={li.id} style={{
                                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                                        background: isSelected ? 'rgba(99,102,241,0.08)' : undefined,
                                    }}>
                                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelect(li.id)}
                                                style={{ accentColor: '#6366f1', cursor: 'pointer', width: 16, height: 16 }}
                                            />
                                        </td>
                                        <td style={{ padding: '10px 8px', textAlign: 'center', color: '#555', fontSize: 12, fontFamily: 'monospace' }}>
                                            {rowNum}
                                        </td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <Link href={`/orders/${li.order?.id}`} style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
                                                {li.order?.orderNumber}
                                            </Link>
                                        </td>
                                        <td style={{ padding: '10px 12px' }}>
                                            {brand ? (
                                                <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#8b5cf622', color: '#8b5cf6' }}>{brand}</span>
                                            ) : <span style={{ color: '#555' }}>—</span>}
                                        </td>
                                        <td style={{ padding: '10px 12px', color: '#ddd', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                                            {li.title}
                                        </td>
                                        <td style={{ padding: '10px 12px', color: '#aaa', fontFamily: 'monospace', fontSize: 11 }}>{li.sku || '—'}</td>
                                        <td style={{ padding: '10px 12px', color: '#fff', fontWeight: 600 }}>{li.quantity}</td>
                                        <td style={{ padding: '10px 12px', color: '#aaa', fontSize: 13 }}>${parseFloat(li.unitPrice).toFixed(2)}</td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: itemInfo.bg, color: itemInfo.color }}>
                                                {itemInfo.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: orderInfo.color + '22', color: orderInfo.color }}>
                                                {orderInfo.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                        style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: page <= 1 ? '#444' : '#aaa', cursor: page <= 1 ? 'default' : 'pointer', fontSize: 13 }}>
                        ← Trước
                    </button>
                    <span style={{ padding: '6px 14px', color: '#888', fontSize: 13 }}>
                        Trang {page}/{totalPages}
                    </span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                        style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: page >= totalPages ? '#444' : '#aaa', cursor: page >= totalPages ? 'default' : 'pointer', fontSize: 13 }}>
                        Sau →
                    </button>
                </div>
            )}
        </div>
    );
}
