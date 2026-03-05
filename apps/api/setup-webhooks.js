/**
 * Setup webhooks for ALL active stores
 */
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
require('dotenv').config();

const prisma = new PrismaClient();

function decrypt(encrypted, ivHex) {
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

const WEBHOOK_TOPICS = [
    'orders/create',
    'orders/updated',
    'orders/cancelled',
    'orders/fulfilled',
];

const WEBHOOK_URL = process.argv[2] || 'https://api.inecso.com/api/v1/webhooks/shopify';

async function main() {
    // Get ALL stores
    const stores = await prisma.shopifyStore.findMany({
        orderBy: { storeName: 'asc' },
    });

    console.log(`Found ${stores.length} store(s):\n`);
    for (const s of stores) {
        console.log(`  ${s.storeName} | ${s.shopifyDomain} | active: ${s.isActive}`);
    }

    for (const store of stores) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🏪 ${store.storeName} (${store.shopifyDomain})`);

        if (!store.isActive) {
            console.log('  ⏭️  Skipped (inactive)');
            continue;
        }

        const token = decrypt(store.accessTokenEnc, store.tokenIv);

        // Test connection first
        const testRes = await fetch(
            `https://${store.shopifyDomain}/admin/api/${store.apiVersion}/shop.json`,
            { headers: { 'X-Shopify-Access-Token': token } },
        );

        if (!testRes.ok) {
            console.log(`  ❌ Token invalid (${testRes.status}) — needs reconnect`);
            continue;
        }
        console.log('  ✅ Token valid');

        // Generate webhook secret if not set
        if (!store.webhookSecret) {
            const secret = crypto.randomBytes(32).toString('hex');
            await prisma.shopifyStore.update({
                where: { id: store.id },
                data: { webhookSecret: secret },
            });
            console.log('  🔑 Generated webhook secret');
        }

        // List existing webhooks
        const listRes = await fetch(
            `https://${store.shopifyDomain}/admin/api/${store.apiVersion}/webhooks.json`,
            { headers: { 'X-Shopify-Access-Token': token } },
        );
        const listData = await listRes.json();
        const existing = listData.webhooks || [];

        // Delete old webhooks
        if (existing.length > 0) {
            console.log(`  🗑️  Removing ${existing.length} old webhook(s)`);
            for (const h of existing) {
                await fetch(
                    `https://${store.shopifyDomain}/admin/api/${store.apiVersion}/webhooks/${h.id}.json`,
                    { method: 'DELETE', headers: { 'X-Shopify-Access-Token': token } },
                );
            }
        }

        // Register new webhooks
        for (const topic of WEBHOOK_TOPICS) {
            const res = await fetch(
                `https://${store.shopifyDomain}/admin/api/${store.apiVersion}/webhooks.json`,
                {
                    method: 'POST',
                    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ webhook: { topic, address: WEBHOOK_URL, format: 'json' } }),
                },
            );
            const data = await res.json();
            if (res.ok) {
                console.log(`  ✅ ${topic}`);
            } else {
                console.log(`  ❌ ${topic}: ${JSON.stringify(data.errors || data)}`);
            }
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ Done!');
    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
