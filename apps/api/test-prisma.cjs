// Minimal test
(async () => {
    const B = 'https://api.inecso.com';
    const l = await (await fetch(`${B}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@ins.vn', password: 'Admin123' }) })).json();
    const t = l.data?.token;
    if (!t) { console.log('FAIL'); return; }
    for (const [n, u] of [['products', '/api/v1/products?page=1&limit=1'], ['summary', '/api/v1/products/summary'], ['variants', '/api/v1/product-variants?page=1&limit=1'], ['sync-jobs', '/api/v1/products/sync-jobs?page=1&limit=1'], ['issues', '/api/v1/products/issues?page=1&limit=1']]) {
        const r = await fetch(`${B}${u}`, { headers: { Authorization: `Bearer ${t}` } });
        console.log(`${r.status === 200 ? 'OK' : 'FAIL'} ${n}: ${r.status}`);
    }
})();
