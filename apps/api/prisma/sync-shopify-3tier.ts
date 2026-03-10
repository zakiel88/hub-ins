/**
 * Shopify → INS Hub 3-Tier Sync Script
 * 
 * 1. Clears existing product/variant/variantGroup data
 * 2. Fetches 50 products from Shopify dev store
 * 3. Splits into: Product → VariantGroup (by color/material) → SKU (by size)
 *
 * Run: cd apps/api && npx ts-node prisma/sync-shopify-3tier.ts
 */
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// ─── Config ──────────────────────────────────────
const PRODUCT_LIMIT = 50;

// ─── Decrypt Shopify token ───────────────────────
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

// ─── Detect which Shopify option is Color vs Size vs Material ───
function classifyOptions(shopifyProduct: any): {
    colorOption: string | null;
    sizeOption: string | null;
    materialOption: string | null;
} {
    const options = shopifyProduct.options || [];

    // Common Shopify option names
    const COLOR_NAMES = ['color', 'colour', 'colors', 'couleur', 'colore', 'farbe'];
    const SIZE_NAMES = ['size', 'sizes', 'taille', 'taglia', 'grösse', 'größe'];
    const MATERIAL_NAMES = ['material', 'fabric', 'matériau', 'matière', 'tessuto'];

    let colorOption: string | null = null;
    let sizeOption: string | null = null;
    let materialOption: string | null = null;

    for (const opt of options) {
        const name = (opt.name || '').toLowerCase().trim();
        if (COLOR_NAMES.some(c => name.includes(c))) colorOption = opt.name;
        else if (SIZE_NAMES.some(s => name.includes(s))) sizeOption = opt.name;
        else if (MATERIAL_NAMES.some(m => name.includes(m))) materialOption = opt.name;
    }

    // Fallback: if there are options but none matched keywords
    // For fashion, option1 = Color, option2 = Size is the standard
    if (!colorOption && !sizeOption && options.length >= 1) {
        // If only 1 option and it has values like S/M/L → it's size
        const firstVals = (options[0]?.values || []).map((v: string) => v.toLowerCase());
        const looksLikeSize = firstVals.some((v: string) =>
            ['xs', 's', 'm', 'l', 'xl', 'xxl', 'os', 'one size'].includes(v) ||
            /^\d{1,2}(\.\d)?$/.test(v),
        );

        if (options.length === 1 && looksLikeSize) {
            sizeOption = options[0].name;
        } else if (options.length === 1 && options[0].name === 'Title') {
            // Default "Title" option = single-variant product
        } else {
            colorOption = options[0]?.name || null;
            sizeOption = options[1]?.name || null;
            if (options.length >= 3) materialOption = options[2]?.name || null;
        }
    }

    return { colorOption, sizeOption, materialOption };
}

// ─── Get option value for a variant ──────────────
function getVariantOption(variant: any, optionName: string | null, shopifyProduct: any): string | null {
    if (!optionName) return null;
    const options = shopifyProduct.options || [];
    const idx = options.findIndex((o: any) => o.name === optionName);
    if (idx < 0) return null;
    return variant[`option${idx + 1}`] || null;
}

// ─── Generate SKU from parts ─────────────────────
function generateSku(styleCode: string, color: string | null, size: string | null): string {
    const colorPart = color ? color.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4) : 'NA';
    const sizePart = size ? size.toUpperCase().replace(/[^A-Z0-9.]/g, '') : 'OS';
    return `${styleCode}-${colorPart}-${sizePart}`;
}

// ─── Generate style code from title + vendor ─────
function generateStyleCode(title: string, vendor: string | null, index: number): string {
    // Take first 3 chars of vendor + 3 chars of title + sequential number
    const vendorPart = (vendor || 'XX').replace(/[^A-Z a-z]/g, '').trim().substring(0, 3).toUpperCase() || 'XX';
    const titlePart = title.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase() || 'PRD';
    return `${vendorPart}-${titlePart}-${String(index).padStart(3, '0')}`;
}

// ─── MAIN ────────────────────────────────────────
async function main() {
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║   Shopify → INS Hub 3-Tier Sync             ║');
    console.log('║   Product → VariantGroup → SKU              ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    // 1. Get active store
    const store = await prisma.shopifyStore.findFirst({ where: { isActive: true } });
    if (!store) { console.log('❌ No active Shopify store found'); return; }
    console.log(`🏪 Store: ${store.storeName} (${store.shopifyDomain})\n`);

    const token = decrypt(store.accessTokenEnc, store.tokenIv);

    // 2. Clear existing data
    console.log('🗑️  Clearing existing data...');
    const delVariantMaps = await prisma.shopifyVariantMap.deleteMany({ where: { storeId: store.id } });
    const delProductMaps = await prisma.shopifyProductMap.deleteMany({ where: { storeId: store.id } });
    const delIssues = await prisma.productIssue.deleteMany({});
    const delVariants = await prisma.productVariant.deleteMany({});
    const delGroups = await prisma.variantGroup.deleteMany({});
    const delImages = await prisma.productImage.deleteMany({});
    const delProducts = await prisma.product.deleteMany({});
    console.log(`   Deleted: ${delProducts.count} products, ${delGroups.count} groups, ${delVariants.count} variants, ${delImages.count} images`);
    console.log(`   Deleted: ${delProductMaps.count} product maps, ${delVariantMaps.count} variant maps, ${delIssues.count} issues\n`);

    // 3. Load brands for vendor matching
    const brands = await prisma.brand.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, code: true },
    });
    console.log(`📋 Loaded ${brands.length} brands for vendor matching\n`);

    // 4. Fetch products from Shopify
    console.log(`📡 Fetching ${PRODUCT_LIMIT} products from Shopify...`);
    const apiVersion = store.apiVersion || '2025-01';
    const url = `https://${store.shopifyDomain}/admin/api/${apiVersion}/products.json?status=active&limit=${PRODUCT_LIMIT}`;

    const res = await fetch(url, {
        headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
        console.error(`❌ Shopify API error: ${res.status}`);
        console.error(await res.text());
        return;
    }

    const data: any = await res.json();
    const shopifyProducts = data.products || [];
    console.log(`✅ Fetched ${shopifyProducts.length} products\n`);

    // 5. Process each product
    let stats = { products: 0, groups: 0, skus: 0, skipped: 0 };

    for (let pi = 0; pi < shopifyProducts.length; pi++) {
        const sp = shopifyProducts[pi];
        const variants = sp.variants || [];
        const images = sp.images || [];

        // 5a. Match vendor → Brand
        const brandId = matchVendorToBrand(sp.vendor, brands);

        // 5b. Generate style code
        const styleCode = generateStyleCode(sp.title, sp.vendor, pi + 1);

        // 5c. Classify options (which is Color, Size, Material)
        const { colorOption, sizeOption, materialOption } = classifyOptions(sp);

        // 5d. Create Product
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

        // 5e. Create images
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

        // 5f. Group Shopify variants by color/material → VariantGroups
        const groupMap = new Map<string, {
            color: string | null;
            material: string | null;
            imageUrl: string | null;
            variants: any[];
        }>();

        for (const v of variants) {
            const color = getVariantOption(v, colorOption, sp) || null;
            const material = getVariantOption(v, materialOption, sp) || null;
            const key = `${(color || 'N/A').toLowerCase()}|${(material || 'N/A').toLowerCase()}`;

            if (!groupMap.has(key)) {
                // Find image for this color group
                let groupImageUrl: string | null = null;
                if (v.image_id) {
                    const matchImg = images.find((img: any) => img.id === v.image_id);
                    if (matchImg) groupImageUrl = matchImg.src;
                }
                groupMap.set(key, { color, material, imageUrl: groupImageUrl, variants: [] });
            }
            groupMap.get(key)!.variants.push(v);
        }

        // 5g. Create VariantGroups + SKUs
        let groupPosition = 0;
        for (const [, group] of groupMap) {
            // Collect all sizes in this group
            const sizes = group.variants
                .map(v => getVariantOption(v, sizeOption, sp) || 'OS')
                .filter((v, i, a) => a.indexOf(v) === i); // unique

            const variantGroup = await prisma.variantGroup.create({
                data: {
                    productId: product.id,
                    color: group.color,
                    material: group.material,
                    sizeRun: sizes,
                    imageUrl: group.imageUrl,
                    position: groupPosition++,
                },
            });
            stats.groups++;

            // Create SKUs for each variant in this group
            for (const v of group.variants) {
                const size = getVariantOption(v, sizeOption, sp) || null;
                const sku = v.sku || generateSku(styleCode, group.color, size);

                // Ensure unique SKU
                const existingSku = await prisma.productVariant.findFirst({ where: { sku } });
                const finalSku = existingSku ? `${sku}-${Date.now().toString(36)}` : sku;

                const variant = await prisma.productVariant.create({
                    data: {
                        productId: product.id,
                        variantGroupId: variantGroup.id,
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
                        imageUrl: v.image_id ? images.find((img: any) => img.id === v.image_id)?.src || null : null,
                        status: 'ACTIVE',
                    },
                });
                stats.skus++;

                // Create ShopifyVariantMap
                await prisma.shopifyVariantMap.create({
                    data: {
                        storeId: store.id,
                        variantId: variant.id,
                        shopifyVariantId: BigInt(v.id),
                        inventoryItemId: v.inventory_item_id ? BigInt(v.inventory_item_id) : null,
                        shopifySku: v.sku || null,
                        syncedAt: new Date(),
                    },
                });
            }
        }

        // 5h. Create ShopifyProductMap
        await prisma.shopifyProductMap.create({
            data: {
                storeId: store.id,
                productId: product.id,
                shopifyProductId: BigInt(sp.id),
                handle: sp.handle || null,
                vendor: sp.vendor || null,
                tags: sp.tags ? sp.tags.split(',').map((t: string) => t.trim()) : [],
                shopifyStatus: sp.status || null,
                bodyHtml: sp.body_html || null,
                syncedAt: new Date(),
            },
        });

        // Progress indicator
        const optInfo = [colorOption, sizeOption, materialOption].filter(Boolean).join('/') || 'Title';
        const groupCount = groupMap.size;
        const variantCount = variants.length;
        console.log(`  [${pi + 1}/${shopifyProducts.length}] ${sp.title.substring(0, 50).padEnd(50)} → ${groupCount} groups, ${variantCount} SKUs (options: ${optInfo})`);
    }

    // 6. Summary
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log(`║  ✅ Sync Complete!                            ║`);
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  Products:      ${String(stats.products).padStart(5)}                      ║`);
    console.log(`║  Variant Groups: ${String(stats.groups).padStart(4)}                      ║`);
    console.log(`║  SKUs:          ${String(stats.skus).padStart(5)}                      ║`);
    console.log('╚══════════════════════════════════════════════╝');

    // 7. Show sample data
    console.log('\n📊 Sample product breakdown:');
    const sample = await prisma.product.findFirst({
        include: {
            variantGroups: {
                include: { variants: { select: { sku: true, color: true, size: true, price: true } } },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
    if (sample) {
        console.log(`\n  📦 ${sample.title} [${sample.styleCode}]`);
        for (const vg of sample.variantGroups) {
            console.log(`    🎨 Group: ${vg.color || 'N/A'} / ${vg.material || 'N/A'} — ${vg.sizeRun.length} sizes`);
            for (const v of vg.variants) {
                console.log(`      └ ${v.sku} | size: ${v.size || '-'} | price: ${v.price || '-'}`);
            }
        }
    }

    await prisma.$disconnect();
}

// ─── Brand matching ──────────────────────────────
function matchVendorToBrand(
    vendor: string | null,
    brands: { id: string; name: string; code: string }[],
): string | null {
    if (!vendor) return null;
    const v = vendor.toLowerCase().trim();
    const exact = brands.find(b => b.name.toLowerCase() === v || b.code.toLowerCase() === v);
    if (exact) return exact.id;
    const partial = brands.find(b =>
        v.includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(v) ||
        v.includes(b.code.toLowerCase()) || b.code.toLowerCase().includes(v),
    );
    return partial?.id || null;
}

main().catch((e) => { console.error('❌ Fatal:', e); prisma.$disconnect(); });
