import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ShopifyStoresService } from '../shopify-stores/shopify-stores.service';
import { applyPipelineMapping } from '../config/pipeline-mapping';
import * as crypto from 'crypto';
import { getConfig } from '../config/configuration';

@Injectable()
export class OrderSyncService {
    private readonly logger = new Logger(OrderSyncService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly shopifyStores: ShopifyStoresService,
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

        // Use auto-refresh token — if expired, will re-exchange client credentials
        const { token, refreshed } = await this.shopifyStores.getValidToken(storeId);
        if (refreshed) {
            this.logger.log(`Token was auto-refreshed for ${store.storeName} before sync`);
        }

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

    /** Extract financial, billing, discount, shipping method, payment fields from Shopify order */
    private extractLarkFields(so: any): Record<string, any> {
        // --- Financial breakdown ---
        const totalLineItemsPrice = so.total_line_items_price
            ? parseFloat(so.total_line_items_price)
            : null;
        const totalShippingPrice = so.total_shipping_price_set?.shop_money?.amount
            ? parseFloat(so.total_shipping_price_set.shop_money.amount)
            : null;
        const totalDiscounts = so.current_total_discounts
            ? parseFloat(so.current_total_discounts)
            : (so.total_discounts ? parseFloat(so.total_discounts) : null);
        const totalTip = so.total_tip_received
            ? parseFloat(so.total_tip_received)
            : null;
        const totalWeight = so.total_weight != null
            ? parseFloat(so.total_weight)
            : null;

        // Total quantity = sum of line item quantities
        const totalQuantity = (so.line_items || []).reduce(
            (sum: number, li: any) => sum + (li.quantity || 0), 0,
        ) || null;

        // --- Billing address (JSON) ---
        const billingAddress = so.billing_address
            ? {
                firstName: so.billing_address.first_name,
                lastName: so.billing_address.last_name,
                address1: so.billing_address.address1,
                address2: so.billing_address.address2,
                city: so.billing_address.city,
                province: so.billing_address.province,
                provinceCode: so.billing_address.province_code,
                country: so.billing_address.country,
                countryCode: so.billing_address.country_code,
                zip: so.billing_address.zip,
            }
            : undefined;

        // --- Discount details ---
        const discountApps = so.discount_applications || [];
        const discountCodesArr = so.discount_codes || [];
        const discountCodes = discountCodesArr.length
            ? discountCodesArr.map((dc: any) => dc.code).join(', ')
            : null;
        const firstDiscount = discountApps[0] || discountCodesArr[0];
        const discountValue = firstDiscount?.value
            ? parseFloat(firstDiscount.value)
            : null;
        const discountValueType = firstDiscount?.value_type || firstDiscount?.type || null;
        const discountTargetType = firstDiscount?.target_type || null;
        const discountDescription = firstDiscount?.description || null;
        const discountTitle = firstDiscount?.title || firstDiscount?.code || null;

        // --- Shipping method ---
        const shippingLine = (so.shipping_lines || [])[0];
        const shippingMethodCode = shippingLine?.code || null;
        const shippingMethodSource = shippingLine?.source || null;

        // --- Payment ---
        const paymentGateway = (so.payment_gateway_names || [])[0] || null;

        // --- Shipment status ---
        const fulfillments = so.fulfillments || [];
        const latestFulfillment = fulfillments[fulfillments.length - 1];
        const shipmentStatus = latestFulfillment?.shipment_status || null;

        return {
            totalLineItemsPrice,
            totalShippingPrice,
            totalDiscounts,
            totalTip,
            totalWeight,
            totalQuantity,
            ...(billingAddress ? { billingAddress } : {}),
            discountCodes,
            discountValue,
            discountValueType,
            discountTargetType,
            discountDescription,
            discountTitle,
            shippingMethodCode,
            shippingMethodSource,
            paymentGateway,
            shipmentStatus,
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
            const larkFields = this.extractLarkFields(so);
            const updateData: any = {
                ...larkFields,
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

            // Also sync line items for existing orders (they may be missing)
            await this.syncLineItems(existing.id, so.line_items || []);

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
                ...this.extractLarkFields(so),
            },
        });

        // Create line items
        await this.syncLineItems(order.id, so.line_items || []);

        return 'created';
    }

    /** Sync line items for an order — upsert to avoid duplicates */
    private async syncLineItems(orderId: string, lineItems: any[]) {
        for (const li of lineItems) {
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

            // Check if line item already exists (by shopifyLineItemId)
            const existing = await this.prisma.orderLineItem.findFirst({
                where: {
                    orderId,
                    shopifyLineItemId: BigInt(li.id),
                },
            });

            if (existing) {
                // Update existing line item (quantity, price may change)
                await this.prisma.orderLineItem.update({
                    where: { id: existing.id },
                    data: {
                        title: li.title,
                        sku: li.sku,
                        quantity: li.quantity,
                        unitPrice: parseFloat(li.price),
                        totalPrice: parseFloat(li.price) * li.quantity,
                        colorwayId,
                        mappingStatus,
                    },
                });
            } else {
                // Create new line item
                await this.prisma.orderLineItem.create({
                    data: {
                        orderId,
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
        }
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
