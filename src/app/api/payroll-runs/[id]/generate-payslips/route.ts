import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, canManagePayroll } from '@/lib/auth';
import { calculatePayslip, HolidayData } from '@/lib/payroll-calculator';
import { CutoffType } from '@prisma/client';
import { generateReferenceNo } from '@/lib/utils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get the payroll run
    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id },
      include: {
        _count: { select: { payslips: true } },
      },
    });

    if (!payrollRun) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    if (payrollRun.status === 'FINALIZED') {
      return NextResponse.json(
        { error: 'Cannot generate payslips for a finalized payroll run' },
        { status: 400 }
      );
    }

    // Get all active employees
    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
    });

    if (employees.length === 0) {
      return NextResponse.json(
        { error: 'No active employees found' },
        { status: 400 }
      );
    }

    // Get existing payslip employee IDs to avoid duplicates
    const existingPayslips = await prisma.payslip.findMany({
      where: { payrollRunId: id },
      select: { employeeId: true },
    });
    const existingEmployeeIds = new Set(existingPayslips.map((p) => p.employeeId));

    // Filter employees that don't have payslips yet
    const employeesToCreate = employees.filter((e) => !existingEmployeeIds.has(e.id));

    if (employeesToCreate.length === 0) {
      return NextResponse.json({
        message: 'All employees already have payslips',
        created: 0,
      });
    }

    // Get holidays for this year
    const holidays = await prisma.holiday.findMany({
      where: { year: payrollRun.year },
    });
    const holidayData: HolidayData[] = holidays.map((h) => ({
      date: h.date,
      type: h.type,
      name: h.name,
    }));

    // Payroll settings
    const payrollSettings = {
      govDeductionMode: (payrollRun.govDeductionMode || '16_end_only') as 'fixed_per_cutoff' | 'prorated_by_days',
      standardDailyHours: payrollRun.standardDailyHours || 8,
    };

    const cutoffEnum = payrollRun.cutoffType as CutoffType;

    // Helper to sanitize NaN values
    const sanitize = (val: number) => (isNaN(val) || !isFinite(val) ? 0 : val);

    let createdCount = 0;

    // Create payslips for all employees without payslips
    for (const employee of employeesToCreate) {
      try {
        const calculation = calculatePayslip(
          employee,
          [], // No timesheet entries yet
          payrollRun.year,
          payrollRun.month,
          cutoffEnum,
          parseFloat(String(employee.defaultKpi)) || 0,
          payrollSettings,
          {},
          undefined,
          holidayData
        );

        await prisma.payslip.create({
          data: {
            referenceNo: generateReferenceNo('PS'),
            payrollRunId: id,
            employeeId: employee.id,
            employeeName: `${employee.lastName}, ${employee.firstName} ${employee.middleName || ''}`.trim(),
            employeeNo: employee.employeeNo,
            department: employee.department,
            position: employee.position,
            dailyRate: employee.dailyRate,
            eligibleWorkdays: sanitize(calculation.attendance.eligibleWorkdays),
            presentDays: sanitize(calculation.attendance.presentDays),
            absentDays: sanitize(calculation.attendance.absentDays),
            totalLateMinutes: sanitize(calculation.attendance.totalLateMinutes),
            totalUndertimeMinutes: sanitize(calculation.attendance.totalUndertimeMinutes),
            totalOvertimeHours: sanitize(calculation.attendance.totalOvertimeHours),
            basicPay: sanitize(calculation.earnings.basicPay),
            overtimePay: sanitize(calculation.earnings.overtimePay),
            holidayPay: sanitize(calculation.earnings.holidayPay),
            cola: sanitize(calculation.earnings.cola),
            kpi: sanitize(calculation.earnings.kpi),
            otherEarnings: sanitize(calculation.earnings.otherEarnings),
            grossPay: sanitize(calculation.earnings.grossPay),
            absenceDeduction: sanitize(calculation.deductions.absenceDeduction),
            lateDeduction: sanitize(calculation.deductions.lateDeduction),
            undertimeDeduction: sanitize(calculation.deductions.undertimeDeduction),
            sssDeduction: sanitize(calculation.deductions.sssDeduction),
            philhealthDeduction: sanitize(calculation.deductions.philhealthDeduction),
            pagibigDeduction: sanitize(calculation.deductions.pagibigDeduction),
            sssLoanDeduction: sanitize(calculation.deductions.sssLoanDeduction),
            pagibigLoanDeduction: sanitize(calculation.deductions.pagibigLoanDeduction),
            otherLoanDeduction: sanitize(calculation.deductions.otherLoanDeduction),
            cashAdvanceDeduction: sanitize(calculation.deductions.cashAdvanceDeduction),
            totalDeductions: sanitize(calculation.deductions.totalDeductions),
            netPay: sanitize(calculation.netPay),
            netPayInWords: calculation.netPayInWords || 'Zero Pesos Only',
            govDeductionsApplied: calculation.govDeductionsApplied,
            computationBreakdown: calculation.computationBreakdown,
            isMissing: true, // Mark as missing until timesheet imported
          },
        });
        createdCount++;
      } catch (err) {
        console.error(`Error creating payslip for employee ${employee.employeeNo}:`, err);
      }
    }

    return NextResponse.json({
      message: `Successfully generated ${createdCount} payslip(s)`,
      created: createdCount,
    });
  } catch (error) {
    console.error('Generate payslips error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
