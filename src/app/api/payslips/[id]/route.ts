import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, canViewAllPayslips } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const payslip = await prisma.payslip.findUnique({
      where: { id },
      include: {
        payrollRun: true,
        employee: true,
        earnings: { orderBy: { sortOrder: 'asc' } },
        deductions: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!payslip) {
      return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    }

    // Check access - employees can only view their own payslips
    if (!canViewAllPayslips(session.role)) {
      if (payslip.employee?.id !== session.employeeId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    // Get timesheet entries for this payslip
    const timesheetEntries = await prisma.timesheetEntry.findMany({
      where: {
        payrollRunId: payslip.payrollRunId,
        employeeId: payslip.employeeId,
      },
      orderBy: { date: 'asc' },
    });

    // Get settings for display
    const settings = await prisma.setting.findMany();
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

    return NextResponse.json({
      ...payslip,
      timesheetEntries,
      settings: {
        companyName: settingsMap.company_name || 'Company Name',
        companyAddress: settingsMap.company_address || '',
        companyPhone: settingsMap.company_phone || '',
        companyEmail: settingsMap.company_email || '',
      },
    });
  } catch (error) {
    console.error('Get payslip error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
