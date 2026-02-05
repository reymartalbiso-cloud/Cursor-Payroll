import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function cleanup() {
  console.log('🗑️  Starting database cleanup...\n');

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

    // 7. Delete all employees
    const employees = await prisma.employee.deleteMany();
    console.log(`✓ Deleted ${employees.count} employees`);

    // 8. Delete all users except keep one admin
    // First, delete all non-admin users
    await prisma.user.deleteMany({
      where: {
        role: { not: 'ADMIN' }
      }
    });
    
    // Check if admin exists, if not create one
    const adminExists = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });

    if (!adminExists) {
      // Create a fresh admin account
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await prisma.user.create({
        data: {
          email: 'admin@payroll.com',
          password: hashedPassword,
          name: 'Administrator',
          role: 'ADMIN',
        }
      });
      console.log(`✓ Created fresh admin account (admin@payroll.com / admin123)`);
    } else {
      // Reset admin password
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await prisma.user.update({
        where: { id: adminExists.id },
        data: {
          email: 'admin@payroll.com',
          password: hashedPassword,
          name: 'Administrator',
        }
      });
      console.log(`✓ Reset admin account (admin@payroll.com / admin123)`);
    }

    // Delete any extra admin users (keep only one)
    const allAdmins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' }
    });
    
    if (allAdmins.length > 1) {
      // Keep the first admin, delete the rest
      const adminsToDelete = allAdmins.slice(1).map(a => a.id);
      await prisma.user.deleteMany({
        where: { id: { in: adminsToDelete } }
      });
      console.log(`✓ Removed ${adminsToDelete.length} extra admin accounts`);
    }

    // 9. Delete holidays (optional - comment out if you want to keep holidays)
    const holidays = await prisma.holiday.deleteMany();
    console.log(`✓ Deleted ${holidays.count} holidays`);

    // 10. Reset settings to defaults
    await prisma.setting.deleteMany();
    await prisma.setting.createMany({
      data: [
        { key: 'company_name', value: 'Your Company Name', description: 'Company name for payslips' },
        { key: 'company_address', value: 'Your Company Address', description: 'Company address for payslips' },
        { key: 'gov_deduction_mode', value: '16_end_only', description: 'When to apply government deductions' },
        { key: 'standard_daily_hours', value: '8', description: 'Standard work hours per day' },
        { key: 'overtime_multiplier', value: '1.25', description: 'Overtime pay multiplier' },
        { key: 'currency', value: 'PHP', description: 'Currency symbol' },
        { key: 'sss_rate', value: '4.5', description: 'SSS contribution rate (%)' },
        { key: 'philhealth_rate', value: '2.5', description: 'PhilHealth contribution rate (%)' },
        { key: 'pagibig_rate', value: '100', description: 'Pag-IBIG fixed contribution (PHP)' },
      ]
    });
    console.log(`✓ Reset settings to defaults`);

    console.log('\n✅ Database cleanup complete!');
    console.log('\n📋 Summary:');
    console.log('   - All employees deleted');
    console.log('   - All payroll data deleted');
    console.log('   - All timesheet entries deleted');
    console.log('   - All holidays deleted');
    console.log('   - Settings reset to defaults');
    console.log('\n🔐 Admin Login:');
    console.log('   Email: admin@payroll.com');
    console.log('   Password: admin123');
    console.log('\n⚠️  Remember to change the admin password after logging in!');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
