import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { applyPipelineMapping } from '../config/pipeline-mapping';
import * as crypto from 'crypto';
import { getConfig } from '../config/configuration';

@Injectable()
export class OrderSyncService {
    private readonly logger = new Logger(OrderSyncService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    private decrypt(encrypted: string, ivHex: string): string {
        const key = Buffer.from(getConfig().ENCRYPTION_KEY, 'hex');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    /** Sync orders from a Shopify store */
    async syncOrders(storeId: string, userId: string, limit = 50, sinceDate?: string) {
        const store = await this.prisma.shopifyStore.findUnique({ where: { id: storeId } });
        if (!store) throw new NotFoundException('Store not found');
        if (!store.isActive) throw new NotFoundException('Store is inactive');

        const token = this.decrypt(store.accessTokenEnc, store.tokenIv);

        // Build initial URL with date filter if provided
        let url = `https://${store.shopifyDomain}/admin/api/${store.apiVersion}/orders.json?limit=${Math.min(limit, 250)}&status=any`;
        if (sinceDate) {
            url += `&created_at_min=${sinceDate}T00:00:00Z`;
        }

        this.logger.log(`Syncing orders from ${store.storeName} (since: ${sinceDate || 'default'})`);

        let created = 0;
        let updated = 0;
        let totalFetched = 0;
        let pageUrl: string | null = url;

        // Paginate through all orders
        while (pageUrl) {
            const res = await fetch(pageUrl, {
                headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
            });

            if (!res.ok) {
                const body = await res.text();
                this.logger.error(`Shopify API error ${res.status}: ${body}`);
                throw new Error(`Shopify API error: ${res.status}`);
            }

            const data: any = await res.json();
            const shopifyOrders: any[] = data.orders || [];
            totalFetched += shopifyOrders.length;

            for (const so of shopifyOrders) {
                const result = await this.upsertOrder(store.id, so);
                if (result === 'created') created++;
                else updated++;
            }

            this.logger.log(`Page synced: ${shopifyOrders.length} orders (total: ${totalFetched})`);

            // Check for next page via Link header
            const linkHeader = res.headers.get('link');
            pageUrl = null;
            if (linkHeader) {
                const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
                if (nextMatch) {
                    pageUrl = nextMatch[1];
                }
            }
        }

        // Update lastSyncAt
        await this.prisma.shopifyStore.update({
            where: { id: storeId },
            data: { lastSyncAt: new Date() },
        });

        // Create sync log
        await this.prisma.syncLog.create({
            data: {
                shopifyStoreId: storeId,
                entityType: 'orders',
                syncType: sinceDate ? 'full_resync' : 'manual',
                status: 'completed',
                totalRecords: totalFetched,
                syncedRecords: created + updated,
                completedAt: new Date(),
            },
        });

        await this.audit.log({
            userId,
            action: 'orders.sync',
            entityType: 'ShopifyStore',
            entityId: storeId,
            changes: { fetched: totalFetched, created, updated, sinceDate },
        });

        this.logger.log(`Sync complete: ${totalFetched} fetched, ${created} created, ${updated} updated`);
        return { data: { fetched: totalFetched, created, updated } };
    }

    /** Extract tracking info from Shopify fulfillments */
    private extractTracking(so: any): { trackingNumber?: string; trackingCompany?: string; trackingUrl?: string } {
        const fulfillments = so.fulfillments || [];
        if (fulfillments.length === 0) return {};
        // Use the latest fulfillment
        const latest = fulfillments[fulfillments.length - 1];
        return {
            trackingNumber: latest.tracking_number || latest.tracking_numbers?.[0] || undefined,
            trackingCompany: latest.tracking_company || undefined,
            trackingUrl: latest.tracking_url || latest.tracking_urls?.[0] || undefined,
        };
    }

    /** Upsert a single Shopify order into DB */
    private async upsertOrder(storeId: string, so: any): Promise<'created' | 'updated'> {
        const customerName = so.customer
            ? `${so.customer.first_name || ''} ${so.customer.last_name || ''}`.trim()
            : null;
        const customerPhone =
            so.shipping_address?.phone || so.phone || so.customer?.phone || null;

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
            : undefined;

        const existing = await this.prisma.order.findUnique({
            where: {
                uq_order_store_shopify: {
                    shopifyStoreId: storeId,
                    shopifyOrderId: BigInt(so.id),
                },
            },
        });

        if (existing) {
            const tracking = this.extractTracking(so);
            const updateData: any = {
                status: so.fulfillment_status === 'fulfilled' ? 'closed' : 'open',
                financialStatus: so.financial_status,
                fulfillmentStatus: so.fulfillment_status,
                customerEmail: so.email || so.customer?.email,
                customerName,
                customerPhone,
                ...(shippingAddress ? { shippingAddress } : {}),
                shippingCountry: so.shipping_address?.country_code || null,
                shippingCity: so.shipping_address?.city || null,
            };
            // Update tracking if available
            if (tracking.trackingNumber) updateData.trackingNumber = tracking.trackingNumber;
            if (tracking.trackingCompany) updateData.trackingCompany = tracking.trackingCompany;
            if (tracking.trackingUrl) updateData.trackingUrl = tracking.trackingUrl;

            // Auto pipeline state transitions based on Shopify data
            const newState = applyPipelineMapping(existing.pipelineState, {
                fulfillmentStatus: so.fulfillment_status,
                financialStatus: so.financial_status,
                cancelledAt: so.cancelled_at,
            });
            if (newState) {
                updateData.pipelineState = newState;
                this.logger.log(`Auto-transition order ${existing.orderNumber}: ${existing.pipelineState} → ${newState}`);
            }

            await this.prisma.order.update({
                where: { id: existing.id },
                data: updateData,
            });
            return 'updated';
        }

        // Determine initial pipeline state
        const tracking = this.extractTracking(so);
        let pipelineState = 'NEW_FROM_SHOPIFY';
        if (so.fulfillment_status === 'fulfilled') {
            pipelineState = 'FULFILLED';
        }

        // New order
        const order = await this.prisma.order.create({
            data: {
                shopifyStoreId: storeId,
                shopifyOrderId: BigInt(so.id),
                orderNumber: so.name || `#${so.order_number}`,
                status: so.fulfillment_status === 'fulfilled' ? 'closed' : 'open',
                financialStatus: so.financial_status,
                fulfillmentStatus: so.fulfillment_status,
                customerEmail: so.email || so.customer?.email,
                customerName,
                customerPhone,
                ...(shippingAddress ? { shippingAddress } : {}),
                shippingCountry: so.shipping_address?.country_code || null,
                shippingCity: so.shipping_address?.city || null,
                pipelineState,
                flags: {},
                notes: so.note,
                trackingNumber: tracking.trackingNumber || null,
                trackingCompany: tracking.trackingCompany || null,
                trackingUrl: tracking.trackingUrl || null,
                shopifyRawPayload: so,
                totalPrice: parseFloat(so.total_price),
                currency: so.currency,
                orderDate: new Date(so.created_at),
            },
        });

        // Create line items
        for (const li of so.line_items || []) {
            let colorwayId: string | null = null;
            let mappingStatus = 'UNMAPPED';

            if (li.sku) {
                const colorway = await this.prisma.colorway.findUnique({
                    where: { sku: li.sku },
                });
                if (colorway) {
                    colorwayId = colorway.id;
                    mappingStatus = 'MAPPED';
                }
            }

            await this.prisma.orderLineItem.create({
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

        return 'created';
    }

    /** Process a Shopify webhook payload */
    async processWebhook(shopifyDomain: string, payload: any) {
        const store = await this.prisma.shopifyStore.findUnique({
            where: { shopifyDomain },
        });
        if (!store) {
            this.logger.warn(`Webhook from unknown store: ${shopifyDomain}`);
            return;
        }

        await this.upsertOrder(store.id, payload);
        this.logger.log(`Webhook: processed order ${payload.name} from ${shopifyDomain}`);
    }
}
