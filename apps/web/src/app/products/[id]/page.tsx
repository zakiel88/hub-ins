'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PANTONE_COLORS, MATERIALS, SIZE_RUN_PRESETS, CURRENCIES, COLOR_CATEGORIES, MATERIAL_CATEGORIES, SIZE_GROUPS, type PantoneColor, type MaterialOption } from '@/lib/variant-libraries';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    ACTIVE: { label: 'Active', color: '#22c55e', bg: '#22c55e22' },
    DRAFT: { label: 'Draft', color: '#f59e0b', bg: '#f59e0b22' },
    ARCHIVED: { label: 'Archived', color: '#6b7280', bg: '#6b728022' },
    DISCONTINUED: { label: 'Discontinued', color: '#6b7280', bg: '#6b728022' },
};

const SEVERITY_CONFIG: Record<string, { color: string; bg: string }> = {
    ERROR: { color: '#ef4444', bg: '#ef444422' },
    WARNING: { color: '#f59e0b', bg: '#f59e0b22' },
    INFO: { color: '#3b82f6', bg: '#3b82f622' },
};

type TabKey = 'overview' | 'variants' | 'images' | 'mappings' | 'issues';

export default function ProductDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabKey>('overview');
    const [editing, setEditing] = useState(false);
    const [editData, setEditData] = useState<any>({});

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        api.getProduct(id).then(res => {
            setProduct(res.data);
            setEditData({
                title: res.data.title || '',
                description: res.data.description || '',
                productType: res.data.productType || '',
                category: res.data.category || '',
                material: res.data.material || '',
                season: res.data.season || '',
                styleCode: res.data.styleCode || '',
            });
        }).catch(e => {
            console.error('Failed to load product:', e);
        }).finally(() => setLoading(false));
    }, [id]);

    const handleSave = async () => {
        try {
            const res = await api.updateProduct(id, editData);
            setProduct(res.data);
            setEditing(false);
        } catch (e: any) {
            alert('Failed to save: ' + e.message);
        }
    };

    const handleArchive = async () => {
        if (!confirm('Archive this product and discontinue all variants?')) return;
        try {
            await api.archiveProduct(id);
            router.push('/products');
        } catch (e: any) {
            alert('Failed to archive: ' + e.message);
        }
    };

    if (loading) return <div style={{ padding: 40, color: '#888' }}>⏳ Loading product...</div>;
    if (!product) return <div style={{ padding: 40, color: '#ef4444' }}>Product not found</div>;

    const statusInfo = STATUS_CONFIG[product.status] || STATUS_CONFIG.DRAFT;

    // Real variant groups from DB + ungrouped SKUs (legacy/imported)
    const vGroups = product?.variantGroups || [];
    const ungroupedVariants = product?.variants || []; // already filtered to variantGroupId=null by API
    const totalSkus = vGroups.reduce((s: number, g: any) => s + (g.variants?.length || 0), 0) + ungroupedVariants.length;

    const tabs: { key: TabKey; label: string; count?: number }[] = [
        { key: 'overview', label: 'Overview' },
        { key: 'variants', label: 'Variant Groups & SKUs', count: totalSkus },
        { key: 'images', label: 'Images', count: product.images?.length || 0 },
        { key: 'mappings', label: 'Store Mappings', count: product.storeMaps?.length || 0 },
        { key: 'issues', label: 'Issues', count: product.issues?.length || 0 },
    ];

    return (
        <div style={{ padding: 32, maxWidth: 1200 }}>
            {/* Breadcrumb */}
            <div style={{ marginBottom: 16, fontSize: 13, color: '#666' }}>
                <Link href="/products" style={{ color: '#6366f1', textDecoration: 'none' }}>← Products</Link>
            </div>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>{product.title}</h1>
                    <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
                        <span className="status-badge" style={{ background: statusInfo.bg, color: statusInfo.color }}>{statusInfo.label}</span>
                        {product.brand && <span style={{ color: '#8b5cf6', fontSize: 13 }}>🏷️ {product.brand.name}</span>}
                        {product.styleCode && <span style={{ color: '#888', fontSize: 12, fontFamily: 'var(--font-mono)' }}>#{product.styleCode}</span>}
                        {product.season && <span style={{ color: '#666', fontSize: 12 }}>📅 {product.season}</span>}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {editing ? (
                        <>
                            <button onClick={handleSave} style={{
                                padding: '8px 16px', background: '#22c55e22', border: '1px solid #22c55e44',
                                borderRadius: 8, color: '#22c55e', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                            }}>✓ Save</button>
                            <button onClick={() => setEditing(false)} style={{
                                padding: '8px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
                                borderRadius: 8, color: '#888', cursor: 'pointer', fontSize: 13,
                            }}>Cancel</button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setEditing(true)} style={{
                                padding: '8px 16px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
                                borderRadius: 8, color: '#818cf8', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                            }}>✏️ Edit</button>
                            {product.status !== 'ARCHIVED' && (
                                <button onClick={handleArchive} style={{
                                    padding: '8px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                                    borderRadius: 8, color: '#ef4444', cursor: 'pointer', fontSize: 13,
                                }}>Archive</button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))', marginBottom: 24 }}>
                {tabs.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                        padding: '10px 20px', background: 'transparent', border: 'none',
                        borderBottom: activeTab === tab.key ? '2px solid #6366f1' : '2px solid transparent',
                        color: activeTab === tab.key ? '#fff' : '#888', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    }}>
                        {tab.label}
                        {tab.count != null && <span style={{
                            marginLeft: 6, padding: '1px 6px', borderRadius: 10,
                            background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontSize: 11,
                        }}>{tab.count}</span>}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <OverviewTab product={product} editing={editing} editData={editData} setEditData={setEditData} />
            )}
            {activeTab === 'variants' && (
                <VariantGroupsTab groups={vGroups} ungrouped={ungroupedVariants} productId={id} product={product} editing={editing} onProductUpdate={setProduct} />
            )}
            {activeTab === 'images' && (
                <ImagesTab images={product.images || []} />
            )}
            {activeTab === 'mappings' && (
                <MappingsTab storeMaps={product.storeMaps || []} />
            )}
            {activeTab === 'issues' && (
                <IssuesTab issues={product.issues || []} productId={id} />
            )}
        </div>
    );
}

/* ─── Tab Components ─── */

function OverviewTab({ product, editing, editData, setEditData }: any) {
    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '8px 12px',
        background: editing ? 'var(--bg-surface, #1a1a24)' : 'transparent',
        border: editing ? '1px solid var(--border, #2a2a38)' : '1px solid transparent',
        borderRadius: 6, color: '#f0f0f5', fontSize: 13,
    };

    const fields = [
        { label: 'Title', key: 'title' },
        { label: 'Description', key: 'description', multiline: true },
        { label: 'Product Type', key: 'productType' },
        { label: 'Category', key: 'category' },
        { label: 'Material', key: 'material' },
        { label: 'Season', key: 'season' },
        { label: 'Style Code', key: 'styleCode' },
    ];

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 800 }}>
            {fields.map(f => (
                <div key={f.key} style={{ gridColumn: f.multiline ? '1 / -1' : undefined }}>
                    <label style={{ fontSize: 11, color: '#888', fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {f.label}
                    </label>
                    {editing ? (
                        f.multiline ? (
                            <textarea value={editData[f.key]} onChange={e => setEditData({ ...editData, [f.key]: e.target.value })}
                                style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
                        ) : (
                            <input value={editData[f.key]} onChange={e => setEditData({ ...editData, [f.key]: e.target.value })}
                                style={inputStyle} />
                        )
                    ) : (
                        <div style={{ padding: '8px 0', color: product[f.key] ? '#e0e0f0' : '#555', fontSize: 13 }}>
                            {product[f.key] || '—'}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}


function VariantGroupsTab({ groups, ungrouped, productId, product, editing, onProductUpdate }: { groups: any[]; ungrouped: any[]; productId: string; product: any; editing?: boolean; onProductUpdate?: (p: any) => void }) {
    const [showAddGroup, setShowAddGroup] = useState(false);
    const [groupForm, setGroupForm] = useState({ color: '', material: '', sizeRunInput: '', price: '', vendorCost: '', imageUrl: '', currency: 'USD' });
    const [sizeRun, setSizeRun] = useState<string[]>([]);
    const [addMsg, setAddMsg] = useState('');
    // Dropdowns
    const [colorOpen, setColorOpen] = useState(false);
    const [colorSearch, setColorSearch] = useState('');
    const [materialOpen, setMaterialOpen] = useState(false);
    const [materialSearch, setMaterialSearch] = useState('');
    const [sizeGroup, setSizeGroup] = useState<string>('Clothing');
    const colorRef = useRef<HTMLDivElement>(null);
    const materialRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (colorRef.current && !colorRef.current.contains(e.target as Node)) setColorOpen(false);
            if (materialRef.current && !materialRef.current.contains(e.target as Node)) setMaterialOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const addSize = (raw: string) => {
        const sizes = raw.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
        setSizeRun(prev => [...new Set([...prev, ...sizes])]);
    };

    const removeSize = (size: string) => {
        setSizeRun(prev => prev.filter(s => s !== size));
    };

    const handleAddGroup = async () => {
        if (sizeRun.length === 0) { setAddMsg('At least one size is required'); return; }
        if (!product.styleCode) { setAddMsg('Product must have a Style Code'); return; }
        setAddMsg('');
        try {
            await api.createVariantGroup(productId, {
                color: groupForm.color || undefined,
                material: groupForm.material || undefined,
                sizeRun,
                imageUrl: groupForm.imageUrl || undefined,
                price: groupForm.price ? parseFloat(groupForm.price) : undefined,
                vendorCost: groupForm.vendorCost ? parseFloat(groupForm.vendorCost) : undefined,
            });
            setAddMsg('\u2705 Variant Group created with ' + sizeRun.length + ' SKUs \u2014 reload to see');
            setGroupForm({ color: '', material: '', sizeRunInput: '', price: '', vendorCost: '', imageUrl: '', currency: groupForm.currency });
            setSizeRun([]);
        } catch (err: any) {
            setAddMsg(`\u274c ${err.message}`);
        }
    };

    const inputStyle: React.CSSProperties = {
        padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 13,
    };
    const dropdownStyle: React.CSSProperties = {
        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
        maxHeight: 280, overflowY: 'auto', borderRadius: 8,
        border: '1px solid rgba(99,102,241,0.3)', background: '#1a1d2e',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)', marginTop: 4,
    };

    const totalGroupSkus = groups.reduce((s: number, g: any) => s + (g.variants?.length || 0), 0);
    const selectedColor = PANTONE_COLORS.find(c => c.name === groupForm.color);
    const filteredColors = PANTONE_COLORS.filter(c => c.name.toLowerCase().includes(colorSearch.toLowerCase()) || c.category.toLowerCase().includes(colorSearch.toLowerCase()));
    const filteredMaterials = MATERIALS.filter(m => m.name.toLowerCase().includes(materialSearch.toLowerCase()) || m.category.toLowerCase().includes(materialSearch.toLowerCase()));
    const currencySymbol = CURRENCIES.find(c => c.code === groupForm.currency)?.symbol || '$';

    return (
        <div>
            {/* Summary */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#94a3b8' }}>
                    <span><strong style={{ color: '#e2e8f0' }}>{groups.length}</strong> variant groups</span>
                    <span><strong style={{ color: '#e2e8f0' }}>{totalGroupSkus + ungrouped.length}</strong> SKUs</span>
                    {ungrouped.length > 0 && <span style={{ color: '#f59e0b' }}>({ungrouped.length} ungrouped)</span>}
                </div>
                <button onClick={() => setShowAddGroup(!showAddGroup)} style={{
                    padding: '8px 16px', borderRadius: 8, border: 'none',
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
                    color: '#818cf8', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>🎨 Add Variant Group</button>
            </div>

            {/* Add Variant Group Form */}
            {showAddGroup && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Add Variant Group to &quot;{product.title}&quot;</div>
                    {!product.styleCode && (
                        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', fontSize: 13, marginBottom: 14 }}>
                            \u26a0\ufe0f Product must have a Style Code. Edit the product first.
                        </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                        {/* ── COLOR PICKER ── */}
                        <div ref={colorRef} style={{ position: 'relative' }}>
                            <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>COLOR</label>
                            <button type="button" onClick={() => { setColorOpen(!colorOpen); setColorSearch(''); }}
                                style={{ ...inputStyle, width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                {selectedColor ? (
                                    <><span style={{ width: 14, height: 14, borderRadius: '50%', background: selectedColor.hex, border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0, display: 'inline-block' }} />{selectedColor.name}</>
                                ) : (
                                    <span style={{ color: '#64748b' }}>Choose color…</span>
                                )}
                                <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 10 }}>▼</span>
                            </button>
                            {colorOpen && (
                                <div style={dropdownStyle}>
                                    <div style={{ position: 'sticky', top: 0, background: '#1a1d2e', padding: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                        <input autoFocus placeholder="Search colors…" value={colorSearch} onChange={e => setColorSearch(e.target.value)}
                                            style={{ ...inputStyle, width: '100%', fontSize: 12 }} />
                                    </div>
                                    {COLOR_CATEGORIES.map(cat => {
                                        const items = filteredColors.filter(c => c.category === cat);
                                        if (items.length === 0) return null;
                                        return (
                                            <div key={cat}>
                                                <div style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>{cat}</div>
                                                {items.map(c => (
                                                    <button key={c.name} onClick={() => { setGroupForm({ ...groupForm, color: c.name }); setColorOpen(false); }}
                                                        style={{
                                                            width: '100%', padding: '6px 12px', border: 'none', background: groupForm.color === c.name ? 'rgba(99,102,241,0.15)' : 'transparent',
                                                            color: '#e2e8f0', fontSize: 12, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                                                        }}>
                                                        <span style={{ width: 16, height: 16, borderRadius: '50%', background: c.hex, border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
                                                        <span>{c.name}</span>
                                                        {c.pantone && <span style={{ fontSize: 10, color: '#64748b', marginLeft: 'auto' }}>{c.pantone}</span>}
                                                    </button>
                                                ))}
                                            </div>
                                        );
                                    })}
                                    {/* Custom entry */}
                                    {colorSearch.trim() && !PANTONE_COLORS.some(c => c.name.toLowerCase() === colorSearch.toLowerCase()) && (
                                        <button onClick={() => { setGroupForm({ ...groupForm, color: colorSearch.trim() }); setColorOpen(false); }}
                                            style={{ width: '100%', padding: '8px 12px', border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(99,102,241,0.08)', color: '#818cf8', fontSize: 12, textAlign: 'left', cursor: 'pointer' }}>
                                            + Use custom: &ldquo;{colorSearch.trim()}&rdquo;
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── MATERIAL PICKER ── */}
                        <div ref={materialRef} style={{ position: 'relative' }}>
                            <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>MATERIAL</label>
                            <button type="button" onClick={() => { setMaterialOpen(!materialOpen); setMaterialSearch(''); }}
                                style={{ ...inputStyle, width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                {groupForm.material ? (
                                    <span>{groupForm.material}</span>
                                ) : (
                                    <span style={{ color: '#64748b' }}>Choose material…</span>
                                )}
                                <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 10 }}>▼</span>
                            </button>
                            {materialOpen && (
                                <div style={dropdownStyle}>
                                    <div style={{ position: 'sticky', top: 0, background: '#1a1d2e', padding: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                        <input autoFocus placeholder="Search materials…" value={materialSearch} onChange={e => setMaterialSearch(e.target.value)}
                                            style={{ ...inputStyle, width: '100%', fontSize: 12 }} />
                                    </div>
                                    {MATERIAL_CATEGORIES.map(cat => {
                                        const items = filteredMaterials.filter(m => m.category === cat);
                                        if (items.length === 0) return null;
                                        return (
                                            <div key={cat}>
                                                <div style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>{cat}</div>
                                                {items.map(m => (
                                                    <button key={m.name} onClick={() => { setGroupForm({ ...groupForm, material: m.name }); setMaterialOpen(false); }}
                                                        style={{
                                                            width: '100%', padding: '6px 12px', border: 'none', background: groupForm.material === m.name ? 'rgba(99,102,241,0.15)' : 'transparent',
                                                            color: '#e2e8f0', fontSize: 12, textAlign: 'left', cursor: 'pointer'
                                                        }}>
                                                        {m.name}
                                                    </button>
                                                ))}
                                            </div>
                                        );
                                    })}
                                    {materialSearch.trim() && !MATERIALS.some(m => m.name.toLowerCase() === materialSearch.toLowerCase()) && (
                                        <button onClick={() => { setGroupForm({ ...groupForm, material: materialSearch.trim() }); setMaterialOpen(false); }}
                                            style={{ width: '100%', padding: '8px 12px', border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(99,102,241,0.08)', color: '#818cf8', fontSize: 12, textAlign: 'left', cursor: 'pointer' }}>
                                            + Use custom: &ldquo;{materialSearch.trim()}&rdquo;
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── IMAGE URL ── */}
                        <div>
                            <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>IMAGE URL</label>
                            <input placeholder="https://..." value={groupForm.imageUrl} onChange={e => setGroupForm({ ...groupForm, imageUrl: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
                        </div>
                    </div>

                    {/* ── SIZE RUN ── */}
                    <div style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>SIZE RUN *</label>
                        {/* Category tabs */}
                        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                            {SIZE_GROUPS.map(g => (
                                <button key={g} onClick={() => setSizeGroup(g)}
                                    style={{
                                        padding: '4px 12px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                        background: sizeGroup === g ? 'rgba(99,102,241,0.2)' : 'transparent',
                                        color: sizeGroup === g ? '#818cf8' : '#64748b'
                                    }}>{g}</button>
                            ))}
                        </div>
                        {/* Presets for selected group */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                            {SIZE_RUN_PRESETS.filter(p => p.group === sizeGroup).map(p => (
                                <button key={p.label} onClick={() => setSizeRun(prev => [...new Set([...prev, ...p.sizes])])}
                                    style={{
                                        padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.15)',
                                        background: 'rgba(99,102,241,0.06)', color: '#94a3b8', fontSize: 11, cursor: 'pointer',
                                        transition: 'all 0.15s'
                                    }}>
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        {/* Manual input */}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input placeholder="Or type custom sizes (comma-separated), press Enter" value={groupForm.sizeRunInput}
                                onChange={e => setGroupForm({ ...groupForm, sizeRunInput: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter' && groupForm.sizeRunInput.trim()) { e.preventDefault(); addSize(groupForm.sizeRunInput); setGroupForm({ ...groupForm, sizeRunInput: '' }); } }}
                                style={{ ...inputStyle, flex: 1, fontSize: 12 }} />
                            <button onClick={() => { if (groupForm.sizeRunInput.trim()) { addSize(groupForm.sizeRunInput); setGroupForm({ ...groupForm, sizeRunInput: '' }); } }}
                                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>Add</button>
                        </div>
                        {/* Selected sizes */}
                        {sizeRun.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                                {sizeRun.map(size => (
                                    <span key={size} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'rgba(99,102,241,0.15)', color: '#818cf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {size}
                                        <button onClick={() => removeSize(size)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>&times;</button>
                                    </span>
                                ))}
                                <button onClick={() => setSizeRun([])} style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: 11, cursor: 'pointer' }}>Clear all</button>
                            </div>
                        )}
                    </div>

                    {/* ── PRICING ── */}
                    <div style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'end', maxWidth: 560 }}>
                            {/* Currency */}
                            <div style={{ minWidth: 90 }}>
                                <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>CURRENCY</label>
                                <select value={groupForm.currency} onChange={e => setGroupForm({ ...groupForm, currency: e.target.value })}
                                    style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}>
                                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
                                </select>
                            </div>
                            {/* Retail Price */}
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>RETAIL PRICE <span style={{ fontWeight: 400, color: '#475569' }}>(sell to customer)</span></label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 13, pointerEvents: 'none' }}>{currencySymbol}</span>
                                    <input type="number" placeholder="0.00" value={groupForm.price} onChange={e => setGroupForm({ ...groupForm, price: e.target.value })}
                                        style={{ ...inputStyle, width: '100%', paddingLeft: currencySymbol.length > 1 ? 32 : 24 }} />
                                </div>
                            </div>
                            {/* Vendor Cost */}
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>VENDOR COST <span style={{ fontWeight: 400, color: '#475569' }}>(buy from supplier)</span></label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 13, pointerEvents: 'none' }}>{currencySymbol}</span>
                                    <input type="number" placeholder="0.00" value={groupForm.vendorCost} onChange={e => setGroupForm({ ...groupForm, vendorCost: e.target.value })}
                                        style={{ ...inputStyle, width: '100%', paddingLeft: currencySymbol.length > 1 ? 32 : 24 }} />
                                </div>
                            </div>
                            {/* Margin preview */}
                            {groupForm.price && groupForm.vendorCost && (
                                <div style={{ minWidth: 80, textAlign: 'center' }}>
                                    <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>MARGIN</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: Number(groupForm.price) > Number(groupForm.vendorCost) ? '#34d399' : '#f87171' }}>
                                        {((1 - Number(groupForm.vendorCost) / Number(groupForm.price)) * 100).toFixed(0)}%
                                    </div>
                                </div>
                            )}
                        </div>
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>
                            These prices are defaults applied to each generated SKU. You can adjust individual SKU prices later.
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button onClick={handleAddGroup} disabled={sizeRun.length === 0 || !product.styleCode} style={{
                            padding: '8px 20px', borderRadius: 8, border: 'none',
                            background: sizeRun.length > 0 && product.styleCode ? '#818cf8' : '#374151',
                            color: 'white', fontSize: 13, fontWeight: 600,
                            cursor: sizeRun.length > 0 && product.styleCode ? 'pointer' : 'default',
                        }}>Create Group + {sizeRun.length} SKUs</button>
                        <span style={{ fontSize: 12, color: '#64748b' }}>
                            SKU: {product.styleCode || '???'}-{groupForm.color ? groupForm.color.toUpperCase().substring(0, 3) : 'NA'}-SIZE
                        </span>
                    </div>
                    {addMsg && <div style={{ marginTop: 8, fontSize: 13, color: addMsg.startsWith('\u2705') ? '#34d399' : '#ef4444' }}>{addMsg}</div>}
                </div>
            )}

            {/* Groups + Ungrouped */}
            <VariantList groups={groups} ungrouped={ungrouped} editing={editing} productId={productId} onProductUpdate={onProductUpdate} />
        </div>
    );
}



// ─── Inline-editable variant list ───
function VariantList({ groups, ungrouped, editing, productId, onProductUpdate }: {
    groups: any[]; ungrouped: any[]; productId: string; editing?: boolean; onProductUpdate?: (p: any) => void;
}) {
    const [edits, setEdits] = useState<Record<string, any>>({});
    const [saving, setSaving] = useState<Record<string, boolean>>({});
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
    const [bulkSaving, setBulkSaving] = useState(false);
    const [bulkMsg, setBulkMsg] = useState('');

    const allVariants = [
        ...groups.flatMap((g: any) => (g.variants || []).map((v: any) => v)),
        ...ungrouped,
    ];

    const getVal = (vid: string, field: string, original: any) => edits[vid]?.[field] ?? original;

    const setVal = (vid: string, field: string, value: any) => {
        setEdits(prev => ({ ...prev, [vid]: { ...prev[vid], [field]: value } }));
        setSavedIds(prev => { const n = new Set(prev); n.delete(vid); return n; });
    };

    const saveOne = async (v: any) => {
        const c = edits[v.id];
        if (!c || Object.keys(c).length === 0) return;
        setSaving(prev => ({ ...prev, [v.id]: true }));
        try {
            await api.updateVariant(productId, v.id, {
                ...(c.price != null ? { price: parseFloat(c.price) } : {}),
                ...(c.vendorCost != null ? { vendorCost: parseFloat(c.vendorCost) } : {}),
                ...(c.color != null ? { color: c.color } : {}),
                ...(c.size != null ? { size: c.size } : {}),
                ...(c.status != null ? { status: c.status } : {}),
            });
            setSavedIds(prev => new Set(prev).add(v.id));
        } catch (e: any) {
            alert(`Failed to save ${v.sku}: ${e.message}`);
        } finally {
            setSaving(prev => ({ ...prev, [v.id]: false }));
        }
    };

    const saveAll = async () => {
        const ids = Object.keys(edits).filter(id => Object.keys(edits[id] || {}).length > 0 && !savedIds.has(id));
        if (ids.length === 0) { setBulkMsg('No changes'); return; }
        setBulkSaving(true); setBulkMsg('');
        let ok = 0;
        for (const vid of ids) {
            const v = allVariants.find((x: any) => x.id === vid);
            if (!v) continue;
            try { await saveOne(v); ok++; } catch { /* counted by saveOne alert */ }
        }
        setBulkSaving(false);
        setBulkMsg(`✅ Saved ${ok} variant${ok > 1 ? 's' : ''}`);
        if (onProductUpdate) {
            try { const res = await api.getProduct(productId); onProductUpdate(res.data); } catch { }
        }
    };

    const inp: React.CSSProperties = {
        padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(99,102,241,0.3)',
        background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 12, width: 80, textAlign: 'right',
    };

    const renderRow = (v: any, showColor?: boolean) => {
        const hasCh = edits[v.id] && Object.keys(edits[v.id]).length > 0 && !savedIds.has(v.id);
        const price = parseFloat(getVal(v.id, 'price', v.price) || '0');
        const cost = parseFloat(getVal(v.id, 'vendorCost', v.vendorCost) || '0');
        const margin = price > 0 && cost > 0 ? ((1 - cost / price) * 100) : null;
        const st = getVal(v.id, 'status', v.status) || 'ACTIVE';
        const si = STATUS_CONFIG[st] || STATUS_CONFIG.DRAFT;
        return (
            <tr key={v.id} style={{ background: hasCh ? 'rgba(99,102,241,0.04)' : undefined }}>
                <td className="cell-mono" style={{ fontWeight: 600, fontSize: 11 }}>{v.sku}</td>
                {showColor && <td>{editing
                    ? <input value={getVal(v.id, 'color', v.color || '')} onChange={e => setVal(v.id, 'color', e.target.value)} style={{ ...inp, width: 70, textAlign: 'left' }} />
                    : <span className="cell-primary">{v.color || '—'}</span>}</td>}
                <td>{editing
                    ? <input value={getVal(v.id, 'size', v.size || '')} onChange={e => setVal(v.id, 'size', e.target.value)} style={{ ...inp, width: 50, textAlign: 'center' }} />
                    : <span className="cell-primary">{v.size || '—'}</span>}</td>
                <td>{editing
                    ? <input type="number" step="0.01" value={getVal(v.id, 'price', v.price ?? '')} onChange={e => setVal(v.id, 'price', e.target.value)} placeholder="0.00" style={inp} />
                    : <span className="cell-muted">{v.price ? `$${parseFloat(v.price).toFixed(2)}` : '—'}</span>}</td>
                <td>{editing
                    ? <input type="number" step="0.01" value={getVal(v.id, 'vendorCost', v.vendorCost ?? '')} onChange={e => setVal(v.id, 'vendorCost', e.target.value)} placeholder="0.00" style={inp} />
                    : <span className="cell-muted">{v.vendorCost ? `$${parseFloat(v.vendorCost).toFixed(2)}` : '—'}</span>}</td>
                <td style={{ color: margin != null ? (margin < 0 ? '#ef4444' : margin < 20 ? '#f59e0b' : '#22c55e') : '#555', fontWeight: 600, fontSize: 12 }}>
                    {margin != null ? `${margin.toFixed(1)}%` : '—'}
                </td>
                <td>{editing
                    ? <select value={st} onChange={e => setVal(v.id, 'status', e.target.value)}
                        style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(0,0,0,0.3)', color: si.color, fontSize: 11, cursor: 'pointer' }}>
                        <option value="ACTIVE">Active</option><option value="DRAFT">Draft</option><option value="DISCONTINUED">Discontinued</option>
                      </select>
                    : <span className="status-badge" style={{ background: si.bg, color: si.color }}>{si.label}</span>}</td>
                <td style={{ textAlign: 'center' }}>
                    {editing && hasCh ? (
                        saving[v.id] ? <span style={{ fontSize: 11, color: '#818cf8' }}>⏳</span>
                        : <button onClick={() => saveOne(v)} style={{ padding: '2px 8px', borderRadius: 4, border: 'none', background: 'rgba(99,102,241,0.2)', color: '#818cf8', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Save</button>
                    ) : editing && savedIds.has(v.id) ? (
                        <span style={{ fontSize: 11, color: '#22c55e' }}>✓</span>
                    ) : (
                        <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontSize: 11 }}>{v.storeMaps?.length || 0}</span>
                    )}
                </td>
            </tr>
        );
    };

    if (groups.length === 0 && ungrouped.length === 0) {
        return <div style={{ color: '#666', padding: 20 }}>No variant groups or SKUs yet.</div>;
    }

    const unsavedCount = Object.keys(edits).filter(id => Object.keys(edits[id] || {}).length > 0 && !savedIds.has(id)).length;

    return (
        <>
            {editing && unsavedCount > 0 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, padding: '8px 12px', background: 'rgba(99,102,241,0.06)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.15)' }}>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{unsavedCount} unsaved change{unsavedCount > 1 ? 's' : ''}</span>
                    <button onClick={saveAll} disabled={bulkSaving} style={{
                        padding: '6px 16px', borderRadius: 6, border: 'none',
                        background: bulkSaving ? '#374151' : '#818cf8', color: 'white',
                        fontSize: 12, fontWeight: 600, cursor: bulkSaving ? 'default' : 'pointer',
                    }}>{bulkSaving ? '⏳ Saving...' : '💾 Save All Changes'}</button>
                    {bulkMsg && <span style={{ fontSize: 12, color: '#34d399' }}>{bulkMsg}</span>}
                </div>
            )}

            {groups.map((g: any) => {
                const gn = g.material ? `${g.color || 'N/A'} / ${g.material}` : (g.color || 'Ungrouped');
                return (
                    <div key={g.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'linear-gradient(135deg, #818cf8, #6366f1)', flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, fontSize: 14 }}>{gn}</span>
                            <span style={{ fontSize: 12, color: '#64748b' }}>{g.variants?.length || 0} SKUs</span>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginLeft: 8 }}>
                                {(g.sizeRun || []).map((s: string) => (
                                    <span key={s} style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>{s}</span>
                                ))}
                            </div>
                        </div>
                        {g.variants?.length > 0 && (
                            <table className="data-table" style={{ margin: 0 }}>
                                <thead><tr><th>SKU</th><th>Size</th><th>Price</th><th>Cost</th><th>Margin</th><th>Status</th><th>{editing ? '' : 'Stores'}</th></tr></thead>
                                <tbody>{g.variants.map((v: any) => renderRow(v, false))}</tbody>
                            </table>
                        )}
                    </div>
                );
            })}

            {ungrouped.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(245,158,11,0.05)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ fontSize: 14 }}>⚠️</span>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#f59e0b' }}>Ungrouped SKUs</span>
                        <span style={{ fontSize: 12, color: '#64748b' }}>{ungrouped.length} SKUs (imported)</span>
                    </div>
                    <table className="data-table" style={{ margin: 0 }}>
                        <thead><tr><th>SKU</th><th>Color</th><th>Size</th><th>Price</th><th>Cost</th><th>Margin</th><th>Status</th><th>{editing ? '' : 'Stores'}</th></tr></thead>
                        <tbody>{ungrouped.map((v: any) => renderRow(v, true))}</tbody>
                    </table>
                </div>
            )}
        </>
    );
}

function ImagesTab({ images }: { images: any[] }) {
    if (images.length === 0) return <div style={{ color: '#666', padding: 20 }}>No images yet. Images are synced from Shopify during import.</div>;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            {images.map((img: any, idx: number) => (
                <div key={img.id} style={{
                    borderRadius: 10, overflow: 'hidden',
                    background: 'var(--bg-surface, rgba(255,255,255,0.03))',
                    border: '1px solid var(--border, rgba(255,255,255,0.06))',
                }}>
                    <img src={img.src} alt={img.alt || `Image ${idx + 1}`}
                        style={{ width: '100%', height: 180, objectFit: 'cover' }}
                        onError={(e: any) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect fill="%23222"/><text x="50%" y="50%" fill="%23666" text-anchor="middle" dy=".3em">No Image</text></svg>'; }}
                    />
                    <div style={{ padding: '8px 12px', fontSize: 12, color: '#888' }}>
                        {img.alt || `Position ${img.position}`}
                        {img.width && <span style={{ marginLeft: 8 }}>{img.width}×{img.height}</span>}
                    </div>
                </div>
            ))}
        </div>
    );
}

function MappingsTab({ storeMaps }: { storeMaps: any[] }) {
    if (storeMaps.length === 0) return <div style={{ color: '#666', padding: 20 }}>Not mapped to any Shopify stores yet.</div>;

    return (
        <div className="table-wrap">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Store</th>
                        <th>Shopify Product ID</th>
                        <th>Handle</th>
                        <th>Shopify Status</th>
                        <th>Category ID</th>
                        <th>Synced At</th>
                    </tr>
                </thead>
                <tbody>
                    {storeMaps.map((m: any) => (
                        <tr key={m.id}>
                            <td className="cell-primary" style={{ fontWeight: 600 }}>{m.store?.storeName || m.storeId}</td>
                            <td className="cell-mono" style={{ fontSize: 12 }}>{m.shopifyProductId}</td>
                            <td className="cell-muted">{m.handle || '—'}</td>
                            <td>
                                <span className="status-badge" style={{
                                    background: m.shopifyStatus === 'active' ? '#22c55e22' : '#f59e0b22',
                                    color: m.shopifyStatus === 'active' ? '#22c55e' : '#f59e0b',
                                }}>{m.shopifyStatus || '—'}</span>
                            </td>
                            <td className="cell-muted" style={{ fontSize: 12 }}>{m.shopifyCategoryId || '—'}</td>
                            <td className="cell-muted" style={{ fontSize: 12 }}>
                                {m.syncedAt ? new Date(m.syncedAt).toLocaleString('vi-VN') : '—'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function IssuesTab({ issues, productId }: { issues: any[]; productId: string }) {
    const [issueList, setIssueList] = useState(issues);

    const handleResolve = async (issueId: string) => {
        try {
            await api.resolveIssue(issueId);
            setIssueList(prev => prev.filter(i => i.id !== issueId));
        } catch (e: any) {
            alert('Failed: ' + e.message);
        }
    };

    const handleIgnore = async (issueId: string) => {
        try {
            await api.ignoreIssue(issueId);
            setIssueList(prev => prev.filter(i => i.id !== issueId));
        } catch (e: any) {
            alert('Failed: ' + e.message);
        }
    };

    if (issueList.length === 0) return (
        <div style={{ color: '#22c55e', padding: 20, fontSize: 14 }}>✓ No open issues for this product.</div>
    );

    return (
        <div className="table-wrap">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Rule</th>
                        <th>Severity</th>
                        <th>Message</th>
                        <th>Variant</th>
                        <th style={{ width: 160 }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {issueList.map((issue: any) => {
                        const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.WARNING;
                        return (
                            <tr key={issue.id}>
                                <td className="cell-mono" style={{ fontSize: 12 }}>{issue.ruleCode}</td>
                                <td>
                                    <span className="status-badge" style={{ background: sev.bg, color: sev.color }}>{issue.severity}</span>
                                </td>
                                <td className="cell-primary" style={{ fontSize: 13 }}>{issue.message}</td>
                                <td className="cell-mono" style={{ fontSize: 12 }}>{issue.variant?.sku || '—'}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button onClick={() => handleResolve(issue.id)} style={{
                                            padding: '4px 10px', background: '#22c55e22', border: '1px solid #22c55e44',
                                            borderRadius: 4, color: '#22c55e', cursor: 'pointer', fontSize: 11,
                                        }}>Resolve</button>
                                        <button onClick={() => handleIgnore(issue.id)} style={{
                                            padding: '4px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: 4, color: '#888', cursor: 'pointer', fontSize: 11,
                                        }}>Ignore</button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
