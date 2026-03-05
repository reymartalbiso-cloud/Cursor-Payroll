export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
  // 1. Immediate build-time rescue
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ message: 'Skipping build-time scan' });
  }

  try {
    // 2. Dynamic imports for isolation
    const { prisma } = await import('@/lib/prisma');
    const { getSession, canManagePayroll } = await import('@/lib/auth');
    const { cookies } = await import('next/headers');
    const { accountingService } = await import('@/services/accountingService');
    const { formatDate } = await import('@/lib/utils');

    // 3. Force dynamic context
    await cookies();

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

      // Send LifeScan payslip notifications to employees
      if (accountingService.isConfigured()) {
        try {
          const payslips = await prisma.payslip.findMany({
            where: { payrollRunId: id, isMissing: false },
            include: { employee: { select: { employeeNo: true } } },
          });

          if (payslips.length > 0) {
            const users = await accountingService.fetchUsersWithDTR({});
            const employeeIdToUserId = new Map<string, string>();
            users.forEach((u) => {
              if (u.employee_id) {
                employeeIdToUserId.set(u.employee_id.toLowerCase().trim(), u.id);
              }
            });

            const periodLabel = `${formatDate(payrollRun.cutoffStart, 'short')} - ${formatDate(payrollRun.cutoffEnd, 'short')}`;

            // Send individual payslip notifications (type: 'payslip') with full JSON data
            const notifyPromises: Promise<unknown>[] = [];
            for (const ps of payslips) {
              const userId = employeeIdToUserId.get(ps.employee.employeeNo.toLowerCase().trim());
              if (userId) {
                const payslipData = {
                  // Employee Info
                  employeeName: ps.employeeName,
                  employeeNo: ps.employeeNo,
                  department: ps.department,
                  position: ps.position,
                  referenceNo: ps.referenceNo,
                  payPeriod: periodLabel,
                  payDate: formatDate(payrollRun.payDate, 'short'),
                  dailyRate: Number(ps.dailyRate),
                  // Attendance Summary
                  eligibleWorkdays: ps.eligibleWorkdays,
                  presentDays: ps.presentDays,
                  absentDays: ps.absentDays,
                  totalLateMinutes: ps.totalLateMinutes,
                  // Earnings
                  basicPay: Number(ps.basicPay),
                  holidayPay: Number(ps.holidayPay),
                  overtimePay: Number(ps.overtimePay),
                  cola: Number(ps.cola),
                  kpi: Number(ps.kpi),
                  otherEarnings: Number(ps.otherEarnings),
                  grossPay: Number(ps.grossPay),
                  // Deductions
                  absenceDeduction: Number(ps.absenceDeduction),
                  lateDeduction: Number(ps.lateDeduction),
                  undertimeDeduction: Number(ps.undertimeDeduction),
                  sssDeduction: Number(ps.sssDeduction),
                  philhealthDeduction: Number(ps.philhealthDeduction),
                  pagibigDeduction: Number(ps.pagibigDeduction),
                  pagibigLoanDeduction: Number(ps.pagibigLoanDeduction),
                  sssLoanDeduction: Number(ps.sssLoanDeduction),
                  cashAdvanceDeduction: Number(ps.cashAdvanceDeduction),
                  otherDeductions: Number(ps.otherDeductions),
                  totalDeductions: Number(ps.totalDeductions),
                  // Net Pay
                  netPay: Number(ps.netPay),
                  netPayInWords: ps.netPayInWords || '',
                };

                notifyPromises.push(
                  accountingService.sendPayslipNotification(
                    userId,
                    'Payslip Released',
                    JSON.stringify(payslipData)
                  )
                );
              }
            }

            if (notifyPromises.length > 0) {
              await Promise.allSettled(notifyPromises);
              console.log(`Sent ${notifyPromises.length} payslip notifications for payroll run ${id}`);
            }
          }
        } catch (notifyError) {
          console.error('LifeScan notify on finalize:', notifyError);
        }
      }
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
