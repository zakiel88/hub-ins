// Wait for deploy, run migration, trigger sync, poll result
(async () => {
    const B = 'https://api.inecso.com';

    // 1. Wait for deploy
    console.log('Waiting 5 min for Railway deploy...');
    await new Promise(r => setTimeout(r, 5 * 60 * 1000));
    
    // 2. Login
    const lr = await fetch(`${B}/api/v1/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email:'admin@ins.vn',password:'Admin123'})});
    const t = (await lr.json()).data?.token;
    if (!t) { console.log('Login failed'); return; }

    // 3. Run migration
    console.log('=== Run migration ===');
    const mr = await fetch(`${B}/api/v1/products/run-migration`, { method:'POST', headers:{Authorization:`Bearer ${t}`}});
    const mb = await mr.json();
    console.log(`Result: ${mb.data?.ok}/${mb.data?.total} OK, ${mb.data?.fail} failed`);
    if (mb.data?.fail > 0) { console.log('ERRORS:'); for(const e of (mb.data?.errors || [])) console.log('  -',e?.substring(0,200)); }

    // 4. Quick check: shopify_variant_maps columns  
    console.log('\n=== shopify_variant_maps columns ===');
    try {
        const dr = await fetch(`${B}/api/v1/products/debug`, { 
            method: 'POST',
            headers:{Authorization:`Bearer ${t}`, 'Content-Type':'application/json'},
            body: JSON.stringify({ query: `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='shopify_variant_maps' ORDER BY ordinal_position` })
        });
        if (dr.status === 200) {
            const dd = await dr.json();
            for (const c of (dd.data || [])) console.log(`  ${c.column_name}: nullable=${c.is_nullable}`);
        } else {
            console.log('  debug POST not available, status:', dr.status);
        }
    } catch(e) { console.log('  debug failed'); }

    // 5. Test sync
    console.log('\n=== Trigger sync ===');
    const sr = await fetch(`${B}/api/v1/shopify-stores?isActive=true`, {headers:{Authorization:`Bearer ${t}`}});
    const stores = (await sr.json()).data;
    const tinh = stores?.find(s => s.storeName.includes('TINH'));
    if (tinh) {
        console.log(`Syncing from: ${tinh.storeName}`);
        const syncR = await fetch(`${B}/api/v1/products/sync/${tinh.id}`, { method:'POST', headers:{Authorization:`Bearer ${t}`}});
        const syncD = await syncR.json();
        console.log('Sync response:', syncR.status, JSON.stringify(syncD).substring(0,300));
        
        if (syncD.data?.jobId) {
            const jobId = syncD.data.jobId;
            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 5000));
                const jr = await fetch(`${B}/api/v1/products/sync-jobs/${jobId}`, {headers:{Authorization:`Bearer ${t}`}});
                const jd = await jr.json();
                const j = jd.data;
                const processed = (j.created||0)+(j.updated||0)+(j.skipped||0);
                console.log(`  [${i+1}] status=${j.status} processed=${processed}/${j.totalItems} failed=${j.failed}`);
                if (j.status === 'success' || j.status === 'failed') break;
            }
        }
    }
})();
