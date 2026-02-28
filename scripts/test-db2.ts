import { PrismaClient } from '@prisma/client';

// Test multiple connection string formats
const urls = [
    {
        label: 'Pooler (transaction mode, dotted user)',
        url: 'postgresql://postgres.ojlkvtcknzptciazqsws:Albiso0917-@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
    },
    {
        label: 'Pooler (session mode, dotted user)',
        url: 'postgresql://postgres.ojlkvtcknzptciazqsws:Albiso0917-@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
    },
];

async function testConnection(label: string, url: string) {
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        console.log(`\n--- Testing: ${label} ---`);
        console.log(`URL: ${url.replace(/:([^@:]+)@/, ':****@')}`);
        const count = await prisma.user.count();
        console.log(`SUCCESS! User count: ${count}`);
        return true;
    } catch (error: any) {
        console.log(`FAILED: ${error.message?.substring(0, 200)}`);
        return false;
    } finally {
        await prisma.$disconnect();
    }
}

async function main() {
    for (const { label, url } of urls) {
        const success = await testConnection(label, url);
        if (success) {
            console.log(`\n✅ Working connection found: ${label}`);
            break;
        }
    }
}

main();
