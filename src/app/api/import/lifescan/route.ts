import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, canManagePayroll } from '@/lib/auth';
import {
    calculatePayslip,
    calculateAttendanceSummary,
    getEligibleWorkdays,
    isSunday,
    AttendanceSummary,
    HolidayData,
} from '@/lib/payroll-calculator';
import { generateReferenceNo } from '@/lib/utils';
import { CutoffType } from '@prisma/client';
import { fetchLifeScanData, LifeScanAttendanceRecord } from '@/lib/lifescan';
import { parseDecimal } from '@/lib/utils';

// Helper types
interface ValidationResult {
    validRows: number;
    invalidRows: Array<{ rowIndex: number; errors: string[] }>;
    missingEmployees: string[];
    unrecognizedEmployees: Array<{ identifier: string }>;
    dateRangeValid: boolean;
    dateRangeError?: string;
    preview: any[];
}

// Logic to process LifeScan record into TimesheetEntry-like structure
function processLifeScanRecord(record: LifeScanAttendanceRecord, employee: any): any {
    const dateStr = record.created_at.split('T')[0]; // YYYY-MM-DD
    const date = new Date(dateStr);

    if (isSunday(date)) return null;

    let timeInStr = record.timeinmorning ? new Date(record.timeinmorning).toLocaleTimeString('en-US', { hour12: false }) : null;
    let timeOutStr = record.timeoutafternoon ? new Date(record.timeoutafternoon).toLocaleTimeString('en-US', { hour12: false }) : null;

    // If timeInStr is null but we have status present, maybe use created_at? 
    // API doc says "created_at": "2023-10-27T08:00:00+08:00" which matches timeinmorning in example.
    if (!timeInStr && record.created_at) {
        timeInStr = new Date(record.created_at).toLocaleTimeString('en-US', { hour12: false });
    }

    let minutesLate = 0;
    let undertimeMinutes = 0;
    let overtimeHours = 0;
    let hoursWorked = 0;

    if (timeInStr && timeOutStr) {
        const timeInDate = new Date(`2000-01-01T${timeInStr}`);
        const timeOutDate = new Date(`2000-01-01T${timeOutStr}`);

        // Shift Logic from Import Page
        // 8:10 cutoff for 8-5 shift
        const splitTime = new Date('2000-01-01T08:10:00');

        let shiftStart: Date;
        let shiftEnd: Date;
        let breakHours = 1;

        if (timeInDate <= splitTime) {
            // 8-5 Shift
            shiftStart = new Date('2000-01-01T08:00:00');
            shiftEnd = new Date('2000-01-01T17:00:00'); // 5 PM
        } else {
            // 9-6 Shift
            shiftStart = new Date('2000-01-01T09:00:00');
            shiftEnd = new Date('2000-01-01T18:00:00'); // 6 PM
        }

        // Late
        if (timeInDate > shiftStart) {
            minutesLate = Math.round((timeInDate.getTime() - shiftStart.getTime()) / 60000);
            // Grace period?? Import page says "8:01-8:10 AM = late". So no grace period for late calculation if strictly > 8:00?
            // Actually page says: "8-5 Shift Rules (Clock in ≤ 8:10 AM): Late: 8:01-8:10 AM = late" -> Wait, if clock in <= 8:10, they are in 8-5 shift. 
            // If they clock in at 8:05, they are Late (5 mins).
            // If they clock in at 8:15, they are in 9-6 Shift. 9:00 start. So they are EARLY for 9:00?
            // Page says: "9-6 Shift Rules (Clock in after 8:10 AM): Time In: Recorded as 9:00 AM... Late: >= 9:06 AM late".

            if (timeInDate > splitTime) {
                // 9-6 Shift Logic
                // If logged in at 8:15, it's considered 9:00. Not late.
                // If logged in at 9:10, it's late (10 mins).
                const shiftStart9 = new Date('2000-01-01T09:00:00');
                const grace9 = new Date('2000-01-01T09:05:00');
                if (timeInDate > grace9) {
                    minutesLate = Math.round((timeInDate.getTime() - shiftStart9.getTime()) / 60000);
                } else {
                    minutesLate = 0;
                }
            }
        }

        // Undertime
        if (timeOutDate < shiftEnd) {
            undertimeMinutes = Math.round((shiftEnd.getTime() - timeOutDate.getTime()) / 60000);
        }

        // Overtime (1 hour beyond shift end)
        const otThreshold = new Date(shiftEnd.getTime() + 60 * 60 * 1000); // Shift End + 1 hr
        if (timeOutDate >= otThreshold) {
            overtimeHours = (timeOutDate.getTime() - shiftEnd.getTime()) / (1000 * 60 * 60);
            // Floor to nearest decimal or just keep raw?
            // Usually OT is claimed, but here we auto-calculate.
        }

        // Hours Worked
        const diffMs = timeOutDate.getTime() - timeInDate.getTime();
        hoursWorked = (diffMs / (1000 * 60 * 60)) - breakHours;
        if (hoursWorked < 0) hoursWorked = 0;
    }

    return {
        employeeId: record.profiles?.employee_id || null, // We need to handle mapping if LifeScan ID != System ID
        employeeName: record.profiles ? `${record.profiles.last_name}, ${record.profiles.first_name}` : 'Unknown',
        date: date,
        timeIn: timeInStr,
        timeOut: timeOutStr,
        hoursWorked,
        minutesLate,
        undertimeMinutes,
        isAbsent: record.status === 'absent',
        overtimeHours,
        // defaults
        isOnLeave: false,
        leaveType: null,
        holidayPay: 0,
        remarks: 'Imported from LifeScan API',
        rawData: record
    };
}

// Reuse helper
async function getOtherCutoffAttendance(
    employeeId: string,
    year: number,
    month: number,
    currentCutoffType: CutoffType
): Promise<AttendanceSummary | undefined> {
    const otherCutoffType = currentCutoffType === CutoffType.FIRST_HALF
        ? CutoffType.SECOND_HALF
        : CutoffType.FIRST_HALF;

    const otherPayrollRun = await prisma.payrollRun.findFirst({
        where: {
            year,
            month,
            cutoffType: otherCutoffType,
        },
    });

    if (!otherPayrollRun) return undefined;

    const otherEntries = await prisma.timesheetEntry.findMany({
        where: {
            payrollRunId: otherPayrollRun.id,
            employeeId,
        },
    });

    if (otherEntries.length === 0) return undefined;

    const eligibleWorkdays = getEligibleWorkdays(year, month, otherCutoffType);
    return calculateAttendanceSummary(otherEntries, eligibleWorkdays);
}

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !canManagePayroll(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { payrollRunId } = await request.json();

        if (!payrollRunId) {
            return NextResponse.json({ error: 'Missing payroll run ID' }, { status: 400 });
        }

        const payrollRun = await prisma.payrollRun.findUnique({
            where: { id: payrollRunId },
        });

        if (!payrollRun) {
            return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
        }

        if (payrollRun.status === 'FINALIZED') {
            return NextResponse.json({ error: 'Cannot import to a finalized payroll run' }, { status: 400 });
        }

        // 1. Fetch from LifeScan
        const lifeScanRecords = await fetchLifeScanData();

        // 2. Filter records for the cutoff period
        const cutoffStart = new Date(payrollRun.cutoffStart);
        const cutoffEnd = new Date(payrollRun.cutoffEnd);

        const relevantRecords = lifeScanRecords.filter(r => {
            const d = new Date(r.created_at);
            // Compare dates (ignoring time)
            const dStr = d.toISOString().split('T')[0];
            const startStr = cutoffStart.toISOString().split('T')[0];
            const endStr = cutoffEnd.toISOString().split('T')[0];
            return dStr >= startStr && dStr <= endStr;
        });

        // 3. Process records
        const processedRows = relevantRecords.map(r => processLifeScanRecord(r, null)).filter(r => r !== null);

        // 4. Validation
        const employees = await prisma.employee.findMany({
            where: { deletedAt: null },
        });

        // Primary lookup: by Employee ID (employeeNo)
        const employeeByNo = new Map(employees.map(e => [e.employeeNo.toLowerCase(), e]));

        const missingEmployees = new Set<string>(); // In masterlist but not in import (optional check)
        const unrecognizedEmployees = new Set<string>(); // In import but not in masterlist
        const invalidRows: any[] = [];
        const validRows: any[] = [];

        // Check consistency
        const uniqueImportedIds = new Set<string>();

        processedRows.forEach((row, index) => {
            if (!row.employeeId) {
                invalidRows.push({ rowIndex: index, errors: ['Missing Employee ID'] });
                return;
            }

            const employee = employeeByNo.get(row.employeeId.toLowerCase().trim());
            if (!employee) {
                unrecognizedEmployees.add(row.employeeId);
                // We can treat unrecognized as invalid or just skip
            } else {
                uniqueImportedIds.add(employee.employeeNo);
                validRows.push(row);
            }
        });

        return NextResponse.json({
            validRows: validRows.length,
            invalidRows,
            missingEmployees: [], // Logic to find missing from masterlist if needed
            unrecognizedEmployees: Array.from(unrecognizedEmployees).map(id => ({ identifier: id })),
            dateRangeValid: true, // filtered by API
            preview: validRows.slice(0, 5) // Send preview
        });

    } catch (error) {
        console.error('LifeScan validation error:', error);
        return NextResponse.json({ error: 'Failed to validat LifeScan data' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !canManagePayroll(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { payrollRunId } = await request.json(); // We can re-fetch or pass params
        // Ideally we re-fetch to be safe, assuming data hasn't changed in milliseconds. 
        // Or we could pass the validated data from frontend, but that's heavy.
        // Let's re-fetch.

        const payrollRun = await prisma.payrollRun.findUnique({
            where: { id: payrollRunId },
        });

        if (!payrollRun) {
            return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
        }

        if (payrollRun.status === 'FINALIZED') {
            return NextResponse.json({ error: 'Cannot import to finalized run' }, { status: 400 });
        }

        // 1. Fetch from LifeScan
        const lifeScanRecords = await fetchLifeScanData();

        const cutoffStart = new Date(payrollRun.cutoffStart);
        const cutoffEnd = new Date(payrollRun.cutoffEnd);

        const relevantRecords = lifeScanRecords.filter(r => {
            const d = new Date(r.created_at);
            const dStr = d.toISOString().split('T')[0];
            const startStr = cutoffStart.toISOString().split('T')[0];
            const endStr = cutoffEnd.toISOString().split('T')[0];
            return dStr >= startStr && dStr <= endStr;
        });

        const processedRows = relevantRecords.map(r => processLifeScanRecord(r, null)).filter(r => r !== null);

        // 2. Get Employees
        const employees = await prisma.employee.findMany({ where: { deletedAt: null } });
        const employeeByNo = new Map(employees.map(e => [e.employeeNo.toLowerCase(), e]));

        // 3. Settings & Holidays
        const settings = await prisma.setting.findMany();
        const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
        const payrollSettings = {
            govDeductionMode: (settingsMap.gov_deduction_mode || 'fixed_per_cutoff') as 'fixed_per_cutoff' | 'prorated_by_days',
            standardDailyHours: parseInt(settingsMap.standard_daily_hours || '8'),
        };

        const holidays = await prisma.holiday.findMany({ where: { year: payrollRun.year } });
        const holidayData: HolidayData[] = holidays.map(h => ({ date: h.date, type: h.type, name: h.name }));

        // 4. Delete existing entries
        await prisma.timesheetEntry.deleteMany({ where: { payrollRunId } });

        // 5. Group by Employee
        const employeeEntries = new Map<string, any[]>();
        const importedEmployeeIds = new Set<string>();

        for (const row of processedRows) {
            if (!row.employeeId) continue;
            const employee = employeeByNo.get(row.employeeId.toLowerCase().trim());
            if (!employee || employee.status !== 'ACTIVE') continue;

            const entries = employeeEntries.get(employee.id) || [];
            entries.push(row);
            employeeEntries.set(employee.id, entries);
        }

        // 6. Save Entries & Calculate
        for (const [employeeId, rows] of Array.from(employeeEntries.entries())) {
            const employee = employees.find(e => e.id === employeeId)!;
            importedEmployeeIds.add(employeeId);

            for (const row of rows) {
                await prisma.timesheetEntry.upsert({
                    where: {
                        payrollRunId_employeeId_date: {
                            payrollRunId,
                            employeeId,
                            date: row.date,
                        }
                    },
                    create: {
                        payrollRunId,
                        employeeId,
                        date: row.date,
                        timeIn: row.timeIn,
                        timeOut: row.timeOut,
                        hoursWorked: row.hoursWorked,
                        minutesLate: row.minutesLate,
                        undertimeMinutes: row.undertimeMinutes,
                        isAbsent: row.isAbsent,
                        overtimeHours: row.overtimeHours,
                        remarks: row.remarks,
                        rawData: row.rawData
                    },
                    update: {
                        timeIn: row.timeIn,
                        timeOut: row.timeOut,
                        hoursWorked: row.hoursWorked,
                        minutesLate: row.minutesLate,
                        undertimeMinutes: row.undertimeMinutes,
                        isAbsent: row.isAbsent,
                        overtimeHours: row.overtimeHours,
                        remarks: row.remarks,
                        rawData: row.rawData
                    }
                });
            }

            // Recalculate Payslip
            const timesheetEntries = await prisma.timesheetEntry.findMany({ where: { payrollRunId, employeeId } });
            const otherCutoffAttendance = await getOtherCutoffAttendance(employeeId, payrollRun.year, payrollRun.month, payrollRun.cutoffType);

            const calculation = calculatePayslip(
                employee,
                timesheetEntries,
                payrollRun.year,
                payrollRun.month,
                payrollRun.cutoffType,
                parseFloat(String(employee.defaultKpi)),
                payrollSettings,
                {},
                otherCutoffAttendance,
                holidayData
            );

            await prisma.payslip.upsert({
                where: { payrollRunId_employeeId: { payrollRunId, employeeId } },
                create: {
                    referenceNo: generateReferenceNo('PS'),
                    payrollRunId,
                    employeeId,
                    employeeName: `${employee.lastName}, ${employee.firstName} ${employee.middleName || ''}`.trim(),
                    employeeNo: employee.employeeNo,
                    department: employee.department,
                    position: employee.position,
                    dailyRate: employee.dailyRate,
                    eligibleWorkdays: calculation.attendance.eligibleWorkdays,
                    presentDays: calculation.attendance.presentDays,
                    absentDays: calculation.attendance.absentDays,
                    totalLateMinutes: calculation.attendance.totalLateMinutes,
                    totalUndertimeMinutes: calculation.attendance.totalUndertimeMinutes,
                    totalOvertimeHours: calculation.attendance.totalOvertimeHours,
                    lateCount: calculation.attendance.lateCount,
                    absentCount: calculation.attendance.absentCount,
                    monthlyLateCount: calculation.monthlyAttendance.lateCount,
                    monthlyAbsentCount: calculation.monthlyAttendance.absentCount,
                    kpiVoided: calculation.kpiVoided,
                    kpiVoidReason: calculation.kpiVoidReason,
                    basicPay: calculation.earnings.basicPay,
                    overtimePay: calculation.earnings.overtimePay,
                    holidayPay: calculation.earnings.holidayPay,
                    cola: calculation.earnings.cola,
                    kpi: calculation.earnings.kpi,
                    otherEarnings: calculation.earnings.otherEarnings,
                    grossPay: calculation.earnings.grossPay,
                    absenceDeduction: calculation.deductions.absenceDeduction,
                    lateDeduction: calculation.deductions.lateDeduction,
                    undertimeDeduction: calculation.deductions.undertimeDeduction,
                    sssDeduction: calculation.deductions.sssDeduction,
                    philhealthDeduction: calculation.deductions.philhealthDeduction,
                    pagibigDeduction: calculation.deductions.pagibigDeduction,
                    sssLoanDeduction: calculation.deductions.sssLoanDeduction,
                    pagibigLoanDeduction: calculation.deductions.pagibigLoanDeduction,
                    otherLoanDeduction: calculation.deductions.otherLoanDeduction,
                    cashAdvanceDeduction: calculation.deductions.cashAdvanceDeduction,
                    totalDeductions: calculation.deductions.totalDeductions,
                    netPay: calculation.netPay,
                    netPayInWords: calculation.netPayInWords,
                    govDeductionsApplied: calculation.govDeductionsApplied,
                    computationBreakdown: calculation.computationBreakdown,
                    isMissing: false,
                },
                update: {
                    // Update implementation same as imports
                    eligibleWorkdays: calculation.attendance.eligibleWorkdays,
                    presentDays: calculation.attendance.presentDays,
                    absentDays: calculation.attendance.absentDays,
                    totalLateMinutes: calculation.attendance.totalLateMinutes,
                    totalUndertimeMinutes: calculation.attendance.totalUndertimeMinutes,
                    totalOvertimeHours: calculation.attendance.totalOvertimeHours,
                    lateCount: calculation.attendance.lateCount,
                    absentCount: calculation.attendance.absentCount,
                    monthlyLateCount: calculation.monthlyAttendance.lateCount,
                    monthlyAbsentCount: calculation.monthlyAttendance.absentCount,
                    kpiVoided: calculation.kpiVoided,
                    kpiVoidReason: calculation.kpiVoidReason,
                    basicPay: calculation.earnings.basicPay,
                    overtimePay: calculation.earnings.overtimePay,
                    holidayPay: calculation.earnings.holidayPay,
                    kpi: calculation.earnings.kpi,
                    grossPay: calculation.earnings.grossPay,
                    absenceDeduction: calculation.deductions.absenceDeduction,
                    lateDeduction: calculation.deductions.lateDeduction,
                    undertimeDeduction: calculation.deductions.undertimeDeduction,
                    sssDeduction: calculation.deductions.sssDeduction,
                    philhealthDeduction: calculation.deductions.philhealthDeduction,
                    pagibigDeduction: calculation.deductions.pagibigDeduction,
                    totalDeductions: calculation.deductions.totalDeductions,
                    netPay: calculation.netPay,
                    netPayInWords: calculation.netPayInWords,
                    govDeductionsApplied: calculation.govDeductionsApplied,
                    computationBreakdown: calculation.computationBreakdown,
                    isMissing: false,
                }
            });
        }

        // Mark missing
        await prisma.payslip.updateMany({
            where: {
                payrollRunId,
                employeeId: { notIn: Array.from(importedEmployeeIds) }
            },
            data: { isMissing: true }
        });

        return NextResponse.json({
            success: true,
            imported: importedEmployeeIds.size,
            total: processedRows.length
        });

    } catch (error) {
        console.error('Impact LifeScan error:', error);
        return NextResponse.json({ error: 'Failed to import' }, { status: 500 });
    }
}
