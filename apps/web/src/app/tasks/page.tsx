'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const TYPE_LABELS: Record<string, string> = {
    CX_VERIFY: 'Xác minh KH (CX)',
    MER_REVIEW: 'Kiểm tra hàng (MER)',
};

const STATUS_LABELS: Record<string, string> = {
    OPEN: 'Chờ xử lý',
    IN_PROGRESS: 'Đang thực hiện',
    DONE: 'Hoàn thành',
    BLOCKED: 'Bị chặn',
};


export default function TasksPage() {
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [summary, setSummary] = useState<any>(null);
    const [toast, setToast] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {};
            if (typeFilter) params.type = typeFilter;
            if (statusFilter) params.status = statusFilter;
            const [tRes, sRes] = await Promise.all([
                api.getTasks(Object.keys(params).length ? params : undefined),
                api.getTasksSummary(),
            ]);
            setTasks(tRes.data);
            setSummary(sRes.data);
        } catch { /* */ } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [typeFilter, statusFilter]);

    const updateStatus = async (id: string, status: string) => {
        try {
            await api.updateTaskStatus(id, status);
            setToast(`✅ Task ${STATUS_LABELS[status] || status}`);
            setTimeout(() => setToast(null), 3000);
            load();
        } catch (e: any) {
            setToast(`❌ Lỗi: ${e.message}`);
            setTimeout(() => setToast(null), 3000);
        }
    };

    const typeColors: Record<string, string> = { CX_VERIFY: '#f59e0b', MER_REVIEW: '#8b5cf6' };
    const statusColors: Record<string, string> = { OPEN: '#3b82f6', IN_PROGRESS: '#f59e0b', DONE: '#22c55e', BLOCKED: '#ef4444' };

    return (
        <div style={{ padding: 32 }}>
            {/* Toast */}
            {toast && (
                <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 20px', background: toast.startsWith('✅') ? '#10b981' : '#ef4444', color: '#fff', borderRadius: 10, fontWeight: 600, fontSize: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                    {toast}
                </div>
            )}

            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 24 }}>Tác vụ</h1>

            {/* Summary Cards — ALL clickable */}
            {summary && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                    {/* Open Tasks card — clickable to filter OPEN */}
                    <div
                        onClick={() => { setStatusFilter(statusFilter === 'OPEN' ? '' : 'OPEN'); setTypeFilter(''); }}
                        style={{
                            padding: '14px 20px', borderRadius: 10, flex: 1, cursor: 'pointer',
                            background: statusFilter === 'OPEN' ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
                            border: statusFilter === 'OPEN' ? '1px solid #3b82f6' : '1px solid transparent',
                            transition: 'all 0.2s',
                        }}
                    >
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#3b82f6' }}>{summary.openCount}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>Chờ xử lý</div>
                    </div>
                    {Object.entries(summary.byType || {}).map(([type, count]) => (
                        <div key={type} onClick={() => { setTypeFilter(typeFilter === type ? '' : type); setStatusFilter(''); }}
                            style={{
                                padding: '14px 20px', borderRadius: 10, cursor: 'pointer', flex: 1,
                                background: typeFilter === type ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                                border: typeFilter === type ? `1px solid ${typeColors[type]}` : '1px solid transparent',
                                transition: 'all 0.2s',
                            }}>
                            <div style={{ fontSize: 28, fontWeight: 700, color: typeColors[type] || '#fff' }}>{count as number}</div>
                            <div style={{ fontSize: 12, color: '#888' }}>{TYPE_LABELS[type] || type}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters — Vietnamese labels */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[
                    { value: '', label: 'Tất cả' },
                    { value: 'OPEN', label: 'Chờ xử lý' },
                    { value: 'IN_PROGRESS', label: 'Đang thực hiện' },
                    { value: 'DONE', label: 'Hoàn thành' },
                    { value: 'BLOCKED', label: 'Bị chặn' },
                ].map(s => (
                    <button key={s.value} onClick={() => setStatusFilter(s.value)} style={{
                        padding: '6px 14px',
                        background: statusFilter === s.value ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                        color: s.value ? statusColors[s.value] : '#fff',
                        border: statusFilter === s.value ? `1px solid ${s.value ? statusColors[s.value] : '#666'}` : '1px solid transparent',
                        borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    }}>
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Tasks List — with content description */}
            {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Đang tải...</div> :
                tasks.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Không có tác vụ</div> :
                    tasks.map(t => (
                        <div key={t.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 16, marginBottom: 10 }}>
                            {/* Row 1: Type + Order + Status + Actions */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: `${typeColors[t.type]}22`, color: typeColors[t.type] }}>
                                        {TYPE_LABELS[t.type] || t.type}
                                    </span>
                                    <a href={`/orders/${t.order?.id}`} style={{ color: '#3b82f6', fontWeight: 600, textDecoration: 'none', fontSize: 14 }}>{t.order?.orderNumber}</a>
                                    <span style={{ color: '#aaa', fontSize: 13 }}>{t.order?.customerName}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: `${statusColors[t.status]}22`, color: statusColors[t.status] }}>
                                        {STATUS_LABELS[t.status] || t.status}
                                    </span>
                                    {t.status === 'OPEN' && (
                                        <button onClick={() => updateStatus(t.id, 'IN_PROGRESS')} style={{ padding: '4px 12px', background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                                            ▶ Bắt đầu
                                        </button>
                                    )}
                                    {(t.status === 'OPEN' || t.status === 'IN_PROGRESS') && (
                                        <button onClick={() => updateStatus(t.id, 'DONE')} style={{ padding: '4px 12px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                                            ✓ Hoàn thành
                                        </button>
                                    )}
                                </div>
                            </div>
                            {/* Row 2: Description + Assignee + Time */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ color: '#aaa', fontSize: 12, lineHeight: 1.5 }}>
                                    {t.notes || '—'}
                                </div>
                                <div style={{ color: '#666', fontSize: 11, whiteSpace: 'nowrap', marginLeft: 16 }}>
                                    {t.assignee?.fullName || 'Chưa phân công'} · {new Date(t.createdAt).toLocaleDateString('vi-VN')}
                                </div>
                            </div>
                        </div>
                    ))
            }
        </div>
    );
}
