export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, isAdmin } from '@/lib/auth';
import { ALL_PHILIPPINE_HOLIDAYS, getHolidaysForYear } from '@/lib/philippine-holidays';
import { HolidayType } from '@prisma/client';

// POST - Seed Philippine holidays for a specific year or all years
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !isAdmin(session.role)) {
      return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { year } = body;

    // Get holidays to seed
    const holidaysToSeed = year ? getHolidaysForYear(year) : ALL_PHILIPPINE_HOLIDAYS;

    if (holidaysToSeed.length === 0) {
      return NextResponse.json({
        error: year
          ? `No holidays defined for year ${year}. Supported years: 2024, 2025, 2026`
          : 'No holidays to seed'
      }, { status: 400 });
    }

    let created = 0;
    let skipped = 0;

    for (const holiday of holidaysToSeed) {
      const holidayDate = new Date(holiday.date);
      const holidayYear = holidayDate.getFullYear();

      try {
        // Check if holiday already exists
        const existing = await prisma.holiday.findUnique({
          where: { date: holidayDate },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Create holiday
        await prisma.holiday.create({
          data: {
            name: holiday.name,
            date: holidayDate,
            type: holiday.type as HolidayType,
            year: holidayYear,
            description: `Philippine ${holiday.type === 'REGULAR' ? 'Regular' : 'Special Non-Working'} Holiday`,
          },
        });
        created++;
      } catch (error) {
        // Skip duplicates
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      message: `Created ${created} holidays, skipped ${skipped} (already exist)`,
    });
  } catch (error) {
    console.error('Seed holidays error:', error);
    return NextResponse.json({ error: 'Failed to seed holidays' }, { status: 500 });
  }
}

