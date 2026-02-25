'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const STATUS_TRANSITIONS: Record<string, string[]> = {
    onboarding: ['active', 'inactive'],
    active: ['suspended', 'inactive'],
    suspended: ['active', 'inactive'],
    inactive: ['onboarding'],
};

export default function BrandDetailPage() {
    const params = useParams();
    const router = useRouter();
    const brandId = params.id as string;

    const [brand, setBrand] = useState<any>(null);
    const [contacts, setContacts] = useState<any[]>([]);
    const [contracts, setContracts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'overview' | 'contacts' | 'contracts'>('overview');
    const [showEdit, setShowEdit] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', website: '', notes: '' });
    const [saving, setSaving] = useState(false);

    // Contact form
    const [showContactForm, setShowContactForm] = useState(false);
    const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', role: '', isPrimary: false });
    const [savingContact, setSavingContact] = useState(false);

    // Contract form
    const [showContractForm, setShowContractForm] = useState(false);
    const [contractForm, setContractForm] = useState({ type: 'distribution', terms: '', status: 'draft' });
    const [savingContract, setSavingContract] = useState(false);

    const loadBrand = async () => {
        try {
            const res = await api.getBrand(brandId);
            setBrand(res.data);
            setEditForm({ name: res.data.name, website: res.data.website || '', notes: res.data.notes || '' });
        } catch {
            router.push('/brands');
        }
    };

    const loadContacts = async () => {
        try {
            const res = await api.getBrandContacts(brandId);
            setContacts(res.data);
        } catch { /* empty */ }
    };

    const loadContracts = async () => {
        try {
            const res = await api.getBrandContracts(brandId);
            setContracts(res.data);
        } catch { /* empty */ }
    };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await Promise.all([loadBrand(), loadContacts(), loadContracts()]);
            setLoading(false);
        };
        load();
    }, [brandId]);

    const handleUpdateBrand = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.updateBrand(brandId, editForm);
            await loadBrand();
            setShowEdit(false);
        } catch (err: any) { alert(err.message); }
        finally { setSaving(false); }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!confirm(`Change status to "${newStatus}"?`)) return;
        try {
            await api.updateBrandStatus(brandId, newStatus);
            await loadBrand();
        } catch (err: any) { alert(err.message); }
    };

    const handleCreateContact = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingContact(true);
        try {
            await api.createBrandContact(brandId, contactForm);
            setShowContactForm(false);
            setContactForm({ name: '', email: '', phone: '', role: '', isPrimary: false });
            await loadContacts();
        } catch (err: any) { alert(err.message); }
        finally { setSavingContact(false); }
    };

    const handleDeleteContact = async (contactId: string) => {
        if (!confirm('Delete this contact?')) return;
        try {
            await api.deleteBrandContact(brandId, contactId);
            await loadContacts();
        } catch (err: any) { alert(err.message); }
    };

    const handleCreateContract = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingContract(true);
        try {
            await api.createBrandContract(brandId, contractForm);
            setShowContractForm(false);
            setContractForm({ type: 'distribution', terms: '', status: 'draft' });
            await loadContracts();
        } catch (err: any) { alert(err.message); }
        finally { setSavingContract(false); }
    };

    const statusClass = (status: string) => {
        const map: Record<string, string> = {
            active: 'badge-success', onboarding: 'badge-warning',
            suspended: 'badge-error', inactive: 'badge-muted',
            draft: 'badge-muted', signed: 'badge-success', expired: 'badge-error',
        };
        return `status-badge ${map[status] || 'badge-muted'}`;
    };

    if (loading) return <div className="page-loading"><div className="spinner" /></div>;
    if (!brand) return null;

    return (
        <>
            <div className="page-header">
                <div className="page-header-row">
                    <div>
                        <button className="btn-ghost btn-back" onClick={() => router.push('/brands')}>← Brands</button>
                        <h1 className="page-title">{brand.name}</h1>
                        <div className="page-subtitle-row">
                            <code className="code-tag">{brand.code}</code>
                            <span className={statusClass(brand.status)}>{brand.status}</span>
                            {brand.website && (
                                <a href={brand.website} target="_blank" rel="noreferrer" className="link-subtle">{brand.website}</a>
                            )}
                        </div>
                    </div>
                    <div className="header-actions">
                        <button className="btn-ghost btn-sm" onClick={() => setShowEdit(true)}>✏️ Edit</button>
                        {STATUS_TRANSITIONS[brand.status]?.map((s) => (
                            <button key={s} className={`btn-sm ${s === 'active' ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => handleStatusChange(s)}>
                                → {s}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="page-content">
                <div className="tab-bar">
                    <button className={`tab-item ${tab === 'overview' ? 'tab-active' : ''}`} onClick={() => setTab('overview')}>
                        📋 Overview
                    </button>
                    <button className={`tab-item ${tab === 'contacts' ? 'tab-active' : ''}`} onClick={() => setTab('contacts')}>
                        👤 Contacts ({contacts.length})
                    </button>
                    <button className={`tab-item ${tab === 'contracts' ? 'tab-active' : ''}`} onClick={() => setTab('contracts')}>
                        📄 Contracts ({contracts.length})
                    </button>
                </div>

                {/* Overview Tab */}
                {tab === 'overview' && (
                    <div className="detail-overview">
                        <div className="stats-grid stats-grid-3">
                            <div className="stat-card stat-accent-1">
                                <div className="stat-label">Collections</div>
                                <div className="stat-value">{brand._count?.collections ?? 0}</div>
                            </div>
                            <div className="stat-card stat-accent-2">
                                <div className="stat-label">Contacts</div>
                                <div className="stat-value">{contacts.length}</div>
                            </div>
                            <div className="stat-card stat-accent-3">
                                <div className="stat-label">Contracts</div>
                                <div className="stat-value">{contracts.length}</div>
                            </div>
                        </div>

                        <div className="card" style={{ marginTop: 20 }}>
                            <div className="card-header">
                                <h3 className="card-title">Brand Details</h3>
                            </div>
                            <div className="card-body">
                                <div className="detail-grid">
                                    <div className="detail-row">
                                        <span className="detail-label">Name</span>
                                        <span className="detail-value">{brand.name}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Code</span>
                                        <span className="detail-value"><code className="code-tag">{brand.code}</code></span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Status</span>
                                        <span className="detail-value"><span className={statusClass(brand.status)}>{brand.status}</span></span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Website</span>
                                        <span className="detail-value">{brand.website || '—'}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Notes</span>
                                        <span className="detail-value">{brand.notes || '—'}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Created</span>
                                        <span className="detail-value">{new Date(brand.createdAt).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Contacts Tab */}
                {tab === 'contacts' && (
                    <>
                        <div className="tab-toolbar">
                            <button className="btn-primary btn-sm" onClick={() => setShowContactForm(true)}>+ Add Contact</button>
                        </div>
                        {contacts.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">👤</div>
                                <div className="empty-state-text">No contacts yet. Add a contact person for this brand.</div>
                            </div>
                        ) : (
                            <div className="table-wrap">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Phone</th>
                                            <th>Role</th>
                                            <th>Primary</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {contacts.map((c) => (
                                            <tr key={c.id}>
                                                <td><div className="cell-primary">{c.name}</div></td>
                                                <td className="cell-muted">{c.email || '—'}</td>
                                                <td className="cell-muted">{c.phone || '—'}</td>
                                                <td>{c.role || '—'}</td>
                                                <td>{c.isPrimary ? <span className="status-badge badge-success">Primary</span> : '—'}</td>
                                                <td>
                                                    <button className="btn-ghost btn-xs btn-danger" onClick={() => handleDeleteContact(c.id)}>🗑</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

                {/* Contracts Tab */}
                {tab === 'contracts' && (
                    <>
                        <div className="tab-toolbar">
                            <button className="btn-primary btn-sm" onClick={() => setShowContractForm(true)}>+ Add Contract</button>
                        </div>
                        {contracts.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">📄</div>
                                <div className="empty-state-text">No contracts yet. Create a contract to define terms.</div>
                            </div>
                        ) : (
                            <div className="table-wrap">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Type</th>
                                            <th>Status</th>
                                            <th>Terms</th>
                                            <th>Start Date</th>
                                            <th>End Date</th>
                                            <th>Created</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {contracts.map((c) => (
                                            <tr key={c.id}>
                                                <td><div className="cell-primary">{c.type}</div></td>
                                                <td><span className={statusClass(c.status)}>{c.status}</span></td>
                                                <td className="cell-muted">{c.terms ? c.terms.substring(0, 60) + '…' : '—'}</td>
                                                <td className="cell-muted">{c.startDate ? new Date(c.startDate).toLocaleDateString() : '—'}</td>
                                                <td className="cell-muted">{c.endDate ? new Date(c.endDate).toLocaleDateString() : '—'}</td>
                                                <td className="cell-muted">{new Date(c.createdAt).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Edit Brand Modal */}
            {showEdit && (
                <div className="modal-overlay" onClick={() => setShowEdit(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Edit Brand</h2>
                            <button className="modal-close" onClick={() => setShowEdit(false)}>✕</button>
                        </div>
                        <form onSubmit={handleUpdateBrand}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Name</label>
                                    <input className="form-input" required value={editForm.name}
                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Website</label>
                                    <input className="form-input" value={editForm.website}
                                        onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Notes</label>
                                    <textarea className="form-input form-textarea" value={editForm.notes}
                                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                        rows={3} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-ghost" onClick={() => setShowEdit(false)}>Cancel</button>
                                <button type="submit" className="btn-primary btn-sm" disabled={saving}>
                                    {saving ? 'Saving…' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Contact Modal */}
            {showContactForm && (
                <div className="modal-overlay" onClick={() => setShowContactForm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Add Contact</h2>
                            <button className="modal-close" onClick={() => setShowContactForm(false)}>✕</button>
                        </div>
                        <form onSubmit={handleCreateContact}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Name *</label>
                                    <input className="form-input" required value={contactForm.name}
                                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <input className="form-input" type="email" value={contactForm.email}
                                            onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Phone</label>
                                        <input className="form-input" value={contactForm.phone}
                                            onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Role</label>
                                        <input className="form-input" placeholder="e.g. Sales Manager" value={contactForm.role}
                                            onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">&nbsp;</label>
                                        <label className="form-checkbox">
                                            <input type="checkbox" checked={contactForm.isPrimary}
                                                onChange={(e) => setContactForm({ ...contactForm, isPrimary: e.target.checked })} />
                                            Primary Contact
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-ghost" onClick={() => setShowContactForm(false)}>Cancel</button>
                                <button type="submit" className="btn-primary btn-sm" disabled={savingContact}>
                                    {savingContact ? 'Saving…' : 'Add Contact'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Contract Modal */}
            {showContractForm && (
                <div className="modal-overlay" onClick={() => setShowContractForm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Add Contract</h2>
                            <button className="modal-close" onClick={() => setShowContractForm(false)}>✕</button>
                        </div>
                        <form onSubmit={handleCreateContract}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Type *</label>
                                        <select className="form-select" value={contractForm.type}
                                            onChange={(e) => setContractForm({ ...contractForm, type: e.target.value })}>
                                            <option value="distribution">Distribution</option>
                                            <option value="licensing">Licensing</option>
                                            <option value="consignment">Consignment</option>
                                            <option value="wholesale">Wholesale</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Status</label>
                                        <select className="form-select" value={contractForm.status}
                                            onChange={(e) => setContractForm({ ...contractForm, status: e.target.value })}>
                                            <option value="draft">Draft</option>
                                            <option value="signed">Signed</option>
                                            <option value="expired">Expired</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Terms</label>
                                    <textarea className="form-input form-textarea" rows={4} value={contractForm.terms}
                                        onChange={(e) => setContractForm({ ...contractForm, terms: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-ghost" onClick={() => setShowContractForm(false)}>Cancel</button>
                                <button type="submit" className="btn-primary btn-sm" disabled={savingContract}>
                                    {savingContract ? 'Saving…' : 'Add Contract'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
