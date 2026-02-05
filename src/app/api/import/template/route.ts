import { NextResponse } from 'next/server';
import { getSession, canManagePayroll } from '@/lib/auth';
import { generateSampleTemplate } from '@/lib/excel-parser';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const buffer = generateSampleTemplate();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="timesheet-template.xlsx"',
      },
    });
  } catch (error) {
    console.error('Template generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
