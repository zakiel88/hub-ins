'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

const PR_STATUSES: Record<string, { label: string; color: string; bg: string }> = {
    OPEN: { label: 'Chưa báo Brand', color: '#f59e0b', bg: '#f59e0b22' },
    NOTIFIED_BRAND: { label: 'Đã Báo Brand', color: '#3b82f6', bg: '#3b82f622' },
    RECEIVED: { label: 'Đã nhập kho', color: '#22c55e', bg: '#22c55e22' },
    CANCELLED: { label: 'Đã huỷ', color: '#ef4444', bg: '#ef444422' },
};

export default function ProcurementPage() {
    const searchParams = useSearchParams();
    const orderIdFilter = searchParams.get('orderId') || '';

    const [activeTab, setActiveTab] = useState<'pr' | 'po'>('pr');
    const [prs, setPrs] = useState<any[]>([]);
    const [pos, setPos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const prParams: Record<string, string> = {};
            if (orderIdFilter) prParams.orderId = orderIdFilter;
            const [prRes, poRes] = await Promise.all([api.getPRs(prParams), api.getPOs()]);
            setPrs(prRes.data);
            setPos(poRes.data);
        } catch { /* */ } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [orderIdFilter]);

    const updatePRStatus = async (id: string, status: string) => {
        try {
            await api.updatePRStatus(id, status);
            const statusLabel = PR_STATUSES[status]?.label || status;
            setToast(`✅ Cập nhật → ${statusLabel}`);
            setTimeout(() => setToast(null), 3000);
            load();
        } catch (e: any) {
            setToast(`❌ ${e.message}`);
            setTimeout(() => setToast(null), 3000);
        }
    };

    const updatePOStatus = async (id: string, status: string) => {
        try {
            await api.updatePOStatus(id, status);
            setToast(`✅ PO status → ${status}`);
            setTimeout(() => setToast(null), 3000);
            load();
        } catch (e: any) {
            setToast(`❌ ${e.message}`);
            setTimeout(() => setToast(null), 3000);
        }
    };

    const getBrandFromSku = (sku: string) => {
        if (sku && sku.includes('-')) return sku.split('-')[0];
        return null;
    };

    const poStatusColors: Record<string, string> = { DRAFT: '#6b7280', SENT: '#f59e0b', CONFIRMED: '#22c55e', RECEIVED: '#06b6d4' };
    const tabStyle = (active: boolean) => ({ padding: '10px 24px', background: active ? 'rgba(255,255,255,0.1)' : 'transparent', color: active ? '#fff' : '#888', border: 'none', borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer', fontWeight: 600 as const, fontSize: 15 });

    return (
        <div style={{ padding: 32 }}>
            {/* Toast */}
            {toast && (
                <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 20px', background: toast.startsWith('✅') ? '#10b981' : '#ef4444', color: '#fff', borderRadius: 10, fontWeight: 600, fontSize: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                    {toast}
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff', margin: 0 }}>Procurement</h1>
                {orderIdFilter && (
                    <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444' }}>
                        Đang lọc theo đơn hàng
                    </span>
                )}
                {orderIdFilter && (
                    <a href="/procurement" style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none' }}>Xem tất cả →</a>
                )}
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
                <button onClick={() => setActiveTab('pr')} style={tabStyle(activeTab === 'pr')}>Yêu cầu mua hàng ({prs.length})</button>
                <button onClick={() => setActiveTab('po')} style={tabStyle(activeTab === 'po')}>Đơn mua hàng ({pos.length})</button>
            </div>

            {loading && <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Đang tải...</div>}

            {!loading && activeTab === 'pr' && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                {['Brand', 'SKU', 'SL', 'Đơn hàng', 'Tình trạng', 'Ghi chú', 'Ngày tạo', 'Thao tác'].map(h => (
                                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#888', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {prs.length === 0 ? (
                                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#666' }}>
                                    {orderIdFilter ? 'Đơn này chưa có yêu cầu mua hàng.' : 'Chưa có yêu cầu mua hàng'}
                                </td></tr>
                            ) : prs.map(pr => {
                                const brand = pr.brand?.name || getBrandFromSku(pr.sku);
                                const statusInfo = PR_STATUSES[pr.status] || PR_STATUSES.OPEN;
                                return (
                                    <tr key={pr.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <td style={{ padding: '10px 14px' }}>
                                            <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: brand ? '#8b5cf622' : 'rgba(255,255,255,0.04)', color: brand ? '#8b5cf6' : '#666' }}>
                                                {brand || 'Chưa gán'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 14px', color: '#fff', fontFamily: 'monospace', fontSize: 12 }}>{pr.sku}</td>
                                        <td style={{ padding: '10px 14px', color: '#fff', fontWeight: 600 }}>{pr.qtyNeeded}</td>
                                        <td style={{ padding: '10px 14px' }}><a href={`/orders/${pr.orderItem?.order?.id}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>{pr.orderItem?.order?.orderNumber}</a></td>
                                        <td style={{ padding: '10px 14px' }}>
                                            <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: statusInfo.bg, color: statusInfo.color }}>{statusInfo.label}</span>
                                        </td>
                                        <td style={{ padding: '10px 14px', color: '#888', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pr.notes || '—'}</td>
                                        <td style={{ padding: '10px 14px', color: '#777', fontSize: 12 }}>{new Date(pr.createdAt).toLocaleDateString('vi-VN')}</td>
                                        <td style={{ padding: '10px 14px' }}>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                {pr.status === 'OPEN' && (
                                                    <button onClick={() => updatePRStatus(pr.id, 'NOTIFIED_BRAND')} style={{ padding: '4px 10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                                                        Báo Brand
                                                    </button>
                                                )}
                                                {pr.status === 'NOTIFIED_BRAND' && (
                                                    <button onClick={() => updatePRStatus(pr.id, 'RECEIVED')} style={{ padding: '4px 10px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                                                        Đã nhập kho
                                                    </button>
                                                )}
                                                {pr.status === 'RECEIVED' && (
                                                    <span style={{ color: '#22c55e', fontSize: 11 }}>✓ Hoàn tất</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {!loading && activeTab === 'po' && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                {['Mã PO', 'Nhà cung cấp', 'Sản phẩm', 'Trạng thái', 'Người tạo', 'Thao tác'].map(h => (
                                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#888', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {pos.length === 0 ? (
                                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#666' }}>Chưa có đơn mua hàng</td></tr>
                            ) : pos.map(po => (
                                <tr key={po.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <td style={{ padding: '10px 14px', color: '#3b82f6', fontWeight: 600 }}>{po.poNumber}</td>
                                    <td style={{ padding: '10px 14px', color: '#ddd' }}>{po.brand?.name || '—'}</td>
                                    <td style={{ padding: '10px 14px', color: '#aaa' }}>{po._count?.items || 0}</td>
                                    <td style={{ padding: '10px 14px' }}>
                                        <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: `${poStatusColors[po.status]}22`, color: poStatusColors[po.status] }}>{po.status}</span>
                                    </td>
                                    <td style={{ padding: '10px 14px', color: '#aaa', fontSize: 13 }}>{po.creator?.fullName}</td>
                                    <td style={{ padding: '10px 14px' }}>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            {po.status === 'DRAFT' && <button onClick={() => updatePOStatus(po.id, 'SENT')} style={{ padding: '4px 10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Gửi</button>}
                                            {po.status === 'SENT' && <button onClick={() => updatePOStatus(po.id, 'CONFIRMED')} style={{ padding: '4px 10px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Xác nhận</button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
