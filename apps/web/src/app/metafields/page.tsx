'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

const OWNER_TYPES = ['PRODUCT', 'VARIANT'];
const METAFIELD_TYPES = [
    'single_line_text_field', 'multi_line_text_field', 'number_integer', 'number_decimal',
    'boolean', 'json', 'color', 'date', 'date_time', 'url', 'money',
    'list.single_line_text_field', 'list.color', 'list.number_integer',
    'metaobject_reference', 'list.metaobject_reference',
    'file_reference', 'list.file_reference',
];

export default function MetafieldsPage() {
    const [tab, setTab] = useState<'catalog' | 'product' | 'definitions'>('catalog');

    // ── Options Library state (shared between catalog & product tabs) ──
    const [catalogDefs, setCatalogDefs] = useState<any[]>([]);
    const [productDefs, setProductDefs] = useState<any[]>([]);
    const [expandedDef, setExpandedDef] = useState<string | null>(null);
    const [newOptionValue, setNewOptionValue] = useState('');
    const [bulkInput, setBulkInput] = useState('');
    const [showBulk, setShowBulk] = useState<string | null>(null);
    const [optLoading, setOptLoading] = useState<string | null>(null);

    // ── Definitions state ──
    const [definitions, setDefinitions] = useState<any[]>([]);
    const [filterOwner, setFilterOwner] = useState('');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editDef, setEditDef] = useState<any>(null);
    const [formData, setFormData] = useState({
        namespace: 'custom', key: '', type: 'single_line_text_field',
        ownerType: 'PRODUCT', label: '', description: '',
    });

    // ── Sync state ──
    const [syncing, setSyncing] = useState(false);
    const [syncMsg, setSyncMsg] = useState('');

    // ── Fetch options-enriched definitions ──
    const fetchCatalogDefs = useCallback(async () => {
        try {
            const res = await api.getDefinitionsWithOptions({ hasCatalogSchema: 'true' });
            setCatalogDefs(res.data || []);
        } catch { }
    }, []);

    const fetchProductDefs = useCallback(async () => {
        try {
            const res = await api.getDefinitionsWithOptions({ hasCatalogSchema: 'false' });
            setProductDefs(res.data || []);
        } catch { }
    }, []);

    const fetchDefinitions = useCallback(async () => {
        try {
            setLoading(true);
            const params: Record<string, string> = {};
            if (filterOwner) params.ownerType = filterOwner;
            const res = await api.getMetafieldDefinitions(params);
            setDefinitions(res.data || []);
        } catch { } finally { setLoading(false); }
    }, [filterOwner]);

    useEffect(() => {
        if (tab === 'catalog') fetchCatalogDefs();
        else if (tab === 'product') fetchProductDefs();
        else fetchDefinitions();
    }, [tab, fetchCatalogDefs, fetchProductDefs, fetchDefinitions]);

    // ── Option handlers ──
    const handleAddOption = async (defId: string) => {
        if (!newOptionValue.trim()) return;
        try {
            await api.addMetafieldOption(defId, newOptionValue.trim());
            setNewOptionValue('');
            if (tab === 'catalog') fetchCatalogDefs(); else fetchProductDefs();
        } catch (err: any) { alert(err.message); }
    };

    const handleRemoveOption = async (optId: string) => {
        try {
            await api.removeMetafieldOption(optId);
            if (tab === 'catalog') fetchCatalogDefs(); else fetchProductDefs();
        } catch (err: any) { alert(err.message); }
    };

    const handleBulkAdd = async (defId: string) => {
        if (!bulkInput.trim()) return;
        const values = bulkInput.split('\n').map(v => v.trim()).filter(Boolean);
        try {
            const res = await api.bulkAddMetafieldOptions(defId, values);
            setBulkInput(''); setShowBulk(null);
            if (tab === 'catalog') fetchCatalogDefs(); else fetchProductDefs();
            alert(`Added ${res.data.created} options, ${res.data.skipped} already existed`);
        } catch (err: any) { alert(err.message); }
    };

    const handleAutoPopulate = async (defId: string) => {
        if (!confirm('Scan Shopify products to discover values for this metafield? This may take a moment.')) return;
        setOptLoading(defId);
        try {
            const res = await api.autoPopulateMetafieldOptions(defId);
            if (tab === 'catalog') fetchCatalogDefs(); else fetchProductDefs();
            alert(`Discovered ${res.data.discovered} unique values, ${res.data.created} new options added`);
        } catch (err: any) { alert(err.message); }
        finally { setOptLoading(null); }
    };

    const handleToggleRequired = async (def: any) => {
        await api.updateMetafieldDefinition(def.id, { isRequired: !def.isRequired });
        if (tab === 'catalog') fetchCatalogDefs();
        else if (tab === 'product') fetchProductDefs();
        else fetchDefinitions();
    };

    const handleToggleActive = async (def: any) => {
        await api.updateMetafieldDefinition(def.id, { isActive: !def.isActive });
        fetchDefinitions();
    };

    // ── Definition CRUD ──
    const handleCreate = async () => {
        try {
            if (editDef) {
                await api.updateMetafieldDefinition(editDef.id, { label: formData.label, description: formData.description });
            } else {
                await api.createMetafieldDefinition(formData);
            }
            setShowModal(false); setEditDef(null);
            fetchDefinitions();
        } catch (err: any) { alert(err.message); }
    };

    const openEdit = (def: any) => {
        setEditDef(def);
        setFormData({ namespace: def.namespace, key: def.key, type: def.type, ownerType: def.ownerType, label: def.label || '', description: def.description || '' });
        setShowModal(true);
    };

    const openCreate = () => {
        setEditDef(null);
        setFormData({ namespace: 'custom', key: '', type: 'single_line_text_field', ownerType: 'PRODUCT', label: '', description: '' });
        setShowModal(true);
    };

    // ── Sync definitions ──
    const handleSync = async () => {
        setSyncing(true); setSyncMsg('');
        try {
            const res = await api.syncMetafieldDefinitions();
            const d = res.data;
            if (d?.jobId) {
                setSyncMsg(`🔄 Sync started (job: ${d.jobId.slice(0, 8)}…) — refreshing in 5s…`);
                setTimeout(() => {
                    fetchDefinitions(); fetchCatalogDefs(); fetchProductDefs();
                    setSyncMsg('✅ Definitions refreshed');
                    setSyncing(false);
                }, 5000);
                return;
            }
            setSyncMsg(`✅ ${d.created} created, ${d.updated} updated, ${d.skipped} skipped`);
            fetchDefinitions(); fetchCatalogDefs(); fetchProductDefs();
        } catch (err: any) { setSyncMsg(`❌ ${err.message}`); }
        finally { setSyncing(false); }
    };

    // ══════════════════════════════════════════════════
    // RENDER: Options Library Row (shared for both tabs)
    // ══════════════════════════════════════════════════
    const renderDefRow = (def: any) => {
        const isExpanded = expandedDef === def.id;
        const options = def.options || [];
        const isPopulating = optLoading === def.id;

        return (
            <div key={def.id} style={{
                background: '#0f172a', borderRadius: 10, border: `1px solid ${isExpanded ? '#334155' : '#1e293b'}`,
                marginBottom: 8, overflow: 'hidden', transition: 'border-color 0.2s',
            }}>
                {/* Definition Header Row */}
                <div
                    onClick={() => { setExpandedDef(isExpanded ? null : def.id); setNewOptionValue(''); setShowBulk(null); }}
                    style={{
                        display: 'grid', gridTemplateColumns: '1fr 180px 100px 80px 70px 60px 40px',
                        gap: 8, padding: '12px 16px', cursor: 'pointer', alignItems: 'center',
                        background: isExpanded ? '#1e293b' : 'transparent',
                    }}
                >
                    <div>
                        <span style={{ color: '#a5b4fc', fontFamily: 'monospace', fontSize: 13 }}>{def.namespace}.</span>
                        <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>{def.key}</span>
                        {def.label && <span style={{ color: '#64748b', fontSize: 12, marginLeft: 8 }}>({def.label})</span>}
                    </div>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: '#1e293b', color: '#94a3b8', justifySelf: 'start' }}>{def.type}</span>
                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, background: 'rgba(129,140,248,0.1)', color: '#818cf8' }}>{def.ownerType}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{
                            width: 20, height: 20, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            background: options.length > 0 ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)',
                            color: options.length > 0 ? '#86efac' : '#64748b', fontSize: 12, fontWeight: 600,
                        }}>{options.length}</span>
                        <span style={{ color: '#64748b', fontSize: 11 }}>opts</span>
                    </div>
                    <input
                        type="checkbox" checked={def.isRequired || false}
                        onChange={e => { e.stopPropagation(); handleToggleRequired(def); }}
                        onClick={e => e.stopPropagation()}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#f59e0b' }}
                        title={def.isRequired ? 'Required' : 'Optional'}
                    />
                    <span style={{ color: isExpanded ? '#818cf8' : '#64748b', fontSize: 16, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▼</span>
                </div>

                {/* Expanded: Options Management */}
                {isExpanded && (
                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid #334155' }}>
                        {/* Action bar */}
                        <div style={{ display: 'flex', gap: 8, padding: '12px 0 8px', alignItems: 'center' }}>
                            <input
                                value={newOptionValue} onChange={e => setNewOptionValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleAddOption(def.id); }}
                                placeholder="Type a value and press Enter..."
                                style={{
                                    flex: 1, padding: '8px 12px', background: '#0f172a', border: '1px solid #334155',
                                    borderRadius: 6, color: '#e2e8f0', fontSize: 13,
                                }}
                            />
                            <button onClick={() => handleAddOption(def.id)} style={{
                                padding: '8px 14px', background: '#6366f1', border: 'none', borderRadius: 6,
                                color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 12,
                            }}>+ Add</button>
                            <button onClick={() => setShowBulk(showBulk === def.id ? null : def.id)} style={{
                                padding: '8px 14px', background: '#334155', border: 'none', borderRadius: 6,
                                color: '#94a3b8', cursor: 'pointer', fontSize: 12,
                            }}>📋 Bulk</button>
                            <button onClick={() => handleAutoPopulate(def.id)} disabled={isPopulating} style={{
                                padding: '8px 14px',
                                background: isPopulating ? '#334155' : 'linear-gradient(135deg, #10b981, #059669)',
                                border: 'none', borderRadius: 6, color: '#fff', fontWeight: 600,
                                cursor: isPopulating ? 'wait' : 'pointer', fontSize: 12,
                                opacity: isPopulating ? 0.7 : 1,
                            }}>{isPopulating ? '⏳ Scanning...' : '🔍 Auto from Shopify'}</button>
                        </div>

                        {/* Bulk input */}
                        {showBulk === def.id && (
                            <div style={{ marginBottom: 8 }}>
                                <textarea
                                    value={bulkInput} onChange={e => setBulkInput(e.target.value)}
                                    placeholder="Paste values, one per line..."
                                    rows={4} style={{
                                        width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155',
                                        borderRadius: 6, color: '#e2e8f0', fontSize: 13, resize: 'vertical', marginBottom: 4,
                                    }}
                                />
                                <button onClick={() => handleBulkAdd(def.id)} style={{
                                    padding: '6px 14px', background: '#6366f1', border: 'none', borderRadius: 6,
                                    color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 12,
                                }}>Add All</button>
                            </div>
                        )}

                        {/* Options list */}
                        {options.length === 0 ? (
                            <p style={{ color: '#64748b', fontSize: 13, margin: '8px 0 0' }}>
                                No options yet. Add values manually or use "Auto from Shopify" to discover existing values.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                {options.map((opt: any) => (
                                    <span key={opt.id} style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        padding: '4px 10px', borderRadius: 6,
                                        background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)',
                                        color: '#c7d2fe', fontSize: 13,
                                    }}>
                                        {opt.label || opt.value}
                                        <button
                                            onClick={() => handleRemoveOption(opt.id)}
                                            style={{
                                                background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
                                                fontSize: 14, padding: 0, lineHeight: 1,
                                            }}
                                            title="Remove option"
                                        >×</button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // ══════════════════════════════════════════════════
    // MAIN RENDER
    // ══════════════════════════════════════════════════
    return (
        <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <span style={{ fontSize: 28 }}>🔖</span>
                <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Metafields Library</h1>
                    <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Manage allowed values for each metafield — products will select from this library</p>
                </div>
                <button onClick={handleSync} disabled={syncing} style={{
                    padding: '8px 18px',
                    background: syncing ? '#334155' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600,
                    cursor: syncing ? 'wait' : 'pointer', fontSize: 13,
                    opacity: syncing ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6,
                }}>
                    {syncing ? '⏳ Syncing...' : '🔄 Sync Definitions'}
                </button>
            </div>

            {/* Sync Message */}
            {syncMsg && (
                <div style={{
                    padding: '10px 16px', marginBottom: 16, borderRadius: 8,
                    background: syncMsg.startsWith('✅') ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                    border: `1px solid ${syncMsg.startsWith('✅') ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    color: syncMsg.startsWith('✅') ? '#86efac' : '#fca5a5', fontSize: 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <span>{syncMsg}</span>
                    <button onClick={() => setSyncMsg('')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14 }}>✕</button>
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid #334155' }}>
                {([
                    { key: 'catalog', label: '📋 Catalog Metafields', count: catalogDefs.length },
                    { key: 'product', label: '📦 Product Metafields', count: productDefs.length },
                    { key: 'definitions', label: '⚙️ All Definitions' },
                ] as const).map(t => (
                    <button key={t.key} onClick={() => setTab(t.key as any)} style={{
                        padding: '10px 20px', background: 'none', border: 'none',
                        color: tab === t.key ? '#818cf8' : '#94a3b8',
                        borderBottom: tab === t.key ? '2px solid #818cf8' : '2px solid transparent',
                        fontWeight: tab === t.key ? 600 : 400, cursor: 'pointer', fontSize: 14,
                        display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                        {t.label}
                        {'count' in t && t.count > 0 && (
                            <span style={{ padding: '1px 6px', borderRadius: 10, fontSize: 11, background: 'rgba(129,140,248,0.15)', color: '#818cf8' }}>{t.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ════════════ CATALOG METAFIELDS TAB ════════════ */}
            {tab === 'catalog' && (
                <div>
                    <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
                        Metafields driven by product taxonomy/category. Click a row to manage allowed values.
                    </p>

                    {/* Column headers */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 180px 100px 80px 70px 60px 40px',
                        gap: 8, padding: '8px 16px', marginBottom: 4,
                    }}>
                        {['METAFIELD', 'TYPE', 'OWNER', 'OPTIONS', 'REQ', 'EXPAND'].slice(0, -1).map(h => (
                            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                        ))}
                    </div>

                    {catalogDefs.length === 0 ? (
                        <div style={{ background: '#0f172a', borderRadius: 12, border: '1px solid #1e293b', padding: '40px 20px', textAlign: 'center' }}>
                            <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                            <p style={{ color: '#64748b', fontSize: 13 }}>No catalog metafields assigned to categories yet. Go to "All Definitions" → assign definitions to categories via Catalog Schemas.</p>
                        </div>
                    ) : catalogDefs.map(renderDefRow)}
                </div>
            )}

            {/* ════════════ PRODUCT METAFIELDS TAB ════════════ */}
            {tab === 'product' && (
                <div>
                    <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
                        Custom product metafields. Click a row to manage allowed values for products to choose from.
                    </p>

                    {/* Column headers */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 180px 100px 80px 70px 60px 40px',
                        gap: 8, padding: '8px 16px', marginBottom: 4,
                    }}>
                        {['METAFIELD', 'TYPE', 'OWNER', 'OPTIONS', 'REQ', ''].map(h => (
                            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                        ))}
                    </div>

                    {productDefs.length === 0 ? (
                        <div style={{ background: '#0f172a', borderRadius: 12, border: '1px solid #1e293b', padding: '40px 20px', textAlign: 'center' }}>
                            <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
                            <p style={{ color: '#64748b', fontSize: 13 }}>No product metafield definitions found. Sync from Shopify first.</p>
                        </div>
                    ) : productDefs.map(renderDefRow)}
                </div>
            )}

            {/* ════════════ ALL DEFINITIONS TAB ════════════ */}
            {tab === 'definitions' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)}
                                style={{ padding: '6px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13 }}>
                                <option value="">All Owner Types</option>
                                {OWNER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <span style={{ color: '#64748b', fontSize: 12 }}>{definitions.length} definitions</span>
                        </div>
                        <button onClick={openCreate} style={{
                            padding: '8px 16px', background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                            border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13,
                        }}>+ New Definition</button>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
                    ) : definitions.length === 0 ? (
                        <div style={{ background: '#0f172a', borderRadius: 12, border: '1px solid #1e293b', padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                            No definitions found. Sync from Shopify or create one manually.
                        </div>
                    ) : (
                        <div style={{ background: '#0f172a', borderRadius: 12, border: '1px solid #1e293b', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                                        {['NAMESPACE', 'KEY', 'TYPE', 'OWNER', 'LABEL', 'REQUIRED', 'VALUES', 'ACTIVE', 'ACTIONS'].map(h => (
                                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {definitions.map((def: any) => (
                                        <tr key={def.id} style={{ borderBottom: '1px solid #1e293b22' }}>
                                            <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 13, fontFamily: 'monospace' }}>{def.namespace}</td>
                                            <td style={{ padding: '10px 14px', color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{def.key}</td>
                                            <td style={{ padding: '10px 14px' }}>
                                                <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: '#1e293b', color: '#94a3b8' }}>{def.type}</span>
                                            </td>
                                            <td style={{ padding: '10px 14px' }}>
                                                <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: 'rgba(129,140,248,0.1)', color: '#818cf8' }}>{def.ownerType}</span>
                                            </td>
                                            <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 13 }}>{def.label || '—'}</td>
                                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                                <input type="checkbox" checked={def.isRequired || false}
                                                    onChange={() => handleToggleRequired(def)}
                                                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#f59e0b' }} />
                                            </td>
                                            <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 13 }}>{def._count?.values || 0}</td>
                                            <td style={{ padding: '10px 14px' }}>
                                                <span onClick={() => handleToggleActive(def)} style={{
                                                    padding: '2px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                                                    background: def.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)',
                                                    color: def.isActive ? '#86efac' : '#94a3b8',
                                                }}>{def.isActive ? 'Active' : 'Inactive'}</span>
                                            </td>
                                            <td style={{ padding: '10px 14px' }}>
                                                <button onClick={() => openEdit(def)} style={{
                                                    padding: '4px 10px', background: '#1e293b', border: '1px solid #334155',
                                                    borderRadius: 4, color: '#e2e8f0', cursor: 'pointer', fontSize: 12,
                                                }}>Edit</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ════════════ CREATE/EDIT MODAL ════════════ */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                }} onClick={() => setShowModal(false)}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: '#1e293b', borderRadius: 16, padding: 28, width: 480, border: '1px solid #334155',
                    }}>
                        <h3 style={{ color: '#e2e8f0', marginBottom: 20 }}>{editDef ? 'Edit Definition' : 'New Metafield Definition'}</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                            <div>
                                <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Namespace</label>
                                <input value={formData.namespace} onChange={e => setFormData({ ...formData, namespace: e.target.value })}
                                    disabled={!!editDef} style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13 }} />
                            </div>
                            <div>
                                <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Key</label>
                                <input value={formData.key} onChange={e => setFormData({ ...formData, key: e.target.value })}
                                    disabled={!!editDef} style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13 }} />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                            <div>
                                <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Type</label>
                                <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    disabled={!!editDef} style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13 }}>
                                    {METAFIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Owner Type</label>
                                <select value={formData.ownerType} onChange={e => setFormData({ ...formData, ownerType: e.target.value })}
                                    disabled={!!editDef} style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13 }}>
                                    {OWNER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Label</label>
                            <input value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })}
                                placeholder="Human-readable name" style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13 }} />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Description</label>
                            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                                rows={2} style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, resize: 'vertical' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowModal(false)} style={{
                                padding: '8px 20px', background: '#334155', border: 'none', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontSize: 13,
                            }}>Cancel</button>
                            <button onClick={handleCreate} style={{
                                padding: '8px 20px', background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                                border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13,
                            }}>{editDef ? 'Save' : 'Create'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
