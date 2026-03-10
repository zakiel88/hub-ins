'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type Step = 'upload' | 'preview' | 'committing' | 'done';

export default function ImportPage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [preview, setPreview] = useState<any>(null);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleFile = (f: File) => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
            setError('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
            return;
        }
        setFile(f);
        setError('');
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    }, []);

    const handlePreview = async () => {
        if (!file) return;
        setLoading(true);
        setError('');
        try {
            const data = await api.previewIntake(file);
            setPreview(data);
            setStep('preview');
        } catch (err: any) {
            setError(err.message || 'Preview failed');
        } finally {
            setLoading(false);
        }
    };

    const handleCommit = async () => {
        if (!file) return;
        setStep('committing');
        setError('');
        try {
            const data = await api.commitIntake(file);
            setResult(data);
            setStep('done');
        } catch (err: any) {
            setError(err.message || 'Import failed');
            setStep('preview');
        }
    };

    return (
        <div style={{ padding: '32px 40px', maxWidth: 1200 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <a href="/products" style={{ color: '#818cf8', fontSize: 14 }}>← Products</a>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>📥 Brand Intake Import</h1>
            <p style={{ color: '#94a3b8', marginBottom: 32 }}>Import products and variants from standardized brand sheets</p>

            {/* Steps indicator */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
                {['Upload', 'Preview', 'Import'].map((label, i) => {
                    const stepIdx = step === 'upload' ? 0 : step === 'preview' ? 1 : 2;
                    const isActive = i === stepIdx;
                    const isDone = i < stepIdx;
                    return (
                        <div key={label} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 16px', borderRadius: 8,
                            background: isActive ? 'rgba(129,140,248,0.15)' : isDone ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${isActive ? '#818cf8' : isDone ? '#34d399' : 'rgba(255,255,255,0.06)'}`,
                            color: isActive ? '#818cf8' : isDone ? '#34d399' : '#64748b',
                            fontSize: 13, fontWeight: 500,
                        }}>
                            <span style={{
                                width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: isActive ? '#818cf8' : isDone ? '#34d399' : 'rgba(255,255,255,0.06)',
                                color: (isActive || isDone) ? '#0f172a' : '#64748b', fontSize: 12, fontWeight: 700,
                            }}>{isDone ? '✓' : i + 1}</span>
                            {label}
                        </div>
                    );
                })}
            </div>

            {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '12px 16px', color: '#ef4444', marginBottom: 24, fontSize: 14 }}>
                    {error}
                </div>
            )}

            {/* Step 1: Upload */}
            {step === 'upload' && (
                <div style={{
                    background: 'rgba(255,255,255,0.02)', border: `2px dashed ${dragOver ? '#818cf8' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 16, padding: '64px 40px', textAlign: 'center',
                    transition: 'border-color 0.2s',
                }}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                >
                    <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
                    <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Drop your brand sheet here</p>
                    <p style={{ color: '#64748b', marginBottom: 24, fontSize: 14 }}>Supports CSV, XLSX, XLS</p>

                    <label style={{
                        display: 'inline-block', padding: '10px 24px', borderRadius: 8,
                        background: 'linear-gradient(135deg, #818cf8, #6366f1)', color: 'white',
                        fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    }}>
                        Choose File
                        <input type="file" accept=".csv,.xlsx,.xls" hidden onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                    </label>

                    {file && (
                        <div style={{ marginTop: 24, padding: 16, background: 'rgba(129,140,248,0.1)', borderRadius: 8, display: 'inline-block' }}>
                            <span style={{ fontWeight: 600 }}>{file.name}</span>
                            <span style={{ color: '#64748b', marginLeft: 12 }}>({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                    )}

                    {file && (
                        <div style={{ marginTop: 24 }}>
                            <button onClick={handlePreview} disabled={loading} style={{
                                padding: '12px 32px', borderRadius: 8, border: 'none',
                                background: 'linear-gradient(135deg, #818cf8, #6366f1)', color: 'white',
                                fontSize: 15, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
                            }}>
                                {loading ? '⏳ Analyzing...' : '🔍 Preview Import'}
                            </button>
                        </div>
                    )}

                    {/* Required columns reference */}
                    <div style={{ marginTop: 40, textAlign: 'left', maxWidth: 600, margin: '40px auto 0' }}>
                        <p style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Required columns:</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {['Brand', 'Title', 'SKU', 'Price'].map(col => (
                                <span key={col} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 12 }}>{col} *</span>
                            ))}
                            {['Product Code', 'Category', 'Color', 'Size', 'Vendor Cost', 'Image URL', 'Material', 'Season'].map(col => (
                                <span key={col} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: '#94a3b8', fontSize: 12 }}>{col}</span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Preview */}
            {step === 'preview' && preview && (
                <div>
                    {/* Summary cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
                        {[
                            { label: 'Total Rows', value: preview.summary.total, color: '#818cf8' },
                            { label: 'Valid', value: preview.summary.valid, color: '#34d399' },
                            { label: 'Errors', value: preview.summary.errors, color: '#ef4444' },
                            { label: 'Warnings', value: preview.summary.warnings, color: '#f59e0b' },
                            { label: 'Products', value: preview.productCount, color: '#06b6d4' },
                        ].map(card => (
                            <div key={card.label} style={{
                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 12, padding: '16px 20px',
                            }}>
                                <div style={{ color: '#64748b', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>{card.label}</div>
                                <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Missing headers warning */}
                    {preview.missingRequiredHeaders?.length > 0 && (
                        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#ef4444', fontSize: 14 }}>
                            ⚠️ Missing required columns: <strong>{preview.missingRequiredHeaders.join(', ')}</strong>
                        </div>
                    )}

                    {/* Mapped headers */}
                    <div style={{ marginBottom: 16 }}>
                        <p style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Detected column mappings:</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {Object.entries(preview.headerMap || {}).map(([field, header]) => (
                                <span key={field} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(52,211,153,0.1)', color: '#34d399', fontSize: 12 }}>
                                    {field} ← &quot;{String(header)}&quot;
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Rows table */}
                    <div style={{ overflowX: 'auto', maxHeight: 500, overflowY: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.03)', position: 'sticky', top: 0 }}>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Row</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>SKU</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Brand</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Title</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Color</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Size</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Price</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {preview.rows.slice(0, 100).map((row: any) => {
                                    const hasError = row.errors.length > 0;
                                    const hasWarn = row.warnings.length > 0;
                                    return (
                                        <tr key={row.rowNum} style={{
                                            borderTop: '1px solid rgba(255,255,255,0.04)',
                                            background: hasError ? 'rgba(239,68,68,0.05)' : hasWarn ? 'rgba(245,158,11,0.03)' : 'transparent',
                                        }}>
                                            <td style={{ padding: '8px 12px', color: '#64748b' }}>{row.rowNum}</td>
                                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>{row.parsed.sku || '—'}</td>
                                            <td style={{ padding: '8px 12px' }}>{row.parsed.brand || '—'}</td>
                                            <td style={{ padding: '8px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.parsed.title || '—'}</td>
                                            <td style={{ padding: '8px 12px' }}>{row.parsed.color || '—'}</td>
                                            <td style={{ padding: '8px 12px' }}>{row.parsed.size || '—'}</td>
                                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>{row.parsed.price != null ? `$${row.parsed.price.toFixed(2)}` : '—'}</td>
                                            <td style={{ padding: '8px 12px' }}>
                                                {hasError && <span style={{ color: '#ef4444', fontSize: 12 }} title={row.errors.join(', ')}>❌ {row.errors.length} error{row.errors.length > 1 ? 's' : ''}</span>}
                                                {!hasError && hasWarn && <span style={{ color: '#f59e0b', fontSize: 12 }} title={row.warnings.join(', ')}>⚠️ {row.warnings.length} warning{row.warnings.length > 1 ? 's' : ''}</span>}
                                                {!hasError && !hasWarn && <span style={{ color: '#34d399', fontSize: 12 }}>✓ Valid</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {preview.rows.length > 100 && (
                        <p style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>Showing first 100 of {preview.rows.length} rows</p>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                        <button onClick={() => { setStep('upload'); setPreview(null); setFile(null); }} style={{
                            padding: '10px 24px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                            background: 'transparent', color: '#94a3b8', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                        }}>← Back</button>
                        <button onClick={handleCommit} disabled={preview.summary.valid === 0} style={{
                            padding: '10px 32px', borderRadius: 8, border: 'none',
                            background: preview.summary.valid > 0 ? 'linear-gradient(135deg, #34d399, #059669)' : '#374151',
                            color: 'white', fontSize: 15, fontWeight: 600,
                            cursor: preview.summary.valid > 0 ? 'pointer' : 'not-allowed',
                        }}>
                            ✅ Import {preview.summary.valid} Valid Rows
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Committing */}
            {step === 'committing' && (
                <div style={{ textAlign: 'center', padding: 64 }}>
                    <div style={{ fontSize: 48, marginBottom: 16, animation: 'spin 1s linear infinite' }}>⏳</div>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Importing products...</h2>
                    <p style={{ color: '#64748b' }}>This may take a moment. Please don&apos;t close this page.</p>
                </div>
            )}

            {/* Step 4: Done */}
            {step === 'done' && result && (
                <div style={{ textAlign: 'center', padding: 48 }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
                    <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Import Complete!</h2>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, maxWidth: 600, margin: '0 auto 32px' }}>
                        {[
                            { label: 'Created', value: result.summary.created, color: '#34d399' },
                            { label: 'Updated', value: result.summary.updated, color: '#818cf8' },
                            { label: 'Failed', value: result.summary.failed, color: '#ef4444' },
                            { label: 'Products', value: result.productsAffected, color: '#06b6d4' },
                        ].map(card => (
                            <div key={card.label} style={{
                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 12, padding: '16px 20px',
                            }}>
                                <div style={{ color: '#64748b', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>{card.label}</div>
                                <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <button onClick={() => router.push('/products')} style={{
                            padding: '10px 24px', borderRadius: 8, border: 'none',
                            background: 'linear-gradient(135deg, #818cf8, #6366f1)', color: 'white',
                            fontSize: 14, fontWeight: 600, cursor: 'pointer',
                        }}>View Products</button>
                        <button onClick={() => router.push('/products/variants')} style={{
                            padding: '10px 24px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                            background: 'transparent', color: '#94a3b8', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                        }}>View Variants</button>
                        <button onClick={() => { setStep('upload'); setFile(null); setPreview(null); setResult(null); }} style={{
                            padding: '10px 24px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                            background: 'transparent', color: '#94a3b8', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                        }}>Import Another</button>
                    </div>
                </div>
            )}
        </div>
    );
}
