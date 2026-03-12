export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const createPayrollRunSchema = z.object({
  year: z.number().min(2020).max(2100),
  month: z.number().min(1).max(12),
  cutoffType: z.enum(['FIRST_HALF', 'SECOND_HALF']),
  payDate: z.string(),
  notes: z.string().optional(),
});

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const year = searchParams.get('year');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = (searchParams.get('search') || '').trim();
    const sortField = searchParams.get('sortField') || '';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

    const where: any = {
      ...(year && { year: parseInt(year) }),
    };

    if (status) {
      if (status.includes(',')) {
        where.status = { in: status.split(',') };
      } else {
        where.status = status;
      }
    }

    if (search) {
      // Search by name, which already contains month, year, and cutoff label
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    // Default ordering: newest periods first
    let orderBy: any =
      [{ year: 'desc' }, { month: 'desc' }, { cutoffType: 'desc' }] as any;

    // Apply explicit sort if requested
    if (sortField) {
      const direction: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';

      switch (sortField) {
        case 'name':
          orderBy = { name: direction };
          break;
        case 'cutoffStart':
          orderBy = { cutoffStart: direction };
          break;
        case 'payDate':
          orderBy = { payDate: direction };
          break;
        case 'workdays':
          orderBy = { eligibleWorkdays: direction };
          break;
        case 'status':
          orderBy = { status: direction };
          break;
        case 'payslips':
          // Sort by number of payslips
          orderBy = {
            payslips: {
              _count: direction,
            },
          };
          break;
        default:
          // keep default order
          break;
      }
    }

    const [payrollRuns, total] = await Promise.all([
      prisma.payrollRun.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { payslips: true } },
        },
      }),
      prisma.payrollRun.count({ where }),
    ]);

    return NextResponse.json({
      payrollRuns,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Get payroll runs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // 1. Immediate build-time rescue
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ message: 'Skipping build-time scan' });
  }

  try {
    // 2. Dynamic imports for isolation
    const { prisma } = await import('@/lib/prisma');
    const { getSession, canManagePayroll } = await import('@/lib/auth');
    const { cookies } = await import('next/headers');
    const { getEligibleWorkdays, getCutoffPeriod } = await import('@/lib/payroll-calculator');

    // 3. Force dynamic context
    await cookies();

    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createPayrollRunSchema.parse(body);

    const { year, month, cutoffType, payDate, notes } = validatedData;

    // Check if payroll run already exists
    const existing = await prisma.payrollRun.findUnique({
      where: {
        year_month_cutoffType: { year, month, cutoffType: cutoffType as any },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Payroll run for this period already exists' },
        { status: 400 }
      );
    }

    // Calculate cutoff period and eligible workdays
    const { start, end } = getCutoffPeriod(year, month, cutoffType as any);
    const eligibleWorkdays = getEligibleWorkdays(year, month, cutoffType as any);

    // Get settings
    const settings = await prisma.setting.findMany();
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

    const payrollSettings = {
      govDeductionMode: (settingsMap.gov_deduction_mode || 'fixed_per_cutoff') as 'fixed_per_cutoff' | 'prorated_by_days',
      standardDailyHours: parseInt(settingsMap.standard_daily_hours || '8'),
    };

    // Create payroll run
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const cutoffLabel = cutoffType === 'FIRST_HALF' ? '1-15' : `16-${end.getDate()}`;
    const name = `${monthNames[month]} ${year} (${cutoffLabel})`;

    const payrollRun = await prisma.payrollRun.create({
      data: {
        name,
        cutoffType: cutoffType as any,
        cutoffStart: start,
        cutoffEnd: end,
        payDate: new Date(payDate),
        year,
        month,
        eligibleWorkdays,
        notes,
        govDeductionMode: payrollSettings.govDeductionMode,
        standardDailyHours: payrollSettings.standardDailyHours,
      },
    });

    return NextResponse.json(payrollRun, { status: 201 });
  } catch (error) {
    console.error('Create payroll run error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

