import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, canManageEmployees } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !canManageEmployees(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const payrollRunId = searchParams.get('payrollRunId');
    const employeeId = searchParams.get('employeeId');
    const search = searchParams.get('search') || '';
    const sortField = searchParams.get('sortField') || 'date';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const filterLate = searchParams.get('filterLate'); // 'all', 'late', 'excused'
    const filterAbsent = searchParams.get('filterAbsent'); // 'all', 'absent', 'excused'

    if (!payrollRunId) {
      return NextResponse.json({ error: 'payrollRunId is required' }, { status: 400 });
    }

    // Build where clause
    const where: Record<string, unknown> = {
      payrollRunId,
    };

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (search) {
      where.employee = {
        OR: [
          { employeeNo: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    // Filter by late status
    if (filterLate === 'late') {
      where.minutesLate = { gt: 0 };
      where.isLateExcused = false;
    } else if (filterLate === 'excused') {
      where.isLateExcused = true;
    }

    // Filter by absent status
    if (filterAbsent === 'absent') {
      where.isAbsent = true;
      where.isAbsentExcused = false;
    } else if (filterAbsent === 'excused') {
      where.isAbsentExcused = true;
    }

    // Build orderBy
    let orderBy: Record<string, string> | Record<string, Record<string, string>>[] = { date: 'asc' };

    switch (sortField) {
      case 'date':
        orderBy = { date: sortOrder };
        break;
      case 'employee':
        orderBy = [
          { employee: { lastName: sortOrder } },
          { employee: { firstName: sortOrder } },
        ];
        break;
      case 'late':
        orderBy = { minutesLate: sortOrder };
        break;
      case 'undertime':
        orderBy = { undertimeMinutes: sortOrder };
        break;
      case 'overtime':
        orderBy = { overtimeHours: sortOrder };
        break;
    }

    const [entries, total] = await Promise.all([
      prisma.timesheetEntry.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          employee: {
            select: {
              employeeNo: true,
              firstName: true,
              lastName: true,
              department: true,
            },
          },
        },
      }),
      prisma.timesheetEntry.count({ where }),
    ]);

    // Get summary stats
    const stats = await prisma.timesheetEntry.aggregate({
      where: { payrollRunId },
      _sum: {
        minutesLate: true,
        undertimeMinutes: true,
      },
      _count: {
        _all: true,
      },
    });

    const lateCount = await prisma.timesheetEntry.count({
      where: { payrollRunId, minutesLate: { gt: 0 } },
    });

    const absentCount = await prisma.timesheetEntry.count({
      where: { payrollRunId, isAbsent: true },
    });

    const excusedLateCount = await prisma.timesheetEntry.count({
      where: { payrollRunId, isLateExcused: true },
    });

    const excusedAbsentCount = await prisma.timesheetEntry.count({
      where: { payrollRunId, isAbsentExcused: true },
    });

    return NextResponse.json({
      entries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        totalEntries: stats._count._all,
        totalLateMinutes: stats._sum.minutesLate || 0,
        totalUndertimeMinutes: stats._sum.undertimeMinutes || 0,
        lateCount,
        absentCount,
        excusedLateCount,
        excusedAbsentCount,
      },
    });
  } catch (error) {
    console.error('Get timesheet entries error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
