// Check actual shopify_variant_maps columns AND check _prisma_migrations
(async () => {
    const B = 'https://api.inecso.com';
    const lr = await fetch(`${B}/api/v1/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email:'admin@ins.vn',password:'Admin123'})});
    const t = (await lr.json()).data?.token;

    // Get debug info - shopify_variant_maps columns
    const dr = await fetch(`${B}/api/v1/products/debug`, { headers:{Authorization:`Bearer ${t}`}});
    const dd = await dr.json();
    
    // Find shopify_variant_maps columns in the debug response
    console.log('=== Debug data (counts) ===');
    console.log('Products:', dd.data?.productCount);
    console.log('Variants:', dd.data?.variantCount);
    console.log('VariantGroups:', dd.data?.variantGroupCount);
    
    console.log('\n=== Product columns ===');
    for (const c of dd.data?.productColumns || []) {
        console.log(`  ${c.column_name}: ${c.data_type}`);
    }
})();
