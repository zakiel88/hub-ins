'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function StoresPage() {
    const [stores, setStores] = useState<any[]>([]);
    const [meta, setMeta] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Connect store modal
    const [showConnect, setShowConnect] = useState(false);
    const [connectForm, setConnectForm] = useState({
        storeName: '', shopifyDomain: '', clientId: '', clientSecret: '',
    });
    const [connecting, setConnecting] = useState(false);

    // Edit modal
    const [showEdit, setShowEdit] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [editForm, setEditForm] = useState({ storeName: '', apiVersion: '2025-01' });
    const [saving, setSaving] = useState(false);

    // Connection test
    const [testingId, setTestingId] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<any>(null);

    // Sync logs
    const [selectedStore, setSelectedStore] = useState<any>(null);
    const [syncLogs, setSyncLogs] = useState<any[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);

    // Toast
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {};
            if (search) params.search = search;
            const res = await api.getStores(Object.keys(params).length ? params : undefined);
            setStores(res.data);
            setMeta(res.meta);
        } catch {
            window.location.href = '/login';
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    useEffect(() => {
        if (toast) {
            const t = setTimeout(() => setToast(null), 5000);
            return () => clearTimeout(t);
        }
    }, [toast]);

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        setConnecting(true);
        try {
            await api.connectStore(connectForm);
            setShowConnect(false);
            setConnectForm({ storeName: '', shopifyDomain: '', clientId: '', clientSecret: '' });
            setToast({ msg: '✅ Store connected successfully!', ok: true });
            load();
        } catch (err: any) {
            setToast({ msg: `❌ ${err.message}`, ok: false });
        } finally {
            setConnecting(false);
        }
    };

    const openEdit = (store: any) => {
        setEditing(store);
        setEditForm({
            storeName: store.storeName,
            apiVersion: store.apiVersion,
        });
        setShowEdit(true);
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.updateStore(editing.id, editForm);
            setShowEdit(false);
            setToast({ msg: '✅ Store updated', ok: true });
            load();
        } catch (err: any) { alert(err.message); }
        finally { setSaving(false); }
    };

    const handleToggle = async (id: string) => {
        try { await api.toggleStore(id); load(); }
        catch (err: any) { alert(err.message); }
    };

    const handleDelete = async (store: any) => {
        if (!confirm(`Delete store "${store.storeName}"? This cannot be undone.`)) return;
        try { await api.deleteStore(store.id); load(); }
        catch (err: any) { alert(err.message); }
    };

    const handleTest = async (id: string) => {
        setTestingId(id);
        setTestResult(null);
        try {
            const res = await api.testStoreConnection(id);
            setTestResult(res.data);
        } catch (err: any) {
            setTestResult({ success: false, error: err.message });
        } finally {
            setTestingId(null);
        }
    };

    const viewLogs = async (store: any) => {
        setSelectedStore(store);
        setLogsLoading(true);
        try {
            const res = await api.getStoreSyncLogs(store.id);
            setSyncLogs(res.data);
        } catch { setSyncLogs([]); }
        finally { setLogsLoading(false); }
    };

    return (
        <>
            {toast && (
                <div className={`toast ${toast.ok ? '' : 'toast-error'}`} onClick={() => setToast(null)}>
                    {toast.msg}
                </div>
            )}

            <div className="page-header">
                <div className="page-header-row">
                    <div>
                        <h1 className="page-title">Shopify Stores</h1>
                        <p className="page-subtitle">Connect and manage your Shopify stores</p>
                    </div>
                    <button className="btn-primary btn-sm" onClick={() => setShowConnect(true)}>
                        + Connect Store
                    </button>
                </div>
            </div>

            <div className="page-content">
                <div className="toolbar">
                    <div className="search-box">
                        <input className="form-input" placeholder="Search stores…"
                            value={search} onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && load()} />
                        <button className="btn-ghost" onClick={load}>Search</button>
                    </div>
                    {meta && <div className="toolbar-meta">{meta.total} store{meta.total !== 1 ? 's' : ''}</div>}
                </div>

                {loading ? (
                    <div className="page-loading"><div className="spinner" /></div>
                ) : stores.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🏪</div>
                        <div className="empty-state-text">No Shopify stores connected yet. Click &quot;Connect Store&quot; to add your first store.</div>
                    </div>
                ) : (
                    <div className="stores-grid">
                        {stores.map((store) => (
                            <div key={store.id} className="store-card">
                                <div className="store-card-header">
                                    <div className="store-card-title">
                                        <span className="store-icon">🏪</span>
                                        <div>
                                            <div className="cell-primary">{store.storeName}</div>
                                            <div className="cell-muted" style={{ fontSize: 12 }}>{store.shopifyDomain}</div>
                                        </div>
                                    </div>
                                    <span className={`status-badge ${store.isActive ? 'badge-success' : 'badge-muted'}`}>
                                        {store.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>

                                <div className="store-card-stats">
                                    <div className="store-stat">
                                        <span className="store-stat-value">{store._count?.orders ?? 0}</span>
                                        <span className="store-stat-label">Orders</span>
                                    </div>
                                    <div className="store-stat">
                                        <span className="store-stat-value">{store._count?.shopifyProductMappings ?? 0}</span>
                                        <span className="store-stat-label">Mappings</span>
                                    </div>
                                    <div className="store-stat">
                                        <span className="store-stat-value">{store._count?.syncLogs ?? 0}</span>
                                        <span className="store-stat-label">Syncs</span>
                                    </div>
                                </div>

                                <div className="store-card-meta">
                                    <span className="cell-muted" style={{ fontSize: 11 }}>API {store.apiVersion}</span>
                                    {store.tokenLastRotatedAt && (
                                        <span className="cell-muted" style={{ fontSize: 11 }}>
                                            🔑 {new Date(store.tokenLastRotatedAt).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>

                                <div className="store-card-actions">
                                    <button className="btn-sm btn-ghost" onClick={() => handleTest(store.id)}
                                        disabled={testingId === store.id}>
                                        {testingId === store.id ? '⏳' : '🔌'} Test
                                    </button>
                                    <button className="btn-sm btn-ghost" onClick={() => viewLogs(store)}>📋 Logs</button>
                                    <button className="btn-sm btn-ghost" onClick={() => openEdit(store)}>✏️ Edit</button>
                                    <button className="btn-sm btn-ghost" onClick={() => handleToggle(store.id)}>
                                        {store.isActive ? '⏸️' : '▶️'}
                                    </button>
                                    <button className="btn-sm btn-ghost btn-danger" onClick={() => handleDelete(store)}>🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Connection test result */}
                {testResult && (
                    <div className="modal-overlay" onClick={() => setTestResult(null)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2 className="modal-title">
                                    {testResult.success ? '✅ Connection OK' : '❌ Connection Failed'}
                                </h2>
                                <button className="modal-close" onClick={() => setTestResult(null)}>✕</button>
                            </div>
                            <div className="modal-body">
                                {testResult.success ? (
                                    <div className="detail-grid">
                                        <div className="detail-row"><span className="detail-label">Shop Name</span><span className="detail-value">{testResult.shop?.name}</span></div>
                                        <div className="detail-row"><span className="detail-label">Email</span><span className="detail-value">{testResult.shop?.email}</span></div>
                                        <div className="detail-row"><span className="detail-label">Domain</span><span className="detail-value">{testResult.shop?.domain}</span></div>
                                        <div className="detail-row"><span className="detail-label">Plan</span><span className="detail-value">{testResult.shop?.plan}</span></div>
                                        <div className="detail-row"><span className="detail-label">Currency</span><span className="detail-value">{testResult.shop?.currency}</span></div>
                                        <div className="detail-row"><span className="detail-label">Timezone</span><span className="detail-value">{testResult.shop?.timezone}</span></div>
                                    </div>
                                ) : (
                                    <div className="store-error"><code>{testResult.error || `HTTP ${testResult.status}`}</code></div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Connect Store Modal */}
            {showConnect && (
                <div className="modal-overlay" onClick={() => setShowConnect(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Connect Shopify Store</h2>
                            <button className="modal-close" onClick={() => setShowConnect(false)}>✕</button>
                        </div>
                        <form onSubmit={handleConnect}>
                            <div className="modal-body">
                                <div className="oauth-info">
                                    <div className="oauth-info-icon">🔐</div>
                                    <p>Enter your store&apos;s Shopify app credentials. The access token will be obtained automatically via Client Credentials grant and encrypted at rest.</p>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Store Name</label>
                                    <input className="form-input" placeholder="e.g. My US Store (auto-detected if blank)"
                                        value={connectForm.storeName}
                                        onChange={(e) => setConnectForm({ ...connectForm, storeName: e.target.value })} />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Shopify Domain *</label>
                                    <input className="form-input" required placeholder="your-store.myshopify.com"
                                        value={connectForm.shopifyDomain}
                                        onChange={(e) => setConnectForm({ ...connectForm, shopifyDomain: e.target.value })} />
                                    <div className="form-hint">The store must have your custom app installed</div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Client ID *</label>
                                        <input className="form-input" required placeholder="From Shopify app credentials"
                                            value={connectForm.clientId}
                                            onChange={(e) => setConnectForm({ ...connectForm, clientId: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Client Secret *</label>
                                        <input className="form-input" required type="password"
                                            placeholder="From Shopify app credentials"
                                            value={connectForm.clientSecret}
                                            onChange={(e) => setConnectForm({ ...connectForm, clientSecret: e.target.value })} />
                                    </div>
                                </div>

                                <div style={{
                                    padding: '10px 14px', borderRadius: 8, marginTop: 4,
                                    background: 'rgba(100, 181, 246, 0.08)', border: '1px solid rgba(100, 181, 246, 0.2)',
                                    fontSize: 12, color: '#90caf9', lineHeight: 1.5,
                                }}>
                                    💡 Find your credentials at <strong>Shopify Partners → Apps → Your App → Settings → Client credentials</strong>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-ghost" onClick={() => setShowConnect(false)}>Cancel</button>
                                <button type="submit" className="btn-primary btn-sm" disabled={connecting}>
                                    {connecting ? '⏳ Connecting…' : '🔗 Connect Store'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Store Modal */}
            {showEdit && (
                <div className="modal-overlay" onClick={() => setShowEdit(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Edit Store</h2>
                            <button className="modal-close" onClick={() => setShowEdit(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSaveEdit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Store Name</label>
                                    <input className="form-input" required value={editForm.storeName}
                                        onChange={(e) => setEditForm({ ...editForm, storeName: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">API Version</label>
                                    <select className="form-select" value={editForm.apiVersion}
                                        onChange={(e) => setEditForm({ ...editForm, apiVersion: e.target.value })}>
                                        <option value="2025-01">2025-01</option>
                                        <option value="2024-10">2024-10</option>
                                        <option value="2024-07">2024-07</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-ghost" onClick={() => setShowEdit(false)}>Cancel</button>
                                <button type="submit" className="btn-primary btn-sm" disabled={saving}>
                                    {saving ? 'Saving…' : 'Update Store'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Sync Logs Modal */}
            {selectedStore && (
                <div className="modal-overlay" onClick={() => setSelectedStore(null)}>
                    <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Sync Logs — {selectedStore.storeName}</h2>
                            <button className="modal-close" onClick={() => setSelectedStore(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            {logsLoading ? (
                                <div className="page-loading"><div className="spinner" /></div>
                            ) : syncLogs.length === 0 ? (
                                <div className="cell-muted" style={{ textAlign: 'center', padding: 40 }}>
                                    No sync logs yet.
                                </div>
                            ) : (
                                <div className="table-wrap">
                                    <table className="data-table">
                                        <thead>
                                            <tr><th>Entity</th><th>Type</th><th>Status</th><th>Records</th><th>Started</th><th>Error</th></tr>
                                        </thead>
                                        <tbody>
                                            {syncLogs.map((log) => (
                                                <tr key={log.id}>
                                                    <td>{log.entityType}</td>
                                                    <td><code className="code-tag">{log.syncType}</code></td>
                                                    <td><span className={`status-badge ${log.status === 'completed' ? 'badge-success' : log.status === 'failed' ? 'badge-error' : 'badge-warning'}`}>{log.status}</span></td>
                                                    <td>{log.syncedRecords ?? '—'} / {log.totalRecords ?? '—'}</td>
                                                    <td className="cell-muted">{new Date(log.startedAt).toLocaleString()}</td>
                                                    <td className="cell-muted">{log.errorMessage || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
