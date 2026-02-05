import { PrismaClient, UserRole, EmployeeStatus, RateType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default settings
  const settings = [
    { key: 'gov_deduction_mode', value: 'fixed_per_cutoff', description: 'Government deduction calculation mode' },
    { key: 'standard_daily_hours', value: '8', description: 'Standard working hours per day' },
    { key: 'overtime_multiplier', value: '1.25', description: 'Overtime pay multiplier' },
    { key: 'currency', value: 'PHP', description: 'Currency code' },
    { key: 'company_name', value: 'ABC Corporation', description: 'Company name for payslips' },
    { key: 'company_address', value: '123 Business Center, Makati City, Philippines', description: 'Company address' },
    { key: 'company_phone', value: '+63 2 8888 1234', description: 'Company phone' },
    { key: 'company_email', value: 'payroll@abccorp.com', description: 'Company email' },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, description: setting.description },
      create: setting,
    });
  }
  console.log('✅ Settings created');

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@company.com' },
    update: {},
    create: {
      email: 'admin@company.com',
      password: hashedPassword,
      name: 'System Administrator',
      role: UserRole.ADMIN,
    },
  });
  console.log('✅ Admin user created');

  // Create payroll admin
  const payrollAdminUser = await prisma.user.upsert({
    where: { email: 'payroll@company.com' },
    update: {},
    create: {
      email: 'payroll@company.com',
      password: hashedPassword,
      name: 'Payroll Administrator',
      role: UserRole.PAYROLL_ADMIN,
    },
  });
  console.log('✅ Payroll admin user created');

  // Create sample employees
  const employees = [
    {
      employeeNo: 'EMP-001',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      middleName: 'Santos',
      department: 'Engineering',
      position: 'Senior Developer',
      rateType: RateType.DAILY,
      dailyRate: 1200,
      defaultKpi: 2000,
      sssContribution: 1350,
      philhealthContribution: 450,
      pagibigContribution: 100,
      status: EmployeeStatus.ACTIVE,
      startDate: new Date('2022-01-15'),
    },
    {
      employeeNo: 'EMP-002',
      firstName: 'Maria',
      lastName: 'Santos',
      middleName: 'Garcia',
      department: 'Engineering',
      position: 'Junior Developer',
      rateType: RateType.DAILY,
      dailyRate: 800,
      defaultKpi: 1500,
      sssContribution: 900,
      philhealthContribution: 300,
      pagibigContribution: 100,
      status: EmployeeStatus.ACTIVE,
      startDate: new Date('2023-03-01'),
    },
    {
      employeeNo: 'EMP-003',
      firstName: 'Pedro',
      lastName: 'Reyes',
      middleName: null,
      department: 'Sales',
      position: 'Sales Manager',
      rateType: RateType.DAILY,
      dailyRate: 1500,
      defaultKpi: 3000,
      sssContribution: 1600,
      philhealthContribution: 550,
      pagibigContribution: 100,
      status: EmployeeStatus.ACTIVE,
      startDate: new Date('2021-06-01'),
    },
    {
      employeeNo: 'EMP-004',
      firstName: 'Ana',
      lastName: 'Garcia',
      middleName: 'Lopez',
      department: 'HR',
      position: 'HR Specialist',
      rateType: RateType.DAILY,
      dailyRate: 1000,
      defaultKpi: 1800,
      sssContribution: 1125,
      philhealthContribution: 400,
      pagibigContribution: 100,
      status: EmployeeStatus.ACTIVE,
      startDate: new Date('2022-08-15'),
    },
    {
      employeeNo: 'EMP-005',
      firstName: 'Carlos',
      lastName: 'Mendoza',
      middleName: 'Rivera',
      department: 'Finance',
      position: 'Accountant',
      rateType: RateType.DAILY,
      dailyRate: 1100,
      defaultKpi: 2000,
      sssContribution: 1250,
      philhealthContribution: 425,
      pagibigContribution: 100,
      status: EmployeeStatus.ACTIVE,
      startDate: new Date('2023-01-10'),
    },
    {
      employeeNo: 'EMP-006',
      firstName: 'Rosa',
      lastName: 'Martinez',
      middleName: null,
      department: 'Operations',
      position: 'Operations Lead',
      rateType: RateType.DAILY,
      dailyRate: 1300,
      defaultKpi: 2500,
      sssContribution: 1400,
      philhealthContribution: 475,
      pagibigContribution: 100,
      status: EmployeeStatus.ACTIVE,
      startDate: new Date('2020-11-01'),
    },
    {
      employeeNo: 'EMP-007',
      firstName: 'Jose',
      lastName: 'Villanueva',
      middleName: 'Cruz',
      department: 'Engineering',
      position: 'QA Engineer',
      rateType: RateType.DAILY,
      dailyRate: 950,
      defaultKpi: 1600,
      sssContribution: 1050,
      philhealthContribution: 375,
      pagibigContribution: 100,
      status: EmployeeStatus.ACTIVE,
      startDate: new Date('2023-06-01'),
    },
    {
      employeeNo: 'EMP-008',
      firstName: 'Elena',
      lastName: 'Ramos',
      middleName: 'Fernandez',
      department: 'Admin',
      position: 'Admin Assistant',
      rateType: RateType.DAILY,
      dailyRate: 700,
      defaultKpi: 1000,
      sssContribution: 750,
      philhealthContribution: 275,
      pagibigContribution: 100,
      status: EmployeeStatus.ACTIVE,
      startDate: new Date('2024-01-15'),
    },
  ];

  for (const emp of employees) {
    await prisma.employee.upsert({
      where: { employeeNo: emp.employeeNo },
      update: emp,
      create: emp,
    });
  }
  console.log(`✅ ${employees.length} employees created`);

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
