import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
  console.log('🗑️  Starting database cleanup (keeping employees)...\n');

  try {
    // Delete in order due to foreign key constraints
    
    // 1. Delete audit logs
    const auditLogs = await prisma.auditLog.deleteMany();
    console.log(`✓ Deleted ${auditLogs.count} audit logs`);

    // 2. Delete payslip deductions
    const deductions = await prisma.payslipDeduction.deleteMany();
    console.log(`✓ Deleted ${deductions.count} payslip deductions`);

    // 3. Delete payslip earnings
    const earnings = await prisma.payslipEarning.deleteMany();
    console.log(`✓ Deleted ${earnings.count} payslip earnings`);

    // 4. Delete payslips
    const payslips = await prisma.payslip.deleteMany();
    console.log(`✓ Deleted ${payslips.count} payslips`);

    // 5. Delete timesheet entries
    const timesheets = await prisma.timesheetEntry.deleteMany();
    console.log(`✓ Deleted ${timesheets.count} timesheet entries`);

    // 6. Delete payroll runs
    const payrollRuns = await prisma.payrollRun.deleteMany();
    console.log(`✓ Deleted ${payrollRuns.count} payroll runs`);

    // 7. Delete holidays
    const holidays = await prisma.holiday.deleteMany();
    console.log(`✓ Deleted ${holidays.count} holidays`);

    // Count remaining employees
    const employeeCount = await prisma.employee.count();
    console.log(`✓ Kept ${employeeCount} employees`);

    console.log('\n✅ Database cleanup complete!');
    console.log('\n📋 Summary:');
    console.log('   - All payroll runs deleted');
    console.log('   - All payslips deleted');
    console.log('   - All timesheet entries deleted');
    console.log('   - All holidays deleted');
    console.log(`   - ${employeeCount} employees KEPT`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
