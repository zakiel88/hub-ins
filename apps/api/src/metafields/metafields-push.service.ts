import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShopifyStoresService } from '../shopify-stores/shopify-stores.service';
import { MetafieldsService } from './metafields.service';
import { CatalogValidationService } from './catalog-validation.service';
import * as crypto from 'crypto';

// Mapping metafields that MUST NOT be pushed via METAFIELDS_PUSH
const EXCLUDED_METAFIELD_KEYS = new Set([
    'ins.master_product_id',
    'ins.master_variant_id',
]);

// ─── Push params (Sprint 2.1: scoped push) ───────────
export interface PushParams {
    storeId?: string;        // Legacy single store — kept for backward compat
    storeIds?: string[];     // Multiple stores
    productIds?: string[];
    brandIds?: string[];
    categoryIds?: string[];
    ownerType?: string;
    ownerId?: string;        // Legacy single owner
    force?: boolean;
}

@Injectable()
export class MetafieldsPushService {
    private readonly logger = new Logger(MetafieldsPushService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly shopifyStores: ShopifyStoresService,
        private readonly metafieldsService: MetafieldsService,
        private readonly catalogValidation: CatalogValidationService,
    ) { }

    // ─── Trigger push for specific owner IDs (called after approval) ──
    async triggerPushForOwners(ownerIds: string[]) {
        if (ownerIds.length === 0) return;
        const jobId = await this.triggerPush({ productIds: ownerIds });
        return jobId;
    }

    // ─── Convenience: push single product ─────────────────
    async triggerPushForProduct(productId: string, storeId?: string): Promise<string> {
        return this.triggerPush({
            productIds: [productId],
            storeIds: storeId ? [storeId] : undefined,
        });
    }

    // ─── Convenience: push by brand ───────────────────────
    async triggerPushForBrand(brandId: string, storeId?: string): Promise<string> {
        return this.triggerPush({
            brandIds: [brandId],
            storeIds: storeId ? [storeId] : undefined,
        });
    }

    // ─── Main trigger: creates SyncJob and runs async ──
    async triggerPush(params: PushParams): Promise<string> {
        // Normalize legacy params
        const normalized = { ...params };
        if (params.storeId && !params.storeIds?.length) {
            normalized.storeIds = [params.storeId];
        }
        if (params.ownerId && !params.productIds?.length) {
            normalized.productIds = [params.ownerId];
        }

        const job = await this.prisma.syncJob.create({
            data: {
                jobType: 'METAFIELDS_PUSH',
                status: 'running',
                startedAt: new Date(),
                metadata: normalized as any,
            },
        });

        // Run async — don't block the request
        this.runPush(job.id, normalized).catch(err => {
            this.logger.error(`Push job ${job.id} crashed: ${err.message}`);
        });

        return job.id;
    }

    // ─── Core push pipeline (Sprint 2.1: scoped + validation gate) ───
    private async runPush(jobId: string, params: PushParams) {
        try {
            await this.addLog(jobId, 'info', 'Starting METAFIELDS_PUSH job...');

            // 1. Determine which stores to push to
            let stores: any[];
            if (params.storeIds?.length) {
                stores = await this.prisma.shopifyStore.findMany({
                    where: { id: { in: params.storeIds }, isActive: true },
                });
            } else {
                stores = await this.prisma.shopifyStore.findMany({
                    where: { isActive: true },
                });
            }

            if (stores.length === 0) {
                await this.finishJob(jobId, 'success', 0, 0, 0, 'No active stores found');
                return;
            }

            await this.addLog(jobId, 'info', `Pushing to ${stores.length} store(s)`);

            let totalItems = 0;
            let processed = 0;
            let failed = 0;
            let skipped = 0;

            // 2. For each store, find all products with publications
            for (const store of stores) {
                try {
                    const { token } = await this.shopifyStores.getValidToken(store.id);

                    // Build publication filter (scoped push)
                    const pubWhere: any = { storeId: store.id };

                    // Apply product filter
                    if (params.productIds?.length) {
                        pubWhere.productId = { in: params.productIds };
                    }

                    // Get candidate publications
                    let publications = await this.prisma.productPublication.findMany({
                        where: pubWhere,
                        include: {
                            product: {
                                select: {
                                    id: true, name: true, brandId: true,
                                    shopifyCategoryId: true,
                                },
                            },
                            variantPublications: {
                                include: {
                                    colorway: { select: { id: true, sku: true } },
                                },
                            },
                        },
                    });

                    // Apply brand filter (Sprint 2.1)
                    if (params.brandIds?.length) {
                        publications = publications.filter(
                            (pub: any) => pub.product.brandId && params.brandIds!.includes(pub.product.brandId),
                        );
                    }

                    // Apply category filter (Sprint 2.1)
                    if (params.categoryIds?.length) {
                        publications = publications.filter(
                            (pub: any) => pub.product.shopifyCategoryId && params.categoryIds!.includes(pub.product.shopifyCategoryId),
                        );
                    }

                    await this.addLog(jobId, 'info',
                        `Store ${store.storeName}: ${publications.length} candidate products`,
                    );

                    // 3. For each publication, apply validation gate + push
                    for (const pub of publications) {
                        // ─── VALIDATION GATE (Sprint 2.1) ────────────
                        const validation = await this.catalogValidation.isProductValidForStore(
                            pub.productId, store.id,
                        );

                        if (!validation.isValid) {
                            const missingKeys = validation.missingRequired
                                .map((f: any) => `${f.namespace}.${f.key}`)
                                .join(', ');

                            await this.addLog(jobId, 'warn',
                                `⛔ Skipping ${pub.product.name}: missing required fields [${missingKeys}]`,
                                { productId: pub.productId, storeId: store.id, missing: validation.missingRequired },
                                { storeId: store.id },
                            );
                            skipped++;
                            continue;
                        }

                        // Push PRODUCT-level metafields
                        const productMap = await this.prisma.shopifyProductMap.findFirst({
                            where: { storeId: store.id, productId: pub.productId },
                        });

                        if (productMap) {
                            const result = await this.pushOwnerMetafields(
                                jobId, store, token,
                                'PRODUCT', pub.productId,
                                'products', productMap.shopifyProductId.toString(),
                                params.force || false,
                            );
                            totalItems += result.total;
                            processed += result.processed;
                            failed += result.failed;
                        }

                        // Push VARIANT-level metafields
                        for (const vPub of pub.variantPublications) {
                            const variantMap = await this.prisma.shopifyVariantMap.findFirst({
                                where: { storeId: store.id, colorwayId: vPub.colorwayId },
                            });

                            if (variantMap) {
                                const result = await this.pushOwnerMetafields(
                                    jobId, store, token,
                                    'VARIANT', vPub.colorwayId,
                                    'variants', variantMap.shopifyVariantId.toString(),
                                    params.force || false,
                                );
                                totalItems += result.total;
                                processed += result.processed;
                                failed += result.failed;
                            }
                        }
                    }
                } catch (err: any) {
                    await this.addLog(jobId, 'error', `Store ${store.storeName} failed: ${err.message}`);
                    failed++;
                }
            }

            const status = failed === 0 ? 'success' : (processed > 0 ? 'completed_with_errors' : 'failed');
            await this.finishJob(jobId, status, totalItems, processed, failed,
                skipped > 0 ? `${skipped} product(s) skipped (missing required fields)` : undefined,
            );

        } catch (err: any) {
            this.logger.error(`Push job ${jobId} failed: ${err.message}`);
            await this.addLog(jobId, 'error', `Job failed: ${err.message}`);
            await this.finishJob(jobId, 'failed', 0, 0, 1, err.message);
        }
    }

    // ─── Push metafields for a single owner (product or variant) ──
    private async pushOwnerMetafields(
        jobId: string,
        store: any,
        token: string,
        ownerType: string,
        ownerId: string,
        shopifyResource: string, // 'products' or 'variants'
        shopifyResourceId: string,
        force: boolean,
    ): Promise<{ total: number; processed: number; failed: number }> {
        const effectiveValues = await this.metafieldsService.getEffectiveValues(
            ownerType, ownerId, store.id,
        );

        let total = 0;
        let processed = 0;
        let failed = 0;

        for (const mfv of effectiveValues) {
            const fullKey = `${mfv.definition.namespace}.${mfv.definition.key}`;

            // GUARDRAIL: Skip mapping metafields
            if (EXCLUDED_METAFIELD_KEYS.has(fullKey)) {
                continue;
            }

            total++;

            // Compute idempotency hash
            const hash = this.computeHash(
                mfv.definition.namespace,
                mfv.definition.key,
                mfv.definition.ownerType,
                mfv.valueJson,
                mfv.storeId || 'ALL',
            );

            // Skip if unchanged (idempotent)
            if (!force && mfv.lastPushedHash === hash && mfv.lastPushedAt) {
                continue; // Already pushed with same value
            }

            // Rate limit: simple delay between requests
            await this.delay(500); // 2 req/sec

            try {
                const shopifyMfId = await this.upsertShopifyMetafield(
                    store.shopifyDomain,
                    token,
                    store.apiVersion,
                    shopifyResource,
                    shopifyResourceId,
                    mfv.definition.namespace,
                    mfv.definition.key,
                    mfv.definition.type,
                    mfv.valueJson,
                );

                // Success: update push tracking
                await this.prisma.metafieldValue.update({
                    where: { id: mfv.id },
                    data: {
                        lastPushedHash: hash,
                        lastPushedAt: new Date(),
                    },
                });

                // Log success
                await this.addLog(jobId, 'info', `✓ ${fullKey} → ${store.storeName}`, null, {
                    metafieldValueId: mfv.id,
                    storeId: store.id,
                    shopifyResourceId,
                    shopifyMetafieldId: shopifyMfId,
                });

                processed++;

            } catch (err: any) {
                failed++;

                // Retry logic (up to 2 retries with exponential backoff)
                let success = false;
                for (let retry = 1; retry <= 2; retry++) {
                    await this.delay(1000 * Math.pow(2, retry)); // 2s, 4s
                    try {
                        const shopifyMfId = await this.upsertShopifyMetafield(
                            store.shopifyDomain, token, store.apiVersion,
                            shopifyResource, shopifyResourceId,
                            mfv.definition.namespace, mfv.definition.key,
                            mfv.definition.type, mfv.valueJson,
                        );

                        await this.prisma.metafieldValue.update({
                            where: { id: mfv.id },
                            data: { lastPushedHash: hash, lastPushedAt: new Date() },
                        });

                        await this.addLog(jobId, 'info', `✓ ${fullKey} → ${store.storeName} (retry ${retry})`, null, {
                            metafieldValueId: mfv.id, storeId: store.id,
                            shopifyResourceId, shopifyMetafieldId: shopifyMfId,
                        });

                        processed++;
                        failed--; // Undo the failed count
                        success = true;
                        break;
                    } catch (retryErr: any) {
                        this.logger.warn(`Retry ${retry} failed for ${fullKey}: ${retryErr.message}`);
                    }
                }

                if (!success) {
                    await this.addLog(jobId, 'error', `✗ ${fullKey} → ${store.storeName}: ${err.message}`, null, {
                        metafieldValueId: mfv.id,
                        storeId: store.id,
                        shopifyResourceId,
                        payload: { error: err.message, status: err.status },
                    });
                }
            }
        }

        return { total, processed, failed };
    }

    // ─── Shopify REST API: metafield upsert ──────────────
    private async upsertShopifyMetafield(
        domain: string,
        token: string,
        apiVersion: string,
        resource: string, // 'products' or 'variants'
        resourceId: string,
        namespace: string,
        key: string,
        type: string,
        valueJson: any,
    ): Promise<string> {
        const url = `https://${domain}/admin/api/${apiVersion}/${resource}/${resourceId}/metafields.json`;

        // Format value for Shopify
        const shopifyValue = typeof valueJson === 'string' ? valueJson : JSON.stringify(valueJson);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'X-Shopify-Access-Token': token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                metafield: {
                    namespace,
                    key,
                    type,
                    value: shopifyValue,
                },
            }),
        });

        if (response.status === 429) {
            // Rate limited — throw to trigger retry
            const retryAfter = response.headers.get('Retry-After') || '2';
            throw new Error(`Rate limited (429), retry after ${retryAfter}s`);
        }

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Shopify ${response.status}: ${errBody.substring(0, 200)}`);
        }

        const data: any = await response.json();
        return data.metafield?.id?.toString() || '';
    }

    // ─── Idempotency hash ────────────────────────────────
    private computeHash(
        namespace: string,
        key: string,
        ownerType: string,
        valueJson: any,
        storeScope: string,
    ): string {
        const normalized = JSON.stringify(valueJson, Object.keys(
            typeof valueJson === 'object' && valueJson !== null ? valueJson : {},
        ).sort());

        const input = `${namespace}:${key}:${ownerType}:${normalized}:${storeScope}`;
        return crypto.createHash('sha256').update(input).digest('hex');
    }

    // ─── Helpers ─────────────────────────────────────────
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async finishJob(
        jobId: string,
        status: string,
        total: number,
        processed: number,
        failed: number,
        errorMsg?: string,
    ) {
        await this.prisma.syncJob.update({
            where: { id: jobId },
            data: {
                status,
                totalItems: total,
                processed,
                failed,
                errorMsg: errorMsg || null,
                completedAt: new Date(),
            },
        });

        await this.addLog(jobId, 'info',
            `Push complete: ${processed} OK, ${failed} failed out of ${total}`,
        );
    }

    private async addLog(
        jobId: string,
        level: string,
        message: string,
        data?: any,
        tracking?: {
            metafieldValueId?: string;
            storeId?: string;
            shopifyResourceId?: string;
            shopifyMetafieldId?: string;
            payload?: any;
        },
    ) {
        try {
            await this.prisma.syncJobLog.create({
                data: {
                    jobId,
                    level,
                    message,
                    data: data || null,
                    metafieldValueId: tracking?.metafieldValueId || null,
                    storeId: tracking?.storeId || null,
                    shopifyResourceId: tracking?.shopifyResourceId || null,
                    shopifyMetafieldId: tracking?.shopifyMetafieldId || null,
                    payload: tracking?.payload || null,
                },
            });
        } catch (err) {
            this.logger.warn(`Failed to write log for job ${jobId}: ${(err as Error).message}`);
        }
    }
}
