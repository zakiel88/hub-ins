'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function BrandsPage() {
    const [brands, setBrands] = useState<any[]>([]);
    const [meta, setMeta] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: '', code: '', website: '' });
    const [creating, setCreating] = useState(false);

    const load = async (params?: Record<string, string>) => {
        setLoading(true);
        try {
            const res = await api.getBrands(params);
            setBrands(res.data);
            setMeta(res.meta);
        } catch {
            window.location.href = '/login';
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleSearch = () => {
        load(search ? { search } : undefined);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            await api.createBrand(form);
            setShowCreate(false);
            setForm({ name: '', code: '', website: '' });
            load();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setCreating(false);
        }
    };

    const statusClass = (status: string) => {
        const map: Record<string, string> = {
            active: 'badge-success', onboarding: 'badge-warning',
            suspended: 'badge-error', inactive: 'badge-muted',
        };
        return `status-badge ${map[status] || 'badge-muted'}`;
    };

    return (
        <>
            <div className="page-header">
                <div className="page-header-row">
                    <div>
                        <h1 className="page-title">Brands</h1>
                        <p className="page-subtitle">Manage brand partnerships and contacts</p>
                    </div>
                    <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}>
                        + New Brand
                    </button>
                </div>
            </div>

            <div className="page-content">
                <div className="toolbar">
                    <div className="search-box">
                        <input
                            className="form-input"
                            placeholder="Search brands…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <button className="btn-ghost" onClick={handleSearch}>Search</button>
                    </div>
                    {meta && <div className="toolbar-meta">{meta.total} brand{meta.total !== 1 ? 's' : ''}</div>}
                </div>

                {loading ? (
                    <div className="page-loading"><div className="spinner" /></div>
                ) : brands.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🏷️</div>
                        <div className="empty-state-text">No brands found. Create your first brand to get started.</div>
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Brand</th>
                                    <th>Code</th>
                                    <th>Status</th>
                                    <th>Collections</th>
                                    <th>Website</th>
                                    <th>Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {brands.map((b) => (
                                    <tr key={b.id} className="table-row-link" onClick={() => window.location.href = `/brands/${b.id}`}>
                                        <td>
                                            <div className="cell-primary">{b.name}</div>
                                        </td>
                                        <td><code className="code-tag">{b.code}</code></td>
                                        <td><span className={statusClass(b.status)}>{b.status}</span></td>
                                        <td>{b._count?.collections ?? 0}</td>
                                        <td className="cell-muted">{b.website || '—'}</td>
                                        <td className="cell-muted">{new Date(b.createdAt).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showCreate && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">New Brand</h2>
                            <button className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Brand Name *</label>
                                    <input className="form-input" required value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Code *</label>
                                    <input className="form-input" required placeholder="e.g. NIKE" value={form.code}
                                        onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Website</label>
                                    <input className="form-input" placeholder="https://" value={form.website}
                                        onChange={(e) => setForm({ ...form, website: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                                <button type="submit" className="btn-primary btn-sm" disabled={creating}>
                                    {creating ? 'Creating…' : 'Create Brand'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
