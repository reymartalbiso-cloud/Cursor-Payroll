import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, canManagePayroll } from '@/lib/auth';

export const dynamic = 'force-dynamic';
import { recalculateWithNewKpi } from '@/lib/payroll-calculator';
import { numberToWords, roundTo2Decimals } from '@/lib/utils';

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
    const { kpi } = await request.json();

    const payslip = await prisma.payslip.findUnique({
      where: { id },
      include: { payrollRun: true },
    });

    if (!payslip) {
      return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    }

    if (payslip.payrollRun.status === 'FINALIZED') {
      return NextResponse.json(
        { error: 'Cannot modify a finalized payroll' },
        { status: 400 }
      );
    }

    const oldKpi = parseFloat(String(payslip.kpi));
    const newKpi = roundTo2Decimals(parseFloat(kpi) || 0);

    // Recalculate gross and net pay
    const kpiDiff = newKpi - oldKpi;
    const newGrossPay = roundTo2Decimals(parseFloat(String(payslip.grossPay)) + kpiDiff);
    const newNetPay = roundTo2Decimals(newGrossPay - parseFloat(String(payslip.totalDeductions)));

    // Update payslip
    const updated = await prisma.payslip.update({
      where: { id },
      data: {
        kpi: newKpi,
        grossPay: newGrossPay,
        netPay: newNetPay,
        netPayInWords: numberToWords(newNetPay),
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        payrollRunId: payslip.payrollRunId,
        action: 'KPI_EDIT',
        entityType: 'Payslip',
        entityId: id,
        oldValue: { kpi: oldKpi },
        newValue: { kpi: newKpi },
        description: `KPI changed from ${oldKpi} to ${newKpi} for ${payslip.employeeName}`,
      },
    });

    return NextResponse.json({
      kpi: updated.kpi,
      grossPay: updated.grossPay,
      netPay: updated.netPay,
    });
  } catch (error) {
    console.error('Update KPI error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
