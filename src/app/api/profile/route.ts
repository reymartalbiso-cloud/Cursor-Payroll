export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
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

    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { employee: true },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
