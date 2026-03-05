/**
 * Sync orders từ Shopify store Happy → INS Hub DB
 * Run: npx ts-node prisma/sync-shopify-orders.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function decrypt(encrypted: string, ivHex: string): string {
    const key = Buffer.from(
        process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        'hex',
    );
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

interface ShopifyOrder {
    id: number;
    order_number: number;
    name: string;
    email: string;
    phone: string | null;
    financial_status: string;
    fulfillment_status: string | null;
    total_price: string;
    currency: string;
    created_at: string;
    customer: {
        first_name: string;
        last_name: string;
        email: string;
        phone: string | null;
    } | null;
    shipping_address: {
        first_name: string;
        last_name: string;
        address1: string;
        address2: string | null;
        city: string;
        province: string;
        country: string;
        country_code: string;
        zip: string;
        phone: string | null;
    } | null;
    line_items: Array<{
        id: number;
        variant_id: number | null;
        title: string;
        sku: string | null;
        quantity: number;
        price: string;
        vendor: string;
    }>;
    tags: string;
    note: string | null;
}

function detectFlags(order: ShopifyOrder): Record<string, boolean> {
    const flags: Record<string, boolean> = {};
    const addr = order.shipping_address;

    if (!addr) {
        flags.address_missing = true;
        return flags;
    }
    if (!addr.phone && !order.phone && !order.customer?.phone) {
        flags.phone_missing = true;
    }
    if (!addr.address1) {
        flags.address_issue = true;
    }
    if (!addr.city) {
        flags.city_missing = true;
    }
    return flags;
}

function determinePipelineState(flags: Record<string, boolean>): string {
    const hasIssues = Object.keys(flags).length > 0;
    return hasIssues ? 'NEEDS_CX' : 'READY_FOR_MER';
}

async function main() {
    // 1. Tìm store Happy
    const store = await prisma.shopifyStore.findFirst({ where: { isActive: true } });
    if (!store) {
        console.log('❌ Không tìm thấy store active');
        return;
    }
    console.log(`\n🏪 Store: ${store.storeName} (${store.shopifyDomain})`);
    const token = decrypt(store.accessTokenEnc, store.tokenIv);

    // 2. Fetch 10 orders từ Shopify
    const url = `https://${store.shopifyDomain}/admin/api/${store.apiVersion}/orders.json?limit=10&status=any`;
    console.log(`📡 Đang kéo orders: ${url}\n`);

    const res = await fetch(url, {
        headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
        console.error(`❌ Shopify API lỗi: ${res.status}`);
        console.error(await res.text());
        return;
    }

    const data: any = await res.json();
    const shopifyOrders: ShopifyOrder[] = data.orders || [];
    console.log(`✅ Nhận ${shopifyOrders.length} orders từ Shopify\n`);

    // 3. Upsert từng order vào DB
    let created = 0;
    let updated = 0;

    for (const so of shopifyOrders) {
        const flags = detectFlags(so);
        const pipelineState = determinePipelineState(flags);
        const customerName = so.customer
            ? `${so.customer.first_name || ''} ${so.customer.last_name || ''}`.trim()
            : null;
        const customerPhone = so.shipping_address?.phone || so.phone || so.customer?.phone || null;

        const shippingAddress = so.shipping_address
            ? {
                address1: so.shipping_address.address1,
                address2: so.shipping_address.address2,
                city: so.shipping_address.city,
                province: so.shipping_address.province,
                country: so.shipping_address.country,
                countryCode: so.shipping_address.country_code,
                zip: so.shipping_address.zip,
                firstName: so.shipping_address.first_name,
                lastName: so.shipping_address.last_name,
            }
            : null;

        // Upsert order
        const order = await prisma.order.upsert({
            where: {
                uq_order_store_shopify: {
                    shopifyStoreId: store.id,
                    shopifyOrderId: BigInt(so.id),
                },
            },
            update: {
                status: so.fulfillment_status === 'fulfilled' ? 'closed' : 'open',
                financialStatus: so.financial_status,
                fulfillmentStatus: so.fulfillment_status,
                customerEmail: so.email || so.customer?.email,
                customerName,
                customerPhone,
                shippingAddress: shippingAddress || Prisma.JsonNull,
                shippingCountry: so.shipping_address?.country_code || null,
                shippingCity: so.shipping_address?.city || null,
                // Don't overwrite pipeline state if already progressed
            },
            create: {
                shopifyStoreId: store.id,
                shopifyOrderId: BigInt(so.id),
                orderNumber: so.name || `#${so.order_number}`,
                status: so.fulfillment_status === 'fulfilled' ? 'closed' : 'open',
                financialStatus: so.financial_status,
                fulfillmentStatus: so.fulfillment_status,
                customerEmail: so.email || so.customer?.email,
                customerName,
                customerPhone,
                shippingAddress: shippingAddress || Prisma.JsonNull,
                shippingCountry: so.shipping_address?.country_code || null,
                shippingCity: so.shipping_address?.city || null,
                pipelineState,
                flags,
                notes: so.note,
                shopifyRawPayload: so as any,
                totalPrice: parseFloat(so.total_price),
                currency: so.currency,
                orderDate: new Date(so.created_at),
            },
        });

        // Check if just created
        const isNew = order.createdAt.getTime() > Date.now() - 2000;
        if (isNew) {
            created++;
            // Create line items
            for (const li of so.line_items) {
                // Try to map SKU to internal colorway
                let colorwayId: string | null = null;
                let mappingStatus = 'UNMAPPED';

                if (li.sku) {
                    const colorway = await prisma.colorway.findUnique({
                        where: { sku: li.sku },
                    });
                    if (colorway) {
                        colorwayId = colorway.id;
                        mappingStatus = 'MAPPED';
                    }
                }

                await prisma.orderLineItem.create({
                    data: {
                        orderId: order.id,
                        shopifyLineItemId: BigInt(li.id),
                        shopifyVariantId: li.variant_id ? BigInt(li.variant_id) : null,
                        title: li.title,
                        sku: li.sku,
                        quantity: li.quantity,
                        unitPrice: parseFloat(li.price),
                        totalPrice: parseFloat(li.price) * li.quantity,
                        colorwayId,
                        mappingStatus,
                        itemState: 'PENDING',
                    },
                });
            }
        } else {
            updated++;
        }

        const stateIcon = pipelineState === 'NEEDS_CX' ? '⚠️' : '✅';
        console.log(
            `${stateIcon} ${order.orderNumber} | $${so.total_price} ${so.currency} | ${customerName || 'N/A'} | ${so.shipping_address?.country_code || '??'} | ${pipelineState} | ${so.line_items.length} items`,
        );
    }

    // 4. Update lastSyncAt
    await prisma.shopifyStore.update({
        where: { id: store.id },
        data: { lastSyncAt: new Date() },
    });

    console.log(`\n═══════════════════════════════════════`);
    console.log(`📊 Kết quả: ${created} mới, ${updated} đã tồn tại`);
    console.log(`═══════════════════════════════════════`);

    // 5. Show DB summary
    const totalOrders = await prisma.order.count();
    const byState = await prisma.order.groupBy({
        by: ['pipelineState'],
        _count: true,
    });
    console.log(`\n📈 Tổng orders trong DB: ${totalOrders}`);
    for (const s of byState) {
        console.log(`   ${s.pipelineState}: ${s._count}`);
    }

    await prisma.$disconnect();
}

main().catch((e) => {
    console.error(e);
    prisma.$disconnect();
});
