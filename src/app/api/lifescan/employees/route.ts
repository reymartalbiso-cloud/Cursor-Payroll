import { NextResponse } from 'next/server';
import { getSession, canManagePayroll } from '@/lib/auth';
import { fetchLifeScanProfiles } from '@/lib/lifescan';
import { accountingService } from '@/services/accountingService';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getSession();
        if (!session || !canManagePayroll(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!accountingService.isConfigured()) {
            return NextResponse.json({
                profiles: [],
                configured: false,
                message: 'LifeScan API not configured. Set LIFESCAN_API_URL and LIFESCAN_API_KEY in .env',
            });
        }

        const profiles = await fetchLifeScanProfiles();
        return NextResponse.json({
            profiles,
            configured: true,
            count: profiles.length,
        });
    } catch (error) {
        console.error('LifeScan employees API error:', error);
        const message = error instanceof Error ? error.message : 'Failed to fetch LifeScan employees';
        return NextResponse.json(
            { error: message, profiles: [], configured: true },
            { status: 500 }
        );
    }
}
