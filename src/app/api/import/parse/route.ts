export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManagePayroll } from '@/lib/auth';
import { parseExcelFile, autoDetectMapping } from '@/lib/excel-parser';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an Excel file (.xlsx or .xls)' },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const sheets = parseExcelFile(buffer);

    if (sheets.length === 0) {
      return NextResponse.json(
        { error: 'No sheets found in the Excel file' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      fileName: file.name,
      sheets: sheets.map(s => ({
        name: s.name,
        headers: s.headers,
        rowCount: s.rowCount,
        preview: s.data.slice(0, 5),
        autoMapping: autoDetectMapping(s.headers), // Auto-detect column mapping
      })),
    });
  } catch (error) {
    console.error('Parse Excel error:', error);
    return NextResponse.json({ error: 'Failed to parse Excel file' }, { status: 500 });
  }
}

