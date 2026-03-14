export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // 1. Immediate build-time rescue
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ message: 'Skipping build-time scan' });
  }

  try {
    // 2. Dynamic imports to hide dependencies from static analyzer
    const { prisma } = await import('@/lib/prisma');
    const { getSession, canManagePayroll } = await import('@/lib/auth');
    const { cookies } = await import('next/headers');

    // 3. Force dynamic context
    await cookies();

    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const currentYear = new Date().getFullYear();

    // Parse months: "all" or comma-separated (e.g. "1,2,3"); legacy single "month" supported
    const monthsParam = searchParams.get('months') ?? searchParams.get('month') ?? '';
    const monthNumbers: number[] =
      monthsParam === 'all' || !monthsParam
        ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        : monthsParam
            .split(',')
            .map((m) => parseInt(m.trim(), 10))
            .filter((m) => m >= 1 && m <= 12);
    const monthSet = monthNumbers.length ? monthNumbers : [new Date().getMonth() + 1];

    // Parse years: "all" or comma-separated; legacy single "year" supported
    const yearsParam = searchParams.get('years') ?? searchParams.get('year') ?? '';
    const yearNumbers: number[] =
      yearsParam === 'all' || !yearsParam
        ? Array.from({ length: 5 }, (_, i) => currentYear - i)
        : yearsParam
            .split(',')
            .map((y) => parseInt(y.trim(), 10))
            .filter((y) => y >= 2000 && y <= 2100);
    const yearSet = yearNumbers.length ? yearNumbers : [currentYear];

    // Get all active employees
    const employees = await prisma.employee.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      select: {
        id: true,
        employeeNo: true,
        firstName: true,
        lastName: true,
        department: true,
        position: true,
      },
      orderBy: { employeeNo: 'asc' },
    });

    // Get all payslips for the selected year(s) and month(s)
    const payslips = await prisma.payslip.findMany({
      where: {
        payrollRun: {
          year: { in: yearSet },
          month: { in: monthSet },
        },
      },
      select: {
        employeeId: true,
        lateCount: true,
        absentCount: true,
        monthlyLateCount: true,
        monthlyAbsentCount: true,
        totalLateMinutes: true,
        kpiVoided: true,
        kpiVoidReason: true,
        payrollRun: {
          select: {
            cutoffType: true,
          },
        },
      },
    });

    // Aggregate attendance by employee
    const attendanceSummary = employees.map(emp => {
      const empPayslips = payslips.filter(p => p.employeeId === emp.id);

      // Sum up across both cutoffs
      const totalLateCount = empPayslips.reduce((sum, p) => sum + (p.lateCount || 0), 0);
      const totalAbsentCount = empPayslips.reduce((sum, p) => sum + (p.absentCount || 0), 0);
      const totalLateMinutes = empPayslips.reduce((sum, p) => sum + (p.totalLateMinutes || 0), 0);

      // Check if KPI is voided in any payslip
      const kpiVoided = empPayslips.some(p => p.kpiVoided);
      const kpiVoidReason = empPayslips.find(p => p.kpiVoided)?.kpiVoidReason || null;

      return {
        employeeId: emp.id,
        employeeNo: emp.employeeNo,
        employeeName: `${emp.lastName}, ${emp.firstName}`,
        department: emp.department,
        position: emp.position,
        lateCount: totalLateCount,
        absentCount: totalAbsentCount,
        totalLateMinutes,
        kpiVoided,
        kpiVoidReason,
        hasData: empPayslips.length > 0,
      };
    });

    // Calculate totals
    const totals = {
      totalEmployees: employees.length,
      employeesWithData: attendanceSummary.filter(a => a.hasData).length,
      totalLateOccurrences: attendanceSummary.reduce((sum, a) => sum + a.lateCount, 0),
      totalAbsences: attendanceSummary.reduce((sum, a) => sum + a.absentCount, 0),
      totalLateMinutes: attendanceSummary.reduce((sum, a) => sum + a.totalLateMinutes, 0),
      kpiVoidedCount: attendanceSummary.filter(a => a.kpiVoided).length,
    };

    return NextResponse.json({
      year: yearSet.length === 1 ? yearSet[0] : null,
      month: monthSet.length === 1 ? monthSet[0] : null,
      years: yearSet,
      months: monthSet,
      attendanceSummary,
      totals,
    });
  } catch (error) {
    console.error('Get attendance summary error:', error);
    return NextResponse.json({ error: 'Failed to get attendance summary' }, { status: 500 });
  }
}
