export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const employeeSchema = z.object({
  employeeNo: z.string().min(1, 'Employee ID is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  middleName: z.string().optional().nullable(),
  department: z.string().min(1, 'Department is required'),
  position: z.string().min(1, 'Position is required'),
  rateType: z.enum(['DAILY', 'MONTHLY']).default('DAILY'),
  monthlySalary: z.number().positive('Monthly salary must be positive'),
  dailyRate: z.number(),  // Auto-calculated from monthlySalary / 26
  basicPayPerCutoff: z.number().optional().nullable(),
  defaultKpi: z.number().default(0),
  sssContribution: z.number().default(0),
  philhealthContribution: z.number().default(0),
  pagibigContribution: z.number().default(0),
  sssLoan: z.number().default(0),
  pagibigLoan: z.number().default(0),
  otherLoans: z.number().default(0),
  cashAdvance: z.number().default(0),
  status: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED']).default('ACTIVE'),
  startDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  // 1. Immediate build-time rescue
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ message: 'Skipping build-time scan' });
  }

  try {
    // 2. Dynamic imports for isolation
    const { prisma } = await import('@/lib/prisma');
    const { getSession, canManageEmployees } = await import('@/lib/auth');
    const { cookies } = await import('next/headers');

    // 3. Force dynamic context
    await cookies();

    const session = await getSession();
    if (!session || !canManageEmployees(session.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get('search') || '';
    const department = searchParams.get('department') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const sortField = searchParams.get('sortField') || 'employeeNo';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    const where = {
      deletedAt: null,
      ...(search && {
        OR: [
          { employeeNo: { contains: search, mode: 'insensitive' as const } },
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(department && { department }),
      ...(status && { status: status as 'ACTIVE' | 'INACTIVE' | 'TERMINATED' }),
    };

    // Build orderBy based on sortField
    let orderBy: Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[] = { employeeNo: 'asc' };

    switch (sortField) {
      case 'employeeNo':
        orderBy = { employeeNo: sortOrder as 'asc' | 'desc' };
        break;
      case 'name':
        orderBy = [
          { lastName: sortOrder as 'asc' | 'desc' },
          { firstName: sortOrder as 'asc' | 'desc' },
        ];
        break;
      case 'department':
        orderBy = { department: sortOrder as 'asc' | 'desc' };
        break;
      case 'position':
        orderBy = { position: sortOrder as 'asc' | 'desc' };
        break;
      case 'dailyRate':
        orderBy = { dailyRate: sortOrder as 'asc' | 'desc' };
        break;
      case 'status':
        orderBy = { status: sortOrder as 'asc' | 'desc' };
        break;
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.employee.count({ where }),
    ]);

    // Get unique departments for filter
    const departments = await prisma.employee.findMany({
      where: { deletedAt: null },
      select: { department: true },
      distinct: ['department'],
    });

    return NextResponse.json({
      employees,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      departments: departments.map((d: any) => d.department),
    });
  } catch (error) {
    console.error('Get employees error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
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
    const { getSession, canManageEmployees } = await import('@/lib/auth');
    const { cookies } = await import('next/headers');

    // 3. Force dynamic context
    await cookies();

    const session = await getSession();
    if (!session || !canManageEmployees(session.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = employeeSchema.parse(body);

    // Check if employee ID already exists
    const existing = await prisma.employee.findUnique({
      where: { employeeNo: validatedData.employeeNo },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Employee ID already exists' },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.create({
      data: {
        ...validatedData,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : null,
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error('Create employee error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

