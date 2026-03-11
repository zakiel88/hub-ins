'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

const STATE_COLORS: Record<string, string> = {
    NEW_FROM_SHOPIFY: '#3b82f6', CHECKING_ADDRESS: '#f59e0b', MER_CHECK: '#8b5cf6',
    WAITING_PURCHASE: '#ef4444', READY_TO_FULFILL: '#22c55e', FULFILLED: '#10b981',
    ON_HOLD: '#6b7280', CANCELLED: '#991b1b',
};

const STATE_LABELS: Record<string, string> = {
    NEW_FROM_SHOPIFY: 'Đơn mới', CHECKING_ADDRESS: 'Đang check địa chỉ', MER_CHECK: 'MER Check',
    WAITING_PURCHASE: 'Đang đợi mua', READY_TO_FULFILL: 'Sẵn sàng giao', FULFILLED: 'Đã giao',
    ON_HOLD: 'Tạm giữ', CANCELLED: 'Đã huỷ',
};

const ITEM_STATE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    PENDING: { label: 'Chưa kiểm', color: '#888', bg: '#88888822' },
    IN_STOCK: { label: 'Có hàng ✓', color: '#22c55e', bg: '#22c55e22' },
    NEEDS_PURCHASE: { label: 'Đã báo mua', color: '#ef4444', bg: '#ef444422' },
};

// Toast
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
    useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
    return (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 20px', background: type === 'success' ? '#10b981' : '#ef4444', color: '#fff', borderRadius: 10, fontWeight: 600, fontSize: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {type === 'success' ? '✅' : '❌'} {message}
        </div>
    );
}

// Confirm modal
function ConfirmModal({ title, message, color, onConfirm, onCancel }: {
    title: string; message: string; color: string; onConfirm: () => void; onCancel: () => void;
}) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onCancel}>
            <div style={{ background: '#1a1a2e', borderRadius: 16, padding: 28, maxWidth: 420, width: '90%', border: `1px solid ${color}33` }} onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{title}</div>
                <div style={{ color: '#aaa', fontSize: 14, marginBottom: 24, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{message}</div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={onCancel} style={{ padding: '8px 20px', background: 'rgba(255,255,255,0.06)', color: '#aaa', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Huỷ</button>
                    <button onClick={onConfirm} style={{ padding: '8px 20px', background: color, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Xác nhận</button>
                </div>
            </div>
        </div>
    );
}

// ─── Items Tab Component ─────────────────────
function ItemsTab({ order, orderId, state, showToast, onOrderUpdate }: {
    order: any; orderId: string; state: string;
    showToast: (msg: string, type?: 'success' | 'error') => void;
    onOrderUpdate: (order: any) => void;
}) {
    const [stockData, setStockData] = useState<Record<string, any>>({});
    const [stockChecked, setStockChecked] = useState(false);
    const [checking, setChecking] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [acting, setActing] = useState(false);

    const items: any[] = order.lineItems || [];

    const handleCheckStock = async () => {
        setChecking(true);
        try {
            const res = await api.checkStockAll(orderId);
            const map: Record<string, any> = {};
            const outOfStockIds: string[] = [];
            for (const item of res.data) {
                map[item.id] = item.stock;
                // Auto-select items that are out of stock and still PENDING
                const li = items.find((i: any) => i.id === item.id);
                if (li && li.itemState === 'PENDING' && (!item.stock || item.stock.available <= 0)) {
                    outOfStockIds.push(item.id);
                }
            }
            setStockData(map);
            setStockChecked(true);
            if (outOfStockIds.length > 0) {
                setSelected(new Set(outOfStockIds));
            }
            showToast('Đã kiểm tra tồn kho');
        } catch (e: any) { showToast(e.message, 'error'); }
        finally { setChecking(false); }
    };

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        const pendingIds = items.filter(i => i.itemState === 'PENDING').map(i => i.id);
        setSelected(prev => prev.size === pendingIds.length ? new Set() : new Set(pendingIds));
    };

    const handleBulkAction = async (action: 'IN_STOCK' | 'NEEDS_PURCHASE') => {
        if (selected.size === 0) return;
        setActing(true);
        try {
            const res = await api.markItemsBulk(orderId, Array.from(selected), action);
            onOrderUpdate(res.data);
            setSelected(new Set());
            if (action === 'NEEDS_PURCHASE') {
                showToast(`✅ ${selected.size} sản phẩm đã báo mua${res.createdPRs ? ` — tạo ${res.createdPRs} PR` : ''}`);
            } else {
                showToast(`✅ ${selected.size} sản phẩm đã đánh dấu có hàng`);
            }
        } catch (e: any) { showToast(e.message, 'error'); }
        finally { setActing(false); }
    };

    const pendingCount = items.filter(i => i.itemState === 'PENDING').length;
    const selectedCount = selected.size;
    const isActionable = !['FULFILLED', 'CANCELLED'].includes(state);

    const getBrand = (li: any) => {
        // 1) Mapped brand (from brandId relation)
        if (li.brand?.name) return li.brand.name;
        // 2) Extract vendor prefix from SKU (e.g. "HappyClothing" from "HappyClothing-VDFW007-M-PIN")
        if (li.sku && li.sku.includes('-')) {
            return li.sku.split('-')[0];
        }
        return null;
    };

    return (
        <div>
            {/* Toolbar */}
            {isActionable && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                    <button onClick={handleCheckStock} disabled={checking} style={{ padding: '8px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: checking ? 0.6 : 1 }}>
                        {checking ? '⏳ Đang kiểm...' : '🔍 Check Stock'}
                    </button>
                    {stockChecked && selectedCount > 0 && (
                        <button onClick={() => handleBulkAction('NEEDS_PURCHASE')} disabled={acting} style={{ padding: '8px 18px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                            📦 Báo Mua ({selectedCount})
                        </button>
                    )}
                    {stockChecked && pendingCount > 0 && (
                        <span style={{ color: '#888', fontSize: 12, marginLeft: 'auto' }}>
                            {selectedCount}/{pendingCount} đang chọn
                        </span>
                    )}
                </div>
            )}

            {/* Table */}
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            {isActionable && stockChecked && (
                                <th style={{ padding: '10px 10px 10px 14px', width: 30 }}>
                                    <input type="checkbox" checked={selectedCount === pendingCount && pendingCount > 0} onChange={selectAll} style={{ cursor: 'pointer', accentColor: '#3b82f6' }} />
                                </th>
                            )}
                            {['Brand', 'Sản phẩm', 'SKU', 'SL', 'Giá', 'Stock'].map(h => (
                                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#888', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((li: any) => {
                            const brand = getBrand(li);
                            const stock = stockData[li.id];
                            const isPending = li.itemState === 'PENDING';
                            const isSelected = selected.has(li.id);
                            const itemInfo = ITEM_STATE_LABELS[li.itemState] || ITEM_STATE_LABELS.PENDING;

                            return (
                                <tr key={li.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isSelected ? 'rgba(59,130,246,0.08)' : 'transparent' }}>
                                    {isActionable && stockChecked && (
                                        <td style={{ padding: '10px 10px 10px 14px', width: 30 }}>
                                            {isPending ? (
                                                <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(li.id)} style={{ cursor: 'pointer', accentColor: '#3b82f6' }} />
                                            ) : <span style={{ color: '#666' }}>—</span>}
                                        </td>
                                    )}
                                    <td style={{ padding: '10px 14px' }}>
                                        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: brand ? '#8b5cf622' : 'rgba(255,255,255,0.04)', color: brand ? '#8b5cf6' : '#666' }}>
                                            {brand || 'Chưa gán'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 14px', color: '#ddd', maxWidth: 300 }}>{li.title}</td>
                                    <td style={{ padding: '10px 14px', color: '#aaa', fontFamily: 'monospace', fontSize: 12 }}>{li.sku || '—'}</td>
                                    <td style={{ padding: '10px 14px', color: '#fff', fontWeight: 600 }}>{li.quantity}</td>
                                    <td style={{ padding: '10px 14px', color: '#aaa' }}>${parseFloat(li.unitPrice).toFixed(2)}</td>
                                    <td style={{ padding: '10px 14px' }}>
                                        {!stockChecked ? (
                                            <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: itemInfo.bg, color: itemInfo.color }}>{itemInfo.label}</span>
                                        ) : li.itemState !== 'PENDING' ? (
                                            <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: itemInfo.bg, color: itemInfo.color }}>{itemInfo.label}</span>
                                        ) : stock ? (
                                            <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: stock.available > 0 ? '#22c55e22' : '#ef444422', color: stock.available > 0 ? '#22c55e' : '#ef4444' }}>
                                                {stock.available > 0 ? `${stock.available} có sẵn` : 'Hết hàng'}
                                            </span>
                                        ) : (
                                            <span style={{ color: '#666', fontSize: 11 }}>—</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function OrderDetailPage() {
    const params = useParams();
    const orderId = params.id as string;
    const [order, setOrder] = useState<any>(null);
    const [orderLogs, setOrderLogs] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState('summary');
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; color: string; action: () => Promise<void> } | null>(null);
    const [showAddressResult, setShowAddressResult] = useState(false);
    const [addressValidation, setAddressValidation] = useState<any>(null);
    const [validatingAddress, setValidatingAddress] = useState(false);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type });

    const load = async () => {
        setLoading(true);
        try {
            const [oRes, lRes] = await Promise.all([
                api.getOrder(orderId),
                api.getOrderLogs(orderId).catch(() => ({ data: [] })),
            ]);
            setOrder(oRes.data);
            setOrderLogs(lRes.data || []);
        } catch (e: any) { showToast(e.message, 'error'); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [orderId]);

    const doTransition = (state: string) => {
        setConfirmModal({
            title: `Chuyển sang "${STATE_LABELS[state] || state}"`,
            message: `Chuyển đơn ${order?.orderNumber} sang "${STATE_LABELS[state]}"?`,
            color: STATE_COLORS[state] || '#3b82f6',
            action: async () => {
                try {
                    await api.transitionOrder(orderId, state);
                    showToast(`Đã chuyển → ${STATE_LABELS[state]}`);
                    load();
                } catch (e: any) { showToast(e.message, 'error'); }
            },
        });
    };

    const handleCheckStock = async (itemId: string, action: 'IN_STOCK' | 'NEEDS_PURCHASE', itemTitle: string) => {
        try {
            const res = await api.checkItemStock(orderId, itemId, action);
            if (action === 'NEEDS_PURCHASE') {
                showToast(`"${itemTitle}" → Đã báo mua + tạo Procurement Request`);
            } else {
                showToast(`"${itemTitle}" → Có hàng ✓`);
            }
            // Update order state from response
            setOrder(res.data);
        } catch (e: any) { showToast(e.message, 'error'); }
    };

    if (loading) return <div style={{ padding: 40, color: '#888' }}>Đang tải...</div>;
    if (!order) return <div style={{ padding: 40, color: '#888' }}>Không tìm thấy đơn hàng</div>;

    const addr = order.shippingAddress || {};
    const state = order.pipelineState;
    const tabs = ['summary', 'items', 'log'];
    const tabLabels: Record<string, string> = { summary: 'Tổng quan', items: 'Sản phẩm', log: 'Lịch sử' };
    const btnStyle = (active: boolean) => ({ padding: '8px 20px', background: active ? 'rgba(255,255,255,0.1)' : 'transparent', color: active ? '#fff' : '#888', border: 'none', borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer', fontWeight: 600 as const, fontSize: 14 });
    const isFulfilled = state === 'FULFILLED' || order.fulfillmentStatus === 'fulfilled';
    const isWaitingPurchase = state === 'WAITING_PURCHASE';

    return (
        <div style={{ padding: 32, maxWidth: 1100 }}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {confirmModal && <ConfirmModal title={confirmModal.title} message={confirmModal.message} color={confirmModal.color} onConfirm={async () => { setConfirmModal(null); await confirmModal.action(); }} onCancel={() => setConfirmModal(null)} />}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <a href="/orders" style={{ color: '#888', textDecoration: 'none' }}>← Đơn hàng</a>
                <span style={{ color: '#444' }}>/</span>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0 }}>{order.orderNumber}</h1>
                <span style={{ padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#fff', background: STATE_COLORS[state] || '#555' }}>
                    {STATE_LABELS[state] || state}
                </span>
                {order.shopifyStore && <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>{order.shopifyStore.storeName}</span>}
            </div>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>
                {order.customerName} · {order.customerEmail} · {order.shippingCountry}
            </div>

            {/* ══ Address Check Card — available for ALL non-terminal states ══ */}
            {!['FULFILLED', 'CANCELLED'].includes(state) && (
                <div style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.02))', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#3b82f6' }}>📍 Địa chỉ giao hàng</div>
                        {state === 'CHECKING_ADDRESS' && <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#f59e0b22', color: '#f59e0b' }}>⏳ Đang xác minh</span>}
                    </div>
                    <div style={{ color: '#aaa', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
                        {addr.address1 && <div>{addr.address1}</div>}
                        {addr.address2 && <div>{addr.address2}</div>}
                        <div>{addr.city}{addr.province ? `, ${addr.province}` : ''} {addr.zip}</div>
                        <div>{addr.country}</div>
                        <div style={{ marginTop: 6 }}>SĐT: {order.customerPhone || <span style={{ color: '#ef4444' }}>chưa có</span>}</div>
                    </div>
                    {!showAddressResult ? (
                        <button
                            onClick={async () => {
                                setValidatingAddress(true);
                                try {
                                    const res = await api.validateAddress(orderId);
                                    setAddressValidation(res.fedex);
                                    setShowAddressResult(true);
                                } catch (e: any) {
                                    showToast(e.message || 'FedEx API error', 'error');
                                } finally {
                                    setValidatingAddress(false);
                                }
                            }}
                            disabled={validatingAddress}
                            style={{ padding: '10px 24px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14, opacity: validatingAddress ? 0.6 : 1 }}
                        >
                            {validatingAddress ? '⏳ Đang kiểm tra FedEx/Google...' : '🔍 Check Địa chỉ (FedEx + Google)'}
                        </button>
                    ) : (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16, marginTop: 4 }}>
                            {/* FedEx / Google Result */}
                            {addressValidation && (
                                <div style={{ marginBottom: 14 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <span style={{
                                            padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                                            background: addressValidation.valid ? '#22c55e22' : '#ef444422',
                                            color: addressValidation.valid ? '#22c55e' : '#ef4444',
                                        }}>
                                            {addressValidation.valid ? '✓ Địa chỉ hợp lệ' : '✗ Địa chỉ không hợp lệ'}
                                        </span>
                                        {addressValidation.classification && addressValidation.classification !== 'UNKNOWN' && (
                                            <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#8b5cf622', color: '#8b5cf6' }}>
                                                {addressValidation.classification === 'RESIDENTIAL' ? '🏠 Residential' : addressValidation.classification === 'BUSINESS' ? '🏢 Business' : addressValidation.classification}
                                            </span>
                                        )}
                                        <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 600, background: addressValidation.provider === 'google' ? '#f59e0b22' : '#06b6d422', color: addressValidation.provider === 'google' ? '#f59e0b' : '#06b6d4' }}>
                                            {addressValidation.provider === 'google' ? '🌐 Google' : '📦 FedEx'}
                                        </span>
                                    </div>
                                    {addressValidation.changes && addressValidation.changes.length > 0 && (
                                        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                                            <div style={{ color: '#888', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>GHI CHÚ:</div>
                                            {addressValidation.changes.map((c: string, i: number) => (
                                                <div key={i} style={{ color: '#aaa', fontSize: 12, lineHeight: 1.6 }}>• {c}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            <button onClick={() => { setShowAddressResult(false); setAddressValidation(null); }} style={{ padding: '6px 14px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                                🔄 Check lại
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ══ Waiting Purchase — link to procurement ══ */}
            {isWaitingPurchase && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: 20, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>📦 Đang đợi mua hàng</div>
                        <div style={{ color: '#aaa', fontSize: 13 }}>Có sản phẩm đã báo mua — xem chi tiết trong Procurement.</div>
                    </div>
                    <a href={`/procurement?orderId=${orderId}`} style={{ padding: '8px 20px', background: '#ef4444', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>Xem Procurement →</a>
                </div>
            )}

            {/* ══ Pipeline Actions — for non-terminal states ══ */}
            {!['FULFILLED', 'CANCELLED'].includes(state) && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ color: '#888', fontSize: 12, marginRight: 4 }}>Chuyển trạng thái:</span>
                    {state === 'NEW_FROM_SHOPIFY' && <>
                        <button onClick={() => doTransition('CHECKING_ADDRESS')} style={{ padding: '6px 14px', background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>→ Check Địa chỉ</button>
                        <button onClick={() => doTransition('MER_CHECK')} style={{ padding: '6px 14px', background: '#8b5cf622', color: '#8b5cf6', border: '1px solid #8b5cf644', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>→ MER Check</button>
                    </>}
                    {state === 'CHECKING_ADDRESS' && (
                        <button onClick={() => doTransition('MER_CHECK')} style={{ padding: '6px 14px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>✓ Địa chỉ OK → MER Check</button>
                    )}
                    {state === 'MER_CHECK' && (() => {
                        const allChecked = (order.lineItems || []).length > 0 && (order.lineItems || []).every((li: any) => li.itemState === 'IN_STOCK');
                        return <button onClick={() => doTransition('READY_TO_FULFILL')} disabled={!allChecked} style={{ padding: '6px 14px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, cursor: allChecked ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 600, opacity: allChecked ? 1 : 0.35 }}>✓ Tất cả có hàng → Sẵn sàng giao</button>;
                    })()}
                    {state === 'WAITING_PURCHASE' && <button onClick={() => doTransition('READY_TO_FULFILL')} style={{ padding: '6px 14px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>✓ Đã mua xong → Sẵn sàng giao</button>}
                    {state === 'READY_TO_FULFILL' && <button onClick={() => doTransition('FULFILLED')} style={{ padding: '6px 14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>📦 Đã giao hàng</button>}
                    <button onClick={() => doTransition('ON_HOLD')} style={{ padding: '6px 14px', background: '#6b728022', color: '#6b7280', border: '1px solid #6b728044', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Tạm giữ</button>
                    <button onClick={() => doTransition('CANCELLED')} style={{ padding: '6px 14px', background: '#991b1b22', color: '#991b1b', border: '1px solid #991b1b44', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Huỷ đơn</button>
                </div>
            )}

            {/* Tracking Banner */}
            {isFulfilled && (order.trackingNumber || order.trackingCompany) && (
                <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: 20, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>📦 Tracking</div>
                        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                            {order.trackingCompany && <div><div style={{ color: '#888', fontSize: 11 }}>Hãng</div><div style={{ color: '#fff', fontWeight: 600 }}>{order.trackingCompany}</div></div>}
                            {order.trackingNumber && <div><div style={{ color: '#888', fontSize: 11 }}>Mã vận đơn</div><div style={{ color: '#10b981', fontWeight: 700, fontFamily: 'monospace', fontSize: 16 }}>{order.trackingNumber}</div></div>}
                        </div>
                    </div>
                    {order.trackingUrl && <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 16px', background: '#10b981', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>Track →</a>}
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
                {tabs.map(t => <button key={t} onClick={() => setActiveTab(t)} style={btnStyle(activeTab === t)}>{tabLabels[t]}</button>)}
            </div>

            {/* Summary Tab */}
            {activeTab === 'summary' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 20 }}>
                        <h3 style={{ color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 12 }}>Khách hàng</h3>
                        <div style={{ color: '#fff', marginBottom: 6 }}>{order.customerName || '—'}</div>
                        <div style={{ color: '#aaa', fontSize: 13 }}>{order.customerEmail}</div>
                        <div style={{ color: '#aaa', fontSize: 13 }}>{order.customerPhone || '—'}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 20 }}>
                        <h3 style={{ color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 12 }}>Địa chỉ giao hàng</h3>
                        <div style={{ color: '#fff', fontSize: 13, lineHeight: 1.6 }}>
                            {addr.address1 && <div>{addr.address1}</div>}
                            {addr.address2 && <div>{addr.address2}</div>}
                            <div>{addr.city}{addr.province ? `, ${addr.province}` : ''} {addr.zip}</div>
                            <div>{addr.country}</div>
                        </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 20 }}>
                        <h3 style={{ color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 12 }}>Thông tin đơn</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div><span style={{ color: '#888', fontSize: 12 }}>Tổng</span><div style={{ color: '#fff', fontWeight: 700 }}>${parseFloat(order.totalPrice).toLocaleString()} {order.currency}</div></div>
                            <div><span style={{ color: '#888', fontSize: 12 }}>Thanh toán</span><div style={{ color: '#aaa' }}>{order.financialStatus}</div></div>
                            <div><span style={{ color: '#888', fontSize: 12 }}>Fulfillment</span><div style={{ color: '#aaa' }}>{order.fulfillmentStatus || 'unfulfilled'}</div></div>
                            <div><span style={{ color: '#888', fontSize: 12 }}>Ngày đặt</span><div style={{ color: '#aaa' }}>{new Date(order.orderDate).toLocaleDateString('vi-VN')}</div></div>
                        </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 20 }}>
                        <h3 style={{ color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 12 }}>Lịch sử trạng thái</h3>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: STATE_COLORS[state] + '22', color: STATE_COLORS[state] }}>{STATE_LABELS[state]}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Items Tab — read-only product list + link to Merchandise */}
            {activeTab === 'items' && (() => {
                const items: any[] = order.lineItems || [];
                const getBrand = (li: any) => li.brand?.name || (li.sku?.includes('-') ? li.sku.split('-')[0] : null);
                return (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ color: '#888', fontSize: 13 }}>{items.length} sản phẩm</div>
                            <a href="/merchandise" style={{ padding: '6px 16px', background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 12, border: '1px solid rgba(139,92,246,0.2)' }}>
                                👕 Xem tất cả trong Merchandise →
                            </a>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                        {['Brand', 'Sản phẩm', 'SKU', 'SL', 'Giá', 'Trạng thái'].map(h => (
                                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#888', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((li: any) => {
                                        const brand = getBrand(li);
                                        const itemInfo = ITEM_STATE_LABELS[li.itemState] || ITEM_STATE_LABELS.PENDING;
                                        return (
                                            <tr key={li.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                <td style={{ padding: '10px 14px' }}>
                                                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: brand ? '#8b5cf622' : 'rgba(255,255,255,0.04)', color: brand ? '#8b5cf6' : '#666' }}>
                                                        {brand || 'Chưa gán'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '10px 14px', color: '#ddd', maxWidth: 300 }}>{li.title}</td>
                                                <td style={{ padding: '10px 14px', color: '#aaa', fontFamily: 'monospace', fontSize: 12 }}>{li.sku || '—'}</td>
                                                <td style={{ padding: '10px 14px', color: '#fff', fontWeight: 600 }}>{li.quantity}</td>
                                                <td style={{ padding: '10px 14px', color: '#aaa' }}>${parseFloat(li.unitPrice).toFixed(2)}</td>
                                                <td style={{ padding: '10px 14px' }}>
                                                    <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: itemInfo.bg, color: itemInfo.color }}>{itemInfo.label}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })()}

            {/* Log Tab */}
            {activeTab === 'log' && (
                <div>
                    {orderLogs.length === 0 ? (
                        <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Chưa có lịch sử thay đổi</div>
                    ) : (
                        <div style={{ position: 'relative', paddingLeft: 24 }}>
                            <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, background: 'rgba(255,255,255,0.08)' }} />
                            {orderLogs.map((log: any, i: number) => (
                                <div key={log.id || i} style={{ position: 'relative', marginBottom: 16 }}>
                                    <div style={{ position: 'absolute', left: -20, top: 6, width: 12, height: 12, borderRadius: '50%', background: log.source === 'webhook' ? '#3b82f6' : log.source === 'manual' ? '#f59e0b' : '#22c55e', border: '2px solid rgba(0,0,0,0.5)' }} />
                                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 14 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: log.source === 'webhook' ? '#3b82f622' : '#f59e0b22', color: log.source === 'webhook' ? '#3b82f6' : '#f59e0b' }}>{log.source}</span>
                                                {log.shopifyTopic && <span style={{ color: '#888', fontSize: 11 }}>{log.shopifyTopic}</span>}
                                            </div>
                                            <span style={{ color: '#666', fontSize: 11 }}>{new Date(log.createdAt).toLocaleString('vi-VN')}</span>
                                        </div>
                                        <div style={{ display: 'grid', gap: 4 }}>
                                            {Object.entries(log.changedFields || {}).map(([field, change]: [string, any]) => (
                                                <div key={field} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                                                    <span style={{ color: '#888', fontFamily: 'monospace', fontSize: 11, minWidth: 140 }}>{field}</span>
                                                    <span style={{ color: '#ef4444', textDecoration: 'line-through', fontSize: 12 }}>{change.old || '—'}</span>
                                                    <span style={{ color: '#666' }}>→</span>
                                                    <span style={{ color: '#22c55e', fontWeight: 600, fontSize: 12 }}>{change.new || '—'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
