import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const passwordHash = await bcrypt.hash('changeme123', 10);

    // Force-update admin password to bcrypt hash
    const admin = await prisma.user.update({
        where: { email: 'admin@ins.vn' },
        data: { passwordHash },
    });
    console.log(`✅ Admin password updated to bcrypt: ${admin.email}`);
    console.log(`   Hash: ${passwordHash.substring(0, 10)}...`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
