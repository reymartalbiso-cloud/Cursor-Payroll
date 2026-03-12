import { CutoffType, Employee, TimesheetEntry, HolidayType } from '@prisma/client';
import { parseDecimal, roundTo2Decimals, numberToWords } from './utils';

// Types
export interface PayrollSettings {
  govDeductionMode: 'fixed_per_cutoff' | 'prorated_by_days';
  standardDailyHours: number;
}

// Holiday data for payroll calculation
export interface HolidayData {
  date: Date;
  type: HolidayType;
  name: string;
}

// Holiday pay constants
export const HOLIDAY_PAY_RATES = {
  REGULAR: 1.0,    // 100% of daily rate for regular holidays
  SPECIAL: 0.3,    // 30% of daily rate for special holidays
};

export interface AttendanceSummary {
  eligibleWorkdays: number;
  presentDays: number;
  absentDays: number;
  lateCount: number;           // Number of times late
  absentCount: number;         // Number of absences
  totalLateMinutes: number;
  totalUndertimeMinutes: number;
  totalOvertimeHours: number;
  totalHolidayPay: number;
  regularHolidayCount: number;   // Number of regular holidays (100% pay)
  specialHolidayCount: number;   // Number of special holidays (30% pay)
  regularHolidayPay: number;     // Total regular holiday pay
  specialHolidayPay: number;     // Total special holiday pay
  vacationLeaveCount: number;    // Number of vacation leave days (VL)
  sickLeaveCount: number;        // Number of sick leave days (SL)
  offsetCount: number;           // Number of offset days (Saturday replacement)
}

// KPI Voiding Rules (applied per MONTH, not per cutoff)
export const KPI_VOID_RULES = {
  maxLateOccurrences: 3,       // More than 3 late in the MONTH = void KPI
  maxAbsentOccurrences: 2,     // More than 2 absences in the MONTH = void KPI
};

// Monthly attendance for KPI voiding calculation
export interface MonthlyAttendance {
  lateCount: number;
  absentCount: number;
}

export interface EarningsBreakdown {
  basicPay: number;
  overtimePay: number;
  holidayPay: number;
  cola: number;
  kpi: number;
  otherEarnings: number;
  grossPay: number;
}

export interface DeductionsBreakdown {
  absenceDeduction: number;
  lateDeduction: number;
  undertimeDeduction: number;
  sssDeduction: number;
  philhealthDeduction: number;
  pagibigDeduction: number;
  sssLoanDeduction: number;
  pagibigLoanDeduction: number;
  otherLoanDeduction: number;
  cashAdvanceDeduction: number;
  thirteenthMonthAdj: number;
  otherDeductions: number;
  totalDeductions: number;
}

export interface PayslipCalculation {
  attendance: AttendanceSummary;
  monthlyAttendance: MonthlyAttendance;  // Combined attendance for the whole month
  earnings: EarningsBreakdown;
  deductions: DeductionsBreakdown;
  netPay: number;
  netPayInWords: string;
  govDeductionsApplied: boolean;
  kpiVoided: boolean;
  kpiVoidReason: string | null;
  computationBreakdown: ComputationBreakdown;
}

export interface ComputationBreakdown {
  basicPayFormula: string;
  absenceFormula: string;
  lateFormula: string;
  undertimeFormula: string;
  overtimeFormula: string;
  holidayNote: string;
  govDeductionNote: string;
  workdayRule: string;
  kpiNote: string;
}

/**
 * Get all dates in a cutoff period
 */
export function getCutoffDates(year: number, month: number, cutoffType: CutoffType): Date[] {
  const dates: Date[] = [];

  if (cutoffType === CutoffType.FIRST_HALF) {
    // 1-15 of the month
    for (let day = 1; day <= 15; day++) {
      dates.push(new Date(year, month - 1, day));
    }
  } else {
    // 16-end of month
    const lastDay = new Date(year, month, 0).getDate(); // Get last day of month
    for (let day = 16; day <= lastDay; day++) {
      dates.push(new Date(year, month - 1, day));
    }
  }

  return dates;
}

/**
 * Check if a date is Sunday (day 0)
 */
export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

/**
 * Get eligible workdays (Mon-Sat only, excluding Sundays)
 */
export function getEligibleWorkdays(year: number, month: number, cutoffType: CutoffType): number {
  const dates = getCutoffDates(year, month, cutoffType);
  return dates.filter(date => !isSunday(date)).length;
}

/**
 * Get eligible workday dates (Mon-Sat only)
 */
export function getEligibleWorkdayDates(year: number, month: number, cutoffType: CutoffType): Date[] {
  const dates = getCutoffDates(year, month, cutoffType);
  return dates.filter(date => !isSunday(date));
}

/**
 * Get cutoff start and end dates
 */
export function getCutoffPeriod(year: number, month: number, cutoffType: CutoffType): { start: Date; end: Date } {
  if (cutoffType === CutoffType.FIRST_HALF) {
    return {
      start: new Date(year, month - 1, 1),
      end: new Date(year, month - 1, 15),
    };
  } else {
    const lastDay = new Date(year, month, 0).getDate();
    return {
      start: new Date(year, month - 1, 16),
      end: new Date(year, month - 1, lastDay),
    };
  }
}

/**
 * Format date to YYYY-MM-DD using local timezone (not UTC)
 * This prevents timezone issues where dates shift when converted to ISO string
 */
function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a date is a holiday and return the holiday type
 */
export function getHolidayType(date: Date, holidays: HolidayData[]): HolidayType | null {
  // Use local date format to avoid timezone issues
  const dateStr = formatDateLocal(date);
  const holiday = holidays.find(h => {
    const holidayDate = new Date(h.date);
    const holidayDateStr = formatDateLocal(holidayDate);
    return holidayDateStr === dateStr;
  });
  return holiday?.type || null;
}

/**
 * Calculate attendance summary from timesheet entries
 * @param holidays - List of holidays to check for holiday pay
 * @param dailyRate - Employee's daily rate for calculating holiday pay
 */
export function calculateAttendanceSummary(
  entries: TimesheetEntry[],
  eligibleWorkdays: number,
  holidays: HolidayData[] = [],
  dailyRate: number = 0
): AttendanceSummary {
  let presentDays = 0;
  let lateCount = 0;           // Track number of late occurrences
  let absentCount = 0;         // Track number of absences
  let totalLateMinutes = 0;
  let totalUndertimeMinutes = 0;
  let totalOvertimeHours = 0;
  let totalHolidayPay = 0;
  let regularHolidayCount = 0;
  let specialHolidayCount = 0;
  let regularHolidayPay = 0;
  let specialHolidayPay = 0;
  let vacationLeaveCount = 0;
  let sickLeaveCount = 0;
  let offsetCount = 0;

  // Get all dates from entries for holiday checking (use local date format)
  const entryDates = new Set(entries.map(e => formatDateLocal(new Date(e.date))));

  for (const entry of entries) {
    const entryDate = new Date(entry.date);

    // Skip Sundays in the calculation
    if (isSunday(entryDate)) continue;

    let countedAsPresent = false;

    // Check if on leave (VL, SL, Offset, or Holiday from status) - these are PAID days
    // Status column takes priority over Holidays table
    if (entry.isOnLeave) {
      if (entry.leaveType === 'VL') {
        vacationLeaveCount++;
        presentDays++;
        countedAsPresent = true;
      } else if (entry.leaveType === 'SL') {
        sickLeaveCount++;
        presentDays++;
        countedAsPresent = true;
      } else if (entry.leaveType === 'OFFSET') {
        offsetCount++;
        presentDays++;
        countedAsPresent = true;
      } else if (entry.leaveType === 'REGULAR_HOLIDAY') {
        // Regular holiday from status column: 100% daily rate
        regularHolidayCount++;
        regularHolidayPay += dailyRate * HOLIDAY_PAY_RATES.REGULAR;
        presentDays++;
        countedAsPresent = true;
      } else if (entry.leaveType === 'SPECIAL_HOLIDAY') {
        // Special holiday from status column: 30% of hours worked, capped at 8 hours
        // OT is calculated SEPARATELY and added to total OT hours
        specialHolidayCount++;
        const hoursWorked = parseDecimal(entry.hoursWorked) || 8;
        const otHours = entry.adjustedOvertimeHours !== null && entry.adjustedOvertimeHours !== undefined
          ? parseDecimal(entry.adjustedOvertimeHours)
          : parseDecimal(entry.overtimeHours);
        const regularHours = Math.min(8, Math.max(0, hoursWorked - otHours));
        const hourlyRate = dailyRate / 8;
        specialHolidayPay += regularHours * hourlyRate * HOLIDAY_PAY_RATES.SPECIAL;
        presentDays++;
        countedAsPresent = true;

        // Add OT hours from special holiday to total OT (OT is NOT included in 30% holiday pay)
        totalOvertimeHours += otHours;
      }
      // Fall through to late/undertime counting if it's a holiday
      if (entry.leaveType !== 'REGULAR_HOLIDAY' && entry.leaveType !== 'SPECIAL_HOLIDAY') {
        continue;
      }
    }

    // Regular work day (holidays are now only detected from Excel Status column above)
    if (entry.isAbsent) {
      // Only count towards KPI voiding if NOT excused
      if (!entry.isAbsentExcused) {
        absentCount++;
      }
    } else {
      if (!countedAsPresent) {
        presentDays++;
      }
    }

    // Use adjusted values if they exist, otherwise use calculated values
    const effectiveLateMinutes = entry.adjustedLateMinutes !== null && entry.adjustedLateMinutes !== undefined
      ? entry.adjustedLateMinutes
      : (entry.minutesLate || 0);

    const effectiveUndertimeMinutes = entry.adjustedUndertimeMinutes !== null && entry.adjustedUndertimeMinutes !== undefined
      ? entry.adjustedUndertimeMinutes
      : (entry.undertimeMinutes || 0);

    let effectiveOvertimeHours = entry.adjustedOvertimeHours !== null && entry.adjustedOvertimeHours !== undefined
      ? parseDecimal(entry.adjustedOvertimeHours)
      : parseDecimal(entry.overtimeHours);

    // For SPECIAL_HOLIDAY, OT hours were already added to totalOvertimeHours above
    // so we skip adding them again here to avoid double-counting.
    if (entry.leaveType === 'SPECIAL_HOLIDAY') {
      effectiveOvertimeHours = 0;
    }

    // Count late occurrences (any day with late minutes > 0)
    // Only count towards KPI voiding if NOT excused
    if (effectiveLateMinutes > 0 && !entry.isLateExcused) {
      lateCount++;
    }

    totalLateMinutes += effectiveLateMinutes;
    totalUndertimeMinutes += effectiveUndertimeMinutes;
    totalOvertimeHours += effectiveOvertimeHours;
    totalHolidayPay += parseDecimal(entry.holidayPay);
  }

  // Holidays are now ONLY detected from Excel Status column (REGULAR_HOLIDAY or SPECIAL_HOLIDAY)
  // No longer checking the Holidays database table to avoid confusion/double-counting

  // Calculate absent days (workdays minus present days, excluding regular holidays)
  const absentDays = Math.max(0, eligibleWorkdays - presentDays);

  // Total holiday pay includes calculated holiday pay + any manual holiday pay from timesheet
  // Keep full precision - don't round here, round only at final totals
  const calculatedHolidayPay = regularHolidayPay + specialHolidayPay;

  return {
    eligibleWorkdays,
    presentDays,
    absentDays,
    lateCount,
    absentCount,
    totalLateMinutes,
    totalUndertimeMinutes,
    // Keep full precision for all numeric values - rounding happens at final Gross/Net Pay
    totalOvertimeHours: totalOvertimeHours,
    totalHolidayPay: totalHolidayPay + calculatedHolidayPay,
    regularHolidayCount,
    specialHolidayCount,
    regularHolidayPay: regularHolidayPay,
    specialHolidayPay: specialHolidayPay,
    vacationLeaveCount,
    sickLeaveCount,
    offsetCount,
  };
}

/**
 * Check if KPI should be voided based on MONTHLY attendance (both cutoffs combined)
 * Rule: Late > 3 times OR Absent > 2 times in the whole MONTH = KPI voided
 */
export function shouldVoidKpi(monthlyAttendance: MonthlyAttendance): { voided: boolean; reason: string | null } {
  if (monthlyAttendance.lateCount > KPI_VOID_RULES.maxLateOccurrences) {
    return {
      voided: true,
      reason: `Late ${monthlyAttendance.lateCount} times this month (max ${KPI_VOID_RULES.maxLateOccurrences} allowed)`,
    };
  }

  if (monthlyAttendance.absentCount > KPI_VOID_RULES.maxAbsentOccurrences) {
    return {
      voided: true,
      reason: `Absent ${monthlyAttendance.absentCount} times this month (max ${KPI_VOID_RULES.maxAbsentOccurrences} allowed)`,
    };
  }

  return { voided: false, reason: null };
}

/**
 * Calculate monthly attendance totals (for KPI voiding)
 * Combines attendance from both cutoffs of the month
 */
export function calculateMonthlyAttendance(
  currentCutoffAttendance: AttendanceSummary,
  otherCutoffAttendance?: AttendanceSummary
): MonthlyAttendance {
  const lateCount = currentCutoffAttendance.lateCount + (otherCutoffAttendance?.lateCount || 0);
  const absentCount = currentCutoffAttendance.absentCount + (otherCutoffAttendance?.absentCount || 0);

  return { lateCount, absentCount };
}

/**
 * Calculate earnings breakdown
 * Uses monthlySalary / 26 for precise calculations to avoid rounding errors
 * Keeps full precision during intermediate calculations, rounds only at final totals
 */
export function calculateEarnings(
  employee: Employee,
  attendance: AttendanceSummary,
  kpi: number,
  settings: PayrollSettings,
  cola: number = 0,
  otherEarnings: number = 0
): EarningsBreakdown {
  // Use monthlySalary / 26 for precise calculations
  const monthlySalary = parseDecimal(employee.monthlySalary);
  const preciseDailyRate = monthlySalary / 26;
  const hourlyRate = preciseDailyRate / settings.standardDailyHours;

  // Basic pay based on eligible workdays MINUS regular holidays
  // Regular holidays are paid separately in holidayPay (100% rate)
  // This prevents double counting regular holidays
  // Keep full precision - don't round yet
  const regularWorkdays = attendance.eligibleWorkdays - attendance.regularHolidayCount;
  const basicPayRaw = preciseDailyRate * regularWorkdays;

  // Overtime pay (flat hourly rate, no multiplier) - keep full precision
  const overtimePayRaw = attendance.totalOvertimeHours * hourlyRate;

  // Holiday pay (from timesheet) - keep full precision
  const holidayPayRaw = attendance.totalHolidayPay;

  // Calculate gross pay with full precision, then round once at the end
  const grossPayRaw = basicPayRaw + overtimePayRaw + holidayPayRaw + cola + kpi + otherEarnings;
  const grossPay = roundTo2Decimals(grossPayRaw);

  // Round individual components for display purposes only
  return {
    basicPay: roundTo2Decimals(basicPayRaw),
    overtimePay: roundTo2Decimals(overtimePayRaw),
    holidayPay: roundTo2Decimals(holidayPayRaw),
    cola: roundTo2Decimals(cola),
    kpi: roundTo2Decimals(kpi),
    otherEarnings: roundTo2Decimals(otherEarnings),
    grossPay,
  };
}

/**
 * Calculate deductions breakdown
 * Uses monthlySalary / 26 for precise calculations to avoid rounding errors
 * Keeps full precision during intermediate calculations, rounds only at final totals
 */
export function calculateDeductions(
  employee: Employee,
  attendance: AttendanceSummary,
  cutoffType: CutoffType,
  settings: PayrollSettings,
  overrides: Partial<DeductionsBreakdown> = {}
): DeductionsBreakdown {
  // Use monthlySalary / 26 for precise calculations
  const monthlySalary = parseDecimal(employee.monthlySalary);
  const preciseDailyRate = monthlySalary / 26;
  const minuteRate = preciseDailyRate / (settings.standardDailyHours * 60);

  // Keep full precision for intermediate calculations
  // Absence deduction (only for Mon-Sat absences)
  const absenceDeductionRaw = overrides.absenceDeduction ??
    (preciseDailyRate * attendance.absentDays);

  // Late deduction
  const lateDeductionRaw = overrides.lateDeduction ??
    (minuteRate * attendance.totalLateMinutes);

  // Undertime deduction
  const undertimeDeductionRaw = overrides.undertimeDeduction ??
    (minuteRate * attendance.totalUndertimeMinutes);

  // Government deductions - ONLY for second half cutoff (16-end)
  const applyGovDeductions = cutoffType === CutoffType.SECOND_HALF;

  let sssDeductionRaw = 0;
  let philhealthDeductionRaw = 0;
  let pagibigDeductionRaw = 0;

  if (applyGovDeductions) {
    if (settings.govDeductionMode === 'prorated_by_days' && attendance.eligibleWorkdays > 0) {
      const prorationFactor = attendance.presentDays / attendance.eligibleWorkdays;
      sssDeductionRaw = parseDecimal(employee.sssContribution) * prorationFactor;
      philhealthDeductionRaw = parseDecimal(employee.philhealthContribution) * prorationFactor;
      pagibigDeductionRaw = parseDecimal(employee.pagibigContribution) * prorationFactor;
    } else {
      // fixed_per_cutoff - apply full amounts
      sssDeductionRaw = parseDecimal(employee.sssContribution);
      philhealthDeductionRaw = parseDecimal(employee.philhealthContribution);
      pagibigDeductionRaw = parseDecimal(employee.pagibigContribution);
    }
  }

  // Loans and advances
  const sssLoanDeductionRaw = overrides.sssLoanDeduction ?? parseDecimal(employee.sssLoan);
  const pagibigLoanDeductionRaw = overrides.pagibigLoanDeduction ?? parseDecimal(employee.pagibigLoan);
  const otherLoanDeductionRaw = overrides.otherLoanDeduction ?? parseDecimal(employee.otherLoans);
  const cashAdvanceDeductionRaw = overrides.cashAdvanceDeduction ?? parseDecimal(employee.cashAdvance);

  const thirteenthMonthAdjRaw = overrides.thirteenthMonthAdj ?? 0;
  const otherDeductionsRaw = overrides.otherDeductions ?? 0;

  // Sum all deductions with full precision, then round once at the end
  const totalDeductionsRaw =
    absenceDeductionRaw +
    lateDeductionRaw +
    undertimeDeductionRaw +
    sssDeductionRaw +
    philhealthDeductionRaw +
    pagibigDeductionRaw +
    sssLoanDeductionRaw +
    pagibigLoanDeductionRaw +
    otherLoanDeductionRaw +
    cashAdvanceDeductionRaw +
    thirteenthMonthAdjRaw +
    otherDeductionsRaw;

  const totalDeductions = roundTo2Decimals(totalDeductionsRaw);

  // Round individual components for display purposes only
  return {
    absenceDeduction: roundTo2Decimals(absenceDeductionRaw),
    lateDeduction: roundTo2Decimals(lateDeductionRaw),
    undertimeDeduction: roundTo2Decimals(undertimeDeductionRaw),
    sssDeduction: roundTo2Decimals(sssDeductionRaw),
    philhealthDeduction: roundTo2Decimals(philhealthDeductionRaw),
    pagibigDeduction: roundTo2Decimals(pagibigDeductionRaw),
    sssLoanDeduction: roundTo2Decimals(sssLoanDeductionRaw),
    pagibigLoanDeduction: roundTo2Decimals(pagibigLoanDeductionRaw),
    otherLoanDeduction: roundTo2Decimals(otherLoanDeductionRaw),
    cashAdvanceDeduction: roundTo2Decimals(cashAdvanceDeductionRaw),
    thirteenthMonthAdj: roundTo2Decimals(thirteenthMonthAdjRaw),
    otherDeductions: roundTo2Decimals(otherDeductionsRaw),
    totalDeductions,
  };
}

/**
 * Generate computation breakdown for transparency
 * Uses monthlySalary / 26 for precise calculations
 */
export function generateComputationBreakdown(
  employee: Employee,
  attendance: AttendanceSummary,
  earnings: EarningsBreakdown,
  deductions: DeductionsBreakdown,
  cutoffType: CutoffType,
  settings: PayrollSettings,
  kpiVoided: boolean,
  kpiVoidReason: string | null,
  monthlyAttendance: MonthlyAttendance
): ComputationBreakdown {
  // Use monthlySalary / 26 for precise calculations
  const monthlySalary = parseDecimal(employee.monthlySalary);
  const preciseDailyRate = monthlySalary / 26;
  const displayDailyRate = parseDecimal(employee.dailyRate);  // For display (rounded)
  const hourlyRate = preciseDailyRate / settings.standardDailyHours;
  const minuteRate = preciseDailyRate / (settings.standardDailyHours * 60);

  // Show MONTHLY totals for KPI voiding (not just this cutoff)
  let kpiNote = `KPI Rule (Monthly): Late ${monthlyAttendance.lateCount}x (max ${KPI_VOID_RULES.maxLateOccurrences}), Absent ${monthlyAttendance.absentCount}x (max ${KPI_VOID_RULES.maxAbsentOccurrences})`;
  if (kpiVoided) {
    kpiNote += ` - KPI VOIDED: ${kpiVoidReason}`;
  } else {
    kpiNote += ` - KPI Applied: ${earnings.kpi.toFixed(2)}`;
  }
  kpiNote += ` | This cutoff: Late ${attendance.lateCount}x, Absent ${attendance.absentCount}x`;

  // Holiday and leave note
  let holidayNote = '';
  const parts: string[] = [];

  if (attendance.regularHolidayCount > 0) {
    parts.push(`Regular Holidays: ${attendance.regularHolidayCount} (100% pay = ${attendance.regularHolidayPay.toFixed(2)})`);
  }
  if (attendance.specialHolidayCount > 0) {
    parts.push(`Special Holidays: ${attendance.specialHolidayCount} (30% of hours worked, max 8hrs, OT excluded = ${attendance.specialHolidayPay.toFixed(2)})`);
  }
  if (attendance.vacationLeaveCount > 0) {
    parts.push(`Vacation Leave: ${attendance.vacationLeaveCount} day(s) (paid)`);
  }
  if (attendance.sickLeaveCount > 0) {
    parts.push(`Sick Leave: ${attendance.sickLeaveCount} day(s) (paid)`);
  }
  if (attendance.offsetCount > 0) {
    parts.push(`Offset: ${attendance.offsetCount} day(s) (paid)`);
  }

  if (parts.length > 0) {
    holidayNote = parts.join(' | ');
  } else {
    holidayNote = 'No holidays or leaves in this cutoff period';
  }

  return {
    basicPayFormula: `Basic Pay = (Monthly ₱${monthlySalary.toLocaleString()} ÷ 26) × ${attendance.eligibleWorkdays - attendance.regularHolidayCount} workdays = ₱${earnings.basicPay.toFixed(2)}`,
    absenceFormula: `Absence Deduction = (Monthly ₱${monthlySalary.toLocaleString()} ÷ 26) × ${attendance.absentDays} absent days = ₱${deductions.absenceDeduction.toFixed(2)}`,
    lateFormula: `Late Deduction = Minute Rate (${minuteRate.toFixed(4)}) × ${attendance.totalLateMinutes} minutes = ₱${deductions.lateDeduction.toFixed(2)}`,
    undertimeFormula: `Undertime Deduction = Minute Rate (${minuteRate.toFixed(4)}) × ${attendance.totalUndertimeMinutes} minutes = ₱${deductions.undertimeDeduction.toFixed(2)}`,
    overtimeFormula: `Overtime Pay = ${attendance.totalOvertimeHours} OT hrs × Hourly Rate (${hourlyRate.toFixed(2)}) = ₱${earnings.overtimePay.toFixed(2)}`,
    holidayNote,
    govDeductionNote: cutoffType === CutoffType.SECOND_HALF
      ? `Government deductions (SSS, PhilHealth, Pag-IBIG) applied for 16-end of month cutoff. Mode: ${settings.govDeductionMode}`
      : 'Government deductions (SSS, PhilHealth, Pag-IBIG) NOT applied for 1-15 cutoff',
    workdayRule: `Workdays: Monday-Saturday only (Sundays excluded). Eligible workdays in cutoff: ${attendance.eligibleWorkdays}. Rate: ₱${monthlySalary.toLocaleString()}/month (₱${displayDailyRate.toFixed(2)}/day)`,
    kpiNote,
  };
}

/**
 * Full payslip calculation
 * @param otherCutoffAttendance - Attendance from the other cutoff of the same month (for monthly KPI voiding)
 * @param holidays - List of holidays for calculating holiday pay
 */
export function calculatePayslip(
  employee: Employee,
  entries: TimesheetEntry[],
  year: number,
  month: number,
  cutoffType: CutoffType,
  kpi: number,
  settings: PayrollSettings,
  overrides: {
    cola?: number;
    otherEarnings?: number;
    deductionOverrides?: Partial<DeductionsBreakdown>;
  } = {},
  otherCutoffAttendance?: AttendanceSummary,
  holidays: HolidayData[] = []
): PayslipCalculation {
  const eligibleWorkdays = getEligibleWorkdays(year, month, cutoffType);
  // Use monthlySalary / 26 for precise calculations to avoid rounding errors
  const monthlySalary = parseDecimal(employee.monthlySalary);
  const preciseDailyRate = monthlySalary / 26;

  // Holidays are now detected ONLY from Excel Status column (REGULAR_HOLIDAY or SPECIAL_HOLIDAY)
  // The holidays parameter is kept for backward compatibility but not used
  const attendance = calculateAttendanceSummary(entries, eligibleWorkdays, [], preciseDailyRate);

  // Calculate MONTHLY attendance (combine both cutoffs for KPI voiding)
  const monthlyAttendance = calculateMonthlyAttendance(attendance, otherCutoffAttendance);

  // Check if KPI should be voided based on MONTHLY totals (late > 3 OR absent > 2 for the whole month)
  const kpiVoidCheck = shouldVoidKpi(monthlyAttendance);
  const effectiveKpi = kpiVoidCheck.voided ? 0 : kpi;

  const earnings = calculateEarnings(
    employee,
    attendance,
    effectiveKpi,
    settings,
    overrides.cola ?? 0,
    overrides.otherEarnings ?? 0
  );

  const deductions = calculateDeductions(
    employee,
    attendance,
    cutoffType,
    settings,
    overrides.deductionOverrides
  );

  const netPay = roundTo2Decimals(earnings.grossPay - deductions.totalDeductions);

  const computationBreakdown = generateComputationBreakdown(
    employee,
    attendance,
    earnings,
    deductions,
    cutoffType,
    settings,
    kpiVoidCheck.voided,
    kpiVoidCheck.reason,
    monthlyAttendance
  );

  return {
    attendance,
    monthlyAttendance,
    earnings,
    deductions,
    netPay,
    netPayInWords: numberToWords(netPay),
    govDeductionsApplied: cutoffType === CutoffType.SECOND_HALF,
    kpiVoided: kpiVoidCheck.voided,
    kpiVoidReason: kpiVoidCheck.reason,
    computationBreakdown,
  };
}

/**
 * Recalculate totals when KPI changes
 * Note: KPI voiding rules are still applied based on MONTHLY attendance
 */
export function recalculateWithNewKpi(
  currentCalculation: PayslipCalculation,
  newKpi: number
): PayslipCalculation {
  // Check if KPI should be voided based on MONTHLY attendance
  const kpiVoidCheck = shouldVoidKpi(currentCalculation.monthlyAttendance);
  const effectiveKpi = kpiVoidCheck.voided ? 0 : newKpi;

  const kpiDiff = effectiveKpi - currentCalculation.earnings.kpi;
  const newGrossPay = roundTo2Decimals(currentCalculation.earnings.grossPay + kpiDiff);
  const newNetPay = roundTo2Decimals(newGrossPay - currentCalculation.deductions.totalDeductions);

  return {
    ...currentCalculation,
    earnings: {
      ...currentCalculation.earnings,
      kpi: effectiveKpi,
      grossPay: newGrossPay,
    },
    netPay: newNetPay,
    netPayInWords: numberToWords(newNetPay),
    kpiVoided: kpiVoidCheck.voided,
    kpiVoidReason: kpiVoidCheck.reason,
  };
}
