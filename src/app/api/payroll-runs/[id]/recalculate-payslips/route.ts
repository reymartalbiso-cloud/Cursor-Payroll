export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Immediate build-time rescue
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ message: 'Skipping build-time scan' });
  }

  try {
    // 2. Dynamic imports for isolation
    const { prisma } = await import('@/lib/prisma');
    const { getSession, canManagePayroll } = await import('@/lib/auth');
    const { cookies } = await import('next/headers');
    const { calculatePayslip, calculateAttendanceSummary, getEligibleWorkdays } = await import('@/lib/payroll-calculator');

    // 3. Force dynamic context
    await cookies();

    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

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
        { error: 'Cannot recalculate payslips for a finalized payroll run' },
        { status: 400 }
      );
    }

    if (payrollRun._count.payslips === 0) {
      return NextResponse.json(
        { error: 'No payslips found to recalculate. Generate payslips first.' },
        { status: 400 }
      );
    }

    // Helper to get attendance from the other cutoff of the same month (for monthly KPI rules)
    const getOtherCutoffAttendance = async (
      employeeId: string,
      year: number,
      month: number,
      currentCutoffType: 'FIRST_HALF' | 'SECOND_HALF'
    ) => {
      const otherCutoffType = currentCutoffType === 'FIRST_HALF' ? 'SECOND_HALF' : 'FIRST_HALF';

      const otherPayrollRun = await prisma.payrollRun.findFirst({
        where: { year, month, cutoffType: otherCutoffType as any },
      });
      if (!otherPayrollRun) return undefined;

      const otherEntries = await prisma.timesheetEntry.findMany({
        where: { payrollRunId: otherPayrollRun.id, employeeId },
      });
      if (otherEntries.length === 0) return undefined;

      const eligible = getEligibleWorkdays(year, month, otherCutoffType as any);
      return calculateAttendanceSummary(otherEntries as any, eligible);
    };

    // Holidays for this year (passed into calculator; calculator currently uses Status-based holidays,
    // but keeping this for compatibility/future use)
    const holidays = await prisma.holiday.findMany({
      where: { year: payrollRun.year },
    });
    const holidayData = holidays.map((h) => ({
      date: h.date,
      type: h.type as 'REGULAR' | 'SPECIAL',
      name: h.name,
    }));

    const payrollSettings = {
      govDeductionMode: (payrollRun.govDeductionMode || '16_end_only') as 'fixed_per_cutoff' | 'prorated_by_days',
      standardDailyHours: payrollRun.standardDailyHours || 8,
    };

    const payslips = await prisma.payslip.findMany({
      where: { payrollRunId: id },
      select: { id: true, employeeId: true },
    });

    const employees = await prisma.employee.findMany({
      where: { id: { in: payslips.map((p) => p.employeeId) } },
    });
    const employeeById = new Map(employees.map((e) => [e.id, e]));

    let updated = 0;
    let missingTimesheets = 0;

    for (const ps of payslips) {
      const employee = employeeById.get(ps.employeeId);
      if (!employee) continue;

      const timesheetEntries = await prisma.timesheetEntry.findMany({
        where: { payrollRunId: id, employeeId: ps.employeeId },
      });

      const otherCutoffAttendance = await getOtherCutoffAttendance(
        ps.employeeId,
        payrollRun.year,
        payrollRun.month,
        payrollRun.cutoffType as any
      );

      const calculation = calculatePayslip(
        employee as any,
        timesheetEntries as any,
        payrollRun.year,
        payrollRun.month,
        payrollRun.cutoffType as any,
        parseFloat(String(employee.defaultKpi || 0)),
        payrollSettings as any,
        {},
        otherCutoffAttendance,
        holidayData
      );

      const isMissing = timesheetEntries.length === 0;
      if (isMissing) missingTimesheets++;

      await prisma.payslip.update({
        where: { id: ps.id },
        data: {
          eligibleWorkdays: calculation.attendance.eligibleWorkdays,
          presentDays: calculation.attendance.presentDays,
          absentDays: calculation.attendance.absentDays,
          totalLateMinutes: calculation.attendance.totalLateMinutes,
          totalUndertimeMinutes: calculation.attendance.totalUndertimeMinutes,
          totalOvertimeHours: calculation.attendance.totalOvertimeHours,

          lateCount: calculation.attendance.lateCount,
          absentCount: calculation.attendance.absentCount,
          monthlyLateCount: calculation.monthlyAttendance.lateCount,
          monthlyAbsentCount: calculation.monthlyAttendance.absentCount,
          kpiVoided: calculation.kpiVoided,
          kpiVoidReason: calculation.kpiVoidReason,

          basicPay: calculation.earnings.basicPay,
          overtimePay: calculation.earnings.overtimePay,
          holidayPay: calculation.earnings.holidayPay,
          cola: calculation.earnings.cola,
          kpi: calculation.earnings.kpi,
          otherEarnings: calculation.earnings.otherEarnings,
          grossPay: calculation.earnings.grossPay,

          absenceDeduction: calculation.deductions.absenceDeduction,
          lateDeduction: calculation.deductions.lateDeduction,
          undertimeDeduction: calculation.deductions.undertimeDeduction,
          sssDeduction: calculation.deductions.sssDeduction,
          philhealthDeduction: calculation.deductions.philhealthDeduction,
          pagibigDeduction: calculation.deductions.pagibigDeduction,
          sssLoanDeduction: calculation.deductions.sssLoanDeduction,
          pagibigLoanDeduction: calculation.deductions.pagibigLoanDeduction,
          otherLoanDeduction: calculation.deductions.otherLoanDeduction,
          cashAdvanceDeduction: calculation.deductions.cashAdvanceDeduction,
          totalDeductions: calculation.deductions.totalDeductions,
          netPay: calculation.netPay,
          netPayInWords: calculation.netPayInWords,
          govDeductionsApplied: calculation.govDeductionsApplied,
          computationBreakdown: calculation.computationBreakdown as any,
          isMissing,
        },
      });

      updated++;
    }

    return NextResponse.json({
      message: `Recalculated ${updated} payslip(s)`,
      updated,
      missingTimesheets,
    });
  } catch (error) {
    console.error('Recalculate payslips error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

