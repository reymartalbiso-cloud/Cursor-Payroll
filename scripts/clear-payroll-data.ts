import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🗑️  Starting payroll data cleanup...');

    try {
        // 1. Delete Audit Logs (references PayrollRun)
        const auditLogs = await prisma.auditLog.deleteMany();
        console.log(`✓ Deleted ${auditLogs.count} audit logs`);

        // 2. Delete Outsource Payroll data
        const entries = await prisma.outsourceOperatorEntry.deleteMany();
        console.log(`✓ Deleted ${entries.count} outsource operator entries`);

        const outsourceRequests = await prisma.outsourcePayrollRequest.deleteMany();
        console.log(`✓ Deleted ${outsourceRequests.count} outsource payroll requests`);

        // 3. Delete Payroll Runs
        // Note: Due to onDelete: Cascade in schema.prisma, this will also delete:
        // - TimesheetEntry
        // - Payslip (and its earnings/deductions)
        // - ImportHistory
        const payrollRuns = await prisma.payrollRun.deleteMany();
        console.log(`✓ Deleted ${payrollRuns.count} payroll runs`);
        console.log(`  (Associated timesheets, payslips, and import history were also cleared via cascade)`);

        console.log('\n✅ Payroll data cleanup complete!');
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
