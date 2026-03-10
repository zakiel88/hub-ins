'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    ERROR: { label: 'Error', color: '#ef4444', bg: '#ef444422' },
    WARNING: { label: 'Warning', color: '#f59e0b', bg: '#f59e0b22' },
    INFO: { label: 'Info', color: '#3b82f6', bg: '#3b82f622' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    OPEN: { label: 'Open', color: '#ef4444', bg: '#ef444422' },
    RESOLVED: { label: 'Resolved', color: '#22c55e', bg: '#22c55e22' },
    IGNORED: { label: 'Ignored', color: '#6b7280', bg: '#6b728022' },
};

const selectStyle: React.CSSProperties = {
    padding: '8px 12px',
    background: 'var(--bg-surface, #1a1a24)',
    border: '1px solid var(--border, #2a2a38)',
    borderRadius: 8,
    color: 'var(--text-primary, #f0f0f5)',
    fontSize: 13, cursor: 'pointer',
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
    minWidth: 120,
};

export default function ProductIssuesPage() {
    const [issues, setIssues] = useState<any[]>([]);
    const [meta, setMeta] = useState<any>({});
    const [loading, setLoading] = useState(true);

    const [severity, setSeverity] = useState('');
    const [status, setStatus] = useState('OPEN');
    const [ruleCode, setRuleCode] = useState('');
    const [page, setPage] = useState(1);
    const limit = 50;

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = { page: String(page), limit: String(limit) };
            if (severity) params.severity = severity;
            if (status) params.status = status;
            if (ruleCode) params.ruleCode = ruleCode;
            const res = await api.getProductIssues(params);
            setIssues(res.data || []);
            setMeta(res.meta || {});
        } catch (e: any) {
            console.error('Failed to load issues:', e);
        } finally {
            setLoading(false);
        }
    }, [page, severity, status, ruleCode]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleResolve = async (id: string) => {
        await api.resolveIssue(id);
        fetchData();
    };

    const handleIgnore = async (id: string) => {
        await api.ignoreIssue(id);
        fetchData();
    };

    const totalPages = Math.ceil((meta.total || 0) / limit);

    return (
        <div style={{ padding: 32, maxWidth: 1400 }}>
            <div style={{ marginBottom: 16, fontSize: 13 }}>
                <Link href="/products" style={{ color: '#6366f1', textDecoration: 'none' }}>← Products</Link>
            </div>

            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0 }}>⚠ Product Issues</h1>
                <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
                    Validation issues detected by the rules engine
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} style={selectStyle}>
                    <option value="">All Status</option>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
                <select value={severity} onChange={e => { setSeverity(e.target.value); setPage(1); }} style={selectStyle}>
                    <option value="">All Severity</option>
                    {Object.entries(SEVERITY_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
                <select value={ruleCode} onChange={e => { setRuleCode(e.target.value); setPage(1); }} style={selectStyle}>
                    <option value="">All Rules</option>
                    <option value="MISSING_SKU">MISSING_SKU</option>
                    <option value="MISSING_VENDOR_COST">MISSING_VENDOR_COST</option>
                    <option value="MISSING_DISCOUNT">MISSING_DISCOUNT</option>
                    <option value="MARGIN_NEGATIVE">MARGIN_NEGATIVE</option>
                    <option value="SKU_CONFLICT_ON_IMPORT">SKU_CONFLICT_ON_IMPORT</option>
                </select>
                <div style={{ marginLeft: 'auto', color: '#666', fontSize: 12 }}>
                    {meta.total || 0} issues
                </div>
            </div>

            {/* Table */}
            <div className="table-wrap">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Rule</th>
                            <th>Severity</th>
                            <th>Product</th>
                            <th>Variant SKU</th>
                            <th>Message</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th style={{ width: 140 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#666' }}>⏳ Loading...</td></tr>
                        ) : issues.length === 0 ? (
                            <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#22c55e' }}>✓ No issues found</td></tr>
                        ) : issues.map((issue: any) => {
                            const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.WARNING;
                            const st = STATUS_CONFIG[issue.status] || STATUS_CONFIG.OPEN;
                            return (
                                <tr key={issue.id}>
                                    <td className="cell-mono" style={{ fontSize: 12, fontWeight: 600 }}>{issue.ruleCode}</td>
                                    <td><span className="status-badge" style={{ background: sev.bg, color: sev.color }}>{sev.label}</span></td>
                                    <td>
                                        {issue.product ? (
                                            <Link href={`/products/${issue.product.id}`} style={{ color: '#e0e0f0', textDecoration: 'none', fontSize: 13 }}>
                                                {issue.product.title}
                                            </Link>
                                        ) : '—'}
                                    </td>
                                    <td className="cell-mono" style={{ fontSize: 12 }}>{issue.variant?.sku || '—'}</td>
                                    <td className="cell-muted" style={{ fontSize: 12, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {issue.message}
                                    </td>
                                    <td><span className="status-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                                    <td className="cell-muted" style={{ fontSize: 12 }}>
                                        {new Date(issue.createdAt).toLocaleDateString('vi-VN')}
                                    </td>
                                    <td>
                                        {issue.status === 'OPEN' && (
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button onClick={() => handleResolve(issue.id)} style={{
                                                    padding: '4px 8px', background: '#22c55e22', border: '1px solid #22c55e44',
                                                    borderRadius: 4, color: '#22c55e', cursor: 'pointer', fontSize: 11,
                                                }}>Resolve</button>
                                                <button onClick={() => handleIgnore(issue.id)} style={{
                                                    padding: '4px 8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: 4, color: '#888', cursor: 'pointer', fontSize: 11,
                                                }}>Ignore</button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-outline"
                        style={{ opacity: page <= 1 ? 0.4 : 1 }}>← Prev</button>
                    <span style={{ padding: '6px 14px', color: '#888', fontSize: 13 }}>Page {page}/{totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-outline"
                        style={{ opacity: page >= totalPages ? 0.4 : 1 }}>Next →</button>
                </div>
            )}
        </div>
    );
}
