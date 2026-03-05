import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking Audit Logs ---');
    const logs = await prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
    });

    logs.forEach(l => {
        console.log(`[${l.createdAt.toISOString()}] ${l.action} on ${l.entityType} (${l.entityId}) by ${l.userId}`);
    });
}

main().finally(() => prisma.$disconnect());
