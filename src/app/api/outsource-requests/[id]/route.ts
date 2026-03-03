import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManagePayroll } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const payrollRequest = await prisma.outsourcePayrollRequest.findUnique({
      where: { id },
      include: {
        project: true,
        entries: true,
      },
    });

    if (!payrollRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    return NextResponse.json({ payrollRequest });
  } catch (error) {
    console.error('Outsource request GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch request' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await prisma.outsourcePayrollRequest.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Outsource request delete error:', error);
    return NextResponse.json({ error: 'Failed to delete request' }, { status: 500 });
  }
}
