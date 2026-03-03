/**
 * Seed Vietnamese banks library into the banks table.
 * 
 * Usage:  node prisma/seed-banks.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BANKS = [
    // ── State-owned commercial banks ──
    { fullName: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam', brandName: 'Agribank', swiftCode: 'VBAAVNVX' },
    { fullName: 'Ngân hàng TMCP Ngoại thương Việt Nam', brandName: 'Vietcombank', swiftCode: 'BFTVVNVX' },
    { fullName: 'Ngân hàng TMCP Công Thương Việt Nam', brandName: 'Vietinbank', swiftCode: 'ICBVVNVX' },
    { fullName: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam', brandName: 'BIDV', swiftCode: 'BIDVVNVX' },

    // ── Joint-stock commercial banks ──
    { fullName: 'Ngân hàng TMCP Á Châu', brandName: 'ACB', swiftCode: 'ASCBVNVX' },
    { fullName: 'Ngân hàng TMCP Quân Đội', brandName: 'MB', swiftCode: 'MSCBVNVX' },
    { fullName: 'Ngân hàng TMCP Kỹ Thương Việt Nam', brandName: 'Techcombank', swiftCode: 'VTCBVNVX' },
    { fullName: 'Ngân hàng TMCP Việt Nam Thịnh Vượng', brandName: 'VPBank', swiftCode: 'VPBKVNVX' },
    { fullName: 'Ngân hàng TMCP Sài Gòn Thương Tín', brandName: 'Sacombank', swiftCode: 'SGTTVNVX' },
    { fullName: 'Ngân hàng TMCP Sài Gòn – Hà Nội', brandName: 'SHB', swiftCode: 'SHBAVNVX' },
    { fullName: 'Ngân hàng TMCP Tiên Phong', brandName: 'TPBank', swiftCode: 'TPBVVNVX' },
    { fullName: 'Ngân hàng TMCP Hàng Hải Việt Nam', brandName: 'MSB', swiftCode: 'MCOBVNVX' },
    { fullName: 'Ngân hàng TMCP Phát triển TP.HCM', brandName: 'HDBank', swiftCode: 'HDBCVNVX' },
    { fullName: 'Ngân hàng TMCP Quốc Tế', brandName: 'VIB', swiftCode: 'VNIBVNVX' },
    { fullName: 'Ngân hàng TMCP Xuất Nhập Khẩu Việt Nam', brandName: 'Eximbank', swiftCode: 'EBVIVNVX' },
    { fullName: 'Ngân hàng TMCP Đông Nam Á', brandName: 'SeABank', swiftCode: 'SEAVVNVX' },
    { fullName: 'Ngân hàng TMCP Bưu điện Liên Việt', brandName: 'LPBank', swiftCode: 'LVBKVNVX' },
    { fullName: 'Ngân hàng TMCP An Bình', brandName: 'ABBank', swiftCode: 'ABBKVNVX' },
    { fullName: 'Ngân hàng TMCP Sài Gòn Công Thương', brandName: 'Saigonbank', swiftCode: 'SGICVNVX' },
    { fullName: 'Ngân hàng TMCP Phương Đông', brandName: 'OCB', swiftCode: 'ORCOVNVX' },
    { fullName: 'Ngân hàng TMCP Quốc Dân', brandName: 'NCB', swiftCode: 'NVBAVNVX' },
    { fullName: 'Ngân hàng TMCP Bản Việt', brandName: 'Viet Capital Bank', swiftCode: 'VCBCVNVX' },
    { fullName: 'Ngân hàng TMCP Đại Chúng Việt Nam', brandName: 'PVcomBank', swiftCode: 'WBVNVNVX' },
    { fullName: 'Ngân hàng TMCP Bắc Á', brandName: 'BacABank', swiftCode: 'NASCVNVX' },
    { fullName: 'Ngân hàng TMCP Việt Á', brandName: 'VietABank', swiftCode: 'VNACVNVX' },
    { fullName: 'Ngân hàng TMCP Nam Á', brandName: 'Nam A Bank', swiftCode: 'NAMAVNVX' },
    { fullName: 'Ngân hàng TMCP Kiên Long', brandName: 'KienlongBank', swiftCode: 'KLBKVNVX' },
    { fullName: 'Ngân hàng TMCP Sài Gòn', brandName: 'SCB', swiftCode: 'SACLVNVX' },
    { fullName: 'Ngân hàng TMCP Đông Á', brandName: 'DongA Bank', swiftCode: 'EABORVNVX' },
    { fullName: 'Ngân hàng TMCP Xăng Dầu Petrolimex', brandName: 'PGBank', swiftCode: 'PGBLVNVX' },
    { fullName: 'Ngân hàng TMCP Việt Nam Thương Tín', brandName: 'VietBank', swiftCode: 'VNTTVNVX' },
    { fullName: 'Ngân hàng TMCP Bảo Việt', brandName: 'BaoViet Bank', swiftCode: 'BVBVVNVX' },

    // ── Policy / Development banks ──
    { fullName: 'Ngân hàng Chính sách Xã hội Việt Nam', brandName: 'VBSP', swiftCode: null },
    { fullName: 'Ngân hàng Phát triển Việt Nam', brandName: 'VDB', swiftCode: null },
    { fullName: 'Ngân hàng Hợp tác xã Việt Nam', brandName: 'Co-opBank', swiftCode: 'COOPVNVX' },

    // ── Foreign bank branches in VN ──
    { fullName: 'HSBC Việt Nam', brandName: 'HSBC', swiftCode: 'HSBCVNVX' },
    { fullName: 'Standard Chartered Việt Nam', brandName: 'Standard Chartered', swiftCode: 'SCBLVNVX' },
    { fullName: 'Citibank Việt Nam', brandName: 'Citibank', swiftCode: 'CLOKVNVX' },
    { fullName: 'Shinhan Việt Nam', brandName: 'Shinhan Bank', swiftCode: 'SHBKVNVX' },
    { fullName: 'Woori Bank Việt Nam', brandName: 'Woori Bank', swiftCode: 'HVBKVNVX' },
    { fullName: 'United Overseas Bank Việt Nam', brandName: 'UOB', swiftCode: 'UOVBVNVX' },
    { fullName: 'CIMB Việt Nam', brandName: 'CIMB', swiftCode: 'CIBBVNVX' },
    { fullName: 'Public Bank Việt Nam', brandName: 'Public Bank', swiftCode: 'PBBEVNVX' },
    { fullName: 'Cathay United Bank Việt Nam', brandName: 'Cathay United', swiftCode: null },
    { fullName: 'Kasikornbank Việt Nam', brandName: 'KBank', swiftCode: null },

    // ── Digital / Neo banks ──
    { fullName: 'Ngân hàng số Cake by VPBank', brandName: 'Cake', swiftCode: null },
    { fullName: 'Ngân hàng số Timo by BanViet', brandName: 'Timo', swiftCode: null },
    { fullName: 'Ngân hàng số TNEX by MSB', brandName: 'TNEX', swiftCode: null },

    // ── E-wallets (commonly used for payments) ──
    { fullName: 'Ví điện tử MoMo', brandName: 'MoMo', swiftCode: null },
    { fullName: 'Ví điện tử ZaloPay', brandName: 'ZaloPay', swiftCode: null },
    { fullName: 'Ví điện tử VNPay', brandName: 'VNPay', swiftCode: null },
];

// ── Mapping from messy Lark data → standardized brandName ──
const BANK_NAME_MAP = {
    // Exact matches
    'mb': 'MB',
    'techcombank': 'Techcombank',
    'vietcombank': 'Vietcombank',
    'vietinbank': 'Vietinbank',
    'agribank': 'Agribank',
    'bidv': 'BIDV',
    'vpbank': 'VPBank',
    'acb': 'ACB',
    'tpbank': 'TPBank',
    'sacombank': 'Sacombank',
    'shb': 'SHB',
    'msb': 'MSB',
    'hdbank': 'HDBank',
    'vib': 'VIB',
    'eximbank': 'Eximbank',
    'seabank': 'SeABank',
    'ocb': 'OCB',
    'scb': 'SCB',
    'ncb': 'NCB',
    'pvcombank': 'PVcomBank',
    'abbank': 'ABBank',
    'saigonbank': 'Saigonbank',
    'lpbank': 'LPBank',
    'bacabank': 'BacABank',
    'nam a bank': 'Nam A Bank',
    'kienlongbank': 'KienlongBank',
    'pgbank': 'PGBank',
    'vietbank': 'VietBank',
    'baoviet bank': 'BaoViet Bank',
    'dong a bank': 'DongA Bank',
    'viet capital bank': 'Viet Capital Bank',
    'hsbc': 'HSBC',
    'standard chartered': 'Standard Chartered',
    'citibank': 'Citibank',
    'shinhan bank': 'Shinhan Bank',
    'shinhan': 'Shinhan Bank',
    'woori bank': 'Woori Bank',
    'uob': 'UOB',
    'cimb': 'CIMB',
    'public bank': 'Public Bank',
    'momo': 'MoMo',
    'zalopay': 'ZaloPay',

    // Messy Vietnamese variations from Lark data
    'ngân hàng bidv chi nhánh quang trung': 'BIDV',
    'ngân hàng bidv': 'BIDV',
    'ngân hàng mb': 'MB',
    'ngân hàng vietcombank': 'Vietcombank',
    'ngân hàng techcombank': 'Techcombank',
    'ngân hàng vietinbank': 'Vietinbank',
    'ngân hàng agribank': 'Agribank',
    'ngân hàng vpbank': 'VPBank',
    'ngân hàng acb': 'ACB',
    'ngân hàng tpbank': 'TPBank',
    'ngân hàng sacombank': 'Sacombank',
    'ngân hàng shb': 'SHB',
    'ngân hàng msb': 'MSB',
    'ngân hàng hdbank': 'HDBank',
    'ngân hàng vib': 'VIB',
    'ngân hàng eximbank': 'Eximbank',
    'ngân hàng quân đội': 'MB',
    'ngân hàng kỹ thương': 'Techcombank',
    'ngân hàng ngoại thương': 'Vietcombank',
    'ngân hàng công thương': 'Vietinbank',
    'ngân hàng đầu tư phát triển': 'BIDV',
    'ngân hàng á châu': 'ACB',
    'ngân hàng tiên phong': 'TPBank',
    'ngân hàng sài gòn thương tín': 'Sacombank',
    'ngan hang bidv': 'BIDV',

    // ── Additional misspellings from actual Lark data ──
    'vp bank': 'VPBank',
    'tp bank': 'TPBank',
    'tp': 'TPBank',
    'vcb': 'Vietcombank',
    'viettinbank': 'Vietinbank',
    'mb bank': 'MB',
    'vib bank': 'VIB',
    'ngân hàng thương mại cổ phần á châu': 'ACB',
    'ngân hàng tmcp công thương việt nam': 'Vietinbank',
    'ngân hàng tmcp á châu': 'ACB',
    'ngân hàng tmcp quân đội': 'MB',
    'ngân hàng tmcp kỹ thương': 'Techcombank',
    'ngân hàng tmcp ngoại thương': 'Vietcombank',
    'ngân hàng tmcp đầu tư': 'BIDV',
    'ngân hàng tmcp tiên phong': 'TPBank',
    'ngân hàng tmcp việt nam thịnh vượng': 'VPBank',
};

function normalizeBankName(raw) {
    if (!raw) return null;
    const lower = raw.toLowerCase().trim();

    // Direct map lookup
    if (BANK_NAME_MAP[lower]) return BANK_NAME_MAP[lower];

    // Partial match — check if input CONTAINS a known key
    for (const [key, val] of Object.entries(BANK_NAME_MAP)) {
        if (lower.includes(key)) return val;
    }

    // Check if input matches a brandName from BANKS (case insensitive)
    const bankMatch = BANKS.find(b => b.brandName.toLowerCase() === lower);
    if (bankMatch) return bankMatch.brandName;

    return null; // cannot map
}

async function main() {
    console.log('🏦 Seeding Vietnamese banks...');

    let created = 0, skipped = 0;
    for (const bank of BANKS) {
        const existing = await prisma.bank.findUnique({ where: { brandName: bank.brandName } });
        if (existing) {
            skipped++;
            continue;
        }
        await prisma.bank.create({ data: bank });
        created++;
    }
    console.log(`✅ Banks: ${created} created, ${skipped} already existed`);
    console.log(`📊 Total banks in DB: ${await prisma.bank.count()}`);

    // ── Standardize existing brand bankName ──
    console.log('\n🔄 Standardizing brand bank names...');
    const brands = await prisma.brand.findMany({
        where: { bankName: { not: null }, deletedAt: null },
        select: { id: true, bankName: true },
    });

    let mapped = 0, unmapped = 0;
    const unmappedNames = [];

    for (const brand of brands) {
        const standardized = normalizeBankName(brand.bankName);
        if (standardized && standardized !== brand.bankName) {
            await prisma.brand.update({
                where: { id: brand.id },
                data: { bankName: standardized },
            });
            console.log(`  ✅ "${brand.bankName}" → "${standardized}"`);
            mapped++;
        } else if (!standardized) {
            unmappedNames.push(brand.bankName);
            unmapped++;
        }
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`✅ Standardization complete!`);
    console.log(`   Mapped: ${mapped}`);
    console.log(`   Already correct: ${brands.length - mapped - unmapped}`);
    console.log(`   Could not map: ${unmapped}`);
    if (unmappedNames.length > 0) {
        console.log(`\n⚠ Unmapped bank names (need manual review):`);
        [...new Set(unmappedNames)].forEach(n => console.log(`   - "${n}"`));
    }
    console.log('═'.repeat(50));
}

main()
    .catch(e => { console.error('Fatal:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
