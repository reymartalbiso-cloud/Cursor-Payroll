
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const runId = 'cmlq5qs8a000k3lxpmn21t9g0'; // The one WITH payslips

    const payslips = await prisma.payslip.findMany({
        where: { payrollRunId: runId },
        include: {
            employee: true
        }
    });

    if (payslips.length > 0) {
        const p = payslips[0] as any;
        console.log(`Payslip for ${p.employeeName}:`);

        console.log('--- Attendance ---');
        console.log('Absent Days:', p.absentDays);
        console.log('Special Holidays:', p.attendance?.specialHolidayCount || 'N/A');
        console.log('Regular Holidays:', p.attendance?.regularHolidayCount || 'N/A');

        console.log('\n--- Breakdown Formulas ---');
        console.log('Absence Formula:', p.computationBreakdown?.absenceFormula);
        console.log('Holiday Note:', p.computationBreakdown?.holidayNote);
        console.log('Basic Pay:', p.computationBreakdown?.basicPayFormula);

        // Also fetch timesheet entries
        const entries = await prisma.timesheetEntry.findMany({
            where: {
                payrollRunId: runId,
                employeeId: p.employeeId
            },
            orderBy: { date: 'asc' }
        });

        console.log('\n--- Timesheet Entries (Absent/Holiday) ---');
        const interesting = entries.filter((e: any) =>
            e.isAbsent || e.isOnLeave || e.isHoliday || e.leaveType?.includes('HOLIDAY')
        );

        if (interesting.length === 0) {
            console.log('No absent or holiday entries found in timesheet.');
        }

        interesting.forEach((e: any) => {
            console.log(`${e.date.toISOString().split('T')[0]}: Absent=${e.isAbsent}, Leave=${e.leaveType}, Holiday=${e.isHoliday}/${e.holidayType}`);
        });
    } else {
        console.log('No payslips found for this run (unexpected).');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
