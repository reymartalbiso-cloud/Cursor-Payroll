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
        const XLSX = await import('xlsx');

        // 3. Force dynamic context
        await cookies();

        const session = await getSession();
        if (!session || !canManagePayroll(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        // Fetch the outsource payroll request with its project and entries
        const payrollRequest = await prisma.outsourcePayrollRequest.findUnique({
            where: { id },
            include: {
                project: true,
                entries: {
                    orderBy: { operatorName: 'asc' },
                },
            },
        });

        if (!payrollRequest) {
            return NextResponse.json(
                { error: 'Payroll request not found' },
                { status: 404 }
            );
        }

        // Build rows for the Excel sheet
        const rows = payrollRequest.entries.map((entry) => ({
            'Operator Name': entry.operatorName,
            'Output': parseFloat(String(entry.output)),
            'Rate (PHP)': parseFloat(String(payrollRequest.project.rate)),
            'Payment Basis': payrollRequest.project.paymentBasis,
            'Calculated Pay (PHP)': parseFloat(String(entry.calculatedPay)),
            'Remarks': entry.remarks || '',
        }));

        // Create workbook & worksheet
        const worksheet = XLSX.utils.json_to_sheet(rows);

        // Auto-fit column widths
        const headers = [
            'Operator Name', 'Output', 'Rate (PHP)', 'Payment Basis',
            'Calculated Pay (PHP)', 'Remarks',
        ];
        worksheet['!cols'] = headers.map((header) => {
            const maxDataLen = rows.reduce((max, row) => {
                const val = String(row[header as keyof typeof row] ?? '');
                return Math.max(max, val.length);
            }, header.length);
            return { wch: maxDataLen + 2 };
        });

        // Add a total row
        const totalRow = rows.length + 2; // +1 for header, +1 for the next row
        XLSX.utils.sheet_add_aoa(worksheet, [
            ['TOTAL', '', '', '', parseFloat(String(payrollRequest.totalAmount)), ''],
        ], { origin: `A${totalRow}` });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Outsource Payroll');

        // Write to buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        const fileName = `Outsource-${payrollRequest.project.name}-${payrollRequest.requestName}.xlsx`
            .replace(/[^a-zA-Z0-9-_ .]/g, '');

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
        });
    } catch (error) {
        console.error('Outsource payroll Excel export error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
