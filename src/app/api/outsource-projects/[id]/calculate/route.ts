export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';

// Parse outsource Excel: employee name + output columns
interface ParsedRow {
  operatorName: string;
  output: number;
  calculatedPay: number;
}

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
    const XLSX = await import('xlsx');

    // 3. Force dynamic context
    await cookies();

    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const requestName = formData.get('requestName') as string;
    const employeeCol = (formData.get('employeeCol') as string) || 'Employee Name';
    const outputCol = (formData.get('outputCol') as string) || 'Output';

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload Excel (.xlsx or .xls)' },
        { status: 400 }
      );
    }

    const project = await prisma.outsourceProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', raw: false });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    // Use default to get objects keyed by first row headers
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      raw: false,
      defval: '',
    });

    if (jsonData.length === 0) {
      return NextResponse.json(
        { error: 'Excel file must have a header row and at least one data row' },
        { status: 400 }
      );
    }

    const headers = Object.keys(jsonData[0] || {});
    const employeeHeader = headers.find(
      (h) =>
        h.toLowerCase().includes('employee') ||
        h.toLowerCase().includes('name') ||
        h.toLowerCase().includes('operator')
    ) || headers[0] || employeeCol;
    const outputHeader = headers.find(
      (h) =>
        h.toLowerCase().includes('output') ||
        h.toLowerCase().includes('hours') ||
        h.toLowerCase().includes('effective') ||
        h.toLowerCase().includes('units') ||
        h.toLowerCase().includes('quantity')
    ) || headers[1] || outputCol;

    const rate = Number(project.rate);
    const rows: ParsedRow[] = [];

    for (const row of jsonData) {
      const operatorName = String(row[employeeHeader] ?? row[headers[0]] ?? '').trim();
      const outputVal = row[outputHeader] ?? row[headers[1]];
      const output = parseFloat(String(outputVal || '0').replace(/,/g, '')) || 0;

      if (!operatorName) continue;

      const calculatedPay = Math.round(output * rate * 100) / 100;
      rows.push({ operatorName, output, calculatedPay });
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows found. Ensure columns have Employee Name and Output values.' },
        { status: 400 }
      );
    }

    const totalAmount = rows.reduce((sum, r) => sum + r.calculatedPay, 0);

    return NextResponse.json({
      project,
      requestName: requestName || `Import ${new Date().toLocaleDateString()}`,
      entries: rows,
      totalAmount: Math.round(totalAmount * 100) / 100,
      mappedColumns: { employeeHeader, outputHeader },
    });
  } catch (error) {
    console.error('Outsource calculate error:', error);
    return NextResponse.json(
      { error: 'Failed to parse and calculate' },
      { status: 500 }
    );
  }
}
