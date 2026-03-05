export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const updateTimesheetSchema = z.object({
  isLateExcused: z.boolean().optional(),
  isAbsentExcused: z.boolean().optional(),
  adjustedLateMinutes: z.number().nullable().optional(),
  adjustedUndertimeMinutes: z.number().nullable().optional(),
  adjustedOvertimeHours: z.number().nullable().optional(),
  adjustmentRemarks: z.string().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const entry = await prisma.timesheetEntry.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            employeeNo: true,
            firstName: true,
            lastName: true,
          },
        },
        payrollRun: {
          select: {
            name: true,
            cutoffStart: true,
            cutoffEnd: true,
          },
        },
      },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Timesheet entry not found' }, { status: 404 });
    }

    return NextResponse.json(entry);
  } catch (error) {
    console.error('Get timesheet entry error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateTimesheetSchema.parse(body);

    // Check if entry exists
    const existing = await prisma.timesheetEntry.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Timesheet entry not found' }, { status: 404 });
    }

    // Update the entry with adjustment data
    const entry = await prisma.timesheetEntry.update({
      where: { id },
      data: {
        ...validatedData,
        adjustedBy: session.name || session.email,
        adjustedAt: new Date(),
      },
      include: {
        employee: {
          select: {
            employeeNo: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json(entry);
  } catch (error) {
    console.error('Update timesheet entry error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
