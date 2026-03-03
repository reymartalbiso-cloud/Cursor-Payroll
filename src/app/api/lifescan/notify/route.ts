import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManagePayroll } from '@/lib/auth';
import { accountingService } from '@/services/accountingService';

/**
 * POST /api/lifescan/notify
 *
 * Option A - Direct targets (user_id from LifeScan/Supabase):
 * { "targets": [{ "user_id": "uuid", "title": "...", "message": "...", "metadata": {} }] }
 *
 * Option B - By employee IDs (we look up LifeScan user_id from employee_id):
 * { "by_employee_ids": true, "notifications": [{ "employee_id": "EMP-001", "title": "...", "message": "..." }] }
 */
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
    const { targets, by_employee_ids, notifications, type } = body;

    let resolvedTargets: Array<{ user_id: string; title: string; message: string; metadata?: Record<string, unknown> }>;

    if (by_employee_ids && Array.isArray(notifications)) {
      // Look up user_id from LifeScan by employee_id (employeeNo)
      const employeeIds = notifications.map((n: { employee_id: string }) => n.employee_id);
      const users = await accountingService.fetchUsersWithDTR({});
      const employeeIdToUserId = new Map<string, string>();
      users.forEach((u) => {
        if (u.employee_id) {
          employeeIdToUserId.set(u.employee_id.toLowerCase().trim(), u.id);
        }
      });

      resolvedTargets = [];
      for (const n of notifications) {
        const user_id = employeeIdToUserId.get(String(n.employee_id || '').toLowerCase().trim());
        if (!user_id) {
          console.warn(`No LifeScan user found for employee_id: ${n.employee_id}`);
          continue;
        }
        resolvedTargets.push({
          user_id,
          title: n.title || 'Notification',
          message: n.message || '',
          metadata: n.metadata,
        });
      }
    } else if (Array.isArray(targets) && targets.length > 0) {
      resolvedTargets = targets.map((t: { user_id: string; title: string; message: string; metadata?: Record<string, unknown> }) => ({
        user_id: t.user_id,
        title: t.title || 'Notification',
        message: t.message || '',
        metadata: t.metadata,
      }));
    } else {
      return NextResponse.json(
        { error: 'Provide "targets" array or "by_employee_ids" with "notifications" array' },
        { status: 400 }
      );
    }

    if (resolvedTargets.length === 0) {
      return NextResponse.json(
        { error: 'No valid targets to notify' },
        { status: 400 }
      );
    }

    await accountingService.sendDirectNotifications(resolvedTargets, type || 'system');

    return NextResponse.json({
      success: true,
      message: `Sent ${resolvedTargets.length} notification(s)`,
    });
  } catch (error) {
    console.error('LifeScan notify error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send notifications' },
      { status: 500 }
    );
  }
}
