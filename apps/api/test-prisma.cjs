// Test production - check if the new tables exist and what the actual error is
(async () => {
    const BASE = 'https://api.inecso.com';

    // Login
    const loginRes = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@ins.vn', password: 'Admin123' }),
    });
    const loginData = await loginRes.json();
    const token = loginData.data.token;

    // Test stores (we know this works)
    const storesRes = await fetch(`${BASE}/api/v1/shopify-stores?isActive=true`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    const stores = await storesRes.json();
    console.log('Active stores:', stores.data?.length, stores.data?.map(s => s.storeName));

    // Test products with full error visibility
    console.log('\n--- Testing endpoints ---');

    // Try sync-jobs (simpler endpoint)
    const jobRes = await fetch(`${BASE}/api/v1/products/sync-jobs?page=1&limit=1`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log('Sync Jobs:', jobRes.status, await jobRes.text().then(t => t.substring(0, 200)));

    // Try product issues
    const issuesRes = await fetch(`${BASE}/api/v1/products/issues?page=1&limit=1`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log('Issues:', issuesRes.status, await issuesRes.text().then(t => t.substring(0, 200)));

    // Try product-variants  
    const varRes = await fetch(`${BASE}/api/v1/product-variants?page=1&limit=1`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log('Variants:', varRes.status, await varRes.text().then(t => t.substring(0, 200)));

    // Let's try an explicit products count
    const prodRes = await fetch(`${BASE}/api/v1/products?page=1&limit=1&sortBy=createdAt&sortDir=desc`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log('Products:', prodRes.status, await prodRes.text().then(t => t.substring(0, 500)));
})();
