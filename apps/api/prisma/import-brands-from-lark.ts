/**
 * Import brands from Lark Bitable → local DB
 *
 * Usage:
 *   npx ts-node prisma/import-brands-from-lark.ts
 *
 * Required env vars (add to .env):
 *   LARK_APP_ID=cli_xxxxx
 *   LARK_APP_SECRET=xxxxx
 *   LARK_BRAND_APP_TOKEN=DMiobOSvmavhKDs89Erlhjpqghf   (from Lark Base URL)
 *   LARK_BRAND_TABLE_ID=tblXXXXXX                        (need to discover)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LARK_BASE = 'https://open.larksuite.com/open-apis';

// ─── Lark API helpers ───────────────────────────────────────

async function getTenantAccessToken(): Promise<string> {
    const appId = process.env.LARK_APP_ID;
    const appSecret = process.env.LARK_APP_SECRET;
    if (!appId || !appSecret) throw new Error('LARK_APP_ID and LARK_APP_SECRET must be set');

    const res = await fetch(`${LARK_BASE}/auth/v3/tenant_access_token/internal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    });
    const data = await res.json();
    if (data.code !== 0) throw new Error(`Lark auth failed: ${JSON.stringify(data)}`);
    return data.tenant_access_token;
}

async function listTables(token: string, appToken: string) {
    const res = await fetch(`${LARK_BASE}/bitable/v1/apps/${appToken}/tables`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.code !== 0) throw new Error(`List tables failed: ${JSON.stringify(data)}`);
    return data.data.items;
}

async function searchRecords(
    token: string,
    appToken: string,
    tableId: string,
    pageToken?: string,
): Promise<{ items: any[]; page_token?: string; has_more: boolean }> {
    const url = `${LARK_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`;
    const body: any = { page_size: 500 };
    if (pageToken) body.page_token = pageToken;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.code !== 0) throw new Error(`Search records failed: ${JSON.stringify(data)}`);
    return data.data;
}

async function getAllRecords(token: string, appToken: string, tableId: string) {
    const all: any[] = [];
    let pageToken: string | undefined;
    let hasMore = true;

    while (hasMore) {
        const result = await searchRecords(token, appToken, tableId, pageToken);
        all.push(...(result.items || []));
        hasMore = result.has_more;
        pageToken = result.page_token;
        console.log(`  Fetched ${all.length} records so far...`);
    }
    return all;
}

// ─── Field extraction ───────────────────────────────────────

function getFieldValue(fields: Record<string, any>, key: string): string | null {
    const v = fields[key];
    if (v == null) return null;
    // Lark returns different formats — text, number, select, etc.
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    // Text array format: [{ text: "..." }]
    if (Array.isArray(v)) {
        if (v.length === 0) return null;
        if (typeof v[0] === 'string') return v.join(', ');
        if (v[0]?.text) return v.map((t: any) => t.text).join('');
        if (v[0]?.name) return v.map((t: any) => t.name).join(', ');
        return JSON.stringify(v);
    }
    // Object format (select, url, etc.)
    if (typeof v === 'object') {
        if (v.text) return v.text;
        if (v.link) return v.link;
        if (v.name) return v.name;
        return JSON.stringify(v);
    }
    return String(v);
}

function mapStatus(larkStatus: string | null): string {
    if (!larkStatus) return 'active';
    const s = larkStatus.toLowerCase().trim();
    if (s === 'on air' || s === 'active') return 'active';
    if (s === 'stopped' || s === 'die' || s === 'inactive') return 'inactive';
    if (s === 'pending') return 'pending';
    return 'inactive';
}

function mapRecord(record: any) {
    const f = record.fields || {};

    const brand = getFieldValue(f, 'Brand') || getFieldValue(f, 'brand');
    const skuPrefix = getFieldValue(f, 'Tiền tố SKU') || getFieldValue(f, 'Text');

    if (!brand) return null; // skip empty rows

    return {
        name: brand,
        code: skuPrefix || brand.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 50),
        warehouseAddress: getFieldValue(f, 'Địa chỉ kho/ Cửa hàng') || getFieldValue(f, 'Đại chỉ kho/ Cửa hàng'),
        logoHdUrl: getFieldValue(f, 'Link Logo HD'),
        baseIn: getFieldValue(f, 'Base in'),
        status: mapStatus(getFieldValue(f, 'Status')),
        returnRate: getFieldValue(f, 'Tỷ lệ return'),

        // Payment
        bankAccount: getFieldValue(f, 'STK thanh toán cổng nợ'),
        bankAccountHolder: getFieldValue(f, 'Chủ tài khoản'),
        bankName: getFieldValue(f, 'Ngân hàng'),
        paymentTerms: getFieldValue(f, 'Thời hạn công nợ'),
        bankAccountOld: getFieldValue(f, 'STK cũ'),
        saleRate: getFieldValue(f, 'Sale rate'),

        // Pricing
        priceListType: getFieldValue(f, 'Loại giá niêm yết'),
        discountFormula: getFieldValue(f, 'Công thức chiết khấu'),
        revenueTier1: getFieldValue(f, 'Doanh thu mức 1'),
        discountTier1: getFieldValue(f, 'Chiết khấu mức 1'),
        revenueTier2: getFieldValue(f, 'Doanh thu mức 2'),
        discountTier2: getFieldValue(f, 'Chiết khấu mức 2'),
        revenueTier3: getFieldValue(f, 'Doanh thu mức 3'),
        discountTier3: getFieldValue(f, 'Chiết khấu mức 3'),

        // Reconciliation
        domesticShipping: getFieldValue(f, 'Ship nội địa'),
        debtNotes: getFieldValue(f, 'Note công nợ'),
        paymentSchedule1: getFieldValue(f, 'Thời gian thanh toán công nợ'),
        paymentSchedule2: getFieldValue(f, 'Thời gian thanh toán công nợ 2nd'),
        reconciliationMethod: getFieldValue(f, 'Cách thức đối soát'),
        latePaymentPenalty: getFieldValue(f, 'Phạt chậm thanh toán'),
        latePaymentNotice: getFieldValue(f, 'Thông báo chậm thanh toán'),

        larkRecordId: record.record_id,
    };
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
    console.log('🔑 Getting Lark access token...');
    const token = await getTenantAccessToken();
    console.log('✅ Token obtained');

    const appToken = process.env.LARK_BRAND_APP_TOKEN || 'DMiobOSvmavhKDs89Erlhjpqghf';
    let tableId = process.env.LARK_BRAND_TABLE_ID;

    // Auto-discover table ID if not set
    if (!tableId) {
        console.log('\n📋 Discovering tables...');
        const tables = await listTables(token, appToken);
        console.log('Available tables:');
        for (const t of tables) {
            console.log(`  - ${t.name} → ${t.table_id}`);
        }
        // Look for "Brand info" or "Brand Info" table
        const brandTable = tables.find(
            (t: any) => t.name.toLowerCase().includes('brand info') || t.name.toLowerCase().includes('all brand'),
        );
        if (!brandTable) {
            console.error('❌ Could not find Brand info table. Set LARK_BRAND_TABLE_ID manually.');
            console.log('Tables found:', tables.map((t: any) => `${t.name} (${t.table_id})`).join(', '));
            process.exit(1);
        }
        tableId = brandTable.table_id;
        console.log(`\n📌 Using table: ${brandTable.name} → ${tableId}`);
    }

    console.log(`\n📥 Fetching records from Lark Bitable...`);
    const records = await getAllRecords(token, appToken, tableId);
    console.log(`\n📊 Total records fetched: ${records.length}`);

    // Log first record fields for debugging
    if (records.length > 0) {
        console.log('\n🔍 Sample record field names:');
        const fieldNames = Object.keys(records[0].fields || {});
        fieldNames.forEach(name => console.log(`  - "${name}"`));
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const record of records) {
        try {
            const mapped = mapRecord(record);
            if (!mapped) { skipped++; continue; }

            // Upsert by larkRecordId (most reliable) or code
            const existing = await prisma.brand.findFirst({
                where: {
                    OR: [
                        { larkRecordId: mapped.larkRecordId },
                        { code: mapped.code },
                        { name: mapped.name },
                    ],
                },
            });

            if (existing) {
                await prisma.brand.update({
                    where: { id: existing.id },
                    data: { ...mapped },
                });
                updated++;
            } else {
                await prisma.brand.create({ data: mapped });
                created++;
            }
        } catch (err: any) {
            const name = record.fields?.Brand || record.fields?.brand || 'unknown';
            errors.push(`${name}: ${err.message}`);
        }
    }

    console.log('\n' + '═'.repeat(50));
    console.log(`✅ Import complete!`);
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    if (errors.length > 0) {
        console.log(`   Errors:  ${errors.length}`);
        errors.slice(0, 10).forEach(e => console.log(`     ⚠ ${e}`));
        if (errors.length > 10) console.log(`     ...and ${errors.length - 10} more`);
    }
    console.log('═'.repeat(50));
}

main()
    .catch(e => { console.error('Fatal error:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
