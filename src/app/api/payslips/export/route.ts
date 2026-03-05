export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, canViewAllPayslips } from '@/lib/auth';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !canViewAllPayslips(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = request.nextUrl;
        const payrollRunId = searchParams.get('payrollRunId');

        if (!payrollRunId) {
            return NextResponse.json(
                { error: 'Payroll run ID is required' },
                { status: 400 }
            );
        }

        // Fetch the payroll run for month/year/cycle info
        const payrollRun = await prisma.payrollRun.findUnique({
            where: { id: payrollRunId },
        });

        if (!payrollRun) {
            return NextResponse.json(
                { error: 'Payroll run not found' },
                { status: 404 }
            );
        }

        // Fetch all employee payslips for this cut-off (excludes outsource)
        const payslips = await prisma.payslip.findMany({
            where: { payrollRunId },
            orderBy: { employeeNo: 'asc' },
        });

        // Map month number to name
        const monthNames = [
            '', 'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December',
        ];

        const monthName = monthNames[payrollRun.month] || String(payrollRun.month);
        const cycle = payrollRun.cutoffType === 'FIRST_HALF' ? '1st Half' : '2nd Half';

        // Build rows for the Excel sheet
        const rows = payslips.map((p) => ({
            'Employee ID': p.employeeNo,
            'NAME': p.employeeName,
            'MONTH': monthName,
            'YEAR': payrollRun.year,
            'CYCLE': cycle,
            'DAYS WORKED': p.presentDays,
            'TOTAL WORKING DAYS': p.eligibleWorkdays,
            'NET PAY': parseFloat(String(p.netPay)),
        }));

        // Create workbook & worksheet
        const worksheet = XLSX.utils.json_to_sheet(rows);

        // Auto-fit column widths based on header + data
        const headers = [
            'Employee ID', 'NAME', 'MONTH', 'YEAR', 'CYCLE',
            'DAYS WORKED', 'TOTAL WORKING DAYS', 'NET PAY',
        ];
        worksheet['!cols'] = headers.map((header) => {
            const maxDataLen = rows.reduce((max, row) => {
                const val = String(row[header as keyof typeof row] ?? '');
                return Math.max(max, val.length);
            }, header.length);
            return { wch: maxDataLen + 2 };
        });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Payslips');

        // Write to buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        const fileName = `Payslips-${payrollRun.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}.xlsx`;

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
        });
    } catch (error) {
        console.error('Payslip Excel export error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

