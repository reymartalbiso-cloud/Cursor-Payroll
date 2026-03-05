export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const generatePayrollRunsSchema = z.object({
    year: z.number().min(2020).max(2100),
});

export async function POST(request: NextRequest) {
    // 1. Immediate build-time rescue
    if (process.env.NEXT_PHASE === 'phase-production-build') {
        return NextResponse.json({ message: 'Skipping build-time scan' });
    }

    try {
        // 2. Dynamic imports for isolation
        const { prisma } = await import('@/lib/prisma');
        const { getSession, canManagePayroll } = await import('@/lib/auth');
        const { cookies } = await import('next/headers');
        const { getEligibleWorkdays, getCutoffPeriod } = await import('@/lib/payroll-calculator');

        // 3. Force dynamic context
        await cookies();

        const session = await getSession();
        if (!session || !canManagePayroll(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const validatedData = generatePayrollRunsSchema.parse(body);
        const { year } = validatedData;

        // Get settings once
        const settings = await prisma.setting.findMany();
        const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

        const payrollSettings = {
            govDeductionMode: (settingsMap.gov_deduction_mode || 'fixed_per_cutoff') as 'fixed_per_cutoff' | 'prorated_by_days',
            standardDailyHours: parseInt(settingsMap.standard_daily_hours || '8'),
        };

        const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        let createdCount = 0;
        const errors: string[] = [];

        // Loop through all 12 months
        for (let month = 1; month <= 12; month++) {
            // Create both cutoffs for each month
            for (const cutoffType of ['FIRST_HALF', 'SECOND_HALF']) {
                try {
                    // Check if already exists
                    const existing = await prisma.payrollRun.findUnique({
                        where: {
                            year_month_cutoffType: { year, month, cutoffType: cutoffType as any },
                        },
                    });

                    if (existing) {
                        continue; // Skip if exists
                    }

                    // Calculate dates
                    const { start, end } = getCutoffPeriod(year, month, cutoffType as any);
                    const eligibleWorkdays = getEligibleWorkdays(year, month, cutoffType as any);

                    const payDate = end;

                    const cutoffLabel = cutoffType === 'FIRST_HALF' ? '1-15' : `16-${end.getDate()}`;
                    const name = `${monthNames[month]} ${year} (${cutoffLabel})`;

                    await prisma.payrollRun.create({
                        data: {
                            name,
                            cutoffType: cutoffType as any,
                            cutoffStart: start,
                            cutoffEnd: end,
                            payDate,
                            year,
                            month,
                            eligibleWorkdays,
                            status: 'DRAFT',
                            govDeductionMode: payrollSettings.govDeductionMode,
                            standardDailyHours: payrollSettings.standardDailyHours,
                        },
                    });

                    createdCount++;
                } catch (err) {
                    console.error(`Failed to create run for ${year}-${month}-${cutoffType}:`, err);
                    errors.push(`${monthNames[month]} ${cutoffType}: ${err instanceof Error ? err.message : 'Unknown error'}`);
                }
            }
        }

        return NextResponse.json({
            success: true,
            createdCount,
            message: `Successfully created ${createdCount} payroll runs for ${year}`,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('Generate payroll runs error:', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

