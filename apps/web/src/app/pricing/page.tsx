'use client';

export default function PricingPage() {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: 'calc(100vh - 200px)', padding: 40, textAlign: 'center',
        }}>
            <div style={{
                background: 'var(--bg-surface, rgba(255,255,255,0.03))',
                border: '1px solid var(--border, rgba(255,255,255,0.08))',
                borderRadius: 16, padding: '48px 40px', maxWidth: 480,
            }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 12px' }}>
                    Pricing Management
                </h1>
                <div style={{ color: '#f59e0b', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                    Coming Soon
                </div>
                <p style={{ color: '#888', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                    Advanced pricing engine with market-specific rules, approval workflows, and price publishing.
                    This module will be built after Products Management is fully operational.
                </p>
                <div style={{
                    marginTop: 24, padding: '10px 20px', background: 'rgba(99,102,241,0.1)',
                    border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8,
                    color: '#818cf8', fontSize: 12,
                }}>
                    For now, vendor cost and discount can be managed per-variant in the Products module.
                </div>
            </div>
        </div>
    );
}
