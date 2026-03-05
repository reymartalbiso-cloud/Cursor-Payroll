import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- DEBUG: Checking Finalized Run ---');
    const run = await prisma.payrollRun.findFirst({
        where: { status: 'FINALIZED' },
        orderBy: { updatedAt: 'desc' },
        include: {
            payslips: {
                include: { employee: true }
            }
        }
    });

    if (!run) {
        console.log('No finalized run found.');
        return;
    }

    console.log(`Run ID: ${run.id}`);
    console.log(`Status: ${run.status}`);
    console.log(`Cutoff: ${run.cutoffStart.toISOString()} - ${run.cutoffEnd.toISOString()}`);
    console.log(`Payslip Count: ${run.payslips.length}`);

    run.payslips.forEach((ps, i) => {
        console.log(`Payslip ${i + 1}:`);
        console.log(`  - Employee: ${ps.employee.employeeNo} (${ps.employeeName})`);
        console.log(`  - isMissing: ${ps.isMissing}`);
        console.log(`  - Reference: ${ps.referenceNo}`);
        console.log(`  - Net Pay: ${ps.netPay}`);
    });

    const audit = await prisma.auditLog.findFirst({
        where: { entityId: run.id, action: 'FINALIZE' },
        orderBy: { timestamp: 'desc' }
    });

    if (audit) {
        console.log(`\nFinalize Audit Log: ${audit.timestamp.toISOString()} by ${audit.performedBy}`);
    } else {
        console.log('\nNo FINALIZE audit log found for this run.');
    }
}

main().finally(() => prisma.$disconnect());
