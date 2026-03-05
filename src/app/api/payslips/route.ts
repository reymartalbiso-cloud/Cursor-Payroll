export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ message: 'Skipping build-time scan' });
  }

  try {
    const { prisma } = await import('@/lib/prisma');
    const { getSession, canViewAllPayslips } = await import('@/lib/auth');
    const { cookies } = await import('next/headers');
    await cookies();

    const session = await getSession();
    if (!session || !canViewAllPayslips(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get('search') || '';
    const payrollRunId = searchParams.get('payrollRunId') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Build where clause based on role
    const canViewAll = canViewAllPayslips(session.role);

    const where: Record<string, any> = {};

    // Employees can only view their own payslips
    if (!canViewAll) {
      if (!session.employeeId) {
        return NextResponse.json({ payslips: [], total: 0, page, limit, totalPages: 0 });
      }
      where.employeeId = session.employeeId;
    } else {
      // Admin search
      if (search) {
        where.OR = [
          { employeeNo: { contains: search, mode: 'insensitive' } },
          { employeeName: { contains: search, mode: 'insensitive' } },
          { referenceNo: { contains: search, mode: 'insensitive' } },
        ];
      }
    }

    if (payrollRunId) {
      where.payrollRunId = payrollRunId;
    }

    const [payslips, total] = await Promise.all([
      prisma.payslip.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          payrollRun: {
            select: {
              id: true,
              name: true,
              cutoffStart: true,
              cutoffEnd: true,
              payDate: true,
              status: true,
            },
          },
        },
      }),
      prisma.payslip.count({ where }),
    ]);

    return NextResponse.json({
      payslips,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Get payslips error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

