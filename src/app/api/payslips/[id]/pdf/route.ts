import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, canViewAllPayslips } from '@/lib/auth';
import { formatCurrency, formatDate } from '@/lib/utils';

// Simple PDF generation using HTML to PDF approach
// For production, consider using @react-pdf/renderer or puppeteer

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
      },
    });

    if (!payslip) {
      return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    }

    // Check access
    if (!canViewAllPayslips(session.role)) {
      if (payslip.employeeId !== session.employeeId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    // Get settings
    const settings = await prisma.setting.findMany();
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

    // Generate HTML for PDF
    const html = generatePayslipHtml(payslip, settingsMap);

    // Return HTML as PDF (browser will render/print)
    // For proper PDF, integrate with puppeteer or similar
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="payslip-${payslip.referenceNo}.html"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generatePayslipHtml(payslip: any, settings: Record<string, string>): string {
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
    @media print { body { padding: 0; } }
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
      <div class="info-item"><span class="info-label">Pay Period:</span><strong>${formatDate(payslip.payrollRun.cutoffStart)} - ${formatDate(payslip.payrollRun.cutoffEnd)}</strong></div>
      <div class="info-item"><span class="info-label">Pay Date:</span><strong>${formatDate(payslip.payrollRun.payDate)}</strong></div>
      <div class="info-item"><span class="info-label">Daily Rate:</span><strong>${formatCurrency(payslip.dailyRate)}</strong></div>
    </div>
  </div>

  <div class="attendance">
    <p style="font-weight: bold; margin-bottom: 10px;">Attendance Summary (Workdays: Monday-Saturday, Sundays excluded)</p>
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
          ${parseFloat(payslip.cola) > 0 ? `<tr><td>COLA</td><td class="amount">${formatCurrency(payslip.cola)}</td></tr>` : ''}
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
          ${parseFloat(payslip.sssLoanDeduction) > 0 ? `<tr><td>SSS Loan</td><td class="amount">${formatCurrency(payslip.sssLoanDeduction)}</td></tr>` : ''}
          ${parseFloat(payslip.pagibigLoanDeduction) > 0 ? `<tr><td>Pag-IBIG Loan</td><td class="amount">${formatCurrency(payslip.pagibigLoanDeduction)}</td></tr>` : ''}
          ${parseFloat(payslip.cashAdvanceDeduction) > 0 ? `<tr><td>Cash Advance</td><td class="amount">${formatCurrency(payslip.cashAdvanceDeduction)}</td></tr>` : ''}
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

  ${!payslip.govDeductionsApplied ? '<p style="text-align: center; font-size: 10px; color: #666;">* Government deductions (SSS, PhilHealth, Pag-IBIG) are applied only for the 16th-end of month cutoff.</p>' : ''}

  <div class="signatures">
    <div class="signature-box"><div class="signature-line"></div><div>Prepared by</div></div>
    <div class="signature-box"><div class="signature-line"></div><div>Approved by</div></div>
    <div class="signature-box"><div class="signature-line"></div><div>Received by</div></div>
  </div>
</body>
</html>
  `;
}
