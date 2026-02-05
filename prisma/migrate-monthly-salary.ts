import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Migrating existing employees to use monthlySalary...');
  
  // Get all employees
  const employees = await prisma.employee.findMany();
  
  console.log(`Found ${employees.length} employees to update`);
  
  for (const employee of employees) {
    // Calculate monthlySalary from dailyRate (dailyRate × 26)
    // But if this is a new setup, the user likely wants to set it to a round number
    // So we'll calculate what monthlySalary SHOULD be based on current dailyRate
    const dailyRate = Number(employee.dailyRate);
    
    // If monthlySalary is already set and non-zero, skip
    if (employee.monthlySalary && Number(employee.monthlySalary) > 0) {
      console.log(`  - ${employee.firstName} ${employee.lastName}: Already has monthlySalary = ${employee.monthlySalary}`);
      continue;
    }
    
    // Calculate monthlySalary by multiplying dailyRate by 26
    // Then round to nearest peso for cleaner numbers
    const calculatedMonthlySalary = Math.round(dailyRate * 26);
    
    await prisma.employee.update({
      where: { id: employee.id },
      data: { 
        monthlySalary: calculatedMonthlySalary,
        // Also update dailyRate to be the precise value (monthlySalary / 26)
        dailyRate: calculatedMonthlySalary / 26
      },
    });
    
    console.log(`  - ${employee.firstName} ${employee.lastName}: dailyRate ${dailyRate.toFixed(2)} -> monthlySalary ${calculatedMonthlySalary} (dailyRate now ${(calculatedMonthlySalary / 26).toFixed(4)})`);
  }
  
  console.log('Migration complete!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
