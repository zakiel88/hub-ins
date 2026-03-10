import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ProductRulesService } from './product-rules.service';
import { computeMargin } from './product-margin.helper';
import * as XLSX from 'xlsx';

/**
 * Brand Intake Import Service.
 * Parses CSV/XLSX brand sheets, validates, previews, and commits
 * products + variants into the system.
 */

// Required column headers (case-insensitive, flexible matching)
const COLUMN_MAP: Record<string, string[]> = {
    brand: ['brand', 'brand name', 'brand_name'],
    styleCode: ['product code', 'style code', 'style_code', 'product_code', 'style'],
    title: ['title', 'product title', 'product_title', 'product name', 'name'],
    productType: ['product type', 'product_type', 'type'],
    category: ['category'],
    sku: ['sku', 'variant sku', 'variant_sku'],
    color: ['color', 'colour', 'variant color'],
    size: ['size', 'variant size'],
    price: ['price', 'retail price', 'retail_price', 'selling price'],
    vendorCost: ['vendor cost', 'vendor_cost', 'cost', 'wholesale price', 'wholesale'],
    compareAtPrice: ['compare at price', 'compare_at_price', 'compare price', 'original price', 'rrp'],
    featuredImageUrl: ['featured image url', 'featured_image_url', 'image url', 'image_url', 'image', 'featured image'],
    material: ['material', 'fabric', 'composition'],
    season: ['season', 'collection season'],
    availabilityType: ['availability type', 'availability_type', 'availability'],
    leadTimeDays: ['lead time', 'lead_time', 'lead time days', 'lead_time_days'],
    barcode: ['barcode', 'ean', 'upc'],
    weight: ['weight', 'weight grams', 'weight_grams'],
};

const REQUIRED_FIELDS = ['brand', 'title', 'sku', 'price'];

interface IntakeRow {
    rowNum: number;
    raw: Record<string, any>;
    parsed: {
        brand?: string;
        styleCode?: string;
        title?: string;
        productType?: string;
        category?: string;
        sku?: string;
        color?: string;
        size?: string;
        price?: number;
        vendorCost?: number;
        compareAtPrice?: number;
        featuredImageUrl?: string;
        material?: string;
        season?: string;
        availabilityType?: string;
        leadTimeDays?: number;
        barcode?: string;
        weight?: number;
    };
    errors: string[];
    warnings: string[];
}

@Injectable()
export class IntakeService {
    private readonly logger = new Logger(IntakeService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly rules: ProductRulesService,
    ) { }

    // ─── Parse uploaded file ───────────────────────────
    parseFile(buffer: Buffer, mimetype: string): Record<string, any>[] {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new BadRequestException('Empty file — no sheets found');

        const sheet = workbook.Sheets[sheetName];
        const jsonRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (jsonRows.length === 0) throw new BadRequestException('Sheet has no data rows');
        return jsonRows;
    }

    // ─── Map headers → known fields ───────────────────
    private mapHeaders(rawHeaders: string[]): Record<string, string> {
        const headerMap: Record<string, string> = {};
        const normalizedHeaders = rawHeaders.map(h => h.toString().toLowerCase().trim());

        for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
            for (const alias of aliases) {
                const idx = normalizedHeaders.indexOf(alias);
                if (idx >= 0) {
                    headerMap[field] = rawHeaders[idx];
                    break;
                }
            }
        }

        return headerMap;
    }

    // ─── Validate + Parse rows ────────────────────────
    validateRows(rawRows: Record<string, any>[]): {
        rows: IntakeRow[];
        summary: { total: number; valid: number; errors: number; warnings: number };
        headerMap: Record<string, string>;
        missingRequiredHeaders: string[];
    } {
        // Build header map from first row's keys
        const rawHeaders = Object.keys(rawRows[0] || {});
        const headerMap = this.mapHeaders(rawHeaders);

        // Check required headers
        const missingRequiredHeaders = REQUIRED_FIELDS.filter(f => !headerMap[f]);

        const rows: IntakeRow[] = [];
        const skuSet = new Set<string>();

        for (let i = 0; i < rawRows.length; i++) {
            const raw = rawRows[i];
            const errors: string[] = [];
            const warnings: string[] = [];

            const get = (field: string): any => headerMap[field] ? raw[headerMap[field]] : undefined;

            // Parse numeric values
            const parseNum = (val: any): number | undefined => {
                if (val === undefined || val === null || val === '') return undefined;
                const n = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
                return isNaN(n) ? undefined : n;
            };

            const parsed: IntakeRow['parsed'] = {
                brand: String(get('brand') || '').trim() || undefined,
                styleCode: String(get('styleCode') || '').trim() || undefined,
                title: String(get('title') || '').trim() || undefined,
                productType: String(get('productType') || '').trim() || undefined,
                category: String(get('category') || '').trim() || undefined,
                sku: String(get('sku') || '').trim() || undefined,
                color: String(get('color') || '').trim() || undefined,
                size: String(get('size') || '').trim() || undefined,
                price: parseNum(get('price')),
                vendorCost: parseNum(get('vendorCost')),
                compareAtPrice: parseNum(get('compareAtPrice')),
                featuredImageUrl: String(get('featuredImageUrl') || '').trim() || undefined,
                material: String(get('material') || '').trim() || undefined,
                season: String(get('season') || '').trim() || undefined,
                availabilityType: String(get('availabilityType') || '').trim() || undefined,
                leadTimeDays: parseNum(get('leadTimeDays')) ? Math.round(parseNum(get('leadTimeDays'))!) : undefined,
                barcode: String(get('barcode') || '').trim() || undefined,
                weight: parseNum(get('weight')),
            };

            // Validate required fields
            if (!parsed.brand) errors.push('Missing brand');
            if (!parsed.title) errors.push('Missing title');
            if (!parsed.sku) errors.push('Missing SKU');
            if (parsed.price == null) errors.push('Missing price');

            // Validate SKU uniqueness within file
            if (parsed.sku) {
                if (skuSet.has(parsed.sku)) {
                    errors.push(`Duplicate SKU in file: ${parsed.sku}`);
                }
                skuSet.add(parsed.sku);
            }

            // Validate price is positive
            if (parsed.price != null && parsed.price <= 0) errors.push('Price must be positive');

            // Warnings for optional but recommended fields
            if (!parsed.styleCode) warnings.push('Missing style code');
            if (!parsed.color) warnings.push('Missing color');
            if (!parsed.size) warnings.push('Missing size');
            if (!parsed.vendorCost) warnings.push('Missing vendor cost');

            rows.push({ rowNum: i + 2, raw, parsed, errors, warnings }); // +2 for header + 0-index
        }

        const valid = rows.filter(r => r.errors.length === 0).length;
        const errCount = rows.filter(r => r.errors.length > 0).length;
        const warnCount = rows.filter(r => r.warnings.length > 0).length;

        return {
            rows,
            summary: { total: rows.length, valid, errors: errCount, warnings: warnCount },
            headerMap,
            missingRequiredHeaders,
        };
    }

    // ─── Preview (no DB writes) ───────────────────────
    async preview(buffer: Buffer, mimetype: string) {
        const rawRows = this.parseFile(buffer, mimetype);
        const result = this.validateRows(rawRows);

        // Group products for summary
        const productKeys = new Set(result.rows.map(r => `${r.parsed.brand}::${r.parsed.styleCode || r.parsed.title}`));

        return {
            ...result,
            productCount: productKeys.size,
            variantCount: result.rows.filter(r => r.errors.length === 0).length,
        };
    }

    // ─── Commit to DB ─────────────────────────────────
    async commit(buffer: Buffer, mimetype: string, userId: string) {
        const rawRows = this.parseFile(buffer, mimetype);
        const { rows, summary, missingRequiredHeaders } = this.validateRows(rawRows);

        if (missingRequiredHeaders.length > 0) {
            throw new BadRequestException(`Missing required columns: ${missingRequiredHeaders.join(', ')}`);
        }

        const validRows = rows.filter(r => r.errors.length === 0);
        if (validRows.length === 0) {
            throw new BadRequestException('No valid rows to import');
        }

        // Load all brands for matching
        const brands = await this.prisma.brand.findMany({
            select: { id: true, name: true, code: true },
        });

        // Create intake job
        const job = await this.prisma.productSyncJob.create({
            data: {
                source: 'intake',
                status: 'running',
                totalItems: validRows.length,
            },
        });

        let created = 0;
        let updated = 0;
        let skipped = 0;
        let failed = 0;
        const affectedProductIds = new Set<string>();

        // Group rows by product key (brand + styleCode or title)
        const productGroups = new Map<string, IntakeRow[]>();
        for (const row of validRows) {
            const key = `${row.parsed.brand}::${row.parsed.styleCode || row.parsed.title}`;
            if (!productGroups.has(key)) productGroups.set(key, []);
            productGroups.get(key)!.push(row);
        }

        for (const [_key, groupRows] of productGroups) {
            try {
                const first = groupRows[0].parsed;

                // Match brand
                const brandId = this.matchBrand(first.brand, brands);

                // Find existing product by styleCode + brand, or by title + brand
                let product = null;
                if (first.styleCode && brandId) {
                    product = await this.prisma.product.findFirst({
                        where: { styleCode: first.styleCode, brandId },
                    });
                }
                if (!product && first.title && brandId) {
                    product = await this.prisma.product.findFirst({
                        where: { title: first.title, brandId },
                    });
                }

                if (product) {
                    // Update existing product
                    await this.prisma.product.update({
                        where: { id: product.id },
                        data: {
                            title: first.title || product.title,
                            productType: first.productType || product.productType,
                            category: first.category || product.category,
                            material: first.material || product.material,
                            season: first.season || product.season,
                            featuredImageUrl: first.featuredImageUrl || (product as any).featuredImageUrl,
                            availabilityType: first.availabilityType || (product as any).availabilityType,
                            leadTimeDays: first.leadTimeDays ?? (product as any).leadTimeDays,
                        },
                    });
                } else {
                    // Create new product
                    product = await this.prisma.product.create({
                        data: {
                            title: first.title!,
                            styleCode: first.styleCode || null,
                            brandId: brandId || null,
                            productType: first.productType || null,
                            category: first.category || null,
                            material: first.material || null,
                            season: first.season || null,
                            featuredImageUrl: first.featuredImageUrl || null,
                            availabilityType: first.availabilityType || null,
                            leadTimeDays: first.leadTimeDays || null,
                            status: 'ACTIVE',
                        },
                    });
                }

                affectedProductIds.add(product.id);

                // Upsert variants
                for (const row of groupRows) {
                    try {
                        const v = row.parsed;
                        const margin = computeMargin(v.price, v.vendorCost);

                        const variantData = {
                            productId: product.id,
                            title: `${first.title} - ${v.color || '—'} / ${v.size || '—'}`,
                            color: v.color || null,
                            size: v.size || null,
                            option1: v.color || null,
                            option2: v.size || null,
                            barcode: v.barcode || null,
                            weightGrams: v.weight ? Math.round(v.weight) : null,
                            price: v.price ?? null,
                            compareAtPrice: v.compareAtPrice ?? null,
                            vendorCost: v.vendorCost ?? null,
                            estimatedMargin: margin,
                            imageUrl: v.featuredImageUrl || null,
                            status: 'ACTIVE' as const,
                        };

                        const existing = await this.prisma.productVariant.findUnique({
                            where: { sku: v.sku! },
                        });

                        if (existing) {
                            await this.prisma.productVariant.update({
                                where: { sku: v.sku! },
                                data: variantData,
                            });
                            updated++;
                        } else {
                            await this.prisma.productVariant.create({
                                data: { sku: v.sku!, ...variantData },
                            });
                            created++;
                        }
                    } catch (err: any) {
                        failed++;
                        await this.addLog(job.id, 'error', `Row ${row.rowNum}: ${err.message}`, { sku: row.parsed.sku });
                    }
                }
            } catch (err: any) {
                failed += groupRows.length;
                await this.addLog(job.id, 'error', `Product group error: ${err.message}`);
            }
        }

        // Run rules for affected products
        for (const pid of affectedProductIds) {
            await this.rules.runRulesForProduct(pid);
        }

        // Finalize job
        await this.prisma.productSyncJob.update({
            where: { id: job.id },
            data: {
                status: failed > 0 ? 'completed_with_errors' : 'completed',
                created,
                updated,
                skipped,
                failed,
                completedAt: new Date(),
            },
        });

        await this.addLog(job.id, 'info', `Import complete: ${created} created, ${updated} updated, ${failed} failed`);

        await this.audit.log({
            userId,
            action: 'intake.commit',
            entityType: 'ProductSyncJob',
            entityId: job.id,
            changes: { created, updated, failed, totalRows: validRows.length },
        });

        this.logger.log(`Intake import done: ${created} created, ${updated} updated, ${failed} failed`);

        return {
            jobId: job.id,
            summary: { created, updated, skipped, failed, total: validRows.length, errors: summary.errors },
            productsAffected: affectedProductIds.size,
        };
    }

    // ─── Helpers ──────────────────────────────────────
    private matchBrand(
        brandName: string | undefined,
        brands: { id: string; name: string; code: string }[],
    ): string | null {
        if (!brandName) return null;
        const normalized = brandName.toLowerCase().trim();

        // Exact code match
        const byCode = brands.find(b => b.code.toLowerCase() === normalized);
        if (byCode) return byCode.id;

        // Exact name match
        const byName = brands.find(b => b.name.toLowerCase() === normalized);
        if (byName) return byName.id;

        // Partial name match
        const partial = brands.find(b =>
            b.name.toLowerCase().includes(normalized) || normalized.includes(b.name.toLowerCase()),
        );
        return partial?.id || null;
    }

    private async addLog(jobId: string, level: string, message: string, data?: any) {
        await this.prisma.productSyncLog.create({
            data: {
                jobId,
                action: level === 'error' ? 'FAILED' : 'CREATED',
                level,
                message,
                data: data || undefined,
            },
        });
    }
}
