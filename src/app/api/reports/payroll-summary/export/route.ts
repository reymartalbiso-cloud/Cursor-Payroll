export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ message: 'Skipping build-time scan' });
  }

  try {
    const { prisma } = await import('@/lib/prisma');
    const { getSession, canManagePayroll } = await import('@/lib/auth');
    const { cookies } = await import('next/headers');
    await cookies();

    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const payrollRunId = searchParams.get('payrollRunId');

    if (!payrollRunId) {
      return NextResponse.json({ error: 'Payroll run ID required' }, { status: 400 });
    }

    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
    });

    if (!payrollRun) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    const payslips = await prisma.payslip.findMany({
      where: { payrollRunId },
      orderBy: { employeeNo: 'asc' },
    });

    // Generate CSV
    const headers = [
      'Employee ID',
      'Employee Name',
      'Department',
      'Position',
      'Daily Rate',
      'Present Days',
      'Absent Days',
      'Late (mins)',
      'Undertime (mins)',
      'OT Hours',
      'Basic Pay',
      'Overtime Pay',
      'Holiday Pay',
      'COLA',
      'KPI',
      'Gross Pay',
      'Absence Deduction',
      'Late Deduction',
      'SSS',
      'PhilHealth',
      'Pag-IBIG',
      'SSS Loan',
      'Pag-IBIG Loan',
      'Cash Advance',
      'Total Deductions',
      'Net Pay',
      'Gov Deductions Applied',
    ];

    const rows = payslips.map((p) => [
      p.employeeNo,
      p.employeeName,
      p.department,
      p.position,
      p.dailyRate,
      p.presentDays,
      p.absentDays,
      p.totalLateMinutes,
      p.totalUndertimeMinutes,
      p.totalOvertimeHours,
      p.basicPay,
      p.overtimePay,
      p.holidayPay,
      p.cola,
      p.kpi,
      p.grossPay,
      p.absenceDeduction,
      p.lateDeduction,
      p.sssDeduction,
      p.philhealthDeduction,
      p.pagibigDeduction,
      p.sssLoanDeduction,
      p.pagibigLoanDeduction,
      p.cashAdvanceDeduction,
      p.totalDeductions,
      p.netPay,
      p.govDeductionsApplied ? 'Yes' : 'No',
    ]);

    // Add summary row
    const summary = {
      totalGross: payslips.reduce((sum, p) => sum + parseFloat(String(p.grossPay)), 0),
      totalDeductions: payslips.reduce((sum, p) => sum + parseFloat(String(p.totalDeductions)), 0),
      totalNet: payslips.reduce((sum, p) => sum + parseFloat(String(p.netPay)), 0),
    };

    rows.push([]);
    rows.push(['TOTALS', '', '', '', '', '', '', '', '', '', '', '', '', '', '', summary.totalGross, '', '', '', '', '', '', '', '', summary.totalDeductions, summary.totalNet, '']);

    const csv = [
      `Payroll Report: ${payrollRun.name}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => {
          const str = String(cell ?? '');
          return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(',')
      ),
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="payroll-report-${payrollRun.name}.csv"`,
      },
    });
  } catch (error) {
    console.error('CSV export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

