export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, canManagePayroll } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const payrollRunId = searchParams.get('payrollRunId');

    if (!payrollRunId) {
      return NextResponse.json({ error: 'Payroll run ID required' }, { status: 400 });
    }

    const payslips = await prisma.payslip.findMany({
      where: { payrollRunId },
      orderBy: { employeeNo: 'asc' },
      select: {
        employeeNo: true,
        employeeName: true,
        department: true,
        presentDays: true,
        absentDays: true,
        totalLateMinutes: true,
        totalOvertimeHours: true,
        basicPay: true,
        kpi: true,
        grossPay: true,
        totalDeductions: true,
        netPay: true,
        govDeductionsApplied: true,
      },
    });

    // Calculate summary
    const summary = {
      totalEmployees: payslips.length,
      totalGrossPay: payslips.reduce((sum, p) => sum + parseFloat(String(p.grossPay)), 0),
      totalDeductions: payslips.reduce((sum, p) => sum + parseFloat(String(p.totalDeductions)), 0),
      totalNetPay: payslips.reduce((sum, p) => sum + parseFloat(String(p.netPay)), 0),
      totalAbsentDays: payslips.reduce((sum, p) => sum + p.absentDays, 0),
      totalLateMinutes: payslips.reduce((sum, p) => sum + p.totalLateMinutes, 0),
      totalOvertimeHours: payslips.reduce((sum, p) => sum + parseFloat(String(p.totalOvertimeHours)), 0),
    };

    return NextResponse.json({ payslips, summary });
  } catch (error) {
    console.error('Report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

