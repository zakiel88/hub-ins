import {
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShopifyStoresService } from '../shopify-stores/shopify-stores.service';

@Injectable()
export class ShopifySyncService {
    private readonly logger = new Logger(ShopifySyncService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly shopifyStores: ShopifyStoresService,
    ) { }

    // ─── Trigger Import ──────────────────────────────
    async importProducts(storeId: string): Promise<string> {
        const store = await this.prisma.shopifyStore.findUnique({ where: { id: storeId } });
        if (!store) throw new NotFoundException('Store not found');

        // Create job record
        const job = await this.prisma.syncJob.create({
            data: {
                storeId,
                jobType: 'import_products',
                status: 'running',
                startedAt: new Date(),
            },
        });

        // Run import in background (don't await)
        this.runImport(job.id, storeId).catch((err) => {
            this.logger.error(`Import job ${job.id} crashed: ${err.message}`);
        });

        return job.id;
    }

    // ─── Core Import Pipeline ────────────────────────
    private async runImport(jobId: string, storeId: string) {
        let processed = 0;
        let failed = 0;
        let totalItems = 0;

        try {
            await this.addLog(jobId, 'info', 'Starting product import...');

            // 1. Get valid token
            const store = await this.prisma.shopifyStore.findUnique({ where: { id: storeId } });
            if (!store) throw new Error('Store not found');

            const { token } = await this.shopifyStores.getValidToken(storeId);
            const domain = store.shopifyDomain;
            const apiVersion = store.apiVersion || '2025-01';

            // 2. Fetch ALL active products via REST (paginated)
            const allProducts = await this.fetchAllActiveProducts(domain, token, apiVersion, jobId);
            totalItems = allProducts.length;

            await this.prisma.syncJob.update({
                where: { id: jobId },
                data: { totalItems },
            });
            await this.addLog(jobId, 'info', `Fetched ${totalItems} active products from Shopify`);

            // 3. Load all brands for vendor matching
            const brands = await this.prisma.brand.findMany({
                where: { deletedAt: null },
                select: { id: true, name: true, code: true },
            });

            // 4. Process each product
            for (const shopifyProduct of allProducts) {
                try {
                    await this.processProduct(shopifyProduct, storeId, brands, jobId);
                    processed++;
                } catch (err: any) {
                    failed++;
                    await this.addLog(jobId, 'error', `Failed: ${shopifyProduct.title} — ${err.message}`, {
                        shopifyProductId: shopifyProduct.id,
                    });
                }

                // Update progress every 10 products
                if ((processed + failed) % 10 === 0) {
                    await this.prisma.syncJob.update({
                        where: { id: jobId },
                        data: { processed, failed },
                    });
                }
            }

            // 5. Complete
            await this.prisma.syncJob.update({
                where: { id: jobId },
                data: {
                    status: 'success',
                    processed,
                    failed,
                    totalItems,
                    completedAt: new Date(),
                },
            });
            await this.addLog(jobId, 'info', `Import complete: ${processed} OK, ${failed} failed out of ${totalItems}`);

        } catch (err: any) {
            await this.prisma.syncJob.update({
                where: { id: jobId },
                data: {
                    status: 'failed',
                    processed,
                    failed,
                    totalItems,
                    errorMsg: err.message,
                    completedAt: new Date(),
                },
            });
            await this.addLog(jobId, 'error', `Import crashed: ${err.message}`);
        }
    }

    // ─── Fetch all active products (paginated REST) ──
    private async fetchAllActiveProducts(
        domain: string,
        token: string,
        apiVersion: string,
        jobId: string,
    ): Promise<any[]> {
        const allProducts: any[] = [];
        let nextPageUrl: string | null =
            `https://${domain}/admin/api/${apiVersion}/products.json?status=active&limit=250`;

        while (nextPageUrl) {
            const res = await fetch(nextPageUrl, {
                headers: { 'X-Shopify-Access-Token': token },
            });

            if (!res.ok) {
                throw new Error(`Shopify API error ${res.status}: ${await res.text()}`);
            }

            const data: any = await res.json();
            allProducts.push(...(data.products || []));

            // Parse Link header for pagination
            const linkHeader = res.headers.get('Link') || '';
            const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
            nextPageUrl = nextMatch ? nextMatch[1] : null;

            if (nextPageUrl) {
                await this.addLog(jobId, 'info', `Fetched page... ${allProducts.length} products so far`);
                // Shopify rate limit: ~2 req/sec
                await new Promise((r) => setTimeout(r, 500));
            }
        }

        return allProducts;
    }

    // ─── Process single Shopify product ──────────────
    private async processProduct(
        shopifyProduct: any,
        storeId: string,
        brands: { id: string; name: string; code: string }[],
        jobId: string,
    ) {
        const variants = shopifyProduct.variants || [];
        const images = shopifyProduct.images || [];

        // 1. Match vendor → Brand
        const brandId = this.matchVendorToBrand(shopifyProduct.vendor, brands);

        // 2. Build SKU list for dedup
        const skus = variants.map((v: any) => v.sku).filter(Boolean);

        // 3. Check if any variant SKU already exists → find existing MasterProduct
        let masterProductId: string | null = null;
        let hasConflict = false;

        if (skus.length > 0) {
            const existingVariant = await this.prisma.colorway.findFirst({
                where: { sku: { in: skus } },
                include: {
                    product: { select: { id: true, brandId: true } },
                },
            }) as any;

            if (existingVariant) {
                masterProductId = existingVariant.product.id;

                // Check conflict: same SKU but different brand
                if (brandId && existingVariant.product.brandId && existingVariant.product.brandId !== brandId) {
                    hasConflict = true;
                    await this.addLog(jobId, 'warn', `SKU conflict: ${existingVariant.sku} — existing brand ${existingVariant.product.brandId} vs incoming ${brandId}`, {
                        sku: existingVariant.sku,
                        existingBrandId: existingVariant.product.brandId,
                        incomingBrandId: brandId,
                    });
                }
            }
        }

        // 4. Upsert MasterProduct
        const productMedia = images.map((img: any, i: number) => ({
            url: img.src,
            alt: img.alt || '',
            position: img.position || i,
        }));

        if (masterProductId) {
            // Update existing product with richer data (canonical = meanblvd)
            const store = await this.prisma.shopifyStore.findUnique({ where: { id: storeId }, select: { shopifyDomain: true } });
            const isMeanblvd = store?.shopifyDomain?.includes('meanblvd');

            if (isMeanblvd || !hasConflict) {
                await this.prisma.product.update({
                    where: { id: masterProductId },
                    data: {
                        description: shopifyProduct.body_html || undefined,
                        productType: shopifyProduct.product_type || undefined,
                        tags: shopifyProduct.tags ? shopifyProduct.tags.split(',').map((t: string) => t.trim()) : [],
                        media: productMedia.length > 0 ? productMedia : undefined,
                        handle: shopifyProduct.handle || undefined,
                        vendor: shopifyProduct.vendor || undefined,
                        hasConflict,
                        ...(brandId && !hasConflict ? { brandId } : {}),
                    },
                });
            }
            if (hasConflict) {
                await this.prisma.product.update({
                    where: { id: masterProductId },
                    data: { hasConflict: true },
                });
            }
        } else {
            // Create new MasterProduct
            const newProduct = await this.prisma.product.create({
                data: {
                    name: shopifyProduct.title,
                    description: shopifyProduct.body_html || null,
                    productType: shopifyProduct.product_type || null,
                    tags: shopifyProduct.tags ? shopifyProduct.tags.split(',').map((t: string) => t.trim()) : [],
                    media: productMedia,
                    handle: shopifyProduct.handle || null,
                    vendor: shopifyProduct.vendor || null,
                    brandId: brandId || null,
                    hasConflict: false,
                    status: 'active',
                },
            });
            masterProductId = newProduct.id;
        }

        // 5. Upsert variants (Colorways)
        for (const variant of variants) {
            if (!variant.sku) continue; // Skip variants without SKU

            const colorwayData = {
                productId: masterProductId,
                color: variant.option1 || '—',
                size: variant.option2 || '—',
                barcode: variant.barcode || null,
                weightGrams: variant.grams || null,
                option1: variant.option1 || null,
                option2: variant.option2 || null,
                option3: variant.option3 || null,
                price: variant.price ? parseFloat(variant.price) : null,
                compareAtPrice: variant.compare_at_price ? parseFloat(variant.compare_at_price) : null,
                imageUrl: variant.image_id ? images.find((img: any) => img.id === variant.image_id)?.src || null : null,
            };

            const colorway = await this.prisma.colorway.upsert({
                where: { sku: variant.sku },
                update: colorwayData,
                create: { sku: variant.sku, ...colorwayData },
            });

            // 6. Create/update ShopifyVariantMap
            await this.prisma.shopifyVariantMap.upsert({
                where: {
                    uq_svmap_store_variant: {
                        storeId,
                        shopifyVariantId: BigInt(variant.id),
                    },
                },
                update: {
                    colorwayId: colorway.id,
                    inventoryItemId: variant.inventory_item_id ? BigInt(variant.inventory_item_id) : null,
                    syncedAt: new Date(),
                },
                create: {
                    storeId,
                    colorwayId: colorway.id,
                    shopifyVariantId: BigInt(variant.id),
                    inventoryItemId: variant.inventory_item_id ? BigInt(variant.inventory_item_id) : null,
                    syncedAt: new Date(),
                },
            });

            // 7. Create/update VariantPublication
            // First ensure ProductPublication exists
            const pub = await this.prisma.productPublication.upsert({
                where: {
                    uq_pub_store_product: { storeId, productId: masterProductId },
                },
                update: {
                    storeTitle: shopifyProduct.title,
                    storeDescription: shopifyProduct.body_html || null,
                    storeStatus: shopifyProduct.status || 'active',
                    handle: shopifyProduct.handle || null,
                    shopifyProductId: BigInt(shopifyProduct.id),
                },
                create: {
                    storeId,
                    productId: masterProductId,
                    storeTitle: shopifyProduct.title,
                    storeDescription: shopifyProduct.body_html || null,
                    storeStatus: shopifyProduct.status || 'active',
                    handle: shopifyProduct.handle || null,
                    shopifyProductId: BigInt(shopifyProduct.id),
                },
            });

            await this.prisma.variantPublication.upsert({
                where: {
                    uq_vpub_store_variant: { storeId, colorwayId: colorway.id },
                },
                update: {
                    priceOverride: variant.price ? parseFloat(variant.price) : null,
                    shopifyVariantId: BigInt(variant.id),
                    status: 'active',
                },
                create: {
                    publicationId: pub.id,
                    storeId,
                    colorwayId: colorway.id,
                    priceOverride: variant.price ? parseFloat(variant.price) : null,
                    shopifyVariantId: BigInt(variant.id),
                    status: 'active',
                },
            });
        }

        // 8. Create/update ShopifyProductMap
        await this.prisma.shopifyProductMap.upsert({
            where: {
                uq_spmap_store_product: { storeId, shopifyProductId: BigInt(shopifyProduct.id) },
            },
            update: {
                productId: masterProductId,
                handle: shopifyProduct.handle || null,
                syncedAt: new Date(),
            },
            create: {
                storeId,
                productId: masterProductId,
                shopifyProductId: BigInt(shopifyProduct.id),
                handle: shopifyProduct.handle || null,
                syncedAt: new Date(),
            },
        });
    }

    // ─── Match vendor string to Brand ────────────────
    private matchVendorToBrand(
        vendor: string | null,
        brands: { id: string; name: string; code: string }[],
    ): string | null {
        if (!vendor) return null;
        const v = vendor.toLowerCase().trim();

        // Exact match on name or code
        const exact = brands.find(
            (b) => b.name.toLowerCase() === v || b.code.toLowerCase() === v,
        );
        if (exact) return exact.id;

        // Partial match
        const partial = brands.find(
            (b) => v.includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(v) ||
                v.includes(b.code.toLowerCase()) || b.code.toLowerCase().includes(v),
        );
        if (partial) return partial.id;

        return null;
    }

    // ─── Write Metafields ────────────────────────────
    async writeMetafields(storeId: string): Promise<string> {
        const store = await this.prisma.shopifyStore.findUnique({ where: { id: storeId } });
        if (!store) throw new NotFoundException('Store not found');

        const job = await this.prisma.syncJob.create({
            data: {
                storeId,
                jobType: 'write_metafields',
                status: 'running',
                startedAt: new Date(),
            },
        });

        this.runMetafieldsWrite(job.id, storeId).catch((err) => {
            this.logger.error(`Metafields job ${job.id} crashed: ${err.message}`);
        });

        return job.id;
    }

    private async runMetafieldsWrite(jobId: string, storeId: string) {
        let processed = 0;
        let failed = 0;

        try {
            const { token } = await this.shopifyStores.getValidToken(storeId);
            const store = await this.prisma.shopifyStore.findUnique({ where: { id: storeId } });
            if (!store) throw new Error('Store not found');

            const apiVersion = store.apiVersion || '2025-01';
            const domain = store.shopifyDomain;

            // Get all variant maps for this store
            const variantMaps = await this.prisma.shopifyVariantMap.findMany({
                where: { storeId },
                include: {
                    colorway: { select: { id: true, productId: true } },
                },
            });

            const productMaps = await this.prisma.shopifyProductMap.findMany({
                where: { storeId },
            });

            const totalItems = variantMaps.length + productMaps.length;
            await this.prisma.syncJob.update({
                where: { id: jobId },
                data: { totalItems },
            });
            await this.addLog(jobId, 'info', `Writing metafields for ${productMaps.length} products + ${variantMaps.length} variants`);

            // Write product metafields
            for (const pm of productMaps) {
                try {
                    await this.writeProductMetafield(domain, token, apiVersion, pm.shopifyProductId, pm.productId);
                    processed++;
                } catch (err: any) {
                    failed++;
                    await this.addLog(jobId, 'error', `Product metafield failed: ${err.message}`, { shopifyProductId: pm.shopifyProductId.toString() });
                }
                // Rate limit
                if ((processed + failed) % 5 === 0) await new Promise((r) => setTimeout(r, 500));
            }

            // Write variant metafields
            for (const vm of variantMaps) {
                try {
                    await this.writeVariantMetafield(domain, token, apiVersion, vm.shopifyVariantId, vm.colorway.id);
                    processed++;
                } catch (err: any) {
                    failed++;
                    await this.addLog(jobId, 'error', `Variant metafield failed: ${err.message}`, { shopifyVariantId: vm.shopifyVariantId.toString() });
                }
                if ((processed + failed) % 5 === 0) await new Promise((r) => setTimeout(r, 500));
            }

            await this.prisma.syncJob.update({
                where: { id: jobId },
                data: { status: 'success', processed, failed, totalItems, completedAt: new Date() },
            });
            await this.addLog(jobId, 'info', `Metafields write complete: ${processed} OK, ${failed} failed`);
        } catch (err: any) {
            await this.prisma.syncJob.update({
                where: { id: jobId },
                data: { status: 'failed', processed, failed, errorMsg: err.message, completedAt: new Date() },
            });
            await this.addLog(jobId, 'error', `Metafields write crashed: ${err.message}`);
        }
    }

    private async writeProductMetafield(domain: string, token: string, apiVersion: string, shopifyProductId: bigint, masterProductId: string) {
        const res = await fetch(`https://${domain}/admin/api/${apiVersion}/products/${shopifyProductId}/metafields.json`, {
            method: 'POST',
            headers: {
                'X-Shopify-Access-Token': token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                metafield: {
                    namespace: 'ins',
                    key: 'master_product_id',
                    value: masterProductId,
                    type: 'single_line_text_field',
                },
            }),
        });
        if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    }

    private async writeVariantMetafield(domain: string, token: string, apiVersion: string, shopifyVariantId: bigint, masterVariantId: string) {
        const res = await fetch(`https://${domain}/admin/api/${apiVersion}/variants/${shopifyVariantId}/metafields.json`, {
            method: 'POST',
            headers: {
                'X-Shopify-Access-Token': token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                metafield: {
                    namespace: 'ins',
                    key: 'master_variant_id',
                    value: masterVariantId,
                    type: 'single_line_text_field',
                },
            }),
        });
        if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    }

    // ─── Helpers ─────────────────────────────────────
    private async addLog(jobId: string, level: string, message: string, data?: any) {
        await this.prisma.syncJobLog.create({
            data: { jobId, level, message, data: data || undefined },
        });
        if (level === 'error') {
            this.logger.error(`[Job ${jobId}] ${message}`);
        } else {
            this.logger.log(`[Job ${jobId}] ${message}`);
        }
    }
}
