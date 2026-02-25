import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    // Hash the default admin password
    const passwordHash = await bcrypt.hash('changeme123', 10);

    // 1. Create admin user
    const admin = await prisma.user.upsert({
        where: { email: 'admin@ins.vn' },
        update: {},
        create: {
            email: 'admin@ins.vn',
            passwordHash,
            fullName: 'INS Admin',
            role: 'admin',
            isActive: true,
        },
    });
    console.log(`✅ Admin user: ${admin.email} (id: ${admin.id})`);

    // 2. Create default warehouse
    const warehouse = await prisma.warehouse.upsert({
        where: { code: 'DISCO_HCM' },
        update: {},
        create: {
            code: 'DISCO_HCM',
            name: 'DISCO Warehouse — Ho Chi Minh City',
            address: 'HCMC, Vietnam',
            isActive: true,
        },
    });
    console.log(`✅ Warehouse: ${warehouse.code} (id: ${warehouse.id})`);

    // 3. Create sample brand
    const brand = await prisma.brand.upsert({
        where: { code: 'SAMPLE' },
        update: {},
        create: {
            name: 'Sample Brand',
            code: 'SAMPLE',
            status: 'active',
            ownerUserId: admin.id,
            notes: 'Sample brand for development',
        },
    });
    console.log(`✅ Sample brand: ${brand.code} (id: ${brand.id})`);

    console.log('\n🎉 Seed complete!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
