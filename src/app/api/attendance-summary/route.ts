import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, canManagePayroll } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());

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

    // Get all payslips for the selected month
    const payslips = await prisma.payslip.findMany({
      where: {
        payrollRun: {
          year,
          month,
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
      year,
      month,
      attendanceSummary,
      totals,
    });
  } catch (error) {
    console.error('Get attendance summary error:', error);
    return NextResponse.json({ error: 'Failed to get attendance summary' }, { status: 500 });
  }
}
