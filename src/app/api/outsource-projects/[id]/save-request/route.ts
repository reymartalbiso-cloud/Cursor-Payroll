export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';

interface Entry {
  operatorName: string;
  output: number;
  calculatedPay: number;
  remarks?: string;
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

    // 3. Force dynamic context
    await cookies();

    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, requestName, periodStart, periodEnd, entries } = body as {
      projectId: string;
      requestName: string;
      periodStart?: string;
      periodEnd?: string;
      entries: Entry[];
    };

    if (!projectId || !requestName || !entries?.length) {
      return NextResponse.json(
        { error: 'Project, request name, and entries are required' },
        { status: 400 }
      );
    }

    const project = await prisma.outsourceProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const totalAmount = entries.reduce((sum: number, e: Entry) => sum + e.calculatedPay, 0);

    const payrollRequest = await prisma.outsourcePayrollRequest.create({
      data: {
        projectId,
        requestName,
        periodStart: periodStart ? new Date(periodStart) : null,
        periodEnd: periodEnd ? new Date(periodEnd) : null,
        totalAmount,
        status: 'DRAFT',
        entries: {
          create: entries.map((e: Entry) => ({
            operatorName: e.operatorName,
            output: e.output,
            calculatedPay: e.calculatedPay,
            remarks: e.remarks || null,
          })),
        },
      },
      include: { entries: true },
    });

    return NextResponse.json({ payrollRequest });
  } catch (error) {
    console.error('Save outsource request error:', error);
    return NextResponse.json({ error: 'Failed to save request' }, { status: 500 });
  }
}
