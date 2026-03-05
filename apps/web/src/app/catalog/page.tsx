'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

// ─── Types ───────────────────────────────
interface Product {
    id: string;
    name: string;
    description?: string;
    skuPrefix?: string;
    category?: string;
    shopifyCategoryId?: string;
    material?: string;
    productType?: string;
    tags?: string[];
    media?: { url: string; alt: string; position: number }[];
    handle?: string;
    vendor?: string;
    hasConflict: boolean;
    status: string;
    brandId?: string;
    brand?: { id: string; name: string; code: string; logoUrl?: string };
    collection?: { id: string; name: string };
    _count?: { colorways: number };
    colorways?: any[];
    publications?: any[];
    productMaps?: any[];
    createdAt: string;
    updatedAt: string;
}

export default function CatalogPage() {
    const { user } = useAuth();
    const canDelete = user && ['admin', 'sourcing_procurement'].includes(user.role);

    // ─── State ───────────────────────────
    const [products, setProducts] = useState<Product[]>([]);
    const [brands, setBrands] = useState<any[]>([]);
    const [stores, setStores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [meta, setMeta] = useState<any>({});

    // Filters
    const [search, setSearch] = useState('');
    const [brandFilter, setBrandFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [conflictFilter, setConflictFilter] = useState('');
    const [page, setPage] = useState(1);

    // Modal
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [modalTab, setModalTab] = useState<'master' | 'stores' | 'metafields' | 'logs'>('master');
    const [productLogs, setProductLogs] = useState<any[]>([]);

    // Import
    const [importing, setImporting] = useState<string | null>(null);
    const [importMsg, setImportMsg] = useState('');

    // Summary
    const [summary, setSummary] = useState<any>(null);

    // ─── Fetch Products ─────────────────
    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = { page: String(page), limit: '25' };
            if (search) params.search = search;
            if (brandFilter) params.brandId = brandFilter;
            if (categoryFilter) params.category = categoryFilter;
            if (statusFilter) params.status = statusFilter;
            if (conflictFilter) params.hasConflict = conflictFilter;

            const res = await api.getProducts(params);
            setProducts(res.data || []);
            setMeta(res.meta || {});
        } catch (err) {
            console.warn('Failed to load products:', err);
        } finally {
            setLoading(false);
        }
    }, [page, search, brandFilter, categoryFilter, statusFilter, conflictFilter]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    // Load brands and stores for filters
    useEffect(() => {
        api.getBrands().then((r: any) => setBrands(r.data || [])).catch(() => { });
        api.getStores().then((r: any) => setStores(r.data || [])).catch(() => { });
        loadSummary();
    }, []);

    const loadSummary = async () => {
        try {
            const res = await api.getProductsSummary();
            setSummary(res);
        } catch { /* product summary may not exist yet */ }
    };

    // ─── Open product detail ────────────
    const openProduct = async (product: Product) => {
        try {
            const res = await api.getProduct(product.id);
            setSelectedProduct(res.data);
        } catch {
            setSelectedProduct(product);
        }
        setModalTab('master');
        setShowModal(true);
    };

    // ─── Delete product ─────────────────
    const handleDelete = async () => {
        if (!selectedProduct || !canDelete) return;
        if (!window.confirm(`Xóa sản phẩm "${selectedProduct.name}"?`)) return;

        try {
            await api.deleteProduct(selectedProduct.id);
            setShowModal(false);
            setSelectedProduct(null);
            fetchProducts();
        } catch (err) {
            alert('Lỗi xóa sản phẩm');
        }
    };

    // ─── Trigger Import ─────────────────
    const handleImport = async (storeId: string) => {
        setImporting(storeId);
        setImportMsg('');
        try {
            const res = await api.triggerImport(storeId);
            setImportMsg(`✅ Import job started: ${res.data.jobId}`);
            // Refresh after a delay
            setTimeout(() => { fetchProducts(); loadSummary(); }, 5000);
        } catch (err: any) {
            setImportMsg(`❌ Import failed: ${err.message}`);
        } finally {
            setImporting(null);
        }
    };

    // ─── Write Metafields ───────────────
    const handleMetafields = async (storeId: string) => {
        try {
            const res = await api.triggerMetafields(storeId);
            setImportMsg(`✅ Metafields job started: ${res.data.jobId}`);
        } catch (err: any) {
            setImportMsg(`❌ Metafields failed: ${err.message}`);
        }
    };

    // ─── Categories (from data) ─────────
    const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];

    const totalPages = Math.ceil((meta.total || 0) / (meta.limit || 25));

    return (
        <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* ═══ Header ═══ */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#f0f0f0', margin: 0 }}>
                        📦 Product Management
                    </h1>
                    <p style={{ color: '#888', marginTop: '4px', fontSize: '14px' }}>
                        Master Product Information Management
                    </p>
                </div>
            </div>

            {/* ═══ Summary Cards ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <SummaryCard label="Total Products" value={meta.total || 0} icon="📦" color="#3b82f6" />
                <SummaryCard label="Active" value={products.filter(p => p.status === 'active').length} icon="✅" color="#22c55e" />
                <SummaryCard label="Conflicts" value={products.filter(p => p.hasConflict).length} icon="⚠️" color="#f59e0b" />
                <SummaryCard label="Brands" value={brands.length} icon="🏷️" color="#8b5cf6" />
            </div>

            {/* ═══ Import Section ═══ */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '24px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#93c5fd', fontWeight: '600', fontSize: '14px' }}>🔄 Import from Shopify:</span>
                    {stores.map((store: any) => (
                        <div key={store.id} style={{ display: 'flex', gap: '4px' }}>
                            <button
                                onClick={() => handleImport(store.id)}
                                disabled={importing === store.id}
                                style={{
                                    padding: '6px 14px',
                                    background: importing === store.id ? '#1e293b' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    cursor: importing === store.id ? 'wait' : 'pointer',
                                    opacity: importing === store.id ? 0.6 : 1,
                                }}
                            >
                                {importing === store.id ? '⏳ Importing...' : store.storeName}
                            </button>
                            <button
                                onClick={() => handleMetafields(store.id)}
                                style={{
                                    padding: '6px 8px',
                                    background: 'rgba(139,92,246,0.2)',
                                    color: '#a78bfa',
                                    border: '1px solid rgba(139,92,246,0.3)',
                                    borderRadius: '8px',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                }}
                                title="Write metafields"
                            >
                                MF
                            </button>
                        </div>
                    ))}
                    {importMsg && (
                        <span style={{ fontSize: '12px', color: importMsg.startsWith('✅') ? '#22c55e' : '#ef4444' }}>
                            {importMsg}
                        </span>
                    )}
                </div>
            </div>

            {/* ═══ Filters ═══ */}
            <div style={{
                display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap',
            }}>
                <input
                    type="text"
                    placeholder="🔍 Search products..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    style={{
                        padding: '10px 16px',
                        background: '#1a1a2e',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '10px',
                        color: '#f0f0f0',
                        fontSize: '14px',
                        flex: '1',
                        minWidth: '200px',
                    }}
                />
                <select
                    value={brandFilter}
                    onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }}
                    style={filterSelectStyle}
                >
                    <option value="">All Brands</option>
                    {brands.map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
                <select
                    value={categoryFilter}
                    onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                    style={filterSelectStyle}
                >
                    <option value="">All Categories</option>
                    {categories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    style={filterSelectStyle}
                >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                </select>
                <select
                    value={conflictFilter}
                    onChange={(e) => { setConflictFilter(e.target.value); setPage(1); }}
                    style={filterSelectStyle}
                >
                    <option value="">All</option>
                    <option value="true">⚠️ Conflicts Only</option>
                </select>
            </div>

            {/* ═══ Products Table ═══ */}
            <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                overflow: 'hidden',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <th style={thStyle}>#</th>
                            <th style={thStyle}>Image</th>
                            <th style={{ ...thStyle, textAlign: 'left' }}>Product</th>
                            <th style={thStyle}>Brand</th>
                            <th style={thStyle}>Category</th>
                            <th style={thStyle}>Variants</th>
                            <th style={thStyle}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Loading...</td></tr>
                        ) : products.length === 0 ? (
                            <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No products yet. Import from Shopify to get started! ☝️</td></tr>
                        ) : products.map((p, i) => (
                            <tr
                                key={p.id}
                                onClick={() => openProduct(p)}
                                style={{
                                    cursor: 'pointer',
                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                                <td style={{ ...tdStyle, color: '#555', width: '40px' }}>{(page - 1) * 25 + i + 1}</td>
                                <td style={{ ...tdStyle, width: '56px' }}>
                                    {p.media && p.media.length > 0 ? (
                                        <img src={p.media[0].url} alt="" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>📦</div>
                                    )}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'left' }}>
                                    <div>
                                        <div style={{ fontWeight: '600', color: '#f0f0f0', fontSize: '14px' }}>
                                            {p.hasConflict && <span title="SKU conflict">⚠️ </span>}
                                            {p.name}
                                        </div>
                                        <div style={{ color: '#666', fontSize: '12px', marginTop: '2px' }}>
                                            {p.skuPrefix && <span style={{ marginRight: '8px' }}>SKU: {p.skuPrefix}</span>}
                                            {p.handle && <span style={{ color: '#555' }}>/{p.handle}</span>}
                                        </div>
                                    </div>
                                </td>
                                <td style={tdStyle}>
                                    <span style={{
                                        background: 'rgba(139,92,246,0.1)',
                                        color: '#a78bfa',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                    }}>
                                        {p.brand?.name || p.vendor || '—'}
                                    </span>
                                </td>
                                <td style={tdStyle}>
                                    <span style={{ color: '#888', fontSize: '13px' }}>{p.category || p.productType || '—'}</span>
                                </td>
                                <td style={tdStyle}>
                                    <span style={{
                                        background: 'rgba(59,130,246,0.1)',
                                        color: '#60a5fa',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                    }}>
                                        {p._count?.colorways || 0}
                                    </span>
                                </td>
                                <td style={tdStyle}>
                                    <span style={{
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: '500',
                                        background: p.status === 'active' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                        color: p.status === 'active' ? '#22c55e' : '#ef4444',
                                    }}>
                                        {p.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ═══ Pagination ═══ */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
                    <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} style={pgBtnStyle}>← Prev</button>
                    <span style={{ color: '#888', padding: '8px 16px', fontSize: '14px' }}>Page {page} / {totalPages}</span>
                    <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={pgBtnStyle}>Next →</button>
                </div>
            )}

            {/* ═══ Product Detail Modal ═══ */}
            {showModal && selectedProduct && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
                    backdropFilter: 'blur(4px)',
                }} onClick={() => setShowModal(false)}>
                    <div style={{
                        background: '#12121a',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '16px',
                        width: '900px',
                        maxHeight: '85vh',
                        overflow: 'auto',
                        padding: '0',
                    }} onClick={(e) => e.stopPropagation()}>

                        {/* Modal Header */}
                        <div style={{
                            padding: '20px 24px',
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                            <div>
                                <h2 style={{ margin: 0, color: '#f0f0f0', fontSize: '20px' }}>
                                    {selectedProduct.hasConflict && '⚠️ '}{selectedProduct.name}
                                </h2>
                                <p style={{ margin: '4px 0 0', color: '#666', fontSize: '13px' }}>
                                    {selectedProduct.brand?.name || selectedProduct.vendor || 'No brand'} · {selectedProduct.handle}
                                </p>
                            </div>
                            <button onClick={() => setShowModal(false)} style={{
                                background: 'none', border: 'none', color: '#888', fontSize: '24px', cursor: 'pointer',
                            }}>✕</button>
                        </div>

                        {/* Modal Tabs */}
                        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px' }}>
                            {(['master', 'stores', 'metafields', 'logs'] as const).map((tab) => (
                                <button key={tab} onClick={() => setModalTab(tab)} style={{
                                    padding: '12px 20px',
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: modalTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
                                    color: modalTab === tab ? '#60a5fa' : '#888',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}>
                                    {tab === 'master' ? '📋 Master' : tab === 'stores' ? '🏪 Stores' : tab === 'metafields' ? '🏷️ Metafields' : '📊 Sync Logs'}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div style={{ padding: '24px' }}>
                            {modalTab === 'master' && <MasterTab product={selectedProduct} stores={stores} />}
                            {modalTab === 'stores' && <StoresTab product={selectedProduct} stores={stores} />}
                            {modalTab === 'metafields' && <MetafieldsTab product={selectedProduct} />}
                            {modalTab === 'logs' && <LogsTab product={selectedProduct} />}
                        </div>

                        {/* Modal Footer */}
                        {canDelete && (
                            <div style={{
                                padding: '16px 24px',
                                borderTop: '1px solid rgba(255,255,255,0.06)',
                                display: 'flex',
                                justifyContent: 'flex-end',
                            }}>
                                <button onClick={handleDelete} style={{
                                    padding: '8px 20px',
                                    background: 'rgba(239,68,68,0.1)',
                                    border: '1px solid rgba(239,68,68,0.3)',
                                    borderRadius: '8px',
                                    color: '#ef4444',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                }}>
                                    🗑️ Xóa sản phẩm
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Sub-components ──────────────────────

function SummaryCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px',
            padding: '16px 20px',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <div style={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontSize: '28px', fontWeight: '700', color }}>{value}</div>
                </div>
                <div style={{ fontSize: '28px' }}>{icon}</div>
            </div>
        </div>
    );
}

function MasterTab({ product, stores }: { product: Product; stores: any[] }) {
    const [categorySearch, setCategorySearch] = useState('');
    const [taxonomyResults, setTaxonomyResults] = useState<any[]>([]);
    const [showCatDropdown, setShowCatDropdown] = useState(false);
    const [currentCategory, setCurrentCategory] = useState(product.shopifyCategoryId || '');
    const [validation, setValidation] = useState<any>(null);

    useEffect(() => {
        if (product.id) {
            api.getProductValidation(product.id).then(setValidation).catch(() => { });
        }
    }, [product.id]);

    const searchCategories = async (q: string) => {
        setCategorySearch(q);
        if (q.length < 2) { setTaxonomyResults([]); return; }
        try {
            const res = await api.searchTaxonomy(q);
            setTaxonomyResults(res.data || []);
            setShowCatDropdown(true);
        } catch { setTaxonomyResults([]); }
    };

    const selectCategory = async (catId: string, catLabel: string) => {
        try {
            await api.updateProductCategory(product.id, catId || null);
            setCurrentCategory(catId);
            setCategorySearch(catLabel);
            setShowCatDropdown(false);
            await api.revalidateProduct(product.id);
            api.getProductValidation(product.id).then(setValidation).catch(() => { });
        } catch (err: any) { alert(err.message); }
    };

    const handleRevalidate = async () => {
        try {
            await api.revalidateProduct(product.id);
            const v = await api.getProductValidation(product.id);
            setValidation(v);
        } catch (err: any) { alert(err.message); }
    };

    return (
        <div>
            {/* Validation Badge */}
            {validation && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
                    padding: '10px 14px', borderRadius: 8,
                    background: validation.global?.isValid === false ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
                    border: `1px solid ${validation.global?.isValid === false ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
                }}>
                    <span style={{ fontSize: 16 }}>{validation.global?.isValid === false ? '⛔' : '✅'}</span>
                    <span style={{ color: validation.global?.isValid === false ? '#fca5a5' : '#86efac', fontSize: 13, flex: 1 }}>
                        {validation.global?.isValid === false
                            ? `Missing required: ${(validation.global?.missingRequired || []).map((f: any) => `${f.namespace}.${f.key}`).join(', ')}`
                            : 'All required metafields present'
                        }
                    </span>
                    <button onClick={handleRevalidate} style={{
                        padding: '4px 10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 6, color: '#ccc', fontSize: 11, cursor: 'pointer',
                    }}>↻ Revalidate</button>
                </div>
            )}

            {/* Shopify Category Selector */}
            <div style={{ marginBottom: 16, position: 'relative' }}>
                <div style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>Shopify Category</div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input
                        value={categorySearch || currentCategory}
                        onChange={(e) => searchCategories(e.target.value)}
                        onFocus={() => { if (taxonomyResults.length) setShowCatDropdown(true); }}
                        placeholder="Search taxonomy (e.g. T-Shirts, Dresses...)"
                        style={{
                            flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
                            color: '#e2e8f0', fontSize: 13,
                        }}
                    />
                    {currentCategory && (
                        <button onClick={() => selectCategory('', '')} style={{
                            padding: '8px 12px', background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8,
                            color: '#fca5a5', fontSize: 12, cursor: 'pointer',
                        }}>Clear</button>
                    )}
                </div>
                {showCatDropdown && taxonomyResults.length > 0 && (
                    <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                        background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
                        maxHeight: 200, overflow: 'auto', marginTop: 4,
                    }}>
                        {taxonomyResults.map((cat: any) => (
                            <div key={cat.id} onClick={() => selectCategory(cat.id, cat.fullPath || cat.name)}
                                style={{
                                    padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#e2e8f0',
                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59,130,246,0.1)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                                {cat.fullPath || cat.name}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Images */}
            {product.media && product.media.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    {product.media.slice(0, 6).map((img, i) => (
                        <img key={i} src={img.url} alt={img.alt} style={{
                            width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover',
                            border: '1px solid rgba(255,255,255,0.06)',
                        }} />
                    ))}
                    {product.media.length > 6 && (
                        <div style={{
                            width: '80px', height: '80px', borderRadius: '8px',
                            background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#888', fontSize: '14px',
                        }}>+{product.media.length - 6}</div>
                    )}
                </div>
            )}

            {/* Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <InfoRow label="Product Type" value={product.productType} />
                <InfoRow label="Category" value={currentCategory || product.category} />
                <InfoRow label="Material" value={product.material} />
                <InfoRow label="SKU Prefix" value={product.skuPrefix} />
                <InfoRow label="Handle" value={product.handle} />
                <InfoRow label="Vendor" value={product.vendor} />
                <InfoRow label="Brand" value={product.brand?.name} />
                <InfoRow label="Status" value={product.status} />
            </div>

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ color: '#888', fontSize: '12px', marginBottom: '6px' }}>Tags</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {product.tags.map((tag, i) => (
                            <span key={i} style={{
                                background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
                                padding: '3px 10px', borderRadius: '12px', fontSize: '12px',
                            }}>{tag}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Description */}
            {product.description && (
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ color: '#888', fontSize: '12px', marginBottom: '6px' }}>Description</div>
                    <div style={{
                        color: '#aaa', fontSize: '13px', lineHeight: '1.5',
                        background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px',
                        maxHeight: '100px', overflow: 'auto',
                    }} dangerouslySetInnerHTML={{ __html: product.description }} />
                </div>
            )}

            {/* Variants Table with vendor_price + cogs */}
            {product.colorways && product.colorways.length > 0 && (
                <div>
                    <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>
                        Variants ({product.colorways.length})
                    </div>
                    <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '10px', overflow: 'hidden',
                    }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <th style={thSmStyle}>SKU</th>
                                    <th style={thSmStyle}>Option1</th>
                                    <th style={thSmStyle}>Option2</th>
                                    <th style={thSmStyle}>Price</th>
                                    <th style={thSmStyle}>Vendor Price</th>
                                    <th style={thSmStyle}>COGS</th>
                                    <th style={thSmStyle}>Barcode</th>
                                </tr>
                            </thead>
                            <tbody>
                                {product.colorways.map((v: any) => (
                                    <tr key={v.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                        <td style={tdSmStyle}><code style={{ color: '#60a5fa' }}>{v.sku}</code></td>
                                        <td style={tdSmStyle}>{v.option1 || v.color || '—'}</td>
                                        <td style={tdSmStyle}>{v.option2 || v.size || '—'}</td>
                                        <td style={tdSmStyle}>{v.price ? `$${v.price}` : '—'}</td>
                                        <td style={tdSmStyle}>
                                            <span style={{ color: v.vendorPrice ? '#fbbf24' : '#555' }}>
                                                {v.vendorPrice ? `$${v.vendorPrice}` : '—'}
                                            </span>
                                        </td>
                                        <td style={tdSmStyle}>
                                            <span style={{ color: v.cogs ? '#34d399' : '#555' }}>
                                                {v.cogs ? `$${v.cogs}` : '—'}
                                            </span>
                                        </td>
                                        <td style={tdSmStyle}>{v.barcode || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

function StoresTab({ product, stores }: { product: Product; stores: any[] }) {
    const pubs = product.publications || [];
    const [validation, setValidation] = useState<any>(null);
    const [pushing, setPushing] = useState(false);
    const [pushStoreId, setPushStoreId] = useState('');

    useEffect(() => {
        if (product.id) {
            api.getProductValidation(product.id).then(setValidation).catch(() => { });
        }
    }, [product.id]);

    const handlePush = async () => {
        try {
            setPushing(true);
            const res = await api.pushProductMetafields(product.id, pushStoreId || undefined);
            alert(`Push started: ${res.data?.jobId}`);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setPushing(false);
        }
    };

    const getStoreValidation = (storeId: string) => {
        if (!validation?.stores) return null;
        return validation.stores.find((s: any) => s.storeId === storeId);
    };

    return (
        <div>
            {/* Push controls */}
            <div style={{
                display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16,
                padding: '10px 14px', background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8,
            }}>
                <span style={{ color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>Push metafields to:</span>
                <select value={pushStoreId} onChange={e => setPushStoreId(e.target.value)} style={{
                    padding: '6px 10px', background: '#0f172a', border: '1px solid #334155',
                    borderRadius: 6, color: '#e2e8f0', fontSize: 12, flex: 1,
                }}>
                    <option value="">All Stores</option>
                    {stores.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.storeName}</option>
                    ))}
                </select>
                <button onClick={handlePush} disabled={pushing} style={{
                    padding: '6px 14px', background: pushing ? '#334155' : 'linear-gradient(135deg, #6366f1, #818cf8)',
                    border: 'none', borderRadius: 6, color: '#fff', fontWeight: 600, cursor: 'pointer',
                    fontSize: 12, opacity: pushing ? 0.6 : 1,
                }}>
                    {pushing ? 'Pushing...' : '🚀 Push'}
                </button>
            </div>

            {pubs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    No store publications yet
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {pubs.map((pub: any) => {
                        const sv = getStoreValidation(pub.store?.id);
                        const prices = (pub.variantPublications || [])
                            .map((vp: any) => vp.currentPrice || vp.colorway?.price)
                            .filter(Boolean)
                            .map(Number);
                        const minPrice = prices.length ? Math.min(...prices) : null;
                        const maxPrice = prices.length ? Math.max(...prices) : null;

                        return (
                            <div key={pub.id} style={{
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: '10px', padding: '16px',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div>
                                            <div style={{ fontWeight: '600', color: '#f0f0f0', fontSize: '14px' }}>
                                                🏪 {pub.store?.storeName || 'Unknown Store'}
                                            </div>
                                            <div style={{ color: '#666', fontSize: '12px' }}>{pub.store?.shopifyDomain}</div>
                                        </div>
                                        {sv && (
                                            <span style={{
                                                padding: '3px 8px', borderRadius: 4, fontSize: 11,
                                                background: sv.isValid ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                                color: sv.isValid ? '#22c55e' : '#ef4444',
                                            }}>
                                                {sv.isValid ? '✓ Valid' : `⛔ ${sv.missingRequired?.length || 0} missing`}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {minPrice !== null && (
                                            <span style={{ color: '#60a5fa', fontSize: 13, fontWeight: 600 }}>
                                                {minPrice === maxPrice ? `$${minPrice}` : `$${minPrice} – $${maxPrice}`}
                                            </span>
                                        )}
                                        <span style={{
                                            padding: '4px 10px', borderRadius: '6px', fontSize: '12px',
                                            background: pub.storeStatus === 'active' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                            color: pub.storeStatus === 'active' ? '#22c55e' : '#ef4444',
                                        }}>
                                            {pub.storeStatus}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <InfoRow label="Store Title" value={pub.storeTitle} />
                                    <InfoRow label="Handle" value={pub.handle} />
                                    <InfoRow label="Shopify Product ID" value={pub.shopifyProductId?.toString()} />
                                    <InfoRow label="Variants Published" value={pub.variantPublications?.length || 0} />
                                </div>
                                {sv && !sv.isValid && sv.missingRequired?.length > 0 && (
                                    <div style={{
                                        marginTop: 8, padding: '6px 10px', borderRadius: 6,
                                        background: 'rgba(239,68,68,0.06)', fontSize: 12, color: '#fca5a5',
                                    }}>
                                        Missing: {sv.missingRequired.map((f: any) => `${f.namespace}.${f.key}`).join(', ')}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Product Maps */}
            {product.productMaps && product.productMaps.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                    <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>Shopify Mappings</div>
                    <div style={{
                        background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '12px',
                    }}>
                        {product.productMaps.map((m: any) => (
                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
                                <span style={{ color: '#888' }}>{m.store?.shopifyDomain}</span>
                                <span style={{ color: '#60a5fa' }}>ID: {m.shopifyProductId?.toString()}</span>
                                <span style={{ color: '#666' }}>Synced: {m.syncedAt ? new Date(m.syncedAt).toLocaleDateString() : '—'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function MetafieldsTab({ product }: { product: Product }) {
    const [values, setValues] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!product.id) return;
        setLoading(true);
        api.getMetafieldValues('PRODUCT', product.id)
            .then((res: any) => setValues(res.data || []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [product.id]);

    const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
        DRAFT: { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8' },
        PENDING_REVIEW: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24' },
        APPROVED: { bg: 'rgba(52,211,153,0.1)', color: '#34d399' },
        REJECTED: { bg: 'rgba(252,165,165,0.1)', color: '#fca5a5' },
    };

    if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading metafields...</div>;

    if (values.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏷️</div>
                <p>No metafield values set for this product yet.</p>
                <p style={{ fontSize: '13px', color: '#555' }}>Add values in the <strong>Metafields Library</strong> page.</p>
            </div>
        );
    }

    const grouped: Record<string, any[]> = {};
    for (const v of values) {
        const ns = v.definition?.namespace || 'custom';
        if (!grouped[ns]) grouped[ns] = [];
        grouped[ns].push(v);
    }

    return (
        <div>
            {Object.entries(grouped).map(([ns, items]) => (
                <div key={ns} style={{ marginBottom: 20 }}>
                    <div style={{
                        color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                        letterSpacing: '0.5px', marginBottom: 8,
                    }}>
                        {ns}
                    </div>
                    <div style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 10, overflow: 'hidden',
                    }}>
                        {items.map((v: any, i: number) => {
                            const badge = STATUS_BADGE[v.status] || STATUS_BADGE.DRAFT;
                            return (
                                <div key={v.id} style={{
                                    padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
                                    borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ color: '#e2e8f0', fontSize: 13, fontFamily: 'monospace' }}>
                                            {v.definition?.key}
                                        </div>
                                        {v.definition?.label && (
                                            <div style={{ color: '#64748b', fontSize: 11 }}>{v.definition.label}</div>
                                        )}
                                    </div>
                                    <div style={{ color: '#ccc', fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {typeof v.valueJson === 'string' ? v.valueJson : JSON.stringify(v.valueJson)}
                                    </div>
                                    <span style={{ color: '#64748b', fontSize: 11 }}>
                                        {v.store?.storeName || '🌐'}
                                    </span>
                                    <span style={{
                                        padding: '2px 8px', borderRadius: 4, fontSize: 10,
                                        background: badge.bg, color: badge.color,
                                    }}>
                                        {v.status.replace('_', ' ')}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

function LogsTab({ product }: { product: Product }) {
    return (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
            <p>Sync logs for this product will appear here after import jobs run.</p>
            <p style={{ fontSize: '13px', color: '#555' }}>Go to <strong>Jobs</strong> page for detailed job logs.</p>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
    return (
        <div>
            <div style={{ color: '#555', fontSize: '11px', marginBottom: '2px' }}>{label}</div>
            <div style={{ color: '#ccc', fontSize: '13px' }}>{value || '—'}</div>
        </div>
    );
}

// ─── Styles ──────────────────────────────
const thStyle: React.CSSProperties = {
    padding: '12px 16px', color: '#666', fontSize: '12px', fontWeight: '500',
    textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)',
};

const tdStyle: React.CSSProperties = {
    padding: '12px 16px', color: '#ccc', fontSize: '13px',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
};

const thSmStyle: React.CSSProperties = {
    ...thStyle, padding: '8px 12px', fontSize: '11px',
};

const tdSmStyle: React.CSSProperties = {
    ...tdStyle, padding: '8px 12px', fontSize: '12px',
};

const filterSelectStyle: React.CSSProperties = {
    padding: '10px 14px',
    background: '#1a1a2e',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    color: '#f0f0f0',
    fontSize: '14px',
};

const pgBtnStyle: React.CSSProperties = {
    padding: '8px 16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#ccc',
    fontSize: '13px',
    cursor: 'pointer',
};
