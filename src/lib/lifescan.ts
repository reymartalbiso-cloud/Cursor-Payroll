/**
 * LifeScan Accounting API Integration
 * Uses the Accounting Edge Function: https://[project-id].supabase.co/functions/v1/accounting
 */

import {
  accountingService,
  type DTRRecordWithProfile,
  type LifeScanProfile as AccountingLifeScanProfile,
} from '../services/accountingService';

export type { LifeScanProfile } from '../services/accountingService';

export interface LifeScanAttendanceRecord {
  id: string;
  user_id: string;
  timeinmorning: string;
  timeoutafternoon: string;
  status: 'present' | 'absent' | 'late';
  created_at: string;
  profiles: LifeScanProfile;
}

/** Re-export for compatibility */
export type LifeScanProfile = AccountingLifeScanProfile;

/**
 * Normalize DTR record from Accounting API to LifeScanAttendanceRecord format.
 * Handles both snake_case (timein_morning) and camelCase (timeinmorning) from Supabase.
 */
function normalizeDTRRecord(record: DTRRecordWithProfile): LifeScanAttendanceRecord {
  const timeIn = record.timeinmorning ?? record.timein_morning ?? '';
  const timeOut = record.timeoutafternoon ?? record.timeout_afternoon ?? '';

  return {
    id: record.id,
    user_id: record.user_id,
    timeinmorning: typeof timeIn === 'string' ? timeIn : (timeIn ? new Date(timeIn).toISOString() : ''),
    timeoutafternoon: typeof timeOut === 'string' ? timeOut : (timeOut ? new Date(timeOut).toISOString() : ''),
    status: (record.status as 'present' | 'absent' | 'late') || 'present',
    created_at: record.created_at,
    profiles: record.profiles,
  };
}

/**
 * Fetch DTR records from LifeScan Accounting API.
 * Supports date range filtering for payroll cutoff periods.
 *
 * @param options - Optional start_date and end_date (YYYY-MM-DD) for filtering
 * @returns Array of attendance records with profile data
 */
export async function fetchLifeScanData(options?: {
  start_date?: string;
  end_date?: string;
  user_id?: string;
}): Promise<LifeScanAttendanceRecord[]> {
  if (!accountingService.isConfigured()) {
    console.warn('LifeScan API credentials are missing (LIFESCAN_API_URL, LIFESCAN_API_KEY).');
    return [];
  }

  try {
    const records = await accountingService.fetchDTRRecords({
      action: 'get_dtr_records',
      start_date: options?.start_date,
      end_date: options?.end_date,
      user_id: options?.user_id,
    });

    return records.map(normalizeDTRRecord);
  } catch (error) {
    console.error('Failed to fetch LifeScan attendance data:', error);
    throw error;
  }
}

/**
 * Fetch unique employee profiles from LifeScan.
 * Tries get_users_with_dtr first, then falls back to get_dtr_records if empty.
 *
 * @param options - Optional date range to filter users who have DTR in that period
 */
export async function fetchLifeScanProfiles(options?: {
  start_date?: string;
  end_date?: string;
}): Promise<LifeScanProfile[]> {
  if (!accountingService.isConfigured()) {
    console.warn('LifeScan API credentials are missing.');
    return [];
  }

  try {
    let profiles: LifeScanProfile[] = [];

    const users = await accountingService.fetchUsersWithDTR({
      start_date: options?.start_date,
      end_date: options?.end_date,
    });

    profiles = users
      .filter((u) => u.employee_id)
      .map((u) => ({
        id: u.id,
        first_name: u.first_name,
        last_name: u.last_name,
        middle_name: u.middle_name ?? null,
        email: u.email,
        department: u.department ?? '',
        position: u.position ?? '',
        employee_id: u.employee_id,
      }));

    // Fallback: if get_users_with_dtr returns empty, try get_dtr_records and extract profiles
    if (profiles.length === 0) {
      const records = await accountingService.fetchDTRRecords({
        action: 'get_dtr_records',
        start_date: options?.start_date,
        end_date: options?.end_date,
      });

      const seen = new Set<string>();
      for (const r of records) {
        if (r.profiles?.employee_id && !seen.has(r.profiles.employee_id)) {
          seen.add(r.profiles.employee_id);
          profiles.push({
            id: r.profiles.id ?? r.user_id,
            first_name: r.profiles.first_name,
            last_name: r.profiles.last_name,
            middle_name: r.profiles.middle_name ?? null,
            email: r.profiles.email,
            department: r.profiles.department ?? '',
            position: r.profiles.position ?? '',
            employee_id: r.profiles.employee_id,
          });
        }
      }
    }

    profiles.sort((a, b) => {
      const nameA = `${a.last_name}, ${a.first_name}`;
      const nameB = `${b.last_name}, ${b.first_name}`;
      return nameA.localeCompare(nameB);
    });

    return profiles;
  } catch (error) {
    console.error('Failed to fetch LifeScan profiles:', error);
    throw error;
  }
}
