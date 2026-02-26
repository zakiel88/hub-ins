'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface UserRow {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    role: string;
    brandId: string | null;
    isActive: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    brand?: { id: string; name: string; code: string } | null;
}

type ModalType = 'create' | 'edit' | 'password' | 'myPassword' | 'myProfile' | null;

const ROLES = ['admin', 'merchandising', 'sourcing'];

const roleStyle: Record<string, { bg: string; color: string; label: string }> = {
    admin: { bg: 'rgba(99,102,241,0.12)', color: '#818cf8', label: 'Admin' },
    merchandising: { bg: 'rgba(16,185,129,0.12)', color: '#34d399', label: 'Merchandising' },
    sourcing: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', label: 'Sourcing' },
};

export default function UsersPage() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<UserRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<ModalType>(null);
    const [selected, setSelected] = useState<UserRow | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

    // Form
    const [formEmail, setFormEmail] = useState('');
    const [formName, setFormName] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formRole, setFormRole] = useState('merchandising');
    const [formPassword, setFormPassword] = useState('');
    const [formCurrentPassword, setFormCurrentPassword] = useState('');
    const [formNewPassword, setFormNewPassword] = useState('');

    const loadUsers = useCallback(async () => {
        try {
            const res = await api.getUsers();
            setUsers(res.data);
        } catch { /* redirect handled by api client */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadUsers(); }, [loadUsers]);
    useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); } }, [toast]);

    const clear = () => {
        setFormEmail(''); setFormName(''); setFormPhone(''); setFormRole('merchandising');
        setFormPassword(''); setFormCurrentPassword(''); setFormNewPassword('');
    };

    const openCreate = () => { clear(); setModal('create'); };
    const openEdit = (u: UserRow) => {
        clear(); setSelected(u);
        setFormName(u.fullName); setFormPhone(u.phone || ''); setFormRole(u.role);
        setModal('edit');
    };
    const openPassword = (u: UserRow) => { clear(); setSelected(u); setModal('password'); };
    const openMyPassword = () => { clear(); setModal('myPassword'); };
    const openMyProfile = () => {
        clear();
        setFormName(currentUser?.fullName || '');
        setFormPhone((currentUser as any)?.phone || '');
        setModal('myProfile');
    };
    const close = () => { setModal(null); setSelected(null); clear(); };

    const exec = async (action: () => Promise<void>, successMsg: string) => {
        setSubmitting(true);
        try {
            await action();
            setToast({ msg: `✅ ${successMsg}`, ok: true });
            await loadUsers(); close();
        } catch (err: any) {
            setToast({ msg: `❌ ${err.message}`, ok: false });
        } finally { setSubmitting(false); }
    };

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        return exec(() => api.createUser({ email: formEmail, password: formPassword, fullName: formName, role: formRole }).then(() => { }), 'User created!');
    };
    const handleEdit = (e: React.FormEvent) => {
        e.preventDefault(); if (!selected) return;
        return exec(() => api.updateUser(selected.id, { fullName: formName, phone: formPhone || null, role: formRole }).then(() => { }), 'User updated!');
    };
    const handleChangePassword = (e: React.FormEvent) => {
        e.preventDefault(); if (!selected) return;
        return exec(() => api.changeUserPassword(selected.id, formNewPassword).then(() => { }), 'Password reset!');
    };
    const handleMyPassword = (e: React.FormEvent) => {
        e.preventDefault();
        return exec(() => api.changeMyPassword(formCurrentPassword, formNewPassword).then(() => { }), 'Password changed!');
    };
    const handleMyProfile = (e: React.FormEvent) => {
        e.preventDefault();
        return exec(() => api.updateMyProfile({ fullName: formName, phone: formPhone || null }).then(() => { }), 'Profile updated!');
    };
    const handleToggle = async (u: UserRow) => {
        if (u.id === currentUser?.id) return;
        try { await api.toggleUser(u.id); await loadUsers(); setToast({ msg: `✅ User ${u.isActive ? 'deactivated' : 'activated'}`, ok: true }); }
        catch (err: any) { setToast({ msg: `❌ ${err.message}`, ok: false }); }
    };

    const fmt = (d: string | null) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    if (currentUser?.role !== 'admin') {
        return (
            <div className="page-content"><div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
                <h3>Access Denied</h3><p className="cell-muted">Only administrators can manage users.</p>
            </div></div></div>
        );
    }

    return (
        <>
            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: 20, right: 20, zIndex: 2000,
                    padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 500,
                    background: toast.ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    color: toast.ok ? '#34d399' : '#f87171',
                    border: `1px solid ${toast.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    backdropFilter: 'blur(8px)', animation: 'fadeIn 0.15s ease',
                }}>{toast.msg}</div>
            )}

            <div className="page-header">
                <div className="page-header-row">
                    <div>
                        <h1 className="page-title">Users</h1>
                        <p className="page-subtitle">Manage accounts, roles & security</p>
                    </div>
                    <div className="page-actions">
                        <button className="btn-ghost btn-sm" onClick={openMyProfile}>👤 My Profile</button>
                        <button className="btn-ghost btn-sm" onClick={openMyPassword}>🔑 Password</button>
                        <button className="btn-primary btn-sm" onClick={openCreate}>+ New User</button>
                    </div>
                </div>
            </div>

            <div className="page-content">
                {/* Stats */}
                <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                    <div className="stat-card stat-accent-1">
                        <div className="stat-label">Total Users</div>
                        <div className="stat-value">{users.length}</div>
                    </div>
                    <div className="stat-card stat-accent-2">
                        <div className="stat-label">Active</div>
                        <div className="stat-value">{users.filter(u => u.isActive).length}</div>
                    </div>
                    <div className="stat-card stat-accent-3">
                        <div className="stat-label">Admins</div>
                        <div className="stat-value">{users.filter(u => u.role === 'admin').length}</div>
                    </div>
                    <div className="stat-card stat-accent-4">
                        <div className="stat-label">Inactive</div>
                        <div className="stat-value">{users.filter(u => !u.isActive).length}</div>
                    </div>
                </div>

                {loading ? (
                    <div className="page-loading"><div className="spinner" /></div>
                ) : (
                    <div className="card">
                        <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Phone</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                        <th>Last Login</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u) => {
                                        const rs = roleStyle[u.role] || roleStyle.sourcing;
                                        return (
                                            <tr key={u.id} style={{ opacity: u.isActive ? 1 : 0.45 }}>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <div style={{
                                                            width: 36, height: 36, borderRadius: '50%',
                                                            background: rs.bg, color: rs.color,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontWeight: 700, fontSize: 14, flexShrink: 0,
                                                        }}>
                                                            {u.fullName.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{u.fullName}</div>
                                                            <div className="cell-muted" style={{ fontSize: '0.82em' }}>{u.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="cell-muted" style={{ fontSize: '0.9em' }}>{u.phone || '—'}</td>
                                                <td>
                                                    <span style={{
                                                        display: 'inline-block', padding: '3px 12px', borderRadius: 12,
                                                        fontSize: 12, fontWeight: 600, background: rs.bg, color: rs.color,
                                                    }}>{rs.label}</span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span style={{
                                                            width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                                                            background: u.isActive ? '#34d399' : '#6b7280',
                                                        }} />
                                                        <span style={{ fontSize: '0.9em' }}>{u.isActive ? 'Active' : 'Inactive'}</span>
                                                    </div>
                                                </td>
                                                <td className="cell-muted" style={{ fontSize: '0.85em' }}>{fmt(u.lastLoginAt)}</td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                                                        <button className="btn-sm btn-ghost" onClick={() => openEdit(u)} title="Edit">✏️</button>
                                                        <button className="btn-sm btn-ghost" onClick={() => openPassword(u)} title="Reset password">🔑</button>
                                                        {u.id !== currentUser?.id && (
                                                            <button className="btn-sm btn-ghost" onClick={() => handleToggle(u)}
                                                                title={u.isActive ? 'Deactivate' : 'Activate'}
                                                            >{u.isActive ? '⏸️' : '▶️'}</button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {users.length === 0 && (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }} className="cell-muted">No users yet</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ CREATE USER ═══ */}
            {modal === 'create' && (
                <div className="modal-overlay" onClick={close}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">New User</h2>
                            <button className="modal-close" onClick={close}>✕</button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Full Name *</label>
                                    <input className="form-input" value={formName}
                                        onChange={e => setFormName(e.target.value)} required placeholder="Nguyen Van A" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email *</label>
                                    <input className="form-input" type="email" value={formEmail}
                                        onChange={e => setFormEmail(e.target.value)} required placeholder="user@company.com" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone</label>
                                    <input className="form-input" value={formPhone}
                                        onChange={e => setFormPhone(e.target.value)} placeholder="0901 234 567" />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Role *</label>
                                        <select className="form-input" value={formRole} onChange={e => setFormRole(e.target.value)}>
                                            {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Password *</label>
                                        <input className="form-input" type="password" value={formPassword}
                                            onChange={e => setFormPassword(e.target.value)} required minLength={6} placeholder="Min 6 chars" />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
                                <button type="submit" className="btn-primary btn-sm" disabled={submitting}>
                                    {submitting ? '⏳ Creating…' : '+ Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══ EDIT USER ═══ */}
            {modal === 'edit' && selected && (
                <div className="modal-overlay" onClick={close}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Edit User</h2>
                            <button className="modal-close" onClick={close}>✕</button>
                        </div>
                        <form onSubmit={handleEdit}>
                            <div className="modal-body">
                                <div className="detail-grid" style={{ marginBottom: 16 }}>
                                    <div className="detail-row">
                                        <span className="detail-label">Email</span>
                                        <span className="detail-value">{selected.email}</span>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Full Name</label>
                                    <input className="form-input" value={formName} onChange={e => setFormName(e.target.value)} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone</label>
                                    <input className="form-input" value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="0901 234 567" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Role</label>
                                    <select className="form-input" value={formRole} onChange={e => setFormRole(e.target.value)}>
                                        {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
                                <button type="submit" className="btn-primary btn-sm" disabled={submitting}>
                                    {submitting ? '⏳ Saving…' : '💾 Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══ RESET PASSWORD ═══ */}
            {modal === 'password' && selected && (
                <div className="modal-overlay" onClick={close}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Reset Password</h2>
                            <button className="modal-close" onClick={close}>✕</button>
                        </div>
                        <form onSubmit={handleChangePassword}>
                            <div className="modal-body">
                                <div className="detail-grid" style={{ marginBottom: 16 }}>
                                    <div className="detail-row">
                                        <span className="detail-label">User</span>
                                        <span className="detail-value">{selected.fullName} ({selected.email})</span>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">New Password</label>
                                    <input className="form-input" type="password" value={formNewPassword}
                                        onChange={e => setFormNewPassword(e.target.value)} required minLength={6} placeholder="Min 6 characters" />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
                                <button type="submit" className="btn-primary btn-sm" disabled={submitting}>
                                    {submitting ? '⏳ Resetting…' : '🔑 Reset Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══ MY PROFILE ═══ */}
            {modal === 'myProfile' && (
                <div className="modal-overlay" onClick={close}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">My Profile</h2>
                            <button className="modal-close" onClick={close}>✕</button>
                        </div>
                        <form onSubmit={handleMyProfile}>
                            <div className="modal-body">
                                <div className="detail-grid" style={{ marginBottom: 16 }}>
                                    <div className="detail-row">
                                        <span className="detail-label">Email</span>
                                        <span className="detail-value">{currentUser?.email}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Role</span>
                                        <span className="detail-value" style={{ textTransform: 'capitalize' }}>{currentUser?.role}</span>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Full Name</label>
                                    <input className="form-input" value={formName}
                                        onChange={e => setFormName(e.target.value)} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone</label>
                                    <input className="form-input" value={formPhone}
                                        onChange={e => setFormPhone(e.target.value)} placeholder="0901 234 567" />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
                                <button type="submit" className="btn-primary btn-sm" disabled={submitting}>
                                    {submitting ? '⏳ Saving…' : '💾 Update Profile'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══ CHANGE MY PASSWORD ═══ */}
            {modal === 'myPassword' && (
                <div className="modal-overlay" onClick={close}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Change Password</h2>
                            <button className="modal-close" onClick={close}>✕</button>
                        </div>
                        <form onSubmit={handleMyPassword}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Current Password</label>
                                    <input className="form-input" type="password" value={formCurrentPassword}
                                        onChange={e => setFormCurrentPassword(e.target.value)} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">New Password</label>
                                    <input className="form-input" type="password" value={formNewPassword}
                                        onChange={e => setFormNewPassword(e.target.value)} required minLength={6} placeholder="Min 6 characters" />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
                                <button type="submit" className="btn-primary btn-sm" disabled={submitting}>
                                    {submitting ? '⏳ Changing…' : '🔑 Change Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
