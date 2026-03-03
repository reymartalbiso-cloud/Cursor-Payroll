import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManagePayroll } from '@/lib/auth';
import { accountingService } from '@/services/accountingService';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!accountingService.isConfigured()) {
      return NextResponse.json(
        { error: 'LifeScan API is not configured (LIFESCAN_API_URL, LIFESCAN_API_KEY)' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { title, message } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: 'title and message are required' },
        { status: 400 }
      );
    }

    await accountingService.sendBroadcast(title, message);

    return NextResponse.json({ success: true, message: 'Broadcast sent' });
  } catch (error) {
    console.error('LifeScan broadcast error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send broadcast' },
      { status: 500 }
    );
  }
}
