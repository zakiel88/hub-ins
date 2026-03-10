'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function NewProductPage() {
    const router = useRouter();
    const [brands, setBrands] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [styleCodeAuto, setStyleCodeAuto] = useState(true); // true = auto-generated
    const [styleCodeLoading, setStyleCodeLoading] = useState(false);

    const [form, setForm] = useState({
        title: '',
        brandId: '',
        collectionId: '',
        styleCode: '',
        productType: '',
        category: '',
        description: '',
        material: '',
        season: '',
        featuredImageUrl: '',
        availabilityType: '',
        leadTimeDays: '',
    });

    useEffect(() => {
        api.getBrands?.().then((r: any) => setBrands(r.data || [])).catch(() => { });
        // Generate initial style code (no brand)
        api.getNextStyleCode().then(r => {
            setForm(prev => ({ ...prev, styleCode: r.data.styleCode }));
        }).catch(() => { });
    }, []);

    const handleChange = (field: string, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    // When brand changes, auto-generate next style code
    const handleBrandChange = async (brandId: string) => {
        setForm(prev => ({ ...prev, brandId }));
        if (styleCodeAuto) {
            setStyleCodeLoading(true);
            try {
                const res = await api.getNextStyleCode(brandId || undefined);
                setForm(prev => ({ ...prev, styleCode: res.data.styleCode }));
            } catch { /* keep existing */ }
            setStyleCodeLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!form.title.trim()) { setError('Product title is required'); return; }
        if (!form.styleCode.trim()) { setError('Style Code is required for SKU auto-generation'); return; }
        setSaving(true);
        setError('');
        try {
            const payload: any = { title: form.title.trim(), styleCode: form.styleCode.trim() };
            if (form.brandId) payload.brandId = form.brandId;
            if (form.collectionId) payload.collectionId = form.collectionId;
            if (form.productType) payload.productType = form.productType.trim();
            if (form.category) payload.category = form.category.trim();
            if (form.description) payload.description = form.description.trim();
            if (form.material) payload.material = form.material.trim();
            if (form.season) payload.season = form.season.trim();
            if (form.featuredImageUrl) payload.featuredImageUrl = form.featuredImageUrl.trim();
            if (form.availabilityType) payload.availabilityType = form.availabilityType;
            if (form.leadTimeDays) payload.leadTimeDays = parseInt(form.leadTimeDays);

            const res = await api.createProduct(payload);
            router.push(`/products/${res.data.id}`);
        } catch (err: any) {
            setError(err.message || 'Failed to create product');
            setSaving(false);
        }
    };

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '10px 14px', borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 14,
    };

    const labelStyle: React.CSSProperties = {
        display: 'block', color: '#94a3b8', fontSize: 13, fontWeight: 600, marginBottom: 6,
    };

    const selectedBrand = brands.find(b => b.id === form.brandId);

    return (
        <div style={{ padding: '32px 40px', maxWidth: 800 }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <a href="/products" style={{ color: '#818cf8', fontSize: 14 }}>← Products</a>
                </div>
                <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>➕ New Product</h1>
                <p style={{ color: '#94a3b8', margin: '4px 0 0' }}>
                    Create a new product. Style Code auto-generates from Brand.
                </p>
            </div>

            {/* Form */}
            <div style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 16, padding: 28,
            }}>
                {error && (
                    <div style={{
                        padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        color: '#ef4444', fontSize: 13,
                    }}>{error}</div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                    {/* Title — full width */}
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>Product Title *</label>
                        <input value={form.title} onChange={e => handleChange('title', e.target.value)}
                            placeholder="e.g. Leather Tote Bag" style={inputStyle} />
                    </div>

                    {/* Brand */}
                    <div>
                        <label style={labelStyle}>Brand *</label>
                        <select value={form.brandId} onChange={e => handleBrandChange(e.target.value)}
                            style={inputStyle}>
                            <option value="">Select brand...</option>
                            {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>

                    {/* Style Code — auto-generated */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <label style={{ ...labelStyle, marginBottom: 0 }}>Style Code *</label>
                            <button
                                onClick={() => {
                                    setStyleCodeAuto(!styleCodeAuto);
                                    if (!styleCodeAuto) {
                                        // Switching back to auto — regenerate
                                        api.getNextStyleCode(form.brandId || undefined).then(r => {
                                            setForm(prev => ({ ...prev, styleCode: r.data.styleCode }));
                                        }).catch(() => { });
                                    }
                                }}
                                style={{
                                    padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                                    background: styleCodeAuto ? 'rgba(52,211,153,0.15)' : 'rgba(245,158,11,0.15)',
                                    color: styleCodeAuto ? '#34d399' : '#f59e0b',
                                    fontSize: 10, fontWeight: 700,
                                }}
                            >
                                {styleCodeAuto ? '🔒 AUTO' : '✏️ MANUAL'}
                            </button>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <input
                                value={form.styleCode}
                                onChange={e => {
                                    if (!styleCodeAuto) handleChange('styleCode', e.target.value);
                                }}
                                readOnly={styleCodeAuto}
                                placeholder={styleCodeLoading ? 'Generating...' : 'Select brand first'}
                                style={{
                                    ...inputStyle,
                                    fontFamily: 'monospace',
                                    fontWeight: 700,
                                    fontSize: 15,
                                    letterSpacing: 1,
                                    background: styleCodeAuto ? 'rgba(52,211,153,0.08)' : 'rgba(0,0,0,0.3)',
                                    border: styleCodeAuto ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(255,255,255,0.1)',
                                    cursor: styleCodeAuto ? 'default' : 'text',
                                }}
                            />
                            {form.styleCode && (
                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                                    {selectedBrand ? `${selectedBrand.name} sequence` : 'Default sequence'} — SKUs: {form.styleCode}-BLK-38, {form.styleCode}-WHT-40...
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Product Type */}
                    <div>
                        <label style={labelStyle}>Product Type</label>
                        <input value={form.productType} onChange={e => handleChange('productType', e.target.value)}
                            placeholder="e.g. Bags" style={inputStyle} />
                    </div>

                    {/* Category */}
                    <div>
                        <label style={labelStyle}>Category</label>
                        <input value={form.category} onChange={e => handleChange('category', e.target.value)}
                            placeholder="e.g. Accessories" style={inputStyle} />
                    </div>

                    {/* Material */}
                    <div>
                        <label style={labelStyle}>Material</label>
                        <input value={form.material} onChange={e => handleChange('material', e.target.value)}
                            placeholder="e.g. Full-grain leather" style={inputStyle} />
                    </div>

                    {/* Season */}
                    <div>
                        <label style={labelStyle}>Season</label>
                        <input value={form.season} onChange={e => handleChange('season', e.target.value)}
                            placeholder="e.g. FW25" style={inputStyle} />
                    </div>

                    {/* Featured Image URL */}
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>Featured Image URL</label>
                        <input value={form.featuredImageUrl} onChange={e => handleChange('featuredImageUrl', e.target.value)}
                            placeholder="https://..." style={inputStyle} />
                    </div>

                    {/* Description */}
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>Description (Short)</label>
                        <textarea value={form.description} onChange={e => handleChange('description', e.target.value)}
                            placeholder="Brief product description..."
                            rows={3}
                            style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>

                    {/* Availability Type */}
                    <div>
                        <label style={labelStyle}>Availability Type</label>
                        <select value={form.availabilityType} onChange={e => handleChange('availabilityType', e.target.value)}
                            style={inputStyle}>
                            <option value="">Select...</option>
                            <option value="In Stock">In Stock</option>
                            <option value="Pre-Order">Pre-Order</option>
                            <option value="Made to Order">Made to Order</option>
                            <option value="Consignment">Consignment</option>
                        </select>
                    </div>

                    {/* Lead Time */}
                    <div>
                        <label style={labelStyle}>Lead Time (days)</label>
                        <input type="number" value={form.leadTimeDays} onChange={e => handleChange('leadTimeDays', e.target.value)}
                            placeholder="e.g. 14" min="0" style={inputStyle} />
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <a href="/products" style={{
                        padding: '10px 24px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                        background: 'transparent', color: '#94a3b8', fontSize: 14, textDecoration: 'none',
                        display: 'inline-flex', alignItems: 'center',
                    }}>Cancel</a>
                    <button onClick={handleSubmit} disabled={saving} style={{
                        padding: '10px 28px', borderRadius: 8, border: 'none',
                        background: saving ? '#4b5563' : 'linear-gradient(135deg, #818cf8, #6366f1)',
                        color: 'white', fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
                    }}>
                        {saving ? 'Creating...' : 'Create Product'}
                    </button>
                </div>
            </div>
        </div>
    );
}
