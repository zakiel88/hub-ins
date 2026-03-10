// Check the actual 'name' column constraint in products table
(async () => {
    const BASE = 'https://api.inecso.com';
    const lr = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@ins.vn', password: 'Admin123' }),
    });
    const ld = await lr.json();
    const t = ld.data?.token;

    // Use the debug endpoint to check columns
    const dr = await fetch(`${BASE}/api/v1/products/debug`, {
        headers: { Authorization: `Bearer ${t}` },
    });
    const db = await dr.json();
    console.log('Debug response:');
    console.log(JSON.stringify(db, null, 2));
})();
