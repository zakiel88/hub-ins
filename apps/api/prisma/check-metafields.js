const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Check active stores (only safe fields, no encrypted tokens)
    const stores = await prisma.shopifyStore.findMany({
        where: { isActive: true },
        select: { id: true, storeName: true, shopifyDomain: true, apiVersion: true, scopes: true },
    });

    console.log(`\n=== ${stores.length} ACTIVE STORES ===`);
    for (const s of stores) {
        console.log(`  ${s.storeName} | ${s.shopifyDomain} | v${s.apiVersion} | scopes: ${s.scopes || 'null'}`);
    }

    // Check existing definitions
    const defCount = await prisma.metafieldDefinition.count();
    console.log(`\n=== DB: ${defCount} metafield definitions ===`);

    if (defCount > 0) {
        const defs = await prisma.metafieldDefinition.findMany({ take: 10 });
        for (const d of defs) {
            console.log(`  ${d.namespace}.${d.key} [${d.type}] ${d.ownerType}`);
        }
    }

    // Check sync job logs
    const recentJobs = await prisma.syncJob.findMany({
        where: { jobType: { startsWith: 'sync' } },
        orderBy: { createdAt: 'desc' },
        take: 3,
        include: { logs: { orderBy: { createdAt: 'asc' } } },
    });

    console.log(`\n=== RECENT SYNC JOBS ===`);
    for (const job of recentJobs) {
        console.log(`\n  Job: ${job.id.substring(0, 8)} | ${job.jobType} | ${job.status} | ${job.processed}/${job.totalItems}`);
        if (job.errorMsg) console.log(`  Error: ${job.errorMsg}`);
        if (job.logs.length > 0) {
            console.log(`  Logs (${job.logs.length}):`);
            for (const log of job.logs) {
                console.log(`    [${log.level}] ${log.message}`);
            }
        } else {
            console.log(`  No logs`);
        }
    }

    await prisma.$disconnect();
}
main().catch(console.error);
