
import { NextResponse } from 'next/server';
import { fetchLifeScanData, LifeScanProfile } from '@/lib/lifescan';

export const dynamic = 'force-dynamic'; // Ensure this is not cached statically

export async function GET() {
    try {
        const data = await fetchLifeScanData();

        // Extract unique profiles
        const uniqueProfilesMap = new Map<string, LifeScanProfile>();

        data.forEach(record => {
            if (record.profiles && record.profiles.employee_id) {
                // Use employee_id as key to ensure uniqueness
                if (!uniqueProfilesMap.has(record.profiles.employee_id)) {
                    uniqueProfilesMap.set(record.profiles.employee_id, record.profiles);
                }
            }
        });

        const profiles = Array.from(uniqueProfilesMap.values());

        // Sort by name for easier selection
        profiles.sort((a, b) => {
            const nameA = `${a.last_name}, ${a.first_name}`;
            const nameB = `${b.last_name}, ${b.first_name}`;
            return nameA.localeCompare(nameB);
        });

        return NextResponse.json({ profiles });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch LifeScan employees' },
            { status: 500 }
        );
    }
}
