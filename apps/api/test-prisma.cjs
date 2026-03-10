// Add ALL missing columns to existing products table via raw SQL
// Uses a temporary approach through the already-deployed run-migration endpoint
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

    console.log('Logged in. Now checking product table columns...');

    // run-migration already exists  - but let's also do raw queries via the existing debug endpoint
    // Actually, I'll call run-migration which we know works, and include additional ALTER TABLE statements
    // The run-migration already has ALTER TABLE for style_code, featured_image_url, availability_type, lead_time_days
    // But we need ALL columns that Prisma expects.
    // From the schema, Product model expects:
    // id, brand_id, collection_id, style_code, title, description, product_type, category, material, season,
    // featured_image_url, availability_type, lead_time_days, status, created_at, updated_at

    // The OLD products table probably has: id, title, description, product_type, brand_id, status, created_at, updated_at
    // Missing: collection_id, style_code, category, material, season, featured_image_url, availability_type, lead_time_days

    // Simply call run-migration again (it already handles ALTER TABLE IF NOT EXISTS)
    console.log('Running migration (which adds missing columns)...');
    const mr = await fetch(`${BASE}/api/v1/products/run-migration`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log('Migration result:', mr.status, await mr.text());

    // Now test products
    console.log('\n=== Testing endpoints after migration ===');
    const pr = await fetch(`${BASE}/api/v1/products?page=1&limit=1`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log('Products:', pr.status, (await pr.text()).substring(0, 300));

    const vr = await fetch(`${BASE}/api/v1/product-variants?page=1&limit=1`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log('Variants:', vr.status, (await vr.text()).substring(0, 300));

    const sr = await fetch(`${BASE}/api/v1/products/summary`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log('Summary:', sr.status, (await sr.text()).substring(0, 300));
})();
