'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function CatalogPage() {
    const [collections, setCollections] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [colorways, setColorways] = useState<any[]>([]);
    const [brands, setBrands] = useState<any[]>([]);
    const [tab, setTab] = useState<'collections' | 'products' | 'colorways'>('collections');
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [meta, setMeta] = useState<any>(null);

    // Create modals
    const [showCreate, setShowCreate] = useState(false);
    const [saving, setSaving] = useState(false);
    const [collectionForm, setCollectionForm] = useState({ brandId: '', name: '', season: '', year: '' });
    const [productForm, setProductForm] = useState({ collectionId: '', name: '', skuPrefix: '', category: '', material: '', wholesalePrice: '' });
    const [colorwayForm, setColorwayForm] = useState({ productId: '', sku: '', color: '', size: '', barcode: '' });

    const load = async () => {
        setLoading(true);
        try {
            const params = search ? { search } : undefined;
            if (tab === 'collections') {
                const res = await api.getCollections(params);
                setCollections(res.data);
                setMeta(res.meta);
            } else if (tab === 'products') {
                const res = await api.getProducts(params);
                setProducts(res.data);
                setMeta(res.meta);
            } else {
                const res = await api.getColorways(params);
                setColorways(res.data);
                setMeta(res.meta);
            }
        } catch {
            window.location.href = '/login';
        } finally {
            setLoading(false);
        }
    };

    const loadBrands = async () => {
        try { const res = await api.getBrands(); setBrands(res.data); } catch { /* */ }
    };

    useEffect(() => { load(); }, [tab]);
    useEffect(() => { loadBrands(); }, []);

    const openCreate = () => {
        setShowCreate(true);
        if (tab === 'products' && collections.length === 0) load();
    };

    const handleCreateCollection = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.createCollection(collectionForm.brandId, {
                name: collectionForm.name,
                season: collectionForm.season || undefined,
                year: collectionForm.year ? parseInt(collectionForm.year) : undefined,
            });
            setShowCreate(false);
            setCollectionForm({ brandId: '', name: '', season: '', year: '' });
            load();
        } catch (err: any) { alert(err.message); }
        finally { setSaving(false); }
    };

    const handleCreateProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.createProduct(productForm.collectionId, {
                name: productForm.name,
                skuPrefix: productForm.skuPrefix || undefined,
                category: productForm.category || undefined,
                material: productForm.material || undefined,
                wholesalePrice: productForm.wholesalePrice ? parseFloat(productForm.wholesalePrice) : undefined,
            });
            setShowCreate(false);
            setProductForm({ collectionId: '', name: '', skuPrefix: '', category: '', material: '', wholesalePrice: '' });
            load();
        } catch (err: any) { alert(err.message); }
        finally { setSaving(false); }
    };

    const handleCreateColorway = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.createColorway(colorwayForm.productId, {
                sku: colorwayForm.sku,
                color: colorwayForm.color,
                size: colorwayForm.size,
                barcode: colorwayForm.barcode || undefined,
            });
            setShowCreate(false);
            setColorwayForm({ productId: '', sku: '', color: '', size: '', barcode: '' });
            load();
        } catch (err: any) { alert(err.message); }
        finally { setSaving(false); }
    };

    return (
        <>
            <div className="page-header">
                <div className="page-header-row">
                    <div>
                        <h1 className="page-title">Catalog</h1>
                        <p className="page-subtitle">Collections, products & colorways</p>
                    </div>
                    <button className="btn-primary btn-sm" onClick={openCreate}>
                        + New {tab === 'collections' ? 'Collection' : tab === 'products' ? 'Product' : 'Colorway'}
                    </button>
                </div>
            </div>

            <div className="page-content">
                <div className="tab-bar">
                    {(['collections', 'products', 'colorways'] as const).map((t) => (
                        <button key={t} className={`tab-item ${tab === t ? 'tab-active' : ''}`}
                            onClick={() => { setTab(t); setSearch(''); }}>
                            {t === 'collections' ? '📁 Collections' : t === 'products' ? '📦 Products' : '🎨 Colorways'}
                        </button>
                    ))}
                </div>

                <div className="toolbar">
                    <div className="search-box">
                        <input className="form-input" placeholder={`Search ${tab}…`}
                            value={search} onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && load()} />
                        <button className="btn-ghost" onClick={load}>Search</button>
                    </div>
                    {meta && <div className="toolbar-meta">{meta.total} {tab}</div>}
                </div>

                {loading ? (
                    <div className="page-loading"><div className="spinner" /></div>
                ) : tab === 'collections' ? (
                    collections.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📁</div>
                            <div className="empty-state-text">No collections yet. Create your first collection.</div>
                        </div>
                    ) : (
                        <div className="table-wrap">
                            <table className="data-table">
                                <thead><tr><th>Collection</th><th>Brand</th><th>Season</th><th>Year</th><th>Products</th><th>Status</th></tr></thead>
                                <tbody>
                                    {collections.map((c) => (
                                        <tr key={c.id}>
                                            <td><div className="cell-primary">{c.name}</div></td>
                                            <td><code className="code-tag">{c.brand?.code}</code></td>
                                            <td>{c.season || '—'}</td>
                                            <td>{c.year || '—'}</td>
                                            <td>{c._count?.products ?? 0}</td>
                                            <td><span className="status-badge badge-success">{c.status}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : tab === 'products' ? (
                    products.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📦</div>
                            <div className="empty-state-text">No products yet. Add a product to a collection.</div>
                        </div>
                    ) : (
                        <div className="table-wrap">
                            <table className="data-table">
                                <thead><tr><th>Product</th><th>SKU Prefix</th><th>Collection</th><th>Brand</th><th>Category</th><th>Wholesale</th><th>Colorways</th></tr></thead>
                                <tbody>
                                    {products.map((p) => (
                                        <tr key={p.id}>
                                            <td><div className="cell-primary">{p.name}</div></td>
                                            <td><code className="code-tag">{p.skuPrefix || '—'}</code></td>
                                            <td>{p.collection?.name}</td>
                                            <td><code className="code-tag">{p.collection?.brand?.code}</code></td>
                                            <td>{p.category || '—'}</td>
                                            <td className="cell-mono">{p.wholesalePrice ? `$${p.wholesalePrice}` : '—'}</td>
                                            <td>{p._count?.colorways ?? 0}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    colorways.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">🎨</div>
                            <div className="empty-state-text">No colorways yet. Add variants to a product.</div>
                        </div>
                    ) : (
                        <div className="table-wrap">
                            <table className="data-table">
                                <thead><tr><th>SKU</th><th>Product</th><th>Color</th><th>Size</th><th>Barcode</th><th>Prices</th><th>Inventory</th><th>Status</th></tr></thead>
                                <tbody>
                                    {colorways.map((cw) => (
                                        <tr key={cw.id}>
                                            <td><code className="code-tag">{cw.sku}</code></td>
                                            <td>{cw.product?.name}</td>
                                            <td>
                                                <span className="color-chip" style={{
                                                    background: cw.color?.toLowerCase() === 'white' ? '#fff' :
                                                        cw.color?.toLowerCase() === 'black' ? '#333' :
                                                            cw.color?.toLowerCase() || '#888',
                                                }} />
                                                {cw.color}
                                            </td>
                                            <td>{cw.size}</td>
                                            <td className="cell-muted">{cw.barcode || '—'}</td>
                                            <td>{cw._count?.marketPrices ?? 0}</td>
                                            <td>{cw._count?.inventoryItems ?? 0}</td>
                                            <td><span className="status-badge badge-success">{cw.status}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>

            {/* Create Collection Modal */}
            {showCreate && tab === 'collections' && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">New Collection</h2>
                            <button className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
                        </div>
                        <form onSubmit={handleCreateCollection}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Brand *</label>
                                    <select className="form-select" required value={collectionForm.brandId}
                                        onChange={(e) => setCollectionForm({ ...collectionForm, brandId: e.target.value })}>
                                        <option value="">Select brand…</option>
                                        {brands.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Collection Name *</label>
                                    <input className="form-input" required value={collectionForm.name}
                                        onChange={(e) => setCollectionForm({ ...collectionForm, name: e.target.value })} />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Season</label>
                                        <select className="form-select" value={collectionForm.season}
                                            onChange={(e) => setCollectionForm({ ...collectionForm, season: e.target.value })}>
                                            <option value="">—</option>
                                            <option value="SS">SS (Spring/Summer)</option>
                                            <option value="FW">FW (Fall/Winter)</option>
                                            <option value="Resort">Resort</option>
                                            <option value="Pre-Fall">Pre-Fall</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Year</label>
                                        <input className="form-input" type="number" placeholder="2025" value={collectionForm.year}
                                            onChange={(e) => setCollectionForm({ ...collectionForm, year: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                                <button type="submit" className="btn-primary btn-sm" disabled={saving}>
                                    {saving ? 'Creating…' : 'Create Collection'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Product Modal */}
            {showCreate && tab === 'products' && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">New Product</h2>
                            <button className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
                        </div>
                        <form onSubmit={handleCreateProduct}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Collection *</label>
                                    <select className="form-select" required value={productForm.collectionId}
                                        onChange={(e) => setProductForm({ ...productForm, collectionId: e.target.value })}>
                                        <option value="">Select collection…</option>
                                        {collections.map((c) => <option key={c.id} value={c.id}>{c.brand?.code} — {c.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Product Name *</label>
                                    <input className="form-input" required value={productForm.name}
                                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">SKU Prefix</label>
                                        <input className="form-input" placeholder="e.g. NK-AF1" value={productForm.skuPrefix}
                                            onChange={(e) => setProductForm({ ...productForm, skuPrefix: e.target.value.toUpperCase() })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Category</label>
                                        <select className="form-select" value={productForm.category}
                                            onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}>
                                            <option value="">—</option>
                                            <option value="footwear">Footwear</option>
                                            <option value="apparel">Apparel</option>
                                            <option value="accessories">Accessories</option>
                                            <option value="bags">Bags</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Material</label>
                                        <input className="form-input" value={productForm.material}
                                            onChange={(e) => setProductForm({ ...productForm, material: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Wholesale Price</label>
                                        <input className="form-input" type="number" step="0.01" placeholder="0.00" value={productForm.wholesalePrice}
                                            onChange={(e) => setProductForm({ ...productForm, wholesalePrice: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                                <button type="submit" className="btn-primary btn-sm" disabled={saving}>
                                    {saving ? 'Creating…' : 'Create Product'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Colorway Modal */}
            {showCreate && tab === 'colorways' && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">New Colorway</h2>
                            <button className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
                        </div>
                        <form onSubmit={handleCreateColorway}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Product *</label>
                                    <select className="form-select" required value={colorwayForm.productId}
                                        onChange={(e) => setColorwayForm({ ...colorwayForm, productId: e.target.value })}>
                                        <option value="">Select product…</option>
                                        {products.map((p) => <option key={p.id} value={p.id}>{p.collection?.brand?.code} — {p.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">SKU *</label>
                                        <input className="form-input" required placeholder="e.g. NK-AF1-WHT-42" value={colorwayForm.sku}
                                            onChange={(e) => setColorwayForm({ ...colorwayForm, sku: e.target.value.toUpperCase() })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Barcode</label>
                                        <input className="form-input" value={colorwayForm.barcode}
                                            onChange={(e) => setColorwayForm({ ...colorwayForm, barcode: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Color *</label>
                                        <input className="form-input" required placeholder="e.g. White" value={colorwayForm.color}
                                            onChange={(e) => setColorwayForm({ ...colorwayForm, color: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Size *</label>
                                        <input className="form-input" required placeholder="e.g. 42" value={colorwayForm.size}
                                            onChange={(e) => setColorwayForm({ ...colorwayForm, size: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                                <button type="submit" className="btn-primary btn-sm" disabled={saving}>
                                    {saving ? 'Creating…' : 'Create Colorway'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
