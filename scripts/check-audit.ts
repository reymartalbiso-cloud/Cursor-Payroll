import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking Audit Logs ---');
    const logs = await prisma.auditLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: 10
    });

    logs.forEach(l => {
        console.log(`[${l.timestamp.toISOString()}] ${l.action} on ${l.entityType} (${l.entityId}) by ${l.performedBy}`);
    });
}

main().finally(() => prisma.$disconnect());
