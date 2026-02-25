'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function OrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [meta, setMeta] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [financialFilter, setFinancialFilter] = useState('');
    const [search, setSearch] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {};
            if (statusFilter) params.status = statusFilter;
            if (financialFilter) params.financialStatus = financialFilter;
            if (search) params.search = search;
            const res = await api.getOrders(Object.keys(params).length ? params : undefined);
            setOrders(res.data);
            setMeta(res.meta);
        } catch {
            window.location.href = '/login';
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [statusFilter, financialFilter]);

    const viewOrder = async (id: string) => {
        setDetailLoading(true);
        try {
            const res = await api.getOrder(id);
            setSelectedOrder(res.data);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleStatusUpdate = async (orderId: string, newStatus: string) => {
        if (!confirm(`Change order status to "${newStatus}"?`)) return;
        try {
            await api.updateOrderStatus(orderId, newStatus);
            const res = await api.getOrder(orderId);
            setSelectedOrder(res.data);
            load();
        } catch (err: any) { alert(err.message); }
    };

    const statusClass = (status: string) => {
        const map: Record<string, string> = {
            open: 'badge-info', closed: 'badge-muted', cancelled: 'badge-error',
            paid: 'badge-success', pending: 'badge-warning', refunded: 'badge-error',
            fulfilled: 'badge-success', unfulfilled: 'badge-warning', partial: 'badge-info',
        };
        return `status-badge ${map[status] || 'badge-muted'}`;
    };

    return (
        <>
            <div className="page-header">
                <div className="page-header-row">
                    <div>
                        <h1 className="page-title">Orders</h1>
                        <p className="page-subtitle">Order management & tracking</p>
                    </div>
                </div>
            </div>

            <div className="page-content">
                <div className="toolbar">
                    <div className="filter-row">
                        <div className="search-box">
                            <input className="form-input" placeholder="Search order # or email…"
                                value={search} onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && load()} />
                            <button className="btn-ghost" onClick={load}>Search</button>
                        </div>
                        <select className="form-select" value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="">All Status</option>
                            <option value="open">Open</option>
                            <option value="closed">Closed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        <select className="form-select" value={financialFilter}
                            onChange={(e) => setFinancialFilter(e.target.value)}>
                            <option value="">All Financial</option>
                            <option value="paid">Paid</option>
                            <option value="pending">Pending</option>
                            <option value="refunded">Refunded</option>
                        </select>
                    </div>
                    {meta && <div className="toolbar-meta">{meta.total} order{meta.total !== 1 ? 's' : ''}</div>}
                </div>

                {loading ? (
                    <div className="page-loading"><div className="spinner" /></div>
                ) : orders.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🛒</div>
                        <div className="empty-state-text">No orders yet. Orders will appear once connected to a Shopify store.</div>
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Order #</th>
                                    <th>Store</th>
                                    <th>Customer</th>
                                    <th>Status</th>
                                    <th>Payment</th>
                                    <th>Fulfillment</th>
                                    <th>Total</th>
                                    <th>Items</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((o) => (
                                    <tr key={o.id} className="table-row-link" onClick={() => viewOrder(o.id)}>
                                        <td><div className="cell-primary">{o.orderNumber}</div></td>
                                        <td>{o.shopifyStore?.storeName}</td>
                                        <td className="cell-muted">{o.customerEmail || '—'}</td>
                                        <td><span className={statusClass(o.status)}>{o.status}</span></td>
                                        <td><span className={statusClass(o.financialStatus || '')}>{o.financialStatus || '—'}</span></td>
                                        <td><span className={statusClass(o.fulfillmentStatus || '')}>{o.fulfillmentStatus || '—'}</span></td>
                                        <td className="cell-mono cell-price">{o.currency} {o.totalPrice}</td>
                                        <td>{o._count?.lineItems ?? 0}</td>
                                        <td className="cell-muted">{new Date(o.orderDate).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {selectedOrder && (
                <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
                    <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Order {selectedOrder.orderNumber}</h2>
                            <div className="header-actions">
                                {selectedOrder.status === 'open' && (
                                    <>
                                        <button className="btn-sm btn-outline" onClick={() => handleStatusUpdate(selectedOrder.id, 'closed')}>Close</button>
                                        <button className="btn-sm btn-outline btn-danger" onClick={() => handleStatusUpdate(selectedOrder.id, 'cancelled')}>Cancel</button>
                                    </>
                                )}
                                {selectedOrder.status === 'closed' && (
                                    <button className="btn-sm btn-outline" onClick={() => handleStatusUpdate(selectedOrder.id, 'open')}>Reopen</button>
                                )}
                                <button className="modal-close" onClick={() => setSelectedOrder(null)}>✕</button>
                            </div>
                        </div>
                        <div className="modal-body">
                            {detailLoading ? (
                                <div className="page-loading"><div className="spinner" /></div>
                            ) : (
                                <>
                                    <div className="order-meta-grid">
                                        <div>
                                            <div className="form-label">Store</div>
                                            <div>{selectedOrder.shopifyStore?.storeName}</div>
                                        </div>
                                        <div>
                                            <div className="form-label">Customer</div>
                                            <div>{selectedOrder.customerEmail || '—'}</div>
                                        </div>
                                        <div>
                                            <div className="form-label">Status</div>
                                            <span className={statusClass(selectedOrder.status)}>{selectedOrder.status}</span>
                                        </div>
                                        <div>
                                            <div className="form-label">Total</div>
                                            <div className="cell-price">{selectedOrder.currency} {selectedOrder.totalPrice}</div>
                                        </div>
                                    </div>

                                    <h3 style={{ marginTop: 20, marginBottom: 12, fontSize: 14, fontWeight: 600 }}>Line Items</h3>
                                    {selectedOrder.lineItems?.length > 0 ? (
                                        <div className="table-wrap">
                                            <table className="data-table">
                                                <thead>
                                                    <tr>
                                                        <th>Item</th>
                                                        <th>SKU</th>
                                                        <th>Brand</th>
                                                        <th>Qty</th>
                                                        <th>Unit Price</th>
                                                        <th>Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedOrder.lineItems.map((li: any) => (
                                                        <tr key={li.id}>
                                                            <td><div className="cell-primary">{li.title}</div></td>
                                                            <td><code className="code-tag">{li.sku || li.colorway?.sku || '—'}</code></td>
                                                            <td>{li.brand?.code || li.colorway?.product?.collection?.brand?.code || '—'}</td>
                                                            <td>{li.quantity}</td>
                                                            <td className="cell-mono">{li.unitPrice}</td>
                                                            <td className="cell-mono cell-price">{li.totalPrice}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="cell-muted">No line items</div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
