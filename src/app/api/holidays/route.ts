import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, canManagePayroll } from '@/lib/auth';
import { HolidayType } from '@prisma/client';

// GET - List holidays
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear();

    const holidays = await prisma.holiday.findMany({
      where: { year },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ holidays });
  } catch (error) {
    console.error('Get holidays error:', error);
    return NextResponse.json({ error: 'Failed to get holidays' }, { status: 500 });
  }
}

// POST - Create holiday
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Check if holiday already exists on this date
    const existing = await prisma.holiday.findUnique({
      where: { date: holidayDate },
    });

    if (existing) {
      return NextResponse.json({ error: 'A holiday already exists on this date' }, { status: 400 });
    }

    const holiday = await prisma.holiday.create({
      data: {
        name,
        date: holidayDate,
        type: type as HolidayType,
        year,
        description,
      },
    });

    return NextResponse.json(holiday);
  } catch (error) {
    console.error('Create holiday error:', error);
    return NextResponse.json({ error: 'Failed to create holiday' }, { status: 500 });
  }
}
