export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // 1. Immediate build-time rescue
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ message: 'Skipping build-time scan' });
  }

  try {
    // 2. Dynamic imports for isolation
    const { clearSession } = await import('@/lib/auth');
    const { cookies } = await import('next/headers');

    // 3. Force dynamic context
    await cookies();

    await clearSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

