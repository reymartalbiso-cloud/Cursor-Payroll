export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ message: 'Skipping build-time scan' });
  }

  try {
    const { prisma } = await import('@/lib/prisma');
    const { getSession, canManagePayroll } = await import('@/lib/auth');
    const { cookies } = await import('next/headers');
    await cookies();

    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projects = await prisma.outsourceProject.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { payrollRequests: true } },
      },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Outsource projects GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ message: 'Skipping build-time scan' });
  }

  try {
    const { prisma } = await import('@/lib/prisma');
    const { getSession, canManagePayroll } = await import('@/lib/auth');
    const { cookies } = await import('next/headers');
    await cookies();

    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, rate, paymentBasis, description } = body;

    if (!name || rate === undefined || rate === null) {
      return NextResponse.json(
        { error: 'Project name and rate are required' },
        { status: 400 }
      );
    }

    const project = await prisma.outsourceProject.create({
      data: {
        name,
        rate: parseFloat(rate),
        paymentBasis: paymentBasis || 'EFFECTIVE_HOUR',
        description: description || null,
      },
    });

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Outsource project create error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

