// Test: check product table columns and try specific queries
(async () => {
    const BASE = 'https://api.inecso.com';
    const lr = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@ins.vn', password: 'Admin123' }),
    });
    const ld = await lr.json();
    const token = ld.data?.token;

    // Check product table columns via debug
    const dr = await fetch(`${BASE}/api/v1/products/debug`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log('Debug full:', await dr.text());

    // Try creating a test product to see what error we get
    console.log('\n=== Trying to create a product ===');
    const cr = await fetch(`${BASE}/api/v1/products`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: 'Test Product Debug',
            styleCode: 'TST-001',
        }),
    });
    console.log('Create product:', cr.status);
    console.log(await cr.text());
})();
