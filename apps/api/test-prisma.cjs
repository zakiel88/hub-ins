// Run migration (with new direct DROP NOT NULL), then test creating a product
(async () => {
    const BASE = 'https://api.inecso.com';
    const lr = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@ins.vn', password: 'Admin123' }),
    });
    const ld = await lr.json();
    const t = ld.data?.token;
    if (!t) { console.log('Login failed'); return; }

    // Run migration  
    console.log('=== Running migration ===');
    const mr = await fetch(`${BASE}/api/v1/products/run-migration`, {
        method: 'POST', headers: { Authorization: `Bearer ${t}` },
    });
    const mb = await mr.json();
    console.log(`Result: ${mb.data?.ok}/${mb.data?.total} OK, ${mb.data?.fail} failed`);
    if (mb.data?.fail > 0) {
        console.log('ERRORS:');
        for (const e of mb.data.errors) {
            console.log('  -', e.substring(0, 150));
        }
    }

    // Quick test all endpoints
    console.log('\n=== Endpoint status ===');
    for (const [n,u] of [['products','/api/v1/products?page=1&limit=1'],['summary','/api/v1/products/summary'],['variants','/api/v1/product-variants?page=1&limit=1']]) {
        const r = await fetch(`${BASE}${u}`, { headers: { Authorization: `Bearer ${t}` } });
        console.log(`${r.status===200?'OK':'FAIL'} ${n}: ${r.status}`);
    }
})();
