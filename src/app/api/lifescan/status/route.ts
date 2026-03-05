import { NextResponse } from 'next/server';
import { getSession, canManagePayroll } from '@/lib/auth';
import { accountingService } from '@/services/accountingService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/lifescan/status
 * Returns LifeScan connection status and optionally tests the API.
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const configured = accountingService.isConfigured();

    if (!configured) {
      return NextResponse.json({
        configured: false,
        connected: false,
        message: 'LIFESCAN_API_URL and LIFESCAN_API_KEY are not set in .env',
      });
    }

    const { searchParams } = new URL(request.url);
    const test = searchParams.get('test') === 'true';

    if (!test) {
      return NextResponse.json({
        configured: true,
        connected: null,
        message: 'Configured. Use ?test=true to verify connection.',
      });
    }

    const records = await accountingService.fetchDTRRecords({
      action: 'get_dtr_records',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date().toISOString().slice(0, 10),
    });

    return NextResponse.json({
      configured: true,
      connected: true,
      message: `Connection successful. Fetched ${records.length} DTR record(s) for today.`,
      recordCount: records.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    return NextResponse.json({
      configured: true,
      connected: false,
      message,
    });
  }
}
