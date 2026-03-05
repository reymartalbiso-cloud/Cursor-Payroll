export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';

export async function POST(
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
    const { formatCurrency, formatDate } = await import('@/lib/utils');
    const archiver = (await import('archiver')).default;

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
          include: { employee: true },
        },
      },
    });

    if (!payrollRun) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    // Get settings
    const settings = await prisma.setting.findMany();
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

    // Create a ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk) => chunks.push(chunk));

    // Add each payslip as HTML file
    for (const payslip of payrollRun.payslips) {
      const html = generatePayslipHtml(payslip, payrollRun, settingsMap, formatCurrency, formatDate);
      archive.append(html, { name: `payslip-${payslip.employeeNo}-${payslip.referenceNo}.html` });
    }

    // Add summary CSV
    const csv = generateSummaryCsv(payrollRun);
    archive.append(csv, { name: 'payroll-summary.csv' });

    await archive.finalize();

    const buffer = Buffer.concat(chunks);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="payroll-${payrollRun.name}.zip"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generatePayslipHtml(payslip: any, payrollRun: any, settings: Record<string, string>, formatCurrency: any, formatDate: any): string {
  const companyName = settings.company_name || 'Company Name';
  const companyAddress = settings.company_address || '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Payslip - ${payslip.referenceNo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; }
    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
    .header h1 { font-size: 18px; }
    .header h2 { font-size: 16px; margin-top: 10px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .info-item { display: flex; justify-content: space-between; margin-bottom: 5px; }
    .info-label { color: #666; }
    .attendance { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .attendance-grid { display: grid; grid-template-columns: repeat(4, 1fr); text-align: center; }
    .attendance-value { font-size: 20px; font-weight: bold; }
    .tables { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #e0e0e0; padding: 8px; text-align: left; }
    td { padding: 8px; border-bottom: 1px solid #ddd; }
    .amount { text-align: right; }
    .total-row { font-weight: bold; border-top: 2px solid #333; }
    .net-pay { background: #e3f2fd; padding: 20px; text-align: center; margin-bottom: 20px; border-radius: 5px; }
    .net-pay-amount { font-size: 28px; font-weight: bold; color: #1976d2; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 40px; }
    .signature-box { text-align: center; }
    .signature-line { border-bottom: 1px solid #333; height: 40px; margin-bottom: 5px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${companyName}</h1>
    <p>${companyAddress}</p>
    <h2>PAYSLIP</h2>
  </div>

  <div class="info-grid">
    <div>
      <div class="info-item"><span class="info-label">Employee Name:</span><strong>${payslip.employeeName}</strong></div>
      <div class="info-item"><span class="info-label">Employee ID:</span><strong>${payslip.employeeNo}</strong></div>
      <div class="info-item"><span class="info-label">Department:</span><strong>${payslip.department}</strong></div>
      <div class="info-item"><span class="info-label">Position:</span><strong>${payslip.position}</strong></div>
    </div>
    <div>
      <div class="info-item"><span class="info-label">Reference No:</span><strong>${payslip.referenceNo}</strong></div>
      <div class="info-item"><span class="info-label">Pay Period:</span><strong>${formatDate(payrollRun.cutoffStart)} - ${formatDate(payrollRun.cutoffEnd)}</strong></div>
      <div class="info-item"><span class="info-label">Pay Date:</span><strong>${formatDate(payrollRun.payDate)}</strong></div>
      <div class="info-item"><span class="info-label">Daily Rate:</span><strong>${formatCurrency(payslip.dailyRate)}</strong></div>
    </div>
  </div>

  <div class="attendance">
    <p style="font-weight: bold; margin-bottom: 10px;">Attendance Summary (Workdays: Monday-Saturday)</p>
    <div class="attendance-grid">
      <div><div class="attendance-value">${payslip.eligibleWorkdays}</div><div>Eligible Days</div></div>
      <div><div class="attendance-value" style="color: green;">${payslip.presentDays}</div><div>Present</div></div>
      <div><div class="attendance-value" style="color: red;">${payslip.absentDays}</div><div>Absent</div></div>
      <div><div class="attendance-value" style="color: orange;">${payslip.totalLateMinutes}</div><div>Late (mins)</div></div>
    </div>
  </div>

  <div class="tables">
    <div>
      <table>
        <thead><tr><th colspan="2" style="background: #c8e6c9;">EARNINGS</th></tr></thead>
        <tbody>
          <tr><td>Basic Pay</td><td class="amount">${formatCurrency(payslip.basicPay)}</td></tr>
          ${parseFloat(payslip.overtimePay) > 0 ? `<tr><td>Overtime Pay</td><td class="amount">${formatCurrency(payslip.overtimePay)}</td></tr>` : ''}
          ${parseFloat(payslip.holidayPay) > 0 ? `<tr><td>Holiday Pay</td><td class="amount">${formatCurrency(payslip.holidayPay)}</td></tr>` : ''}
          <tr><td>KPI</td><td class="amount">${formatCurrency(payslip.kpi)}</td></tr>
          <tr class="total-row"><td>GROSS PAY</td><td class="amount" style="color: green;">${formatCurrency(payslip.grossPay)}</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <table>
        <thead><tr><th colspan="2" style="background: #ffcdd2;">DEDUCTIONS</th></tr></thead>
        <tbody>
          ${parseFloat(payslip.absenceDeduction) > 0 ? `<tr><td>Absences</td><td class="amount">${formatCurrency(payslip.absenceDeduction)}</td></tr>` : ''}
          ${parseFloat(payslip.lateDeduction) > 0 ? `<tr><td>Late/Undertime</td><td class="amount">${formatCurrency(payslip.lateDeduction)}</td></tr>` : ''}
          ${payslip.govDeductionsApplied ? `
            <tr><td>SSS</td><td class="amount">${formatCurrency(payslip.sssDeduction)}</td></tr>
            <tr><td>PhilHealth</td><td class="amount">${formatCurrency(payslip.philhealthDeduction)}</td></tr>
            <tr><td>Pag-IBIG</td><td class="amount">${formatCurrency(payslip.pagibigDeduction)}</td></tr>
          ` : ''}
          <tr class="total-row"><td>TOTAL DEDUCTIONS</td><td class="amount" style="color: red;">${formatCurrency(payslip.totalDeductions)}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="net-pay">
    <div>NET PAY</div>
    <div class="net-pay-amount">${formatCurrency(payslip.netPay)}</div>
    <div style="font-style: italic; margin-top: 5px;">${payslip.netPayInWords}</div>
  </div>

  <div class="signatures">
    <div class="signature-box"><div class="signature-line"></div><div>Prepared by</div></div>
    <div class="signature-box"><div class="signature-line"></div><div>Approved by</div></div>
    <div class="signature-box"><div class="signature-line"></div><div>Received by</div></div>
  </div>
</body>
</html>
  `;
}

function generateSummaryCsv(payrollRun: any): string {
  const headers = ['Employee ID', 'Name', 'Department', 'Gross Pay', 'Total Deductions', 'Net Pay'];
  const rows = payrollRun.payslips.map((p: any) => [
    p.employeeNo,
    p.employeeName,
    p.department,
    p.grossPay,
    p.totalDeductions,
    p.netPay,
  ]);

  const totals = {
    gross: payrollRun.payslips.reduce((sum: number, p: any) => sum + parseFloat(p.grossPay), 0),
    deductions: payrollRun.payslips.reduce((sum: number, p: any) => sum + parseFloat(p.totalDeductions), 0),
    net: payrollRun.payslips.reduce((sum: number, p: any) => sum + parseFloat(p.netPay), 0),
  };

  rows.push([]);
  rows.push(['TOTALS', '', '', totals.gross, totals.deductions, totals.net]);

  return [
    `Payroll: ${payrollRun.name}`,
    '',
    headers.join(','),
    ...rows.map((row: any[]) => row.join(',')),
  ].join('\n');
}
