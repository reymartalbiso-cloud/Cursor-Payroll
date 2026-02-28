import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, canManagePayroll } from '@/lib/auth';

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

    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id },
      include: {
        payslips: {
          include: {
            employee: {
              select: { id: true, employeeNo: true, firstName: true, lastName: true, department: true },
            },
          },
          orderBy: { employeeNo: 'asc' },
        },
        _count: { select: { payslips: true, timesheetEntries: true } },
      },
    });

    if (!payrollRun) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    return NextResponse.json(payrollRun);
  } catch (error) {
    console.error('Get payroll run error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
    const { status, notes } = body;

    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id },
    });

    if (!payrollRun) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    // Prevent modification if finalized, UNLESS we are reverting status to DRAFT (unlocking)
    if (payrollRun.status === 'FINALIZED' && status && status !== 'FINALIZED' && status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Cannot modify a finalized payroll run. Please unlock it first.' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (notes !== undefined) updateData.notes = notes;

    if (status) {
      updateData.status = status;
      if (status === 'FINALIZED') {
        updateData.finalizedAt = new Date();
        updateData.finalizedBy = session.userId;
      }
    }

    const updated = await prisma.payrollRun.update({
      where: { id },
      data: updateData,
    });

    // Log the action
    if (status === 'FINALIZED') {
      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          payrollRunId: id,
          action: 'FINALIZE',
          entityType: 'PayrollRun',
          entityId: id,
          description: `Finalized payroll run: ${payrollRun.name}`,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update payroll run error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id },
      include: {
        _count: { select: { payslips: true } },
      },
    });

    if (!payrollRun) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    // Allow deleting finalized runs ONLY if they have 0 payslips (empty runs)
    if (payrollRun.status === 'FINALIZED' && payrollRun._count.payslips > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a finalized payroll run with payslips' },
        { status: 400 }
      );
    }

    // Delete related records first
    await prisma.timesheetEntry.deleteMany({ where: { payrollRunId: id } });
    await prisma.payslipDeduction.deleteMany({ where: { payslip: { payrollRunId: id } } });
    await prisma.payslipEarning.deleteMany({ where: { payslip: { payrollRunId: id } } });
    await prisma.payslip.deleteMany({ where: { payrollRunId: id } });
    await prisma.auditLog.deleteMany({ where: { payrollRunId: id } });

    await prisma.payrollRun.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Payroll run deleted' });
  } catch (error) {
    console.error('Delete payroll run error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
