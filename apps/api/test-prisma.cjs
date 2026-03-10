// Quick production diagnostic
(async () => {
    const BASE = 'https://api.inecso.com';
    // Login
    const lr = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@ins.vn', password: 'Admin123' }),
    });
    if (!lr.ok) { console.log('API down - login failed:', lr.status); return; }
    const ld = await lr.json();
    if (!ld.data?.token) { console.log('No token'); return; }
    const token = ld.data.token;

    // Check debug endpoint
    const dr = await fetch(`${BASE}/api/v1/products/debug`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log('Debug:', dr.status);
    if (dr.ok) {
        const body = await dr.json();
        console.log(JSON.stringify(body, null, 2));
    } else {
        console.log('Debug response:', await dr.text());
    }

    // Also check health for timestamp
    const hr = await fetch(`${BASE}/api/v1/health`);
    console.log('\nHealth:', await hr.json());
})();
