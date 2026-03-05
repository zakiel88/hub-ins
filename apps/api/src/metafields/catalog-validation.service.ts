import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface MissingField {
    namespace: string;
    key: string;
    label: string | null;
    ownerType: string;
    definitionId: string;
}

interface ValidationResult {
    productId: string;
    storeId: string | null;
    isValid: boolean;
    missingRequired: MissingField[];
}

@Injectable()
export class CatalogValidationService {
    private readonly logger = new Logger(CatalogValidationService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Revalidate a product for all stores + global.
     * Called on: category change, metafield value approval, manual trigger.
     * Persists validation state to ProductValidationState table.
     */
    async revalidateProduct(productId: string): Promise<ValidationResult[]> {
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, shopifyCategoryId: true },
        });

        if (!product) {
            this.logger.warn(`revalidateProduct: product ${productId} not found`);
            return [];
        }

        // If no category assigned, product is valid everywhere — clear any existing state
        if (!product.shopifyCategoryId) {
            await this.prisma.productValidationState.deleteMany({
                where: { productId },
            });
            return [];
        }

        // Get all required definitions for this category
        const requiredSchemas = await this.prisma.catalogMetafieldSchema.findMany({
            where: {
                shopifyCategoryId: product.shopifyCategoryId,
                isRequired: true,
            },
            include: { definition: true },
        });

        // If no required fields, product is valid
        if (requiredSchemas.length === 0) {
            await this.prisma.productValidationState.deleteMany({
                where: { productId },
            });
            return [];
        }

        // Get all active stores
        const stores = await this.prisma.shopifyStore.findMany({
            where: { isActive: true },
            select: { id: true },
        });

        const results: ValidationResult[] = [];

        // ─── 1. Global validation (storeId = null) ────────
        const globalResult = await this.validateForScope(
            productId, null, requiredSchemas,
        );
        results.push(globalResult);

        // ─── 2. Per-store validation ──────────────────────
        for (const store of stores) {
            const storeResult = await this.validateForScope(
                productId, store.id, requiredSchemas,
            );
            results.push(storeResult);
        }

        // ─── 3. Persist all states (find + create/update) ──
        for (const result of results) {
            const existing = await this.prisma.productValidationState.findFirst({
                where: { productId: result.productId, storeId: result.storeId },
            });

            if (existing) {
                await this.prisma.productValidationState.update({
                    where: { id: existing.id },
                    data: {
                        isValid: result.isValid,
                        missingRequired: result.missingRequired as any,
                    },
                });
            } else {
                await this.prisma.productValidationState.create({
                    data: {
                        productId: result.productId,
                        storeId: result.storeId,
                        isValid: result.isValid,
                        missingRequired: result.missingRequired as any,
                    },
                });
            }
        }

        // Clean up states for stores that no longer exist
        const validStoreIds = stores.map(s => s.id);
        await this.prisma.productValidationState.deleteMany({
            where: {
                productId,
                storeId: { notIn: [...validStoreIds], not: null },
            },
        });

        this.logger.log(
            `Revalidated product ${productId}: ${results.filter(r => r.isValid).length}/${results.length} valid`,
        );

        return results;
    }

    /**
     * Validate product for a specific scope (global or store-specific).
     * Uses effective value resolution: store-specific > global.
     */
    private async validateForScope(
        productId: string,
        storeId: string | null,
        requiredSchemas: any[],
    ): Promise<ValidationResult> {
        const productDefs = requiredSchemas.filter(
            (s: any) => s.definition.ownerType === 'PRODUCT',
        );

        if (productDefs.length === 0) {
            return { productId, storeId, isValid: true, missingRequired: [] };
        }

        const requiredDefIds = productDefs.map((s: any) => s.definitionId);

        // Get APPROVED values — effective resolution
        let approvedDefIds: Set<string>;

        if (storeId) {
            // Effective: store-specific overrides global
            const [storeValues, globalValues] = await Promise.all([
                this.prisma.metafieldValue.findMany({
                    where: {
                        ownerType: 'PRODUCT', ownerId: productId,
                        storeId, status: 'APPROVED',
                        definitionId: { in: requiredDefIds },
                    },
                    select: { definitionId: true },
                }),
                this.prisma.metafieldValue.findMany({
                    where: {
                        ownerType: 'PRODUCT', ownerId: productId,
                        storeId: null, status: 'APPROVED',
                        definitionId: { in: requiredDefIds },
                    },
                    select: { definitionId: true },
                }),
            ]);

            // Merge: global first, then store overrides
            approvedDefIds = new Set([
                ...globalValues.map(v => v.definitionId),
                ...storeValues.map(v => v.definitionId),
            ]);
        } else {
            // Global-only check
            const globalValues = await this.prisma.metafieldValue.findMany({
                where: {
                    ownerType: 'PRODUCT', ownerId: productId,
                    storeId: null, status: 'APPROVED',
                    definitionId: { in: requiredDefIds },
                },
                select: { definitionId: true },
            });
            approvedDefIds = new Set(globalValues.map(v => v.definitionId));
        }

        const missing: MissingField[] = productDefs
            .filter((s: any) => !approvedDefIds.has(s.definitionId))
            .map((s: any) => ({
                namespace: s.definition.namespace,
                key: s.definition.key,
                label: s.definition.label,
                ownerType: s.definition.ownerType,
                definitionId: s.definitionId,
            }));

        return {
            productId,
            storeId,
            isValid: missing.length === 0,
            missingRequired: missing,
        };
    }

    /**
     * Quick check: is product valid for a specific store (or global)?
     * Reads from persisted state — fast DB lookup.
     */
    async isProductValidForStore(
        productId: string,
        storeId: string | null,
    ): Promise<{ isValid: boolean; missingRequired: MissingField[] }> {
        const state = await this.prisma.productValidationState.findFirst({
            where: { productId, storeId },
        });

        // No state = no category = valid
        if (!state) return { isValid: true, missingRequired: [] };

        return {
            isValid: state.isValid,
            missingRequired: state.missingRequired as unknown as MissingField[],
        };
    }

    /**
     * Get all validation states for a product (global + per-store).
     * Used by UI to show badge per store.
     */
    async getProductValidation(productId: string): Promise<{
        global: { isValid: boolean; missingRequired: MissingField[] } | null;
        stores: { storeId: string; storeName: string; isValid: boolean; missingRequired: MissingField[] }[];
    }> {
        const states = await this.prisma.productValidationState.findMany({
            where: { productId },
            include: {
                store: { select: { id: true, storeName: true } },
            },
        });

        const globalState = states.find((s: any) => s.storeId === null);
        const storeStates = states
            .filter((s: any) => s.storeId !== null)
            .map((s: any) => ({
                storeId: s.storeId!,
                storeName: s.store?.storeName || 'Unknown',
                isValid: s.isValid,
                missingRequired: s.missingRequired as MissingField[],
            }));

        return {
            global: globalState
                ? { isValid: globalState.isValid, missingRequired: globalState.missingRequired as unknown as MissingField[] }
                : null,
            stores: storeStates,
        };
    }
}
