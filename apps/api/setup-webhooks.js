/**
 * Register Shopify webhooks for Happy store
 * Topics: orders/create, orders/updated, orders/cancelled
 * 
 * NOTE: For local dev, you need ngrok or similar tunnel.
 * For production, set WEBHOOK_URL env var to your public URL.
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

async function main() {
    const store = await prisma.shopifyStore.findFirst({
        where: { storeName: { contains: 'Happy', mode: 'insensitive' } },
    });
    if (!store) { console.log('Store not found'); return; }

    const token = decrypt(store.accessTokenEnc, store.tokenIv);
    console.log('Store:', store.storeName, store.shopifyDomain);

    // Get callback URL
    const webhookUrl = process.env.WEBHOOK_URL || process.argv[2];
    if (!webhookUrl) {
        console.log('\n⚠️  No webhook URL provided.');
        console.log('Usage: node setup-webhooks.js https://your-public-url.ngrok.io/api/v1/webhooks/shopify');
        console.log('Or set WEBHOOK_URL in .env');
        console.log('\nTo set up ngrok for local dev:');
        console.log('  1. Install ngrok: npm install -g ngrok');
        console.log('  2. Run: ngrok http 3001');
        console.log('  3. Copy the https URL and run this script again');

        // List existing webhooks
        console.log('\n📋 Existing webhooks:');
        const listRes = await fetch(
            `https://${store.shopifyDomain}/admin/api/${store.apiVersion}/webhooks.json`,
            { headers: { 'X-Shopify-Access-Token': token } },
        );
        const listData = await listRes.json();
        const hooks = listData.webhooks || [];
        if (hooks.length === 0) {
            console.log('  (none registered)');
        } else {
            for (const h of hooks) {
                console.log(`  ${h.topic} → ${h.address} (id: ${h.id})`);
            }
        }
        await prisma.$disconnect();
        return;
    }

    // Generate webhook secret if not set
    let webhookSecret = store.webhookSecret;
    if (!webhookSecret) {
        webhookSecret = crypto.randomBytes(32).toString('hex');
        await prisma.shopifyStore.update({
            where: { id: store.id },
            data: { webhookSecret },
        });
        console.log('Generated webhook secret:', webhookSecret.substring(0, 10) + '...');
    }

    // List existing webhooks first
    const listRes = await fetch(
        `https://${store.shopifyDomain}/admin/api/${store.apiVersion}/webhooks.json`,
        { headers: { 'X-Shopify-Access-Token': token } },
    );
    const listData = await listRes.json();
    const existingHooks = listData.webhooks || [];
    console.log(`\n📋 Existing webhooks: ${existingHooks.length}`);

    // Delete old webhooks
    for (const h of existingHooks) {
        console.log(`  Deleting: ${h.topic} → ${h.address}`);
        await fetch(
            `https://${store.shopifyDomain}/admin/api/${store.apiVersion}/webhooks/${h.id}.json`,
            { method: 'DELETE', headers: { 'X-Shopify-Access-Token': token } },
        );
    }

    // Register new webhooks
    console.log('\n📡 Registering webhooks...');
    for (const topic of WEBHOOK_TOPICS) {
        const res = await fetch(
            `https://${store.shopifyDomain}/admin/api/${store.apiVersion}/webhooks.json`,
            {
                method: 'POST',
                headers: {
                    'X-Shopify-Access-Token': token,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    webhook: {
                        topic,
                        address: webhookUrl,
                        format: 'json',
                    },
                }),
            },
        );

        const data = await res.json();
        if (res.ok) {
            console.log(`  ✅ ${topic} → ${webhookUrl} (id: ${data.webhook?.id})`);
        } else {
            console.log(`  ❌ ${topic}: ${JSON.stringify(data.errors || data)}`);
        }
    }

    // Verify
    console.log('\n📋 Final webhook list:');
    const verifyRes = await fetch(
        `https://${store.shopifyDomain}/admin/api/${store.apiVersion}/webhooks.json`,
        { headers: { 'X-Shopify-Access-Token': token } },
    );
    const verifyData = await verifyRes.json();
    for (const h of verifyData.webhooks || []) {
        console.log(`  ${h.topic} → ${h.address}`);
    }

    console.log('\n✅ Done!');
    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
