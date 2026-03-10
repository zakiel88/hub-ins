import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeMargin } from './product-margin.helper';

/**
 * Issue detection engine.
 * Scans products and variants for known rule violations
 * and creates/resolves ProductIssue records.
 */
@Injectable()
export class ProductRulesService {
    private readonly logger = new Logger(ProductRulesService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Run all rules for a single product and its variants.
     * Called after sync, import, or manual update.
     */
    async runRulesForProduct(productId: string): Promise<{ created: number; resolved: number }> {
        let created = 0;
        let resolved = 0;

        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            include: { images: { select: { id: true } } },
        });
        if (!product) return { created: 0, resolved: 0 };

        const p = product as any; // for new fields

        // ─── Product-level rules ──────────────────────────
        // Rule: MISSING_FEATURED_IMAGE
        const noImage = !p.featuredImageUrl && product.images.length === 0;
        const imgRule = await this.evaluateRule('MISSING_FEATURED_IMAGE', 'WARNING', productId, null, noImage,
            `Product "${product.title}" has no featured image`);
        if (imgRule === 'created') created++; if (imgRule === 'resolved') resolved++;

        // Rule: MISSING_CATEGORY
        const noCat = !product.productType && !product.category;
        const catRule = await this.evaluateRule('MISSING_CATEGORY', 'WARNING', productId, null, noCat,
            `Product "${product.title}" has no category or product type`);
        if (catRule === 'created') created++; if (catRule === 'resolved') resolved++;

        // Rule: MISSING_AVAILABILITY
        const noAvail = !p.availabilityType;
        const availRule = await this.evaluateRule('MISSING_AVAILABILITY', 'INFO', productId, null, noAvail,
            `Product "${product.title}" has no availability type set`);
        if (availRule === 'created') created++; if (availRule === 'resolved') resolved++;

        // Rule: MISSING_MATERIAL
        const noMat = !product.material;
        const matRule = await this.evaluateRule('MISSING_MATERIAL', 'INFO', productId, null, noMat,
            `Product "${product.title}" has no material specified`);
        if (matRule === 'created') created++; if (matRule === 'resolved') resolved++;

        // ─── Variant-level rules ──────────────────────────
        const variants = await this.prisma.productVariant.findMany({
            where: { productId },
        });

        const VALID_SIZES = new Set([
            'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL', '4XL', '5XL',
            'ONE SIZE', 'OS', 'FREE', 'FREESIZE', 'FREE SIZE', 'N/A',
        ]);

        for (const v of variants) {
            // Rule: MISSING_SKU
            const missingSku = await this.evaluateRule(
                'MISSING_SKU', 'ERROR', productId, v.id,
                !v.sku || v.sku.trim() === '',
                `Variant ${v.id} is missing SKU`,
            );
            if (missingSku === 'created') created++;
            if (missingSku === 'resolved') resolved++;

            // Rule: MISSING_VENDOR_COST
            const missingVc = await this.evaluateRule(
                'MISSING_VENDOR_COST', 'WARNING', productId, v.id,
                v.vendorCost == null,
                `Variant ${v.sku || v.id} is missing vendor cost`,
            );
            if (missingVc === 'created') created++;
            if (missingVc === 'resolved') resolved++;

            // Rule: MISSING_DISCOUNT (type set but value null, or vice versa)
            const discountMismatch = (v.insDiscountType != null && v.insDiscountValue == null)
                || (v.insDiscountType == null && v.insDiscountValue != null);
            const missingDiscount = await this.evaluateRule(
                'MISSING_DISCOUNT', 'WARNING', productId, v.id,
                discountMismatch,
                `Variant ${v.sku || v.id} has incomplete discount config`,
            );
            if (missingDiscount === 'created') created++;
            if (missingDiscount === 'resolved') resolved++;

            // Rule: MARGIN_NEGATIVE (price < vendorCost)
            const margin = computeMargin(v.price, v.vendorCost);
            const marginNeg = await this.evaluateRule(
                'MARGIN_NEGATIVE', 'ERROR', productId, v.id,
                margin != null && margin < 0,
                `Variant ${v.sku || v.id} has negative margin (${margin?.toFixed(1)}%)`,
            );
            if (marginNeg === 'created') created++;
            if (marginNeg === 'resolved') resolved++;

            // Rule: INVALID_SIZE_FORMAT
            const sizeVal = v.size?.toUpperCase().trim() || '';
            const isNumericSize = sizeVal && /^\d+(\.\d+)?$/.test(sizeVal);
            const numSize = isNumericSize ? parseFloat(sizeVal) : NaN;
            const isValidSize = !sizeVal || VALID_SIZES.has(sizeVal) || (isNumericSize && numSize >= 20 && numSize <= 60);
            const sizeRule = await this.evaluateRule(
                'INVALID_SIZE_FORMAT', 'WARNING', productId, v.id,
                sizeVal !== '' && !isValidSize,
                `Variant ${v.sku || v.id} has non-standard size "${v.size}"`,
            );
            if (sizeRule === 'created') created++;
            if (sizeRule === 'resolved') resolved++;

            // Rule: INVALID_COLOR_FORMAT
            const colorVal = v.color?.trim() || '';
            const invalidColor = !colorVal || /^\d+$/.test(colorVal);
            const colorRule = await this.evaluateRule(
                'INVALID_COLOR_FORMAT', 'INFO', productId, v.id,
                invalidColor && colorVal === '',
                `Variant ${v.sku || v.id} is missing color`,
            );
            if (colorRule === 'created') created++;
            if (colorRule === 'resolved') resolved++;
        }

        this.logger.log(`Rules for product ${productId}: ${created} created, ${resolved} resolved`);
        return { created, resolved };
    }

    /**
     * Evaluate a single rule against current state.
     * - If violated and no OPEN issue exists → create
     * - If not violated and OPEN issue exists → auto-resolve
     */
    private async evaluateRule(
        ruleCode: string,
        severity: string,
        productId: string,
        variantId: string | null,
        isViolated: boolean,
        message: string,
    ): Promise<'created' | 'resolved' | 'unchanged'> {
        const existing = await this.prisma.productIssue.findFirst({
            where: {
                ruleCode,
                productId,
                variantId,
                status: 'OPEN',
            },
        });

        if (isViolated && !existing) {
            await this.prisma.productIssue.create({
                data: {
                    productId,
                    variantId,
                    ruleCode,
                    severity: severity as any,
                    status: 'OPEN',
                    message,
                },
            });
            return 'created';
        }

        if (!isViolated && existing) {
            await this.prisma.productIssue.update({
                where: { id: existing.id },
                data: {
                    status: 'RESOLVED',
                    resolvedAt: new Date(),
                },
            });
            return 'resolved';
        }

        return 'unchanged';
    }

    /** Batch: run rules for all active products */
    async runRulesAll(): Promise<{ productsChecked: number; created: number; resolved: number }> {
        const products = await this.prisma.product.findMany({
            where: { status: { not: 'ARCHIVED' } },
            select: { id: true },
        });

        let totalCreated = 0;
        let totalResolved = 0;

        for (const p of products) {
            const result = await this.runRulesForProduct(p.id);
            totalCreated += result.created;
            totalResolved += result.resolved;
        }

        this.logger.log(`Rules scan complete: ${products.length} products, ${totalCreated} issues created, ${totalResolved} resolved`);
        return { productsChecked: products.length, created: totalCreated, resolved: totalResolved };
    }
}
