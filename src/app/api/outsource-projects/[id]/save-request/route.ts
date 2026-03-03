import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManagePayroll } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface Entry {
  operatorName: string;
  output: number;
  calculatedPay: number;
  remarks?: string;
}

export async function POST(request: NextRequest) {
  try {
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
