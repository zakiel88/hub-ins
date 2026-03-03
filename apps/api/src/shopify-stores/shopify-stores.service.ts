import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { getConfig } from '../config/configuration';
import * as crypto from 'crypto';

@Injectable()
export class ShopifyStoresService {
    private readonly logger = new Logger(ShopifyStoresService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    /* ── Encryption helpers ── */

    private encrypt(plaintext: string): { encrypted: string; iv: string } {
        const key = Buffer.from(getConfig().ENCRYPTION_KEY, 'hex');
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return { encrypted, iv: iv.toString('hex') };
    }

    private decrypt(encrypted: string, ivHex: string): string {
        const key = Buffer.from(getConfig().ENCRYPTION_KEY, 'hex');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    /**
     * Get a valid access token for a store — auto-refreshes if expired (401).
     * Uses stored client credentials to exchange for a new token via client_credentials grant.
     */
    async getValidToken(storeId: string): Promise<{ token: string; refreshed: boolean }> {
        const store = await this.prisma.shopifyStore.findUnique({ where: { id: storeId } });
        if (!store) throw new NotFoundException('Store not found');

        let token = this.decrypt(store.accessTokenEnc, store.tokenIv);

        // Quick validation: test token against Shopify
        const testRes = await fetch(
            `https://${store.shopifyDomain}/admin/api/${store.apiVersion}/shop.json`,
            { headers: { 'X-Shopify-Access-Token': token } },
        );

        if (testRes.ok) {
            return { token, refreshed: false };
        }

        // If 401 — attempt auto-refresh using stored client credentials
        if (testRes.status === 401 && store.clientIdEnc && store.clientIdIv && store.clientSecretEnc && store.clientSecretIv) {
            this.logger.warn(`Token expired for ${store.storeName} — auto-refreshing...`);

            const clientId = this.decrypt(store.clientIdEnc, store.clientIdIv);
            const clientSecret = this.decrypt(store.clientSecretEnc, store.clientSecretIv);

            const tokenRes = await fetch(
                `https://${store.shopifyDomain}/admin/oauth/access_token`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        client_id: clientId,
                        client_secret: clientSecret,
                        grant_type: 'client_credentials',
                    }),
                },
            );

            if (!tokenRes.ok) {
                const body = await tokenRes.text();
                this.logger.error(`Token refresh failed for ${store.storeName}: ${body}`);
                throw new Error(`Token refresh failed (${tokenRes.status}): ${body}`);
            }

            const tokenData: any = await tokenRes.json();
            const newToken = tokenData.access_token;
            if (!newToken) throw new Error('No access token returned from Shopify refresh');

            // Encrypt and save new token
            const enc = this.encrypt(newToken);
            await this.prisma.shopifyStore.update({
                where: { id: storeId },
                data: {
                    accessTokenEnc: enc.encrypted,
                    tokenIv: enc.iv,
                    tokenLastRotatedAt: new Date(),
                },
            });

            this.logger.log(`Token refreshed for ${store.storeName}`);
            return { token: newToken, refreshed: true };
        }

        // Other errors (non-401)
        throw new Error(`Shopify API error: ${testRes.status} ${testRes.statusText}`);
    }

    /* ── Connect Store (Client Credentials Grant) ── */

    /**
     * Connect a Shopify store using per-store Client Credentials.
     * Each store has its own Client ID + Secret from its Shopify app.
     */
    async connectStore(
        data: {
            shopifyDomain: string;
            storeName?: string;
            clientId: string;
            clientSecret: string;
        },
        userId: string,
    ) {
        const config = getConfig();

        if (!data.clientId || !data.clientSecret) {
            throw new BadRequestException('Client ID and Client Secret are required');
        }

        // Normalize domain
        let domain = data.shopifyDomain.trim().toLowerCase();
        if (!domain.endsWith('.myshopify.com')) {
            domain = domain + '.myshopify.com';
        }

        // Check if store already exists
        const existing = await this.prisma.shopifyStore.findUnique({
            where: { shopifyDomain: domain },
        });

        // Request access token via Client Credentials
        const tokenUrl = `https://${domain}/admin/oauth/access_token`;
        let accessToken: string;
        let grantedScopes: string | null = null;

        try {
            const tokenRes = await fetch(tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: data.clientId,
                    client_secret: data.clientSecret,
                    grant_type: 'client_credentials',
                }),
            });

            if (!tokenRes.ok) {
                const body = await tokenRes.text();
                this.logger.error(`Client credentials failed for ${domain}: ${body}`);
                throw new BadRequestException(
                    `Shopify rejected credentials (${tokenRes.status}). Verify your Client ID/Secret and that the app is installed on this store.`,
                );
            }

            const tokenData: any = await tokenRes.json();
            accessToken = tokenData.access_token;
            grantedScopes = tokenData.scope || null;

            if (!accessToken) {
                throw new BadRequestException('No access token returned from Shopify');
            }
        } catch (err: any) {
            if (err instanceof BadRequestException) throw err;
            throw new BadRequestException(`Failed to connect to Shopify: ${err.message}`);
        }

        // Encrypt tokens and credentials
        const tokenEnc = this.encrypt(accessToken);
        const cidEnc = this.encrypt(data.clientId);
        const csEnc = this.encrypt(data.clientSecret);

        // Fetch shop info for the store name
        let storeName = data.storeName || domain.replace('.myshopify.com', '');
        try {
            const shopRes = await fetch(
                `https://${domain}/admin/api/${config.SHOPIFY_API_VERSION}/shop.json`,
                { headers: { 'X-Shopify-Access-Token': accessToken } },
            );
            if (shopRes.ok) {
                const shopData: any = await shopRes.json();
                if (!data.storeName && shopData.shop?.name) {
                    storeName = shopData.shop.name;
                }
            }
        } catch { /* use fallback name */ }

        // Upsert: create or reconnect
        let store;
        if (existing) {
            store = await this.prisma.shopifyStore.update({
                where: { id: existing.id },
                data: {
                    storeName,
                    accessTokenEnc: tokenEnc.encrypted,
                    tokenIv: tokenEnc.iv,
                    clientIdEnc: cidEnc.encrypted,
                    clientIdIv: cidEnc.iv,
                    clientSecretEnc: csEnc.encrypted,
                    clientSecretIv: csEnc.iv,
                    scopes: grantedScopes || existing.scopes,
                    tokenLastRotatedAt: new Date(),
                    isActive: true,
                },
            });
            this.logger.log(`Store reconnected: ${storeName} (${domain})`);
        } else {
            store = await this.prisma.shopifyStore.create({
                data: {
                    storeName,
                    shopifyDomain: domain,
                    accessTokenEnc: tokenEnc.encrypted,
                    tokenIv: tokenEnc.iv,
                    clientIdEnc: cidEnc.encrypted,
                    clientIdIv: cidEnc.iv,
                    clientSecretEnc: csEnc.encrypted,
                    clientSecretIv: csEnc.iv,
                    scopes: grantedScopes,
                    apiVersion: config.SHOPIFY_API_VERSION,
                    tokenLastRotatedAt: new Date(),
                },
            });
            this.logger.log(`Store connected: ${storeName} (${domain})`);
        }

        await this.audit.log({
            userId,
            action: existing ? 'shopify_store.reconnect' : 'shopify_store.connect',
            entityType: 'ShopifyStore',
            entityId: store.id,
            changes: { storeName, domain, scopes: grantedScopes },
        });

        return { data: store };
    }

    /* ── CRUD ── */

    async findAll(params: {
        page?: number;
        limit?: number;
        search?: string;
        isActive?: string;
    }) {
        const take = Math.min(params.limit || 50, 100);
        const skip = ((params.page || 1) - 1) * take;

        const where: any = {};
        if (params.search) {
            where.OR = [
                { storeName: { contains: params.search, mode: 'insensitive' } },
                { shopifyDomain: { contains: params.search, mode: 'insensitive' } },
            ];
        }
        if (params.isActive !== undefined) {
            where.isActive = params.isActive === 'true';
        }

        const [data, total] = await Promise.all([
            this.prisma.shopifyStore.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    storeName: true,
                    shopifyDomain: true,
                    market: true,
                    scopes: true,
                    apiVersion: true,
                    isActive: true,
                    lastSyncAt: true,
                    tokenLastRotatedAt: true,
                    createdAt: true,
                    updatedAt: true,
                    _count: {
                        select: {
                            orders: true,
                            shopifyProductMappings: true,
                            syncLogs: true,
                        },
                    },
                },
            }),
            this.prisma.shopifyStore.count({ where }),
        ]);

        return { data, meta: { total, page: params.page || 1, limit: take } };
    }

    async findById(id: string) {
        const store = await this.prisma.shopifyStore.findUnique({
            where: { id },
            select: {
                id: true,
                storeName: true,
                shopifyDomain: true,
                market: true,
                scopes: true,
                apiVersion: true,
                isActive: true,
                lastSyncAt: true,
                tokenLastRotatedAt: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        orders: true,
                        shopifyProductMappings: true,
                        syncLogs: true,
                        inventoryItems: true,
                        webhookEvents: true,
                    },
                },
            },
        });
        if (!store) throw new NotFoundException('Store not found');
        return { data: store };
    }

    async update(
        id: string,
        data: { storeName?: string; market?: string; apiVersion?: string },
        userId: string,
    ) {
        const existing = await this.prisma.shopifyStore.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Store not found');

        const updateData: any = {};
        if (data.storeName) updateData.storeName = data.storeName.trim();
        if (data.market !== undefined) updateData.market = data.market || null;
        if (data.apiVersion) updateData.apiVersion = data.apiVersion;

        const store = await this.prisma.shopifyStore.update({
            where: { id },
            data: updateData,
        });

        await this.audit.log({
            userId,
            action: 'shopify_store.update',
            entityType: 'ShopifyStore',
            entityId: id,
            changes: Object.keys(updateData),
        });

        return { data: store };
    }

    async toggleActive(id: string, userId: string) {
        const existing = await this.prisma.shopifyStore.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Store not found');

        const store = await this.prisma.shopifyStore.update({
            where: { id },
            data: { isActive: !existing.isActive },
        });

        await this.audit.log({
            userId,
            action: existing.isActive ? 'shopify_store.deactivate' : 'shopify_store.activate',
            entityType: 'ShopifyStore',
            entityId: id,
            changes: { isActive: store.isActive },
        });

        return { data: store };
    }

    async delete(id: string, userId: string) {
        const existing = await this.prisma.shopifyStore.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { orders: true, shopifyProductMappings: true },
                },
            },
        });
        if (!existing) throw new NotFoundException('Store not found');

        if (existing._count.orders > 0 || existing._count.shopifyProductMappings > 0) {
            throw new BadRequestException(
                `Cannot delete store with ${existing._count.orders} orders and ${existing._count.shopifyProductMappings} product mappings. Deactivate it instead.`,
            );
        }

        await this.prisma.syncLog.deleteMany({ where: { shopifyStoreId: id } });
        await this.prisma.webhookEvent.deleteMany({ where: { shopifyStoreId: id } });
        await this.prisma.pricePublishLog.deleteMany({ where: { shopifyStoreId: id } });
        await this.prisma.shopifyStore.delete({ where: { id } });

        await this.audit.log({
            userId,
            action: 'shopify_store.delete',
            entityType: 'ShopifyStore',
            entityId: id,
            changes: { storeName: existing.storeName },
        });

        return { message: 'Store deleted' };
    }

    /* ── Connection Test ── */

    async testConnection(id: string) {
        try {
            const { token, refreshed } = await this.getValidToken(id);
            const store = await this.prisma.shopifyStore.findUnique({ where: { id } });
            if (!store) throw new NotFoundException('Store not found');

            const res = await fetch(
                `https://${store.shopifyDomain}/admin/api/${store.apiVersion}/shop.json`,
                { headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' } },
            );

            if (!res.ok) {
                const body = await res.text();
                return { data: { success: false, status: res.status, error: body.substring(0, 500) } };
            }

            const shop: any = await res.json();
            return {
                data: {
                    success: true,
                    tokenRefreshed: refreshed,
                    shop: {
                        name: shop.shop?.name,
                        email: shop.shop?.email,
                        domain: shop.shop?.domain,
                        myshopifyDomain: shop.shop?.myshopify_domain,
                        plan: shop.shop?.plan_display_name,
                        currency: shop.shop?.currency,
                        timezone: shop.shop?.iana_timezone,
                    },
                },
            };
        } catch (err: any) {
            return { data: { success: false, error: err.message || 'Connection failed' } };
        }
    }

    /* ── Sync Logs ── */

    async getSyncLogs(storeId: string, params?: { page?: number; limit?: number }) {
        const store = await this.prisma.shopifyStore.findUnique({ where: { id: storeId } });
        if (!store) throw new NotFoundException('Store not found');

        const take = Math.min(params?.limit || 20, 100);
        const skip = ((params?.page || 1) - 1) * take;

        const [data, total] = await Promise.all([
            this.prisma.syncLog.findMany({
                where: { shopifyStoreId: storeId },
                orderBy: { startedAt: 'desc' },
                skip,
                take,
            }),
            this.prisma.syncLog.count({ where: { shopifyStoreId: storeId } }),
        ]);

        return { data, meta: { total, page: params?.page || 1, limit: take } };
    }
}
