// Quick test — just check statuses
(async () => {
    const BASE = 'https://api.inecso.com';
    const lr = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@ins.vn', password: 'Admin123' }),
    });
    const ld = await lr.json();
    const t = ld.data?.token;

    const tests = [
        'products?page=1&limit=1',
        'products/summary',
        'product-variants?page=1&limit=1',
        'products/sync-jobs?page=1&limit=1',
        'products/issues?page=1&limit=1',
    ];
    for (const ep of tests) {
        const r = await fetch(`${BASE}/api/v1/${ep}`, { headers: { Authorization: `Bearer ${t}` } });
        console.log(`${r.status} ${ep}`);
    }
})();
