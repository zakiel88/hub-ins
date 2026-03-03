'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Brand {
    id: string;
    name: string;
    code: string;
    status: string;
    website?: string;
    logoUrl?: string;
    companyName?: string;
    taxCode?: string;
    companyAddress?: string;
    baseIn?: string;
    warehouseAddress?: string;
    returnRate?: string;
    contractUrl?: string;
    brandDocsUrl?: string;
    bankAccount?: string;
    bankAccountHolder?: string;
    bankName?: string;
    paymentTerms?: string;
    saleRate?: string;
    priceListType?: string;
    discountFormula?: string;
    revenueTier1?: string;
    discountTier1?: string;
    revenueTier2?: string;
    discountTier2?: string;
    revenueTier3?: string;
    discountTier3?: string;
    revenueTier1From?: number;
    revenueTier1To?: number;
    revenueTier2From?: number;
    revenueTier2To?: number;
    revenueTier3From?: number;
    revenueTier3To?: number;
    domesticShipping?: string;
    debtNotes?: string;
    reconciliationMethod?: string;
    latePaymentPenalty?: string;
    latePaymentNotice?: string;
    paymentSchedule1?: string;
    paymentSchedule2?: string;
    larkRecordId?: string;
    createdAt: string;
}

const EMPTY_BRAND: Partial<Brand> = {
    name: '', code: '', status: 'active', baseIn: '', website: '', logoUrl: '',
    companyName: '', taxCode: '', companyAddress: '',
    warehouseAddress: '', returnRate: '', contractUrl: '', brandDocsUrl: '',
    bankAccount: '', bankAccountHolder: '', bankName: '', paymentTerms: '', saleRate: '',
    priceListType: 'VND', discountFormula: '',
    revenueTier1: '', discountTier1: '', revenueTier2: '', discountTier2: '',
    revenueTier3: '', discountTier3: '',
    revenueTier1From: undefined, revenueTier1To: undefined,
    revenueTier2From: undefined, revenueTier2To: undefined,
    revenueTier3From: undefined, revenueTier3To: undefined,
    domesticShipping: '', debtNotes: '', reconciliationMethod: '',
    latePaymentPenalty: '', latePaymentNotice: '',
    paymentSchedule1: '', paymentSchedule2: '',
};

const STATUS_OPTIONS = ['all', 'active', 'processing', 'pending', 'inactive'];
const STATUS_LABELS: Record<string, string> = {
    active: 'On air', processing: 'Processing', pending: 'Pending', inactive: 'Stopped',
};
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
    active: { bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
    processing: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
    pending: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    inactive: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
};

export default function BrandsPage() {
    const [brands, setBrands] = useState<Brand[]>([]);
    const [meta, setMeta] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [page, setPage] = useState(1);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [editId, setEditId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Brand>>({ ...EMPTY_BRAND });
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');
    const [summary, setSummary] = useState<{ total: number; active: number; processing: number; pending: number; inactive: number }>({ total: 0, active: 0, processing: 0, pending: 0, inactive: 0 });
    const [banks, setBanks] = useState<{ id: string; brandName: string; fullName: string }[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load banks once on mount
    useEffect(() => {
        api.getBanks().then(setBanks).catch(() => { });
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [res, sum] = await Promise.all([
                api.getBrands({
                    page: String(page), limit: '50',
                    ...(search ? { search } : {}),
                    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
                }),
                api.getBrandsSummary(),
            ]);
            setBrands(res.data);
            setMeta(res.meta);
            setSummary(sum);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [page, search, statusFilter]);

    useEffect(() => { load(); }, [load]);

    // ─── Create ─────────────────────────────────────
    const openCreate = () => {
        setModalMode('create');
        setEditId(null);
        setFormData({ ...EMPTY_BRAND });
        setSaveMsg('');
        setModalOpen(true);
    };

    // ─── Edit ───────────────────────────────────────
    const openEdit = (brand: Brand) => {
        setModalMode('edit');
        setEditId(brand.id);
        setFormData({ ...brand });
        setSaveMsg('');
        setModalOpen(true);
    };

    // ─── Save ───────────────────────────────────────
    const handleSave = async () => {
        if (!formData.name || !formData.code) {
            setSaveMsg('⚠ Brand name và Code là bắt buộc');
            return;
        }
        setSaving(true);
        setSaveMsg('');
        try {
            if (modalMode === 'create') {
                await api.createBrand(formData);
                setSaveMsg('✅ Tạo brand thành công');
            } else if (editId) {
                await api.updateBrand(editId, formData);
                setSaveMsg('✅ Cập nhật thành công');
            }
            setTimeout(() => {
                setModalOpen(false);
                load();
            }, 600);
        } catch (err: any) {
            setSaveMsg('❌ Lỗi: ' + (err.message || 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    const updateField = (key: string, value: string | number | undefined) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    // ─── Logo Upload ─────────────────────────────────
    const handleLogoUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            setSaveMsg('⚠ Chỉ chấp nhận file ảnh');
            return;
        }
        setUploading(true);
        try {
            const result = await api.uploadFile(file);
            updateField('logoUrl', `${API_BASE}${result.url}`);
        } catch (err: any) {
            setSaveMsg('❌ Upload failed: ' + (err.message || 'Unknown error'));
        } finally {
            setUploading(false);
        }
    };

    const statusBadge = (status: string) => {
        const s = STATUS_COLORS[status] || STATUS_COLORS.inactive;
        return (
            <span style={{
                padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                backgroundColor: s.bg, color: s.color, whiteSpace: 'nowrap',
            }}>
                {STATUS_LABELS[status] || status}
            </span>
        );
    };

    const inputStyle: React.CSSProperties = {
        width: '100%', background: '#1a1a2e', color: '#e0e0e0',
        border: '1px solid #333', borderRadius: 6, padding: '6px 10px', fontSize: 13,
    };
    const labelStyle: React.CSSProperties = {
        display: 'block', fontSize: 11, color: '#888', marginBottom: 3,
    };

    return (
        <>
            <div className="page-header">
                <div className="page-header-row">
                    <div>
                        <h1 className="page-title">Brand Profile</h1>
                        <p className="page-subtitle">Quản lý thông tin brand — thanh toán, chiết khấu, đối soát</p>
                    </div>
                    <button className="btn-primary btn-sm" onClick={openCreate}
                        style={{ fontSize: 14, padding: '8px 20px', borderRadius: 8, fontWeight: 600 }}>
                        + Tạo Brand mới
                    </button>
                </div>
            </div>

            <div className="page-content">
                {/* Summary Dashboard */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
                    <div className="summary-card"><div className="summary-value">{summary.total}</div><div className="summary-label">Total Brands</div></div>
                    <div className="summary-card"><div className="summary-value" style={{ color: '#10b981' }}>{summary.active}</div><div className="summary-label">🟢 On Air</div></div>
                    <div className="summary-card"><div className="summary-value" style={{ color: '#3b82f6' }}>{summary.processing}</div><div className="summary-label">🔵 Processing</div></div>
                    <div className="summary-card"><div className="summary-value" style={{ color: '#f59e0b' }}>{summary.pending}</div><div className="summary-label">🟡 Pending</div></div>
                    <div className="summary-card"><div className="summary-value" style={{ color: '#ef4444' }}>{summary.inactive}</div><div className="summary-label">🔴 Stopped</div></div>
                </div>

                {/* Toolbar */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                    <select
                        value={statusFilter}
                        onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                        style={{ ...inputStyle, width: 150 }}
                    >
                        {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s}>{s === 'all' ? 'Tất cả Status' : STATUS_LABELS[s] || s}</option>
                        ))}
                    </select>
                    <div style={{ flex: 1, display: 'flex', gap: 6 }}>
                        <input
                            placeholder="Tìm brand..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load(); } }}
                            style={{ ...inputStyle, flex: 1 }}
                        />
                        <button className="btn-ghost" onClick={() => { setPage(1); load(); }} style={{ fontSize: 13 }}>🔍</button>
                    </div>
                    {meta && <div style={{ color: '#888', fontSize: 12 }}>{meta.total} brands</div>}
                </div>

                {/* Table */}
                {loading ? (
                    <div className="page-loading"><div className="spinner" /></div>
                ) : brands.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🏷️</div>
                        <div className="empty-state-text">Không tìm thấy brand nào</div>
                    </div>
                ) : (
                    <div className="table-wrap" style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ minWidth: 1800 }}>
                            <thead>
                                <tr>
                                    <th style={{ width: 36 }}>#</th>
                                    <th style={{ minWidth: 150 }}>Brand</th>
                                    <th style={{ width: 80 }}>Code</th>
                                    <th style={{ width: 55 }}>Base</th>
                                    <th style={{ width: 80 }}>Status</th>
                                    <th style={{ minWidth: 100 }}>Ngân hàng</th>
                                    <th style={{ minWidth: 110 }}>STK</th>
                                    <th style={{ minWidth: 120 }}>Chủ TK</th>
                                    <th style={{ width: 90 }}>Công nợ</th>
                                    <th style={{ width: 80 }}>Sale rate</th>
                                    <th style={{ width: 55 }}>Giá</th>
                                    <th style={{ width: 75 }}>CK 1</th>
                                    <th style={{ width: 75 }}>CK 2</th>
                                    <th style={{ width: 75 }}>CK 3</th>
                                    <th style={{ width: 70 }}>Ship</th>
                                    <th style={{ minWidth: 130 }}>Note</th>
                                    <th style={{ width: 60 }}>Edit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {brands.map((b, i) => (
                                    <tr key={b.id} className="table-row-link">
                                        <td style={{ color: '#666', fontSize: 12 }}>{(page - 1) * 50 + i + 1}</td>
                                        <td><div className="cell-primary" style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => openEdit(b)}>{b.name}</div></td>
                                        <td><code className="code-tag">{b.code}</code></td>
                                        <td style={{ fontSize: 12 }}>{b.baseIn || '—'}</td>
                                        <td>{statusBadge(b.status)}</td>
                                        <td style={{ fontSize: 12, color: '#ccc' }}>{b.bankName || '—'}</td>
                                        <td style={{ fontSize: 11, color: '#aaa', fontFamily: 'monospace' }}>{b.bankAccount || '—'}</td>
                                        <td style={{ fontSize: 12, color: '#ccc' }}>{b.bankAccountHolder || '—'}</td>
                                        <td style={{ fontSize: 12, color: '#f59e0b' }}>{b.paymentTerms || '—'}</td>
                                        <td style={{ fontSize: 12, color: '#ccc' }}>{b.saleRate || '—'}</td>
                                        <td style={{ fontSize: 12 }}>{b.priceListType || '—'}</td>
                                        <td style={{ fontSize: 12, color: '#10b981' }}>{b.discountTier1 || '—'}</td>
                                        <td style={{ fontSize: 12, color: '#10b981' }}>{b.discountTier2 || '—'}</td>
                                        <td style={{ fontSize: 12, color: '#10b981' }}>{b.discountTier3 || '—'}</td>
                                        <td style={{ fontSize: 12 }}>{b.domesticShipping || '—'}</td>
                                        <td style={{ fontSize: 11, color: '#999', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {b.debtNotes || '—'}
                                        </td>
                                        <td>
                                            <button onClick={() => openEdit(b)}
                                                style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                                                ✏️ Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {meta && meta.total > 50 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                        <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                        <span style={{ color: '#888', fontSize: 13, lineHeight: '32px' }}>
                            Page {page} / {Math.ceil(meta.total / 50)}
                        </span>
                        <button className="btn-ghost" disabled={page >= Math.ceil(meta.total / 50)} onClick={() => setPage(p => p + 1)}>Next →</button>
                    </div>
                )}
            </div>

            {/* ═══ Create / Edit Modal ═══ */}
            {modalOpen && (
                <div className="modal-overlay" onClick={() => setModalOpen(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}
                        style={{ maxWidth: 720, maxHeight: '88vh', overflow: 'auto' }}>
                        <div className="modal-header" style={{ position: 'sticky', top: 0, background: '#1e1e2f', zIndex: 1, borderBottom: '1px solid #333' }}>
                            <h2 className="modal-title" style={{ fontSize: 18 }}>
                                {modalMode === 'create' ? '➕ Tạo Brand mới' : `✏️ Chỉnh sửa — ${formData.name}`}
                            </h2>
                            <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
                        </div>

                        <div className="modal-body" style={{ display: 'grid', gap: 16, padding: 20 }}>
                            {/* Thông tin cơ bản */}
                            <fieldset style={{ border: '1px solid #333', borderRadius: 8, padding: 16 }}>
                                <legend style={{ color: '#6366f1', fontWeight: 600, fontSize: 14, padding: '0 8px' }}>📋 Thông tin cơ bản</legend>
                                {/* Logo upload row */}
                                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                                        onDrop={e => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) handleLogoUpload(f); }}
                                        style={{ width: 80, height: 80, borderRadius: 12, border: '2px dashed #555', background: '#12121f', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, cursor: 'pointer', transition: 'border-color 0.2s' }}
                                        title="Click hoặc kéo thả ảnh vào đây"
                                    >
                                        {uploading ? (
                                            <div className="spinner" style={{ width: 24, height: 24 }} />
                                        ) : formData.logoUrl ? (
                                            <img src={formData.logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ textAlign: 'center', color: '#666', fontSize: 11, lineHeight: 1.3 }}>
                                                <div style={{ fontSize: 20, marginBottom: 2 }}>📷</div>
                                                Upload
                                            </div>
                                        )}
                                    </div>
                                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ''; }} />
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle}>Ảnh Logo Brand</label>
                                        <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Click hoặc kéo thả ảnh vào ô bên trái • Max 5MB</div>
                                        {formData.logoUrl && (
                                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                <span style={{ fontSize: 11, color: '#10b981' }}>✅ Đã upload</span>
                                                <button type="button" onClick={() => updateField('logoUrl', '')} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11, padding: 0 }}>✕ Xóa</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    <div>
                                        <label style={labelStyle}>Brand Name *</label>
                                        <input value={formData.name || ''} onChange={e => updateField('name', e.target.value)} style={inputStyle} placeholder="Tên brand" />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Code (SKU prefix) *</label>
                                        <input value={formData.code || ''} onChange={e => updateField('code', e.target.value.toUpperCase())} style={inputStyle} placeholder="VD: KOALIFY" />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Tên công ty</label>
                                        <input value={formData.companyName || ''} onChange={e => updateField('companyName', e.target.value)} style={inputStyle} placeholder="VD: Công ty TNHH ABC" />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>MST (Mã số thuế)</label>
                                        <input value={formData.taxCode || ''} onChange={e => updateField('taxCode', e.target.value)} style={inputStyle} placeholder="VD: 0123456789" />
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={labelStyle}>Địa chỉ công ty</label>
                                        <input value={formData.companyAddress || ''} onChange={e => updateField('companyAddress', e.target.value)} style={inputStyle} placeholder="Địa chỉ công ty..." />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Base in</label>
                                        <select value={formData.baseIn || ''} onChange={e => updateField('baseIn', e.target.value)} style={inputStyle}>
                                            <option value="">— Chọn —</option>
                                            <option value="HCM">HCM</option>
                                            <option value="HN">HN</option>
                                            <option value="SG">SG</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Status</label>
                                        <select value={formData.status || 'active'} onChange={e => updateField('status', e.target.value)} style={inputStyle}>
                                            <option value="active">On air</option>
                                            <option value="processing">Processing</option>
                                            <option value="pending">Pending</option>
                                            <option value="inactive">Stopped</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Website</label>
                                        <input value={formData.website || ''} onChange={e => updateField('website', e.target.value)} style={inputStyle} placeholder="https://" />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Tỷ lệ return</label>
                                        <input value={formData.returnRate || ''} onChange={e => updateField('returnRate', e.target.value)} style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>🔗 URL Hợp Đồng</label>
                                        <input value={formData.contractUrl || ''} onChange={e => updateField('contractUrl', e.target.value)} style={inputStyle} placeholder="https://link-hop-dong..." />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>🔗 URL Tài Liệu Brand</label>
                                        <input value={formData.brandDocsUrl || ''} onChange={e => updateField('brandDocsUrl', e.target.value)} style={inputStyle} placeholder="https://link-tai-lieu..." />
                                    </div>
                                </div>
                                <div style={{ marginTop: 10 }}>
                                    <label style={labelStyle}>Địa chỉ kho / Cửa hàng</label>
                                    <input value={formData.warehouseAddress || ''} onChange={e => updateField('warehouseAddress', e.target.value)} style={inputStyle} placeholder="Địa chỉ..." />
                                </div>
                            </fieldset>

                            {/* Thanh toán */}
                            <fieldset style={{ border: '1px solid #333', borderRadius: 8, padding: 16 }}>
                                <legend style={{ color: '#f59e0b', fontWeight: 600, fontSize: 14, padding: '0 8px' }}>💳 Thông tin thanh toán</legend>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    <div>
                                        <label style={labelStyle}>STK thanh toán</label>
                                        <input value={formData.bankAccount || ''} onChange={e => updateField('bankAccount', e.target.value)} style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Chủ tài khoản</label>
                                        <input value={formData.bankAccountHolder || ''} onChange={e => updateField('bankAccountHolder', e.target.value)} style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Ngân hàng</label>
                                        <select value={formData.bankName || ''} onChange={e => updateField('bankName', e.target.value)} style={inputStyle}>
                                            <option value="">— Chọn ngân hàng —</option>
                                            {banks.map(b => (
                                                <option key={b.id} value={b.brandName}>{b.brandName}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Thời hạn công nợ</label>
                                        <input value={formData.paymentTerms || ''} onChange={e => updateField('paymentTerms', e.target.value)} style={inputStyle} placeholder="VD: 30 ngày" />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Sale rate</label>
                                        <input value={formData.saleRate || ''} onChange={e => updateField('saleRate', e.target.value)} style={inputStyle} />
                                    </div>
                                </div>
                            </fieldset>

                            {/* Chiết khấu */}
                            <fieldset style={{ border: '1px solid #333', borderRadius: 8, padding: 16 }}>
                                <legend style={{ color: '#10b981', fontWeight: 600, fontSize: 14, padding: '0 8px' }}>📊 Chiết khấu & Doanh thu</legend>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    <div>
                                        <label style={labelStyle}>Loại giá niêm yết</label>
                                        <select value={formData.priceListType || 'VND'} onChange={e => updateField('priceListType', e.target.value)} style={inputStyle}>
                                            <option value="VND">VND</option>
                                            <option value="USD">USD</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Công thức CK</label>
                                        <input value={formData.discountFormula || ''} onChange={e => updateField('discountFormula', e.target.value)} style={inputStyle} />
                                    </div>
                                </div>
                                {/* Tiers table */}
                                <div style={{ marginTop: 12, border: '1px solid #333', borderRadius: 6, overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                        <thead>
                                            <tr style={{ background: 'rgba(16,185,129,0.08)' }}>
                                                <th style={{ padding: '6px 10px', textAlign: 'left', color: '#10b981', fontWeight: 600, borderBottom: '1px solid #333', width: 55 }}>Mức</th>
                                                <th style={{ padding: '6px 10px', textAlign: 'left', color: '#888', borderBottom: '1px solid #333' }}>Từ ({formData.priceListType === 'USD' ? '$' : '₫'})</th>
                                                <th style={{ padding: '6px 10px', textAlign: 'left', color: '#888', borderBottom: '1px solid #333' }}>Đến ({formData.priceListType === 'USD' ? '$' : '₫'})</th>
                                                <th style={{ padding: '6px 10px', textAlign: 'left', color: '#888', borderBottom: '1px solid #333' }}>CK %</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[1, 2, 3].map(n => (
                                                <tr key={n}>
                                                    <td style={{ padding: '4px 10px', color: '#10b981', fontWeight: 600, borderBottom: '1px solid #222' }}>Mức {n}</td>
                                                    <td style={{ padding: '4px 6px', borderBottom: '1px solid #222' }}>
                                                        <input type="number" value={(formData as any)[`revenueTier${n}From`] ?? ''}
                                                            onChange={e => updateField(`revenueTier${n}From`, e.target.value ? Number(e.target.value) : undefined)}
                                                            style={{ ...inputStyle, padding: '4px 8px' }} placeholder={formData.priceListType === 'USD' ? '0' : '0'} />
                                                    </td>
                                                    <td style={{ padding: '4px 6px', borderBottom: '1px solid #222' }}>
                                                        <input type="number" value={(formData as any)[`revenueTier${n}To`] ?? ''}
                                                            onChange={e => updateField(`revenueTier${n}To`, e.target.value ? Number(e.target.value) : undefined)}
                                                            style={{ ...inputStyle, padding: '4px 8px' }} placeholder={formData.priceListType === 'USD' ? '0' : '0'} />
                                                    </td>
                                                    <td style={{ padding: '4px 6px', borderBottom: '1px solid #222' }}>
                                                        <input value={(formData as any)[`discountTier${n}`] || ''} onChange={e => updateField(`discountTier${n}`, e.target.value)} style={{ ...inputStyle, padding: '4px 8px' }} placeholder="25%" />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </fieldset>

                            {/* Đối soát */}
                            <fieldset style={{ border: '1px solid #333', borderRadius: 8, padding: 16 }}>
                                <legend style={{ color: '#ef4444', fontWeight: 600, fontSize: 14, padding: '0 8px' }}>📝 Đối soát & Công nợ</legend>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    <div>
                                        <label style={labelStyle}>Ship nội địa</label>
                                        <select value={formData.domesticShipping || ''} onChange={e => updateField('domesticShipping', e.target.value)} style={inputStyle}>
                                            <option value="">— Chọn —</option>
                                            <option value="Brand chịu">Brand chịu</option>
                                            <option value="INS chịu">INS chịu</option>
                                            <option value="Chia đôi">Chia đôi</option>
                                            <option value="Theo HĐ">Theo HĐ</option>
                                            <option value="Free ship">Free ship</option>
                                            <option value="Khác">Khác</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Cách thức đối soát</label>
                                        <input value={formData.reconciliationMethod || ''} onChange={e => updateField('reconciliationMethod', e.target.value)} style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Phạt chậm thanh toán</label>
                                        <input value={formData.latePaymentPenalty || ''} onChange={e => updateField('latePaymentPenalty', e.target.value)} style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Thông báo chậm TT</label>
                                        <input value={formData.latePaymentNotice || ''} onChange={e => updateField('latePaymentNotice', e.target.value)} style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>TG thanh toán công nợ</label>
                                        <input value={formData.paymentSchedule1 || ''} onChange={e => updateField('paymentSchedule1', e.target.value)} style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>TG thanh toán CN (2nd)</label>
                                        <input value={formData.paymentSchedule2 || ''} onChange={e => updateField('paymentSchedule2', e.target.value)} style={inputStyle} />
                                    </div>
                                </div>
                                <div style={{ marginTop: 10 }}>
                                    <label style={labelStyle}>Note công nợ</label>
                                    <textarea value={formData.debtNotes || ''} onChange={e => updateField('debtNotes', e.target.value)}
                                        rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                                </div>
                            </fieldset>
                        </div>

                        {/* Footer */}
                        <div className="modal-footer" style={{ position: 'sticky', bottom: 0, background: '#1e1e2f', borderTop: '1px solid #333', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: 13, color: saveMsg.includes('✅') ? '#10b981' : saveMsg.includes('❌') ? '#ef4444' : '#f59e0b' }}>
                                {saveMsg}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn-ghost" onClick={() => setModalOpen(false)}>Hủy</button>
                                <button onClick={handleSave} disabled={saving}
                                    style={{
                                        background: modalMode === 'create' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'linear-gradient(135deg, #10b981, #059669)',
                                        color: '#fff', border: 'none', borderRadius: 8, padding: '8px 24px', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
                                    }}>
                                    {saving ? '⏳ Đang lưu...' : modalMode === 'create' ? '✅ Tạo Brand' : '💾 Lưu thay đổi'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
