import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ShopifyStoresService } from '../shopify-stores/shopify-stores.service';

/**
 * Shopify Draft Listing Service.
 * Creates draft products on a Shopify store from approved INS products.
 * Persists ShopifyProductMap + ShopifyVariantMap for tracking.
 */
@Injectable()
export class ShopifyListingService {
    private readonly logger = new Logger(ShopifyListingService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly shopifyStores: ShopifyStoresService,
    ) { }

    // ─── Create Draft Listing for single product ──────
    async createDraftListing(productId: string, storeId: string, userId: string) {
        // 1. Load product with variants and images
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            include: {
                brand: { select: { id: true, name: true, code: true } },
                variants: { where: { status: { not: 'DISCONTINUED' } }, orderBy: { sku: 'asc' } },
                images: { orderBy: { position: 'asc' } },
                issues: { where: { status: 'OPEN', severity: 'ERROR' } },
            },
        });

        if (!product) throw new NotFoundException('Product not found');
        if (product.status !== 'ACTIVE') throw new BadRequestException('Product must be ACTIVE to list on Shopify');
        if (product.variants.length === 0) throw new BadRequestException('Product has no active variants');
        if (product.issues.length > 0) throw new BadRequestException(`Product has ${product.issues.length} unresolved ERROR issues`);

        // 2. Check if already listed on this store
        const existingMap = await this.prisma.shopifyProductMap.findFirst({
            where: { productId, storeId },
        });
        if (existingMap) throw new BadRequestException('Product is already listed on this store');

        // 3. Get store details and token
        const store = await this.prisma.shopifyStore.findUnique({ where: { id: storeId } });
        if (!store) throw new NotFoundException('Store not found');
        if (!store.isActive) throw new BadRequestException('Store is inactive');

        const { token } = await this.shopifyStores.getValidToken(storeId);
        const apiVersion = store.apiVersion || '2024-10';
        const baseUrl = `https://${store.shopifyDomain}/admin/api/${apiVersion}`;

        // 4. Build Shopify product payload
        const shopifyPayload: any = {
            product: {
                title: product.title,
                body_html: product.description || '',
                vendor: product.brand?.name || '',
                product_type: product.productType || '',
                status: 'draft',
                variants: product.variants.map((v, i) => ({
                    title: v.title || `${v.color || ''} / ${v.size || ''}`.trim() || 'Default Title',
                    sku: v.sku,
                    price: v.price?.toString() || '0',
                    compare_at_price: v.compareAtPrice?.toString() || null,
                    option1: v.color || v.option1 || 'Default',
                    option2: v.size || v.option2 || null,
                    option3: v.option3 || null,
                    barcode: v.barcode || null,
                    weight: v.weightGrams || 0,
                    weight_unit: 'g',
                    inventory_management: 'shopify',
                    inventory_policy: 'deny',
                    position: i + 1,
                })),
                options: this.buildOptions(product.variants),
                images: product.images.map(img => ({
                    src: img.src,
                    alt: img.alt || '',
                    position: img.position,
                })),
            },
        };

        // Add featured image if no images but featuredImageUrl exists
        if (shopifyPayload.product.images.length === 0 && (product as any).featuredImageUrl) {
            shopifyPayload.product.images.push({
                src: (product as any).featuredImageUrl,
                alt: product.title,
                position: 1,
            });
        }

        // 5. Create product on Shopify
        this.logger.log(`Creating draft listing on ${store.shopifyDomain} for "${product.title}"`);

        const response = await fetch(`${baseUrl}/products.json`, {
            method: 'POST',
            headers: {
                'X-Shopify-Access-Token': token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(shopifyPayload),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            this.logger.error(`Shopify create failed (${response.status}): ${errorBody}`);
            throw new BadRequestException(`Shopify API error: ${response.status} — ${errorBody.substring(0, 200)}`);
        }

        const shopifyData: any = await response.json();
        const shopifyProduct = shopifyData.product;

        // 6. Persist ShopifyProductMap
        const productMap = await this.prisma.shopifyProductMap.create({
            data: {
                storeId,
                productId,
                shopifyProductId: BigInt(shopifyProduct.id),
                handle: shopifyProduct.handle || null,
                shopifyStatus: shopifyProduct.status || 'draft',
                vendor: shopifyProduct.vendor || null,
                tags: shopifyProduct.tags ? shopifyProduct.tags.split(',').map((t: string) => t.trim()) : [],
                bodyHtml: shopifyProduct.body_html || null,
                syncedAt: new Date(),
            },
        });

        // 7. Persist ShopifyVariantMap for each variant
        let variantsMapped = 0;
        for (const shopifyVariant of shopifyProduct.variants || []) {
            // Match by SKU
            const localVariant = product.variants.find(v => v.sku === shopifyVariant.sku);
            if (!localVariant) continue;

            await this.prisma.shopifyVariantMap.create({
                data: {
                    storeId,
                    variantId: localVariant.id,
                    shopifyVariantId: BigInt(shopifyVariant.id),
                    inventoryItemId: shopifyVariant.inventory_item_id ? BigInt(shopifyVariant.inventory_item_id) : null,
                    shopifySku: shopifyVariant.sku || null,
                    syncedAt: new Date(),
                },
            });
            variantsMapped++;
        }

        // 8. Create sync job record
        const job = await this.prisma.productSyncJob.create({
            data: {
                storeId,
                source: 'shopify_listing',
                status: 'completed',
                totalItems: 1,
                created: 1,
                completedAt: new Date(),
            },
        });

        await this.prisma.productSyncLog.create({
            data: {
                jobId: job.id,
                action: 'CREATED',
                level: 'info',
                message: `Draft listing created: "${product.title}" (${variantsMapped} variants) on ${store.shopifyDomain}`,
                data: {
                    shopifyProductId: shopifyProduct.id.toString(),
                    handle: shopifyProduct.handle,
                    variantsMapped,
                },
            },
        });

        await this.audit.log({
            userId,
            action: 'shopify.create_draft',
            entityType: 'Product',
            entityId: productId,
            changes: {
                storeId,
                shopifyProductId: shopifyProduct.id.toString(),
                variantsMapped,
            },
        });

        this.logger.log(`Draft listing created: shopify#${shopifyProduct.id} (${variantsMapped} variants)`);

        return {
            shopifyProductId: shopifyProduct.id.toString(),
            handle: shopifyProduct.handle,
            url: `https://${store.shopifyDomain}/admin/products/${shopifyProduct.id}`,
            variantsMapped,
            productMapId: productMap.id,
            jobId: job.id,
        };
    }

    // ─── Bulk Create ──────────────────────────────────
    async bulkCreateDraftListings(productIds: string[], storeId: string, userId: string) {
        const results: any[] = [];
        let success = 0;
        let failed = 0;

        for (const pid of productIds) {
            try {
                const result = await this.createDraftListing(pid, storeId, userId);
                results.push({ productId: pid, status: 'success', ...result });
                success++;
            } catch (err: any) {
                results.push({ productId: pid, status: 'failed', error: err.message });
                failed++;
                this.logger.warn(`Bulk listing failed for ${pid}: ${err.message}`);
            }
        }

        return { total: productIds.length, success, failed, results };
    }

    // ─── Build option definitions ──────────────────────
    private buildOptions(variants: any[]): any[] {
        const options: any[] = [];
        const colors = new Set(variants.map(v => v.color || v.option1).filter(Boolean));
        const sizes = new Set(variants.map(v => v.size || v.option2).filter(Boolean));

        if (colors.size > 0) {
            options.push({ name: 'Color', values: Array.from(colors) });
        }
        if (sizes.size > 0) {
            options.push({ name: 'Size', values: Array.from(sizes) });
        }
        if (options.length === 0) {
            options.push({ name: 'Title', values: ['Default Title'] });
        }

        return options;
    }
}
