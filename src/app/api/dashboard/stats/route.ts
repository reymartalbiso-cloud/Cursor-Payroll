export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // 1. Immediate build-time rescue
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ message: 'Skipping build-time scan' });
  }

  try {
    // 2. Dynamic imports for isolation
    const { prisma } = await import('@/lib/prisma');
    const { getSession, canManagePayroll } = await import('@/lib/auth');
    const { cookies } = await import('next/headers');

    // 3. Force dynamic context
    await cookies();

    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [
      totalEmployees,
      activeEmployees,
      pendingPayrollRuns,
      thisMonthPayslips,
    ] = await Promise.all([
      prisma.employee.count({
        where: { deletedAt: null },
      }),
      prisma.employee.count({
        where: { status: 'ACTIVE', deletedAt: null },
      }),
      prisma.payrollRun.count({
        where: { status: { in: ['DRAFT', 'REVIEWED'] } },
      }),
      prisma.payslip.count({
        where: {
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
    ]);

    // Get total net pay for this month
    const netPayResult = await prisma.payslip.aggregate({
      where: {
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { netPay: true },
    });

    return NextResponse.json({
      totalEmployees,
      activeEmployees,
      pendingPayrollRuns,
      thisMonthPayslips,
      totalNetPay: netPayResult._sum.netPay || 0,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

