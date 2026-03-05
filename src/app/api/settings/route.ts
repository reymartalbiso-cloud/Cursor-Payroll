export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  // 1. Immediate build-time rescue
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ message: 'Skipping build-time scan' });
  }

  try {
    // 2. Dynamic imports for isolation
    const { prisma } = await import('@/lib/prisma');
    const { getSession } = await import('@/lib/auth');
    const { cookies } = await import('next/headers');

    // 3. Force dynamic context
    await cookies();

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await prisma.setting.findMany();
    const settingsObj = Object.fromEntries(settings.map(s => [s.key, s.value]));

    return NextResponse.json(settingsObj);
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  // 1. Immediate build-time rescue
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ message: 'Skipping build-time scan' });
  }

  try {
    // 2. Dynamic imports for isolation
    const { prisma } = await import('@/lib/prisma');
    const { getSession, isAdmin } = await import('@/lib/auth');
    const { cookies } = await import('next/headers');

    // 3. Force dynamic context
    await cookies();

    const session = await getSession();
    if (!session || !isAdmin(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Update each setting
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string') {
        await prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

