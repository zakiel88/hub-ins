'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function InventoryPage() {
    const [tab, setTab] = useState<'warehouses' | 'stock'>('stock');
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [inventory, setInventory] = useState<any[]>([]);
    const [meta, setMeta] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Warehouse create modal
    const [showCreateWH, setShowCreateWH] = useState(false);
    const [whForm, setWhForm] = useState({ code: '', name: '', address: '' });
    const [savingWH, setSavingWH] = useState(false);

    // Stock upsert modal
    const [showUpsert, setShowUpsert] = useState(false);
    const [savingStock, setSavingStock] = useState(false);
    const [variants, setVariants] = useState<any[]>([]);
    const [stockForm, setStockForm] = useState({ variantId: '', warehouseId: '', quantityOnHand: '0', quantityReserved: '0' });

    // Stock adjust modal
    const [adjusting, setAdjusting] = useState<any>(null);
    const [adjustForm, setAdjustForm] = useState({ adjustment: '', reason: '' });
    const [savingAdjust, setSavingAdjust] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            if (tab === 'warehouses') {
                const res = await api.getWarehouses(search ? { search } : undefined);
                setWarehouses(res.data); setMeta(res.meta);
            } else {
                const res = await api.getInventory(search ? { search } : undefined);
                setInventory(res.data); setMeta(res.meta);
            }
        } catch { window.location.href = '/login'; }
        finally { setLoading(false); }
    };

    const loadRefs = async () => {
        try {
            const [vr, wh] = await Promise.all([api.getVariants(), api.getWarehouses()]);
            setVariants(vr.data); setWarehouses(wh.data);
        } catch { /* */ }
    };

    useEffect(() => { load(); }, [tab]);

    const handleCreateWarehouse = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingWH(true);
        try {
            await api.createWarehouse(whForm);
            setShowCreateWH(false); setWhForm({ code: '', name: '', address: '' });
            load();
        } catch (err: any) { alert(err.message); }
        finally { setSavingWH(false); }
    };

    const openUpsert = () => { loadRefs(); setShowUpsert(true); };

    const handleUpsert = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingStock(true);
        try {
            await api.upsertInventory({
                colorwayId: stockForm.variantId,
                warehouseId: stockForm.warehouseId,
                quantityOnHand: parseInt(stockForm.quantityOnHand),
                quantityReserved: parseInt(stockForm.quantityReserved),
            });
            setShowUpsert(false);
            setStockForm({ variantId: '', warehouseId: '', quantityOnHand: '0', quantityReserved: '0' });
            load();
        } catch (err: any) { alert(err.message); }
        finally { setSavingStock(false); }
    };

    const openAdjust = (inv: any) => {
        setAdjusting(inv);
        setAdjustForm({ adjustment: '', reason: '' });
    };

    const handleAdjust = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingAdjust(true);
        try {
            await api.adjustStock(adjusting.id, {
                adjustment: parseInt(adjustForm.adjustment),
                reason: adjustForm.reason || undefined,
            });
            setAdjusting(null);
            load();
        } catch (err: any) { alert(err.message); }
        finally { setSavingAdjust(false); }
    };

    return (
        <>
            <div className="page-header">
                <div className="page-header-row">
                    <div>
                        <h1 className="page-title">Inventory</h1>
                        <p className="page-subtitle">Warehouse management & stock levels</p>
                    </div>
                    <div className="header-actions">
                        {tab === 'warehouses' && (
                            <button className="btn-primary btn-sm" onClick={() => setShowCreateWH(true)}>+ New Warehouse</button>
                        )}
                        {tab === 'stock' && (
                            <button className="btn-primary btn-sm" onClick={openUpsert}>+ Set Stock</button>
                        )}
                    </div>
                </div>
            </div>

            <div className="page-content">
                <div className="tab-bar">
                    <button className={`tab-item ${tab === 'stock' ? 'tab-active' : ''}`} onClick={() => { setTab('stock'); setSearch(''); }}>
                        📦 Stock Levels
                    </button>
                    <button className={`tab-item ${tab === 'warehouses' ? 'tab-active' : ''}`} onClick={() => { setTab('warehouses'); setSearch(''); }}>
                        🏭 Warehouses
                    </button>
                </div>

                <div className="toolbar">
                    <div className="search-box">
                        <input className="form-input" placeholder={tab === 'warehouses' ? 'Search warehouses…' : 'Search by SKU…'}
                            value={search} onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && load()} />
                        <button className="btn-ghost" onClick={load}>Search</button>
                    </div>
                    {meta && <div className="toolbar-meta">{meta.total} {tab === 'warehouses' ? 'warehouse(s)' : 'item(s)'}</div>}
                </div>

                {loading ? (
                    <div className="page-loading"><div className="spinner" /></div>
                ) : tab === 'warehouses' ? (
                    warehouses.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">🏭</div>
                            <div className="empty-state-text">No warehouses yet. Create your first warehouse.</div>
                        </div>
                    ) : (
                        <div className="table-wrap">
                            <table className="data-table">
                                <thead><tr><th>Warehouse</th><th>Code</th><th>Address</th><th>SKUs</th><th>Status</th></tr></thead>
                                <tbody>
                                    {warehouses.map((w) => (
                                        <tr key={w.id}>
                                            <td><div className="cell-primary">{w.name}</div></td>
                                            <td><code className="code-tag">{w.code}</code></td>
                                            <td className="cell-muted">{w.address || '—'}</td>
                                            <td>{w._count?.inventoryItems ?? 0}</td>
                                            <td><span className={`status-badge ${w.isActive ? 'badge-success' : 'badge-muted'}`}>{w.isActive ? 'Active' : 'Inactive'}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    inventory.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📦</div>
                            <div className="empty-state-text">No inventory items yet. Use &quot;Set Stock&quot; to add stock.</div>
                        </div>
                    ) : (
                        <div className="table-wrap">
                            <table className="data-table">
                                <thead><tr><th>SKU</th><th>Product</th><th>Brand</th><th>Warehouse</th><th>On Hand</th><th>Reserved</th><th>Available</th><th>Sync</th><th></th></tr></thead>
                                <tbody>
                                    {inventory.map((inv) => (
                                        <tr key={inv.id}>
                                            <td><code className="code-tag">{inv.colorway?.sku}</code></td>
                                            <td>{inv.colorway?.product?.name}</td>
                                            <td><code className="code-tag">{inv.colorway?.product?.collection?.brand?.code}</code></td>
                                            <td>{inv.warehouse?.name}</td>
                                            <td className="cell-mono">{inv.quantityOnHand}</td>
                                            <td className="cell-mono cell-muted">{inv.quantityReserved}</td>
                                            <td className="cell-mono cell-price">{inv.quantityOnHand - inv.quantityReserved}</td>
                                            <td><span className={`status-badge ${inv.syncStatus === 'synced' ? 'badge-success' : 'badge-warning'}`}>{inv.syncStatus}</span></td>
                                            <td>
                                                <button className="btn-sm btn-ghost" onClick={() => openAdjust(inv)}>± Adjust</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>

            {/* Create Warehouse Modal */}
            {showCreateWH && (
                <div className="modal-overlay" onClick={() => setShowCreateWH(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">New Warehouse</h2>
                            <button className="modal-close" onClick={() => setShowCreateWH(false)}>✕</button>
                        </div>
                        <form onSubmit={handleCreateWarehouse}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Code *</label>
                                    <input className="form-input" required placeholder="e.g. WH-MAIN" value={whForm.code}
                                        onChange={(e) => setWhForm({ ...whForm, code: e.target.value.toUpperCase() })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Name *</label>
                                    <input className="form-input" required value={whForm.name}
                                        onChange={(e) => setWhForm({ ...whForm, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Address</label>
                                    <input className="form-input" value={whForm.address}
                                        onChange={(e) => setWhForm({ ...whForm, address: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-ghost" onClick={() => setShowCreateWH(false)}>Cancel</button>
                                <button type="submit" className="btn-primary btn-sm" disabled={savingWH}>
                                    {savingWH ? 'Creating…' : 'Create Warehouse'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Set Stock (Upsert) Modal */}
            {showUpsert && (
                <div className="modal-overlay" onClick={() => setShowUpsert(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Set Stock Level</h2>
                            <button className="modal-close" onClick={() => setShowUpsert(false)}>✕</button>
                        </div>
                        <form onSubmit={handleUpsert}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">SKU (Variant) *</label>
                                    <select className="form-select" required value={stockForm.variantId}
                                        onChange={(e) => setStockForm({ ...stockForm, variantId: e.target.value })}>
                                        <option value="">Select SKU…</option>
                                        {variants.map((v) => (
                                            <option key={v.id} value={v.id}>{v.sku} — {v.product?.title} ({v.color}/{v.size})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Warehouse *</label>
                                    <select className="form-select" required value={stockForm.warehouseId}
                                        onChange={(e) => setStockForm({ ...stockForm, warehouseId: e.target.value })}>
                                        <option value="">Select warehouse…</option>
                                        {warehouses.map((w) => (
                                            <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Quantity On Hand *</label>
                                        <input className="form-input" type="number" required min="0" value={stockForm.quantityOnHand}
                                            onChange={(e) => setStockForm({ ...stockForm, quantityOnHand: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Quantity Reserved</label>
                                        <input className="form-input" type="number" min="0" value={stockForm.quantityReserved}
                                            onChange={(e) => setStockForm({ ...stockForm, quantityReserved: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-ghost" onClick={() => setShowUpsert(false)}>Cancel</button>
                                <button type="submit" className="btn-primary btn-sm" disabled={savingStock}>
                                    {savingStock ? 'Saving…' : 'Set Stock'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Stock Adjustment Modal */}
            {adjusting && (
                <div className="modal-overlay" onClick={() => setAdjusting(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Adjust Stock</h2>
                            <button className="modal-close" onClick={() => setAdjusting(null)}>✕</button>
                        </div>
                        <form onSubmit={handleAdjust}>
                            <div className="modal-body">
                                <div className="adjust-context">
                                    <div className="detail-row">
                                        <span className="detail-label">SKU</span>
                                        <span className="detail-value"><code className="code-tag">{adjusting.colorway?.sku}</code></span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Warehouse</span>
                                        <span className="detail-value">{adjusting.warehouse?.name}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Current On Hand</span>
                                        <span className="detail-value cell-mono">{adjusting.quantityOnHand}</span>
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: 16 }}>
                                    <label className="form-label">Adjustment *</label>
                                    <input className="form-input" type="number" required placeholder="+10 or -5" value={adjustForm.adjustment}
                                        onChange={(e) => setAdjustForm({ ...adjustForm, adjustment: e.target.value })} />
                                    <div className="form-hint">Positive to add, negative to subtract.</div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Reason</label>
                                    <textarea className="form-input form-textarea" rows={2} placeholder="e.g. Physical count reconciliation"
                                        value={adjustForm.reason}
                                        onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-ghost" onClick={() => setAdjusting(null)}>Cancel</button>
                                <button type="submit" className="btn-primary btn-sm" disabled={savingAdjust}>
                                    {savingAdjust ? 'Adjusting…' : 'Apply Adjustment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
