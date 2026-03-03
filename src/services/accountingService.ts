/**
 * Accounting Edge Function API Service
 * Providers endpoints for fetching DTR records and sending notifications.
 */

const getBaseUrl = () => {
    const url = process.env.LIFESCAN_API_URL || process.env.NEXT_PUBLIC_LIFESCAN_API_URL;
    if (!url) {
        throw new Error('LIFESCAN_API_URL is not configured');
    }
    return url.replace(/\/$/, '');
};

const getApiKey = () => {
    const key = process.env.LIFESCAN_API_KEY || process.env.NEXT_PUBLIC_LIFESCAN_API_KEY;
    if (!key) {
        throw new Error('LIFESCAN_API_KEY is not configured');
    }
    return key;
};

const getHeaders = () => ({
    Authorization: `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
});

// -------- Types --------

export interface LifeScanProfile {
    id: string;
    first_name: string;
    last_name: string;
    middle_name?: string | null;
    email: string;
    department?: string;
    position?: string;
    employee_id: string;
}

export interface DTRRecordWithProfile {
    id: string;
    user_id: string;
    created_at: string;
    profiles: LifeScanProfile;
    timeinmorning?: string;
    timeoutafternoon?: string;
    timein_morning?: string;
    timeout_afternoon?: string;
    status?: string;
}

export interface UserWithDTR extends LifeScanProfile {
    dtr?: Array<{
        id: string;
        user_id: string;
        created_at: string;
        timeinmorning?: string;
        timeoutafternoon?: string;
        timein_morning?: string;
        timeout_afternoon?: string;
        status?: string;
    }>;
}

export interface FetchDTRParams {
    action?: 'get_dtr_records' | 'get_users_with_dtr';
    user_id?: string;
    start_date?: string; // YYYY-MM-DD
    end_date?: string; // YYYY-MM-DD
}

export interface DirectTarget {
    user_id: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
}

// -------- Service --------

export const accountingService = {
    /**
     * Fetch DTR records (optionally filtered by user or date)
     */
    async fetchDTRRecords(params?: FetchDTRParams): Promise<DTRRecordWithProfile[]> {
        const baseUrl = getBaseUrl();
        const searchParams = new URLSearchParams();
        searchParams.set('action', params?.action || 'get_dtr_records');
        if (params?.user_id) searchParams.set('user_id', params.user_id);
        if (params?.start_date) searchParams.set('start_date', params.start_date);
        if (params?.end_date) searchParams.set('end_date', params.end_date);

        const response = await fetch(`${baseUrl}?${searchParams.toString()}`, {
            method: 'GET',
            headers: getHeaders(),
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Accounting API Error: ${response.status} - ${errorText}`);
        }

        return response.json();
    },

    /**
     * Fetch users with their DTR records
     */
    async fetchUsersWithDTR(params?: { start_date?: string; end_date?: string }): Promise<UserWithDTR[]> {
        const baseUrl = getBaseUrl();
        const searchParams = new URLSearchParams();
        searchParams.set('action', 'get_users_with_dtr');
        if (params?.start_date) searchParams.set('start_date', params.start_date);
        if (params?.end_date) searchParams.set('end_date', params.end_date);

        const response = await fetch(`${baseUrl}?${searchParams.toString()}`, {
            method: 'GET',
            headers: getHeaders(),
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Accounting API Error: ${response.status} - ${errorText}`);
        }

        return response.json();
    },

    /**
     * Send a broadcast announcement to all users
     */
    async sendBroadcast(title: string, message: string): Promise<{ success: boolean; notificationCount: number }> {
        const baseUrl = getBaseUrl();
        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ action: 'broadcast', title, message }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Accounting API Error: ${response.status} - ${errorText}`);
        }

        return response.json();
    },

    /**
     * Send a targeted payslip notification to a specific user
     */
    async sendPayslipNotification(
        userId: string,
        title: string,
        message: string
    ): Promise<{ success: boolean; pushSent: boolean }> {
        const baseUrl = getBaseUrl();
        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ action: 'payslip_notification', user_id: userId, title, message }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Accounting API Error: ${response.status} - ${errorText}`);
        }

        return response.json();
    },

    /**
     * Send direct notifications to specific users
     */
    async sendDirectNotifications(
        targets: DirectTarget[],
        type: 'reminder' | 'system' | 'success' = 'system'
    ): Promise<{ success: boolean; successCount: number }> {
        const baseUrl = getBaseUrl();
        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ action: 'direct', targets, type }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Accounting API Error: ${response.status} - ${errorText}`);
        }

        return response.json();
    },

    /**
     * Check if service is configured
     */
    isConfigured(): boolean {
        return !!(process.env.LIFESCAN_API_URL || process.env.NEXT_PUBLIC_LIFESCAN_API_URL) &&
            !!(process.env.LIFESCAN_API_KEY || process.env.NEXT_PUBLIC_LIFESCAN_API_KEY);
    }
};
