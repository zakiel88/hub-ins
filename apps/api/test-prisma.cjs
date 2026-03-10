// Test individual summary queries to find which one fails
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

    // Test the debug endpoint which has findMany
    const dr = await fetch(`${BASE}/api/v1/products/debug`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log('Debug:', dr.status, await dr.text());

    // Test products (OK)
    const pr = await fetch(`${BASE}/api/v1/products?page=1&limit=1`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log('\nProducts:', pr.status);

    // Test summary
    const sr = await fetch(`${BASE}/api/v1/products/summary`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log('Summary:', sr.status, await sr.text());

    // Test variants
    const vr = await fetch(`${BASE}/api/v1/product-variants?page=1&limit=1`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log('Variants:', vr.status, await vr.text());

    // Test sync-jobs (should be OK)
    const jr = await fetch(`${BASE}/api/v1/products/sync-jobs?page=1&limit=1`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log('SyncJobs:', jr.status);

    // Test issues (should be OK)
    const ir = await fetch(`${BASE}/api/v1/products/issues?page=1&limit=1`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log('Issues:', ir.status);
})();
