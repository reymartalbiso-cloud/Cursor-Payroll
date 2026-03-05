import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, canViewAllPayslips } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const payrollRunId = searchParams.get('payrollRunId') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Build where clause based on role
    const canViewAll = canViewAllPayslips(session.role);

    const where: Record<string, unknown> = {};

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
