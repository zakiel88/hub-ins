/**
 * Shopify → INS Hub 3-Tier Sync Script (CJS version)
 * Run: cd apps/api && node prisma/sync-shopify-3tier.cjs
 */
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();
const PRODUCT_LIMIT = 50;

function decrypt(encrypted, ivHex) {
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

function encryptValue(text) {
    const key = Buffer.from(
        process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        'hex',
    );
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return { encrypted, iv: iv.toString('hex') };
}

function classifyOptions(sp) {
    const options = sp.options || [];
    const COLOR_NAMES = ['color', 'colour', 'colors', 'couleur'];
    const SIZE_NAMES = ['size', 'sizes', 'taille'];
    const MATERIAL_NAMES = ['material', 'fabric'];

    let colorOption = null, sizeOption = null, materialOption = null;

    for (const opt of options) {
        const name = (opt.name || '').toLowerCase().trim();
        if (COLOR_NAMES.some(c => name.includes(c))) colorOption = opt.name;
        else if (SIZE_NAMES.some(s => name.includes(s))) sizeOption = opt.name;
        else if (MATERIAL_NAMES.some(m => name.includes(m))) materialOption = opt.name;
    }

    if (!colorOption && !sizeOption && options.length >= 1) {
        const firstVals = (options[0]?.values || []).map(v => v.toLowerCase());
        const looksLikeSize = firstVals.some(v =>
            ['xs', 's', 'm', 'l', 'xl', 'xxl', 'os', 'one size'].includes(v) ||
            /^\d{1,2}(\.\d)?$/.test(v),
        );
        if (options.length === 1 && looksLikeSize) {
            sizeOption = options[0].name;
        } else if (options.length === 1 && options[0].name === 'Title') {
            // single-variant product — no options
        } else {
            colorOption = options[0]?.name || null;
            sizeOption = options[1]?.name || null;
            if (options.length >= 3) materialOption = options[2]?.name || null;
        }
    }
    return { colorOption, sizeOption, materialOption };
}

function getVariantOption(variant, optionName, sp) {
    if (!optionName) return null;
    const idx = (sp.options || []).findIndex(o => o.name === optionName);
    if (idx < 0) return null;
    return variant[`option${idx + 1}`] || null;
}

function generateStyleCode(title, vendor, index) {
    const vendorPart = (vendor || 'XX').replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase() || 'XX';
    const titlePart = title.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase() || 'PRD';
    return `${vendorPart}-${titlePart}-${String(index).padStart(3, '0')}`;
}

function generateSku(styleCode, color, size) {
    const colorPart = color ? color.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4) : 'NA';
    const sizePart = size ? size.toUpperCase().replace(/[^A-Z0-9.]/g, '') : 'OS';
    return `${styleCode}-${colorPart}-${sizePart}`;
}

function matchVendorToBrand(vendor, brands) {
    if (!vendor) return null;
    const v = vendor.toLowerCase().trim();
    const exact = brands.find(b => b.name.toLowerCase() === v || b.code.toLowerCase() === v);
    if (exact) return exact.id;
    const partial = brands.find(b =>
        v.includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(v),
    );
    return partial?.id || null;
}

async function main() {
    console.log('=== Shopify -> INS Hub 3-Tier Sync ===\n');

    // 1. Get active store
    const store = await prisma.shopifyStore.findFirst({ where: { isActive: true } });
    if (!store) { console.log('ERROR: No active store'); return; }
    console.log('Store:', store.storeName, store.shopifyDomain);

    let token = decrypt(store.accessTokenEnc, store.tokenIv);
    console.log('Token decrypted, validating...');

    // 1b. Validate token — auto-refresh if expired
    const testRes = await fetch(
        `https://${store.shopifyDomain}/admin/api/${store.apiVersion || '2025-01'}/shop.json`,
        { headers: { 'X-Shopify-Access-Token': token } },
    );

    if (testRes.ok) {
        console.log('Token valid');
    } else if (testRes.status === 401 && store.clientIdEnc && store.clientIdIv && store.clientSecretEnc && store.clientSecretIv) {
        console.log('Token expired (401), refreshing...');
        const clientId = decrypt(store.clientIdEnc, store.clientIdIv);
        const clientSecret = decrypt(store.clientSecretEnc, store.clientSecretIv);

        const tokenRes = await fetch(
            `https://${store.shopifyDomain}/admin/oauth/access_token`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: clientId,
                    client_secret: clientSecret,
                    grant_type: 'client_credentials',
                }),
            },
        );

        if (!tokenRes.ok) {
            const body = await tokenRes.text();
            console.error('Token refresh FAILED:', tokenRes.status, body);
            return;
        }

        const tokenData = await tokenRes.json();
        token = tokenData.access_token;
        if (!token) { console.error('No access_token in refresh response'); return; }

        // Save refreshed token to DB
        const enc = encryptValue(token);
        await prisma.shopifyStore.update({
            where: { id: store.id },
            data: { accessTokenEnc: enc.encrypted, tokenIv: enc.iv, tokenLastRotatedAt: new Date() },
        });
        console.log('Token refreshed and saved');
    } else {
        console.error('Token invalid:', testRes.status, await testRes.text());
        return;
    }

    // 2. Clear existing data (order matters for FK constraints)
    console.log('\nClearing data...');
    await prisma.shopifyVariantMap.deleteMany({});
    await prisma.shopifyProductMap.deleteMany({});
    await prisma.productIssue.deleteMany({});
    await prisma.productVariant.deleteMany({});
    await prisma.variantGroup.deleteMany({});
    await prisma.productImage.deleteMany({});
    await prisma.product.deleteMany({});
    console.log('Data cleared');

    // 3. Brands
    const brands = await prisma.brand.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, code: true },
    });
    console.log('Brands:', brands.length);

    // 4. Fetch from Shopify
    const apiVersion = store.apiVersion || '2025-01';
    const url = `https://${store.shopifyDomain}/admin/api/${apiVersion}/products.json?status=active&limit=${PRODUCT_LIMIT}`;
    console.log('\nFetching:', url);

    const res = await fetch(url, {
        headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
        console.error('Shopify API error:', res.status, await res.text());
        return;
    }

    const data = await res.json();
    const shopifyProducts = data.products || [];
    console.log('Fetched', shopifyProducts.length, 'products\n');

    // 5. Process each product
    let stats = { products: 0, groups: 0, skus: 0 };

    for (let pi = 0; pi < shopifyProducts.length; pi++) {
        const sp = shopifyProducts[pi];
        const variants = sp.variants || [];
        const images = sp.images || [];

        try {
            const brandId = matchVendorToBrand(sp.vendor, brands);
            const styleCode = generateStyleCode(sp.title, sp.vendor, pi + 1);
            const { colorOption, sizeOption, materialOption } = classifyOptions(sp);

            // Create Product
            const product = await prisma.product.create({
                data: {
                    title: sp.title,
                    description: sp.body_html || null,
                    productType: sp.product_type || null,
                    brandId: brandId || null,
                    styleCode,
                    featuredImageUrl: sp.image?.src || images[0]?.src || null,
                    status: 'ACTIVE',
                },
            });
            stats.products++;

            // Images
            for (const img of images) {
                await prisma.productImage.create({
                    data: {
                        productId: product.id,
                        src: img.src,
                        alt: img.alt || null,
                        position: img.position || 0,
                        width: img.width || null,
                        height: img.height || null,
                        shopifyId: img.id ? BigInt(img.id) : null,
                    },
                });
            }

            // Group variants by color/material
            const groupMap = new Map();

            for (const v of variants) {
                const color = getVariantOption(v, colorOption, sp) || null;
                const material = getVariantOption(v, materialOption, sp) || null;
                const key = `${(color || 'N/A')}|${(material || 'N/A')}`;

                if (!groupMap.has(key)) {
                    let groupImageUrl = null;
                    if (v.image_id) {
                        const matchImg = images.find(img => img.id === v.image_id);
                        if (matchImg) groupImageUrl = matchImg.src;
                    }
                    groupMap.set(key, { color, material, imageUrl: groupImageUrl, variants: [] });
                }
                groupMap.get(key).variants.push(v);
            }

            // Create VariantGroups + SKUs
            let groupPos = 0;
            for (const [, group] of groupMap) {
                const sizes = [...new Set(group.variants.map(v => getVariantOption(v, sizeOption, sp) || 'OS'))];

                const vg = await prisma.variantGroup.create({
                    data: {
                        productId: product.id,
                        color: group.color,
                        material: group.material,
                        sizeRun: sizes,
                        imageUrl: group.imageUrl,
                        position: groupPos++,
                    },
                });
                stats.groups++;

                for (const v of group.variants) {
                    const size = getVariantOption(v, sizeOption, sp) || null;
                    const sku = v.sku || generateSku(styleCode, group.color, size);

                    // Unique SKU
                    const exists = await prisma.productVariant.findFirst({ where: { sku } });
                    const finalSku = exists ? `${sku}-${Date.now().toString(36).slice(-4)}` : sku;

                    const pv = await prisma.productVariant.create({
                        data: {
                            productId: product.id,
                            variantGroupId: vg.id,
                            sku: finalSku,
                            title: v.title || null,
                            color: group.color,
                            size,
                            option1: v.option1 || null,
                            option2: v.option2 || null,
                            option3: v.option3 || null,
                            barcode: v.barcode || null,
                            weightGrams: v.grams || null,
                            price: v.price ? parseFloat(v.price) : null,
                            compareAtPrice: v.compare_at_price ? parseFloat(v.compare_at_price) : null,
                            imageUrl: v.image_id ? images.find(img => img.id === v.image_id)?.src || null : null,
                            status: 'ACTIVE',
                        },
                    });
                    stats.skus++;

                    await prisma.shopifyVariantMap.create({
                        data: {
                            storeId: store.id,
                            variantId: pv.id,
                            shopifyVariantId: BigInt(v.id),
                            inventoryItemId: v.inventory_item_id ? BigInt(v.inventory_item_id) : null,
                            shopifySku: v.sku || null,
                            syncedAt: new Date(),
                        },
                    });
                }
            }

            // ShopifyProductMap
            await prisma.shopifyProductMap.create({
                data: {
                    storeId: store.id,
                    productId: product.id,
                    shopifyProductId: BigInt(sp.id),
                    handle: sp.handle || null,
                    vendor: sp.vendor || null,
                    tags: sp.tags ? sp.tags.split(',').map(t => t.trim()) : [],
                    shopifyStatus: sp.status || null,
                    bodyHtml: sp.body_html || null,
                    syncedAt: new Date(),
                },
            });

            const optInfo = [colorOption, sizeOption, materialOption].filter(Boolean).join('/') || 'Title';
            console.log(`[${pi + 1}/${shopifyProducts.length}] ${sp.title.substring(0, 45).padEnd(45)} ${groupMap.size}G ${variants.length}V (${optInfo})`);
        } catch (err) {
            console.error(`[${pi + 1}] ERROR on "${sp.title}":`, err.message);
        }
    }

    console.log(`\n=== DONE: ${stats.products} products, ${stats.groups} groups, ${stats.skus} SKUs ===`);
    await prisma.$disconnect();
}

main().catch(e => { console.error('FATAL:', e); prisma.$disconnect(); });
