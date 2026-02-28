import { PrismaClient } from '@prisma/client';

// Test with URL-encoded password (- encoded as %2D)
const urls = [
    {
        label: 'Pooler transaction mode (URL-encoded password)',
        url: 'postgresql://postgres.ojlkvtcknzptciazqsws:Albiso0917%2D@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
    },
    {
        label: 'Pooler session mode (URL-encoded password)',
        url: 'postgresql://postgres.ojlkvtcknzptciazqsws:Albiso0917%2D@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
    },
    {
        label: 'Pooler transaction mode (raw password)',
        url: 'postgresql://postgres.ojlkvtcknzptciazqsws:Albiso0917-@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
    },
];

async function testConnection(label: string, url: string) {
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        console.log(`\n--- Testing: ${label} ---`);
        const result = await prisma.$queryRaw`SELECT 1 as test`;
        console.log(`SUCCESS!`, result);
        return true;
    } catch (error: any) {
        const msg = error.message || '';
        // Extract just the key part of the error
        const match = msg.match(/error:.*$/mi) || msg.match(/Can't reach.*$/mi) || msg.match(/tenant.*$/mi);
        console.log(`FAILED: ${match ? match[0] : msg.substring(0, 150)}`);
        return false;
    } finally {
        await prisma.$disconnect();
    }
}

async function main() {
    let found = false;
    for (const { label, url } of urls) {
        const success = await testConnection(label, url);
        if (success) {
            console.log(`\n✅ Working connection: ${label}`);
            console.log(`URL: ${url.replace(/:([^@:]+)@/, ':****@')}`);
            found = true;
            break;
        }
    }
    if (!found) {
        console.log('\n❌ All connection attempts failed.');
        console.log('The pooler may not be provisioned for this project yet.');
        console.log('Go to: https://supabase.com/dashboard/project/ojlkvtcknzptciazqsws/settings/database');
        console.log('Click "Connect" at the top to get the correct pooler connection string.');
    }
}

main();
