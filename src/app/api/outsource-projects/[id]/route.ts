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
    const project = await prisma.outsourceProject.findUnique({
      where: { id },
      include: {
        payrollRequests: {
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { entries: true } } },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Outsource project GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, rate, paymentBasis, description } = body;

    const project = await prisma.outsourceProject.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(rate !== undefined && { rate: parseFloat(rate) }),
        ...(paymentBasis !== undefined && { paymentBasis }),
        ...(description !== undefined && { description }),
      },
    });

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Outsource project update error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update project';
    return NextResponse.json({ error: message }, { status: 500 });
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
    await prisma.outsourceProject.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Outsource project delete error:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
