/**
 * Import brands from Lark Bitable → local DB
 * 
 * Usage:  node prisma/import-brands-from-lark.js
 * 
 * Uses DATABASE_URL from .env
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const LARK_BASE = 'https://open.larksuite.com/open-apis';

// ─── Lark API helpers ───────────────────────────────────────

async function getTenantAccessToken() {
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

async function listTables(token, appToken) {
    const res = await fetch(`${LARK_BASE}/bitable/v1/apps/${appToken}/tables`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.code !== 0) throw new Error(`List tables failed: ${JSON.stringify(data)}`);
    return data.data.items;
}

async function searchRecords(token, appToken, tableId, pageToken) {
    const url = `${LARK_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`;
    const body = { page_size: 500 };
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

async function getAllRecords(token, appToken, tableId) {
    const all = [];
    let pageToken;
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

function getVal(fields, key) {
    const v = fields[key];
    if (v == null) return null;
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    if (Array.isArray(v)) {
        if (v.length === 0) return null;
        if (typeof v[0] === 'string') return v.join(', ');
        if (v[0]?.text != null) return v.map(t => t.text).join('');
        if (v[0]?.name != null) return v.map(t => t.name).join(', ');
        return JSON.stringify(v);
    }
    if (typeof v === 'object') {
        if (v.text) return v.text;
        if (v.link) return v.link;
        if (v.name) return v.name;
        return JSON.stringify(v);
    }
    return String(v);
}

function mapStatus(s) {
    if (!s) return 'active';
    const l = s.toLowerCase().trim();
    if (l === 'on air' || l === 'active') return 'active';
    if (l === 'processing') return 'processing';
    if (l === 'pending') return 'pending';
    if (l === 'stopped' || l === 'stop' || l === 'die' || l === 'inactive') return 'inactive';
    return l.slice(0, 20);
}

function mapRecord(record) {
    const f = record.fields || {};

    const brand = getVal(f, 'Brand') || getVal(f, 'brand');
    const skuPrefix = getVal(f, 'Tiền tố SKU') || getVal(f, 'Text');

    if (!brand) return null;

    const code = (skuPrefix || brand.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()).slice(0, 50);

    return {
        name: brand.slice(0, 255),
        code,
        warehouseAddress: getVal(f, 'Địa chỉ kho/ Cửa hàng'),
        logoHdUrl: getVal(f, 'Link Logo HD'),
        baseIn: (getVal(f, 'Base in') || '').slice(0, 10) || null,
        status: mapStatus(getVal(f, 'Status')),
        returnRate: (getVal(f, 'Tỷ lệ return') || '').slice(0, 10) || null,

        bankAccount: (getVal(f, 'STK thanh toán cộng nợ') || '').slice(0, 50) || null,
        bankAccountHolder: getVal(f, 'Chủ tài khoản'),
        bankName: (getVal(f, 'Ngân hàng') || '').slice(0, 100) || null,
        paymentTerms: (getVal(f, 'Thời hạn công nợ') || '').slice(0, 50) || null,
        bankAccountOld: (getVal(f, 'STK cũ') || '').slice(0, 50) || null,
        saleRate: (getVal(f, 'Sale rate') || '').slice(0, 50) || null,

        priceListType: (getVal(f, 'Loại giá niêm yết') || '').slice(0, 20) || null,
        discountFormula: (getVal(f, 'Công thức chiết khấu') || '').slice(0, 50) || null,
        revenueTier1: (getVal(f, 'Doanh thu mức 1') || '').slice(0, 30) || null,
        discountTier1: (getVal(f, 'Chiết khấu mức 1') || '').slice(0, 20) || null,
        revenueTier2: (getVal(f, 'Doanh thu mức 2') || '').slice(0, 30) || null,
        discountTier2: (getVal(f, 'Chiết khấu mức 2') || '').slice(0, 20) || null,
        revenueTier3: (getVal(f, 'Doanh thu mức 3') || '').slice(0, 30) || null,
        discountTier3: (getVal(f, 'Chiết khấu mức 3') || '').slice(0, 20) || null,

        domesticShipping: (getVal(f, 'Ship nội địa') || '').slice(0, 50) || null,
        debtNotes: getVal(f, 'Note công nợ'),
        paymentSchedule1: getVal(f, 'Thời gian thanh toán công nợ'),
        paymentSchedule2: getVal(f, 'Thời gian thanh toán công nợ 2nd'),
        reconciliationMethod: getVal(f, 'Cách thức đối soát'),
        latePaymentPenalty: getVal(f, 'Phạt chậm thanh toán'),
        latePaymentNotice: getVal(f, 'Thông báo chậm thanh toán'),

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

    if (!tableId) {
        console.log('\n📋 Discovering tables...');
        const tables = await listTables(token, appToken);
        console.log('Available tables:');
        for (const t of tables) {
            console.log(`  - ${t.name} → ${t.table_id}`);
        }
        const brandTable = tables.find(
            t => t.name.toLowerCase().includes('all brand'),
        ) || tables.find(
            t => t.name.toLowerCase().includes('brand'),
        );
        if (!brandTable) {
            console.error('❌ Could not find Brand info table. Set LARK_BRAND_TABLE_ID manually.');
            process.exit(1);
        }
        tableId = brandTable.table_id;
        console.log(`\n📌 Using table: ${brandTable.name} → ${tableId}`);
    }

    console.log(`\n📥 Fetching records from Lark Bitable...`);
    const records = await getAllRecords(token, appToken, tableId);
    console.log(`\n📊 Total records fetched: ${records.length}`);

    if (records.length > 0) {
        console.log('\n🔍 Sample record field names:');
        Object.keys(records[0].fields || {}).forEach(name => console.log(`  - "${name}"`));
    }

    let created = 0, updated = 0, skipped = 0;
    const errors = [];

    for (const record of records) {
        try {
            const mapped = mapRecord(record);
            if (!mapped) { skipped++; continue; }

            const existing = await prisma.brand.findFirst({
                where: {
                    OR: [
                        { larkRecordId: mapped.larkRecordId },
                        { code: mapped.code },
                    ],
                },
            });

            if (existing) {
                await prisma.brand.update({
                    where: { id: existing.id },
                    data: mapped,
                });
                updated++;
            } else {
                await prisma.brand.create({ data: mapped });
                created++;
            }
        } catch (err) {
            const name = getVal(record.fields || {}, 'Brand') || 'unknown';
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
        errors.slice(0, 15).forEach(e => console.log(`     ⚠ ${e}`));
        if (errors.length > 15) console.log(`     ...and ${errors.length - 15} more`);
    }
    console.log('═'.repeat(50));
}

main()
    .catch(e => { console.error('Fatal error:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
