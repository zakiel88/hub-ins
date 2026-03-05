'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

export default function JobsPage() {
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<any>(null);
    const [selectedJob, setSelectedJob] = useState<any>(null);
    const [showModal, setShowModal] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');

    const fetchJobs = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {};
            if (statusFilter) params.status = statusFilter;
            const res = await api.getJobs(params);
            setJobs(res.data || []);
        } catch (err) {
            console.warn('Failed to load jobs');
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchJobs();
        loadSummary();
    }, [fetchJobs]);

    const loadSummary = async () => {
        try {
            const res = await api.getJobsSummary();
            setSummary(res);
        } catch { }
    };

    const openJob = async (job: any) => {
        try {
            const res = await api.getJob(job.id);
            setSelectedJob(res.data);
        } catch {
            setSelectedJob(job);
        }
        setShowModal(true);
    };

    const handleRetry = async (jobId: string) => {
        try {
            await api.retryJob(jobId);
            fetchJobs();
            setShowModal(false);
        } catch (err) {
            alert('Retry failed');
        }
    };

    const statusColor = (status: string) => {
        switch (status) {
            case 'running': return { bg: 'rgba(59,130,246,0.1)', color: '#60a5fa' };
            case 'success': return { bg: 'rgba(34,197,94,0.1)', color: '#22c55e' };
            case 'failed': return { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' };
            case 'pending': return { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' };
            default: return { bg: 'rgba(255,255,255,0.04)', color: '#888' };
        }
    };

    return (
        <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#f0f0f0', margin: '0 0 8px' }}>
                ⚙️ Sync Jobs
            </h1>
            <p style={{ color: '#888', marginBottom: '24px', fontSize: '14px' }}>
                Import jobs, metafield writes, and sync operations
            </p>

            {/* Summary */}
            {summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
                    {[
                        { label: 'Total', val: summary.total, icon: '📊', color: '#3b82f6' },
                        { label: 'Running', val: summary.running, icon: '🔄', color: '#60a5fa' },
                        { label: 'Success', val: summary.success, icon: '✅', color: '#22c55e' },
                        { label: 'Failed', val: summary.failed, icon: '❌', color: '#ef4444' },
                        { label: 'Pending', val: summary.pending, icon: '⏳', color: '#f59e0b' },
                    ].map((s) => (
                        <div key={s.label} style={{
                            background: `${s.color}08`, border: `1px solid ${s.color}20`,
                            borderRadius: '10px', padding: '14px 16px',
                        }}>
                            <div style={{ color: '#888', fontSize: '11px' }}>{s.label}</div>
                            <div style={{ color: '#f0f0f0', fontSize: '22px', fontWeight: '700' }}>{s.icon} {s.val}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Filter */}
            <div style={{ marginBottom: '16px' }}>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                        padding: '10px 16px', background: '#1a1a2e',
                        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px',
                        color: '#f0f0f0', fontSize: '13px',
                    }}
                >
                    <option value="">All Status</option>
                    <option value="running">Running</option>
                    <option value="success">Success</option>
                    <option value="failed">Failed</option>
                    <option value="pending">Pending</option>
                </select>
            </div>

            {/* Jobs Table */}
            <div style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px', overflow: 'hidden',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <th style={thS}>Type</th>
                            <th style={thS}>Store</th>
                            <th style={thS}>Status</th>
                            <th style={thS}>Progress</th>
                            <th style={thS}>Started</th>
                            <th style={thS}>Duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Loading...</td></tr>
                        ) : jobs.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No jobs yet</td></tr>
                        ) : jobs.map((job) => {
                            const sc = statusColor(job.status);
                            const duration = job.startedAt && job.completedAt
                                ? `${Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)}s`
                                : job.startedAt ? 'Running...' : '—';

                            return (
                                <tr key={job.id} onClick={() => openJob(job)} style={{
                                    cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)',
                                    transition: 'background 0.15s',
                                }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <td style={tdS}>
                                        <span style={{ color: '#93c5fd', fontSize: '13px' }}>
                                            {job.jobType === 'import_products' ? '📥 Import' : '📝 Metafields'}
                                        </span>
                                    </td>
                                    <td style={tdS}>{job.store?.storeName || '—'}</td>
                                    <td style={tdS}>
                                        <span style={{
                                            padding: '4px 10px', borderRadius: '6px', fontSize: '12px',
                                            background: sc.bg, color: sc.color, fontWeight: '500',
                                        }}>{job.status}</span>
                                    </td>
                                    <td style={tdS}>
                                        <span style={{ color: '#22c55e' }}>{job.processed}</span>
                                        {job.failed > 0 && <span style={{ color: '#ef4444' }}> / {job.failed} ✗</span>}
                                        <span style={{ color: '#666' }}> / {job.totalItems}</span>
                                    </td>
                                    <td style={tdS}>
                                        <span style={{ color: '#888', fontSize: '12px' }}>
                                            {job.startedAt ? new Date(job.startedAt).toLocaleString() : '—'}
                                        </span>
                                    </td>
                                    <td style={tdS}>
                                        <span style={{ color: '#888', fontSize: '12px' }}>{duration}</span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Job Detail Modal */}
            {showModal && selectedJob && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
                    backdropFilter: 'blur(4px)',
                }} onClick={() => setShowModal(false)}>
                    <div style={{
                        background: '#12121a', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '16px', width: '700px', maxHeight: '80vh', overflow: 'auto', padding: '24px',
                    }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <h2 style={{ margin: 0, color: '#f0f0f0', fontSize: '18px' }}>
                                {selectedJob.jobType === 'import_products' ? '📥 Import Job' : '📝 Metafields Job'}
                            </h2>
                            <button onClick={() => setShowModal(false)} style={{
                                background: 'none', border: 'none', color: '#888', fontSize: '20px', cursor: 'pointer',
                            }}>✕</button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                            <div><span style={{ color: '#666', fontSize: '11px' }}>Store</span><div style={{ color: '#ccc', fontSize: '13px' }}>{selectedJob.store?.storeName || '—'}</div></div>
                            <div><span style={{ color: '#666', fontSize: '11px' }}>Status</span><div style={{ color: statusColor(selectedJob.status).color, fontSize: '13px', fontWeight: '600' }}>{selectedJob.status}</div></div>
                            <div><span style={{ color: '#666', fontSize: '11px' }}>Processed</span><div style={{ color: '#22c55e', fontSize: '13px' }}>{selectedJob.processed} / {selectedJob.totalItems}</div></div>
                            <div><span style={{ color: '#666', fontSize: '11px' }}>Failed</span><div style={{ color: '#ef4444', fontSize: '13px' }}>{selectedJob.failed}</div></div>
                        </div>

                        {selectedJob.errorMsg && (
                            <div style={{
                                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                                borderRadius: '8px', padding: '12px', marginBottom: '16px',
                            }}>
                                <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Error</div>
                                <div style={{ color: '#fca5a5', fontSize: '12px' }}>{selectedJob.errorMsg}</div>
                            </div>
                        )}

                        {/* Logs */}
                        {selectedJob.logs && selectedJob.logs.length > 0 && (
                            <div>
                                <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>Logs ({selectedJob.logs.length})</div>
                                <div style={{
                                    background: '#0a0a0f', borderRadius: '8px', padding: '12px',
                                    maxHeight: '300px', overflow: 'auto', fontFamily: 'monospace',
                                }}>
                                    {selectedJob.logs.map((log: any, i: number) => (
                                        <div key={i} style={{
                                            padding: '4px 0', fontSize: '11px', borderBottom: '1px solid rgba(255,255,255,0.02)',
                                            color: log.level === 'error' ? '#ef4444' : log.level === 'warn' ? '#f59e0b' : '#888',
                                        }}>
                                            <span style={{ color: '#555', marginRight: '8px' }}>
                                                {new Date(log.createdAt).toLocaleTimeString()}
                                            </span>
                                            <span style={{
                                                padding: '1px 4px', borderRadius: '3px', fontSize: '10px', marginRight: '6px',
                                                background: log.level === 'error' ? 'rgba(239,68,68,0.1)' : log.level === 'warn' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.02)',
                                            }}>{log.level}</span>
                                            {log.message}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Retry button */}
                        {selectedJob.status === 'failed' && (
                            <div style={{ marginTop: '16px', textAlign: 'right' }}>
                                <button onClick={() => handleRetry(selectedJob.id)} style={{
                                    padding: '8px 20px', background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                    border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px',
                                    fontWeight: '600', cursor: 'pointer',
                                }}>
                                    🔄 Retry Job
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

const thS: React.CSSProperties = {
    padding: '12px 16px', color: '#666', fontSize: '12px', fontWeight: '500',
    textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center',
};

const tdS: React.CSSProperties = {
    padding: '12px 16px', color: '#ccc', fontSize: '13px', textAlign: 'center',
};
