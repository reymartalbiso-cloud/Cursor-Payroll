
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const runs = await prisma.payrollRun.findMany({
        where: {
            OR: [
                { name: { contains: 'Nov' } },
                { name: { contains: 'November' } }
            ]
        },
        include: {
            _count: { select: { payslips: true } }
        }
    });

    console.log('Found Payroll Runs:', JSON.stringify(runs, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
