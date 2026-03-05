const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
require('dotenv').config();
const prisma = new PrismaClient();

function decrypt(e, i) {
    const k = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const v = Buffer.from(i, 'hex');
    const d = crypto.createDecipheriv('aes-256-cbc', k, v);
    return d.update(e, 'hex', 'utf8') + d.final('utf8');
}

async function main() {
    const stores = await prisma.shopifyStore.findMany({ orderBy: { storeName: 'asc' } });
    console.log('Found ' + stores.length + ' stores\n');

    for (const s of stores) {
        console.log('== ' + s.storeName + ' (' + s.shopifyDomain + ') active:' + s.isActive + ' secret:' + !!s.webhookSecret);
        if (!s.isActive) { console.log('  SKIPPED\n'); continue; }
        const t = decrypt(s.accessTokenEnc, s.tokenIv);
        const r = await fetch('https://' + s.shopifyDomain + '/admin/api/' + s.apiVersion + '/webhooks.json', { headers: { 'X-Shopify-Access-Token': t } });
        const d = await r.json();
        const wh = d.webhooks || [];
        if (!wh.length) { console.log('  !! NO WEBHOOKS REGISTERED !!'); }
        else { wh.forEach(w => console.log('  ' + w.topic + ' -> ' + w.address)); }
        console.log('');
    }

    const ev = await prisma.webhookEvent.findMany({ take: 5, orderBy: { createdAt: 'desc' }, select: { topic: true, status: true, createdAt: true, errorMessage: true } });
    console.log('Last 5 webhook events in DB:');
    if (!ev.length) console.log('  NONE — no webhook events received!');
    else ev.forEach(e => console.log('  ' + e.createdAt.toISOString() + ' | ' + e.topic + ' | ' + e.status + (e.errorMessage ? ' ERR:' + e.errorMessage : '')));

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
