export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';

// GET - Get single holiday
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
    const { getSession, canManagePayroll } = await import('@/lib/auth');
    const { cookies } = await import('next/headers');

    // 3. Force dynamic context
    await cookies();

    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const holiday = await prisma.holiday.findUnique({
      where: { id },
    });

    if (!holiday) {
      return NextResponse.json({ error: 'Holiday not found' }, { status: 404 });
    }

    return NextResponse.json(holiday);
  } catch (error) {
    console.error('Get holiday error:', error);
    return NextResponse.json({ error: 'Failed to get holiday' }, { status: 500 });
  }
}

// PUT - Update holiday
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
    const { getSession, canManagePayroll } = await import('@/lib/auth');
    const { cookies } = await import('next/headers');
    const { HolidayType } = await import('@prisma/client');

    // 3. Force dynamic context
    await cookies();

    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, date, type, description } = body;

    if (!name || !date || !type) {
      return NextResponse.json({ error: 'Name, date, and type are required' }, { status: 400 });
    }

    if (!['REGULAR', 'SPECIAL'].includes(type)) {
      return NextResponse.json({ error: 'Invalid holiday type' }, { status: 400 });
    }

    const holidayDate = new Date(date);
    const year = holidayDate.getFullYear();

    // Check if another holiday exists on this date
    const existing = await prisma.holiday.findFirst({
      where: {
        date: holidayDate,
        id: { not: id },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Another holiday already exists on this date' }, { status: 400 });
    }

    const holiday = await prisma.holiday.update({
      where: { id },
      data: {
        name,
        date: holidayDate,
        type: type as any, // casting to any to avoid importing the enum value at top level
        year,
        description,
      },
    });

    return NextResponse.json(holiday);
  } catch (error) {
    console.error('Update holiday error:', error);
    return NextResponse.json({ error: 'Failed to update holiday' }, { status: 500 });
  }
}

// DELETE - Delete holiday
export async function DELETE(
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
    const { getSession, canManagePayroll } = await import('@/lib/auth');
    const { cookies } = await import('next/headers');

    // 3. Force dynamic context
    await cookies();

    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await prisma.holiday.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete holiday error:', error);
    return NextResponse.json({ error: 'Failed to delete holiday' }, { status: 500 });
  }
}
