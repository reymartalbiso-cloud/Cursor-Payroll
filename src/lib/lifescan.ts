/**
 * LifeScan Accounting API Integration
 */

export interface LifeScanProfile {
    first_name: string;
    middle_name?: string | null;
    last_name: string;
    email: string;
    department: string;
    position: string;
    employee_id: string; // This maps to employeeNo in our system
}

export interface LifeScanAttendanceRecord {
    id: string;
    user_id: string;
    timeinmorning: string; // ISO 8601 string
    timeoutafternoon: string; // ISO 8601 string
    status: 'present' | 'absent' | 'late'; // Adjust based on actual API response if needed
    created_at: string;
    profiles: LifeScanProfile;
}

export async function fetchLifeScanData(): Promise<LifeScanAttendanceRecord[]> {
    const LIFESCAN_API_URL = process.env.LIFESCAN_API_URL;
    const LIFESCAN_API_KEY = process.env.LIFESCAN_API_KEY;

    if (!LIFESCAN_API_URL || !LIFESCAN_API_KEY) {
        console.warn('LifeScan API credentials are missing.');
        return [];
    }

    try {
        const response = await fetch(LIFESCAN_API_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${LIFESCAN_API_KEY}`,
                'Content-Type': 'application/json',
            },
            cache: 'no-store', // Ensure fresh data
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`LifeScan API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        return data as LifeScanAttendanceRecord[];
    } catch (error) {
        console.error('Failed to fetch LifeScan attendance data:', error);
        // Re-throw or return empty array depending on desired strictness. 
        // Returning empty array prevents checking failure from crashing the whole app, 
        // but might mask issues. Let's throw to make it visible in logs/UI.
        throw error;
    }
}
