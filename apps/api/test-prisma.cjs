// Comprehensive schema check - get ALL columns + constraints for ALL product-related tables
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

    // Query ALL product-related tables with their column details including is_nullable
    const tables = ['products', 'product_variants', 'variant_groups', 'shopify_product_maps', 
                     'shopify_variant_maps', 'product_sync_jobs', 'product_sync_logs', 
                     'product_issues', 'product_images', 'product_validation_states'];
    
    for (const table of tables) {
        console.log(`\n=== ${table} ===`);
        const r = await fetch(`${BASE}/api/v1/products/debug`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                query: `SELECT column_name, data_type, is_nullable, column_default 
                        FROM information_schema.columns 
                        WHERE table_name = '${table}' 
                        ORDER BY ordinal_position`
            }),
        });
        if (r.status !== 200) {
            // Try GET debug endpoint instead
            console.log(`  (status: ${r.status})`);
            continue;
        }
        const d = await r.json();
        console.log(JSON.stringify(d.data || d, null, 2));
    }
})();
