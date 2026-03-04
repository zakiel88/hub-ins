import { Controller, Post, Req, Res, RawBodyRequest, Logger, Headers } from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { OrderSyncService } from './order-sync.service';
import { AuditService } from '../audit/audit.service';
import { applyPipelineMapping } from '../config/pipeline-mapping';
import { Public } from '../auth/decorators/public.decorator';
import * as crypto from 'crypto';

@Controller('api/v1/webhooks')
@Public()
export class WebhookController {
    private readonly logger = new Logger(WebhookController.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly syncService: OrderSyncService,
        private readonly audit: AuditService,
    ) { }

    /**
     * Shopify Webhook Endpoint
     * POST /api/v1/webhooks/shopify
     */
    @Post('shopify')
    async handleShopifyWebhook(
        @Headers('x-shopify-topic') topic: string,
        @Headers('x-shopify-hmac-sha256') hmac: string,
        @Headers('x-shopify-shop-domain') shopDomain: string,
        @Headers('x-shopify-webhook-id') webhookId: string,
        @Req() req: RawBodyRequest<Request>,
        @Res() res: Response,
    ) {
        // Acknowledge immediately (Shopify expects 200 within 5s)
        res.status(200).send('OK');

        this.logger.log(`Webhook received: ${topic} from ${shopDomain} (${webhookId})`);

        try {
            // 1. Find store
            const store = await this.prisma.shopifyStore.findUnique({
                where: { shopifyDomain: shopDomain },
            });
            if (!store) {
                this.logger.warn(`Webhook from unknown store: ${shopDomain}`);
                return;
            }

            // 2. Verify HMAC signature using Shopify's client secret
            if (req.rawBody && hmac) {
                // Shopify signs webhooks with the app's client secret
                let secret: string | null = null;
                if (store.clientSecretEnc && store.clientSecretIv) {
                    try {
                        const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
                        const iv = Buffer.from(store.clientSecretIv, 'hex');
                        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
                        secret = decipher.update(store.clientSecretEnc, 'hex', 'utf8') + decipher.final('utf8');
                    } catch {
                        this.logger.warn(`Could not decrypt client secret for ${shopDomain}, skipping HMAC`);
                    }
                }
                if (secret) {
                    const computed = crypto
                        .createHmac('sha256', secret)
                        .update(req.rawBody)
                        .digest('base64');
                    if (computed !== hmac) {
                        this.logger.error(`HMAC mismatch for ${shopDomain} — rejecting webhook`);
                        return;
                    }
                    this.logger.log(`HMAC verified for ${shopDomain}`);
                }
            }

            // 3. Parse payload
            const payload = req.body;
            const payloadHash = crypto
                .createHash('sha256')
                .update(JSON.stringify(payload))
                .digest('hex');

            // 4. Dedup check via WebhookEvent
            const existing = await this.prisma.webhookEvent.findFirst({
                where: { shopifyStoreId: store.id, payloadHash },
            });
            if (existing) {
                this.logger.log(`Duplicate webhook skipped (hash: ${payloadHash.slice(0, 8)})`);
                return;
            }

            // 5. Log WebhookEvent
            await this.prisma.webhookEvent.create({
                data: {
                    shopifyStoreId: store.id,
                    shopifyWebhookId: webhookId || `wh_${Date.now()}`,
                    topic,
                    shopifyEntityId: payload.id ? BigInt(payload.id) : null,
                    payloadHash,
                    rawPayload: payload,
                    status: 'processing',
                },
            });

            // 6. Route by topic
            if (topic.startsWith('orders/')) {
                await this.processOrderWebhook(store.id, topic, payload);
            }

            // 7. Mark as processed
            await this.prisma.webhookEvent.updateMany({
                where: { payloadHash },
                data: { status: 'processed', processedAt: new Date() },
            });
        } catch (err: any) {
            this.logger.error(`Webhook error: ${err.message}`, err.stack);
            // Log error in webhook event
            await this.prisma.webhookEvent.updateMany({
                where: { shopifyWebhookId: webhookId },
                data: { status: 'failed', errorMessage: err.message, attempts: { increment: 1 } },
            }).catch(() => { });
        }
    }

    /**
     * Mock webhook endpoint for local dev testing
     * POST /api/v1/webhooks/shopify/test
     */
    @Post('shopify/test')
    async handleTestWebhook(
        @Req() req: Request,
        @Res() res: Response,
    ) {
        const payload = req.body;
        const topic = (req.headers['x-shopify-topic'] as string) || 'orders/updated';
        const shopDomain = (req.headers['x-shopify-shop-domain'] as string) || '';

        this.logger.log(`[TEST] Webhook: ${topic} from ${shopDomain}`);

        const store = shopDomain
            ? await this.prisma.shopifyStore.findUnique({ where: { shopifyDomain: shopDomain } })
            : await this.prisma.shopifyStore.findFirst({ where: { isActive: true } });

        if (!store) {
            return res.status(404).json({ error: 'Store not found' });
        }

        try {
            await this.processOrderWebhook(store.id, topic, payload);
            return res.json({ success: true, topic, storeId: store.id });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    /**
     * Process an order webhook — diff old/new, create OrderLog, update order
     */
    private async processOrderWebhook(storeId: string, topic: string, payload: any) {
        const shopifyOrderId = BigInt(payload.id);

        // Find existing order
        const existing = await this.prisma.order.findUnique({
            where: { uq_order_store_shopify: { shopifyStoreId: storeId, shopifyOrderId } },
        });

        if (topic === 'orders/create' && !existing) {
            // New order — delegate to sync service upsert
            await (this.syncService as any).upsertOrder(storeId, payload);
            this.logger.log(`Webhook: created order ${payload.name}`);
            return;
        }

        if (!existing) {
            this.logger.warn(`Webhook update for unknown order ${payload.name} — skipping`);
            return;
        }

        // Build update fields + diff
        const tracking = this.extractTracking(payload);
        const newData: Record<string, any> = {
            financialStatus: payload.financial_status,
            fulfillmentStatus: payload.fulfillment_status,
            customerEmail: payload.email || payload.customer?.email,
            customerName: payload.customer
                ? `${payload.customer.first_name || ''} ${payload.customer.last_name || ''}`.trim()
                : existing.customerName,
            customerPhone: payload.shipping_address?.phone || payload.phone || payload.customer?.phone || existing.customerPhone,
            shopifyRawPayload: payload,
        };

        // Add tracking if available
        if (tracking.trackingNumber) newData.trackingNumber = tracking.trackingNumber;
        if (tracking.trackingCompany) newData.trackingCompany = tracking.trackingCompany;
        if (tracking.trackingUrl) newData.trackingUrl = tracking.trackingUrl;

        // Update shipping address if changed
        if (payload.shipping_address) {
            newData.shippingAddress = {
                address1: payload.shipping_address.address1,
                address2: payload.shipping_address.address2,
                city: payload.shipping_address.city,
                province: payload.shipping_address.province,
                country: payload.shipping_address.country,
                countryCode: payload.shipping_address.country_code,
                zip: payload.shipping_address.zip,
            };
            newData.shippingCountry = payload.shipping_address.country_code || null;
            newData.shippingCity = payload.shipping_address.city || null;
        }

        // Compute diff (old vs new)
        const changedFields: Record<string, { old: any; new: any }> = {};
        const fieldsToCompare = [
            'financialStatus', 'fulfillmentStatus', 'customerEmail', 'customerName',
            'customerPhone', 'trackingNumber', 'trackingCompany', 'trackingUrl',
            'shippingCountry', 'shippingCity',
        ];

        for (const field of fieldsToCompare) {
            const oldVal = (existing as any)[field];
            const newVal = newData[field];
            if (newVal !== undefined && String(oldVal || '') !== String(newVal || '')) {
                changedFields[field] = { old: oldVal || null, new: newVal };
            }
        }

        // Apply pipeline mapping
        const newState = applyPipelineMapping(existing.pipelineState, newData);
        if (newState) {
            changedFields.pipelineState = { old: existing.pipelineState, new: newState };
            newData.pipelineState = newState;
        }

        // Skip if nothing changed
        if (Object.keys(changedFields).length === 0) {
            this.logger.log(`Webhook: no changes for ${payload.name}`);
            return;
        }

        // Create OrderLog
        await this.prisma.orderLog.create({
            data: {
                orderId: existing.id,
                source: 'webhook',
                shopifyTopic: topic,
                changedFields,
                rawPayload: payload,
            },
        });

        // Update order (exclude shopifyRawPayload from update if too large)
        const { shopifyRawPayload, ...updateFields } = newData;
        await this.prisma.order.update({
            where: { id: existing.id },
            data: { ...updateFields, shopifyRawPayload: payload },
        });

        this.logger.log(
            `Webhook: updated ${payload.name} — ${Object.keys(changedFields).join(', ')}`,
        );
    }

    private extractTracking(payload: any) {
        const fulfillments = payload.fulfillments || [];
        if (fulfillments.length === 0) return {};
        const latest = fulfillments[fulfillments.length - 1];
        return {
            trackingNumber: latest.tracking_number || latest.tracking_numbers?.[0] || undefined,
            trackingCompany: latest.tracking_company || undefined,
            trackingUrl: latest.tracking_url || latest.tracking_urls?.[0] || undefined,
        };
    }
}
