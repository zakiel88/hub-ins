/**
 * Quick script to fetch products from connected Shopify store
 * Run: npx ts-node prisma/fetch-shopify-products.ts
 */
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function decrypt(encrypted: string, ivHex: string): string {
    const key = Buffer.from(process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

async function main() {
    const store = await prisma.shopifyStore.findFirst({ where: { isActive: true } });
    if (!store) { console.log('❌ No active store'); return; }

    console.log(`\n🏪 Store: ${store.storeName} (${store.shopifyDomain})`);
    const token = decrypt(store.accessTokenEnc, store.tokenIv);

    // Fetch 1 product with all details
    const url = `https://${store.shopifyDomain}/admin/api/${store.apiVersion}/products.json?limit=1`;
    console.log(`📡 Fetching: ${url}\n`);

    const res = await fetch(url, {
        headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
        console.error(`❌ Error: ${res.status}`);
        console.error(await res.text());
        return;
    }

    const data: any = await res.json();
    const products = data.products || [];
    console.log(`✅ Got ${products.length} product(s)\n`);

    if (products.length > 0) {
        console.log(JSON.stringify(products[0], null, 2));
    }

    // Also fetch product count
    const countRes = await fetch(
        `https://${store.shopifyDomain}/admin/api/${store.apiVersion}/products/count.json`,
        { headers: { 'X-Shopify-Access-Token': token } },
    );
    if (countRes.ok) {
        const countData: any = await countRes.json();
        console.log(`\n📊 Total products in store: ${countData.count}`);
    }

    await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); });
