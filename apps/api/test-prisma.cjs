// Wait and test production debug endpoint
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

    // Test debug endpoint
    const debugRes = await fetch(`${BASE}/api/v1/products/debug`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log('Debug status:', debugRes.status);
    const body = await debugRes.text();
    console.log('Debug response:', body);
})();
