// Full test: run migration then test all endpoints
(async () => {
    const BASE = 'https://api.inecso.com';
    const lr = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@ins.vn', password: 'Admin123' }),
    });
    const ld = await lr.json();
    const token = ld.data?.token;
    if (!token) { console.log('Login failed'); return; }
    console.log('✅ Logged in\n');

    // Run migration (includes enum type conversions if new code deployed)
    console.log('🔧 Running migration...');
    const mr = await fetch(`${BASE}/api/v1/products/run-migration`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    const mb = await mr.json();
    console.log(`Migration: ${mb.data.ok}/${mb.data.total} OK, ${mb.data.fail} failed`);
    if (mb.data.errors?.length) console.log('Errors:', mb.data.errors);

    // Test ALL endpoints
    const tests = [
        ['Products', '/api/v1/products?page=1&limit=1'],
        ['Summary', '/api/v1/products/summary'],
        ['Variants', '/api/v1/product-variants?page=1&limit=1'],
        ['SyncJobs', '/api/v1/products/sync-jobs?page=1&limit=1'],
        ['Issues', '/api/v1/products/issues?page=1&limit=1'],
    ];
    console.log('\n📦 Testing endpoints:');
    for (const [name, url] of tests) {
        const r = await fetch(`${BASE}${url}`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        const status = r.status === 200 ? '✅' : '❌';
        console.log(`  ${status} ${name}: ${r.status} — ${(await r.text()).substring(0, 150)}`);
    }
})();
