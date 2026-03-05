export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, isPayrollAdmin } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !isPayrollAdmin(session.role)) {
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

