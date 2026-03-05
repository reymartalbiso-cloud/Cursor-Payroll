import * as XLSX from 'xlsx';

export interface ExcelSheet {
  name: string;
  headers: string[];
  data: Record<string, unknown>[];
  rowCount: number;
}

export interface ColumnMapping {
  employeeId?: string;
  employeeName?: string;
  date?: string;
  timeIn?: string;
  timeOut?: string;
  amIn?: string;
  amOut?: string;
  pmIn?: string;
  pmOut?: string;
  minutesLate?: string;
  undertimeMinutes?: string;
  status?: string;  // "absent", "late", "present"
  isAbsent?: string;
  overtimeHours?: string;
  otIn?: string;
  otOut?: string;
  holidayPay?: string;
  remarks?: string;
}

export type LeaveType = 'VL' | 'SL' | 'OFFSET' | 'REGULAR_HOLIDAY' | 'SPECIAL_HOLIDAY' | null;  // Vacation Leave, Sick Leave, Offset, Holidays

export interface ParsedTimesheetRow {
  rowIndex: number;
  employeeId?: string;
  employeeName?: string;
  date?: Date;
  timeIn?: string;
  timeOut?: string;
  hoursWorked?: number;        // Total hours worked (regular + OT)
  minutesLate?: number;
  undertimeMinutes?: number;
  isAbsent?: boolean;
  isOnLeave?: boolean;         // Is on paid leave (VL or SL)
  leaveType?: LeaveType;       // Type of leave
  overtimeHours?: number;
  holidayPay?: number;
  remarks?: string;
  rawData: Record<string, unknown>;
  errors: string[];
}

export interface TimesheetValidationResult {
  validRows: ParsedTimesheetRow[];
  invalidRows: ParsedTimesheetRow[];
  missingEmployees: string[];
  unrecognizedEmployees: Array<{
    identifier: string;
    row: ParsedTimesheetRow;
  }>;
  dateRangeValid: boolean;
  dateRangeError?: string;
}

/**
 * Parse an Excel file and return all sheets
 */
export function parseExcelFile(buffer: ArrayBuffer): ExcelSheet[] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheets: ExcelSheet[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, {
      header: 1,
      raw: false,
      dateNF: 'yyyy-mm-dd',
    });

    if (jsonData.length === 0) continue;

    // First row as headers
    const headers = jsonData[0].map((h: any, i: number) =>
      h?.toString().trim() || `Column_${i + 1}`
    );

    // Convert rows to objects
    const data: Record<string, unknown>[] = [];
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.every(cell => cell === null || cell === undefined || cell === '')) {
        continue; // Skip empty rows
      }

      const rowObj: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        rowObj[header] = row[index];
      });
      data.push(rowObj);
    }

    sheets.push({
      name: sheetName,
      headers,
      data,
      rowCount: data.length,
    });
  }

  return sheets;
}

/**
 * Get unique column values for preview
 */
export function getColumnPreview(sheet: ExcelSheet, column: string, limit = 5): string[] {
  const values = new Set<string>();

  for (const row of sheet.data) {
    const value = row[column];
    if (value !== null && value !== undefined && value !== '') {
      values.add(String(value));
      if (values.size >= limit) break;
    }
  }

  return Array.from(values);
}

/**
 * Parse date from various formats
 */
function parseDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) return value;

  const str = String(value).trim();

  // Try various date formats
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/,                    // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})$/,                  // MM/DD/YYYY
    /^(\d{2})-(\d{2})-(\d{4})$/,                    // MM-DD-YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,              // M/D/YYYY
  ];

  for (const format of formats) {
    const match = str.match(format);
    if (match) {
      if (format === formats[0]) {
        // YYYY-MM-DD
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      } else {
        // MM/DD/YYYY or MM-DD-YYYY or M/D/YYYY
        return new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
      }
    }
  }

  // Try native Date parsing
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;

  // Excel serial number
  const serial = parseFloat(str);
  if (!isNaN(serial) && serial > 0) {
    // Excel dates start from 1899-12-30
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
  }

  return null;
}

/**
 * Parse time string (HH:MM, HH:MM:SS, etc.)
 */
function parseTime(value: unknown): string | null {
  if (!value) return null;

  const str = String(value).trim();

  // Check if it's a time format
  const timeMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2];
    const ampm = timeMatch[4];

    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
      if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
    }

    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  // Excel time (fraction of a day)
  const fraction = parseFloat(str);
  if (!isNaN(fraction) && fraction >= 0 && fraction < 1) {
    const totalMinutes = Math.round(fraction * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  return str;
}

/**
 * Parse number from various formats
 */
function parseNumber(value: unknown, defaultValue = 0): number {
  if (value === null || value === undefined || value === '') return defaultValue;

  const num = parseFloat(String(value).replace(/,/g, ''));
  return isNaN(num) ? defaultValue : num;
}

/**
 * Parse boolean from various formats
 */
function parseBoolean(value: unknown): boolean {
  if (!value) return false;

  const str = String(value).toLowerCase().trim();
  return ['true', 'yes', '1', 'absent', 'y', 'x'].includes(str);
}

/**
 * Company Shift Rules:
 * 
 * 8-5 Shift (clock in ≤ 8:10 AM):
 * - Late: 8:01-8:10 AM = late minutes from 8:00 AM
 * - Undertime: Leave before 5:00 PM
 * - OT: Work 1+ hour beyond 5:00 PM (6:00 PM or later)
 * 
 * 9-6 Shift (clock in > 8:10 AM):
 * - Time in recorded as 9:00 AM
 * - Late: ≤ 9:05 not late, ≥ 9:06 late (from 9:00 AM)
 * - Undertime: Leave before 6:00 PM
 * - OT: Work 1+ hour beyond 6:00 PM (7:00 PM or later)
 */
const SHIFT_CONFIG = {
  // 8-5 Shift: Clock in at or before 8:10 AM
  EARLY_SHIFT: {
    cutoffTime: 8 * 60 + 10,   // 8:10 AM - clock in at or before this = 8-5 shift
    expectedStart: 8 * 60,      // 8:00 AM
    expectedEnd: 17 * 60,       // 5:00 PM
    otThreshold: 18 * 60,       // 6:00 PM - OT starts (1 hour after shift end)
  },
  // 9-6 Shift: Clock in after 8:10 AM
  LATE_SHIFT: {
    graceTime: 9 * 60 + 5,      // 9:05 AM - not late if at or before this
    expectedStart: 9 * 60,      // 9:00 AM
    recordedStart: 9 * 60,      // 9:00 AM - time in recorded as this
    expectedEnd: 18 * 60,       // 6:00 PM
    otThreshold: 19 * 60,       // 7:00 PM - OT starts (1 hour after shift end)
  },
  OT_MINIMUM_MINUTES: 60,       // Must work at least 1 hour beyond shift to get OT
};

/**
 * Detect which shift based on time in
 * - Clock in ≤ 8:10 AM → 8-5 shift
 * - Clock in > 8:10 AM → 9-6 shift
 */
function detectShift(timeIn: string | null): 'EARLY_SHIFT' | 'LATE_SHIFT' {
  if (!timeIn) return 'LATE_SHIFT'; // Default to 9-6 if no time

  const [hours, mins] = timeIn.split(':').map(Number);
  const timeInMinutes = hours * 60 + mins;

  // If clock in at or before 8:10 AM → 8-5 shift
  if (timeInMinutes <= SHIFT_CONFIG.EARLY_SHIFT.cutoffTime) {
    return 'EARLY_SHIFT';
  }

  // Otherwise → 9-6 shift
  return 'LATE_SHIFT';
}

/**
 * Calculate minutes late based on company rules:
 * 
 * 8-5 shift (clock in ≤ 8:10 AM):
 * - 8:00 AM = not late
 * - 8:01-8:10 AM = late (minutes from 8:00 AM)
 * 
 * 9-6 shift (clock in > 8:10 AM):
 * - ≤ 9:05 AM = not late
 * - ≥ 9:06 AM = late (minutes from 9:00 AM)
 */
function calculateLateMinutes(timeIn: string | null): number {
  if (!timeIn) return 0;

  const [hours, mins] = timeIn.split(':').map(Number);
  const timeInMinutes = hours * 60 + mins;

  const shift = detectShift(timeIn);

  if (shift === 'EARLY_SHIFT') {
    // 8-5 shift: Late if clocked in after 8:00 AM (but still ≤ 8:10 AM)
    const diff = timeInMinutes - SHIFT_CONFIG.EARLY_SHIFT.expectedStart;
    return diff > 0 ? diff : 0;
  }

  // 9-6 shift: Check if within grace period (≤ 9:05 AM)
  if (timeInMinutes <= SHIFT_CONFIG.LATE_SHIFT.graceTime) {
    // Within grace period, NOT late
    return 0;
  }

  // Late! Calculate minutes from 9:00 AM
  const diff = timeInMinutes - SHIFT_CONFIG.LATE_SHIFT.expectedStart;
  return diff > 0 ? diff : 0;
}

/**
 * Calculate overtime hours based on company rules:
 * - Must work at least 1 hour beyond scheduled shift end to qualify
 * - Once qualified, OT is calculated from shift end time
 * - 8-5 shift: If clock out at 6:00 PM or later, get OT from 5:00 PM
 * - 9-6 shift: If clock out at 7:00 PM or later, get OT from 6:00 PM
 */
function calculateOvertimeFromShift(timeIn: string | null, timeOut: string | null): number {
  if (!timeIn || !timeOut) return 0;

  const shift = detectShift(timeIn);
  const shiftEnd = SHIFT_CONFIG[shift].expectedEnd;
  const otThreshold = SHIFT_CONFIG[shift].otThreshold;

  const [inHours, inMins] = timeIn.split(':').map(Number);
  const [outHours, outMins] = timeOut.split(':').map(Number);
  const timeInMinutes = inHours * 60 + inMins;
  let timeOutMinutes = outHours * 60 + outMins;

  // Handle overnight shift: if clock out time is earlier than clock in time, it's the next day
  // Example: Clock in 08:00, Clock out 02:00 (next day) = 02:00 + 24hrs = 26:00 (1560 minutes)
  if (timeOutMinutes < timeInMinutes) {
    timeOutMinutes += 24 * 60; // Add 24 hours
  }

  // Must clock out at or after OT threshold to qualify (1 hour beyond shift end)
  if (timeOutMinutes < otThreshold) {
    return 0;
  }

  // Calculate OT from shift end time, not from threshold
  const overtimeMinutes = timeOutMinutes - shiftEnd;
  return Math.round((overtimeMinutes / 60) * 100000) / 100000; // Round to 5 decimals for precision
}

/**
 * Calculate undertime based on company rules:
 * - 8-5 shift: Undertime if leave before 5:00 PM (17:00)
 * - 9-6 shift: Undertime if leave before 6:00 PM (18:00)
 */
function calculateUndertimeFromShift(timeIn: string | null, timeOut: string | null): number {
  if (!timeIn || !timeOut) return 0;

  const shift = detectShift(timeIn);
  const shiftEnd = SHIFT_CONFIG[shift].expectedEnd;

  const [inHours, inMins] = timeIn.split(':').map(Number);
  const [outHours, outMins] = timeOut.split(':').map(Number);
  const timeInMinutes = inHours * 60 + inMins;
  let timeOutMinutes = outHours * 60 + outMins;

  // Handle overnight shift: if clock out time is earlier than clock in time, it's the next day
  // In this case, there's no undertime since they worked past shift end
  if (timeOutMinutes < timeInMinutes) {
    timeOutMinutes += 24 * 60; // Add 24 hours
  }

  // If left before shift end, calculate undertime
  if (timeOutMinutes < shiftEnd) {
    return shiftEnd - timeOutMinutes;
  }

  return 0;
}

/**
 * Calculate minutes between two time strings (HH:MM format)
 */
function calculateMinutesBetween(startTime: string | null, endTime: string | null): number {
  if (!startTime || !endTime) return 0;

  const [startHours, startMins] = startTime.split(':').map(Number);
  const [endHours, endMins] = endTime.split(':').map(Number);

  const startMinutes = startHours * 60 + startMins;
  let endMinutes = endHours * 60 + endMins;

  // Handle overnight shift: if end time is earlier than start time, it's the next day
  // Example: Clock in 08:00, Clock out 02:00 (next day)
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60; // Add 24 hours (1440 minutes)
  }

  const diff = endMinutes - startMinutes;
  return diff > 0 ? diff : 0;
}

/**
 * Calculate overtime hours from OT In and OT Out times
 */
function calculateOvertimeFromOtTimes(otIn: string | null, otOut: string | null): number {
  if (!otIn || !otOut) return 0;

  const diffMinutes = calculateMinutesBetween(otIn, otOut);
  return diffMinutes > 0 ? Math.round((diffMinutes / 60) * 100000) / 100000 : 0;
}

/**
 * Parse status field to determine if absent/late/on leave/offset
 */
function parseStatus(value: unknown): {
  isAbsent: boolean;
  isLate: boolean;
  isOnLeave: boolean;
  leaveType: LeaveType;
} {
  if (!value) return { isAbsent: false, isLate: false, isOnLeave: false, leaveType: null };

  const str = String(value).toLowerCase().trim();

  // Check for Vacation Leave
  if (str === 'vl' || str === 'vacation leave' || str === 'vacation' || str === 'v/l') {
    return { isAbsent: false, isLate: false, isOnLeave: true, leaveType: 'VL' };
  }

  // Check for Sick Leave
  if (str === 'sl' || str === 'sick leave' || str === 'sick' || str === 's/l') {
    return { isAbsent: false, isLate: false, isOnLeave: true, leaveType: 'SL' };
  }

  // Check for Offset (Saturday replacement day off)
  if (str === 'offset' || str === 'off-set' || str === 'off set' || str === 'os') {
    return { isAbsent: false, isLate: false, isOnLeave: true, leaveType: 'OFFSET' };
  }

  // Check for Regular Holiday (from status column)
  // Match exact or partial: "regular holiday", "rh", "regular", or contains "regular holiday"
  if (str === 'regular holiday' || str === 'rh' || str === 'r/h' || str === 'reg holiday' ||
    str.includes('regular holiday') || str.includes('regular non-working')) {
    return { isAbsent: false, isLate: false, isOnLeave: true, leaveType: 'REGULAR_HOLIDAY' };
  }

  // Check for Special Holiday (from status column)
  // Match exact or partial: "special holiday", "sh", "special", or contains "special" with "holiday"/"non-working"
  if (str === 'special holiday' || str === 'sh' || str === 's/h' || str === 'spl holiday' ||
    str.includes('special holiday') || str.includes('special non-working') ||
    (str.includes('special') && (str.includes('holiday') || str.includes('non-working') || str.includes('day')))) {
    return { isAbsent: false, isLate: false, isOnLeave: true, leaveType: 'SPECIAL_HOLIDAY' };
  }

  return {
    isAbsent: str === 'absent' || str === 'a' || str === 'abs' || str === 'awol',
    isLate: str === 'late' || str === 'l' || str === 'tardy',
    isOnLeave: false,
    leaveType: null,
  };
}

/**
 * Auto-detect column mapping based on common header names
 */
export function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};

  // Employee ID is the PRIMARY identifier - these patterns are checked FIRST and are most important
  const patterns: { key: keyof ColumnMapping; patterns: RegExp[] }[] = [
    {
      key: 'employeeId', patterns: [
        /^employee\s*id$/i,      // "Employee ID", "Employee Id"
        /^emp\s*id$/i,           // "Emp ID", "Emp Id" 
        /^employee\s*no\.?$/i,   // "Employee No", "Employee No."
        /^emp\s*no\.?$/i,        // "Emp No", "Emp No."
        /^employee\s*#$/i,       // "Employee #"
        /^emp\s*#$/i,            // "Emp #"
        /^emp\s*code$/i,         // "Emp Code"
        /^id\s*no\.?$/i,         // "ID No", "ID No."
        /^employee\s*code$/i,    // "Employee Code"
        /^staff\s*id$/i,         // "Staff ID"
        /^worker\s*id$/i,        // "Worker ID"
        /^badge\s*no\.?$/i,      // "Badge No"
        /^emp$/i,                // "EMP" (standalone, might be ID)
        /^id$/i,                 // "ID" (standalone)
        /^no\.?$/i,              // "No", "No."
      ]
    },
    {
      key: 'employeeName', patterns: [
        /^name$/i,               // "Name"
        /^user$/i,               // "User"  
        /^employee\s*name$/i,    // "Employee Name"
        /^emp\s*name$/i,         // "Emp Name"
        /^full\s*name$/i,        // "Full Name"
        /^employee$/i,           // "Employee" (if not matched as ID)
        /^staff\s*name$/i,       // "Staff Name"
        /^worker\s*name$/i,      // "Worker Name"
      ]
    },
    { key: 'date', patterns: [/^date$/i, /^attendance.*date$/i, /^work.*date$/i] },
    { key: 'status', patterns: [/^status$/i, /^attendance$/i, /^att.*status$/i] },
    { key: 'timeIn', patterns: [/^time.*in$/i, /^in$/i, /^clock.*in$/i, /^arrival$/i] },
    { key: 'timeOut', patterns: [/^time.*out$/i, /^out$/i, /^clock.*out$/i, /^departure$/i] },
    { key: 'amIn', patterns: [/^am\s*in$/i, /^am-in$/i, /^am_in$/i, /^morning.*in$/i] },
    { key: 'amOut', patterns: [/^am\s*out$/i, /^am-out$/i, /^am_out$/i, /^morning.*out$/i] },
    { key: 'pmIn', patterns: [/^pm\s*in$/i, /^pm-in$/i, /^pm_in$/i, /^afternoon.*in$/i] },
    { key: 'pmOut', patterns: [/^pm\s*out$/i, /^pm-out$/i, /^pm_out$/i, /^afternoon.*out$/i] },
    { key: 'minutesLate', patterns: [/^late$/i, /^minutes.*late$/i, /^late.*min/i, /^tardiness$/i] },
    { key: 'undertimeMinutes', patterns: [/^undertime$/i, /^under.*time$/i, /^early.*out$/i] },
    { key: 'isAbsent', patterns: [/^absent$/i, /^is.*absent$/i, /^absence$/i] },
    { key: 'overtimeHours', patterns: [/^ot$/i, /^overtime$/i, /^ot.*hrs$/i, /^overtime.*hours$/i] },
    { key: 'otIn', patterns: [/^ot\s*in$/i, /^ot-in$/i, /^ot_in$/i, /^overtime.*in$/i] },
    { key: 'otOut', patterns: [/^ot\s*out$/i, /^ot-out$/i, /^ot_out$/i, /^overtime.*out$/i] },
    { key: 'holidayPay', patterns: [/^holiday$/i, /^holiday.*pay$/i, /^hol.*pay$/i] },
    { key: 'remarks', patterns: [/^remarks$/i, /^notes$/i, /^comment$/i] },
  ];

  for (const header of headers) {
    // Normalize: remove extra spaces, convert to lowercase for comparison
    const normalizedHeader = header.trim().replace(/[\s_-]+/g, ' ').toLowerCase();

    for (const { key, patterns: patternList } of patterns) {
      if (mapping[key]) continue; // Already mapped

      for (const pattern of patternList) {
        // Check both original header (trimmed) and normalized header
        if (pattern.test(header.trim()) || pattern.test(normalizedHeader)) {
          mapping[key] = header;
          break;
        }
      }
    }
  }

  return mapping;
}

/**
 * Apply column mapping to parse timesheet data
 */
export function parseTimesheetData(
  sheet: ExcelSheet,
  mapping: ColumnMapping
): ParsedTimesheetRow[] {
  const rows: ParsedTimesheetRow[] = [];

  sheet.data.forEach((rawRow, index) => {
    const errors: string[] = [];

    // Extract employee identifier
    let employeeId: string | undefined;
    let employeeName: string | undefined;

    if (mapping.employeeId && rawRow[mapping.employeeId]) {
      employeeId = String(rawRow[mapping.employeeId]).trim();
    }
    if (mapping.employeeName && rawRow[mapping.employeeName]) {
      employeeName = String(rawRow[mapping.employeeName]).trim();
    }

    if (!employeeId && !employeeName) {
      errors.push('Missing employee identifier');
    }

    // Parse date
    const date = mapping.date ? parseDate(rawRow[mapping.date]) : null;
    if (!date && mapping.date) {
      errors.push('Invalid or missing date');
    }

    // Parse all time columns for multiple clock-in/out support
    // Scenario: Employee clocks in at 8 AM, out at 10 AM (break), in at 11 AM, out at 5 PM
    const amIn = mapping.amIn && rawRow[mapping.amIn] ? parseTime(rawRow[mapping.amIn]) : null;
    const amOut = mapping.amOut && rawRow[mapping.amOut] ? parseTime(rawRow[mapping.amOut]) : null;
    const pmIn = mapping.pmIn && rawRow[mapping.pmIn] ? parseTime(rawRow[mapping.pmIn]) : null;
    const pmOut = mapping.pmOut && rawRow[mapping.pmOut] ? parseTime(rawRow[mapping.pmOut]) : null;

    // Also check for single Time In/Out columns
    const singleTimeIn = mapping.timeIn && rawRow[mapping.timeIn] ? parseTime(rawRow[mapping.timeIn]) : null;
    const singleTimeOut = mapping.timeOut && rawRow[mapping.timeOut] ? parseTime(rawRow[mapping.timeOut]) : null;

    // Determine the first time in (for late calculation) and last time out (for OT calculation)
    // Priority: Use AM In/PM Out if available, otherwise use single Time In/Out
    // Note: rawTimeIn is the actual clock-in time, used for display and calculations
    // The adjusted time (9:00 AM for 9-6 shift) is only used internally for late calculation
    let rawTimeIn: string | null = amIn || singleTimeIn;
    let timeOut: string | null = pmOut || singleTimeOut;

    // Calculate total hours worked when multiple clock-ins exist
    let totalWorkedMinutes = 0;
    let hasMultipleClockIns = false;

    if (amIn && amOut && pmIn && pmOut) {
      // Full multiple clock-in scenario: AM session + PM session
      hasMultipleClockIns = true;
      const amWorkedMinutes = calculateMinutesBetween(amIn, amOut);
      const pmWorkedMinutes = calculateMinutesBetween(pmIn, pmOut);
      totalWorkedMinutes = amWorkedMinutes + pmWorkedMinutes;
    } else if (amIn && amOut && pmIn && !pmOut) {
      // AM session complete, PM session started but no clock out yet - use PM In as last
      hasMultipleClockIns = true;
      const amWorkedMinutes = calculateMinutesBetween(amIn, amOut);
      totalWorkedMinutes = amWorkedMinutes;
      timeOut = amOut; // Last recorded out
    } else if (amIn && pmOut && !amOut && !pmIn) {
      // Simple case: AM In and PM Out only (like Time In / Time Out)
      totalWorkedMinutes = calculateMinutesBetween(amIn, pmOut);
    } else if (singleTimeIn && singleTimeOut) {
      // Single Time In/Out
      totalWorkedMinutes = calculateMinutesBetween(singleTimeIn, singleTimeOut);
    }

    // Parse status (absent/late/present/on leave)
    let status = mapping.status ? parseStatus(rawRow[mapping.status]) : { isAbsent: false, isLate: false, isOnLeave: false, leaveType: null };

    // FALLBACK: Check "Email" column for status/remarks if standard status column yields nothing
    // This handles cases where users mistakenly put "Special Holiday" or "Absent" in the Email column
    if (!status.isAbsent && !status.isLate && !status.isOnLeave) {
      const emailHeader = sheet.headers.find(h => /email/i.test(h));
      if (emailHeader) {
        const emailStatus = parseStatus(rawRow[emailHeader]);
        if (emailStatus.isAbsent || emailStatus.isLate || emailStatus.isOnLeave) {
          status = emailStatus;
        }
      }
    }

    // Determine if on leave (VL or SL) - these are PAID days
    const isOnLeave = status.isOnLeave;
    const leaveType = status.leaveType;

    // Determine if absent - from status column or isAbsent column
    // Note: VL/SL are NOT absences - they are paid leave
    let isAbsent = status.isAbsent;
    if (!isAbsent && !isOnLeave && mapping.isAbsent) {
      isAbsent = parseBoolean(rawRow[mapping.isAbsent]);
    }

    // Calculate minutes late
    // Note: No late calculation for employees on leave
    // Use rawTimeIn (actual clock in time) for late calculation
    // Calculate minutes late
    // Note: No late calculation for employees on pure leave (VL, SL, OFFSET)
    // But DO calculate late for holidays if they key in (it means they worked)
    // Use rawTimeIn (actual clock in time) for late calculation
    let minutesLate = 0;
    if (!isOnLeave || leaveType === 'SPECIAL_HOLIDAY' || leaveType === 'REGULAR_HOLIDAY') {
      // Check if Excel has a valid numeric late value (not "-" or empty)
      // ... (rest of the block is unchanged, just the condition above)
      // Could be in minutes (number) or time format (h:mm or 0:mm)
      const excelLateValue = mapping.minutesLate ? rawRow[mapping.minutesLate] : null;
      let parsedExcelLate = NaN;

      if (excelLateValue !== null && excelLateValue !== undefined && excelLateValue !== '') {
        const lateStr = String(excelLateValue).trim();

        // Check if it's a time string format (h:mm or hh:mm)
        const timeMatch = lateStr.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          // Parse as hours:minutes → convert to total minutes
          parsedExcelLate = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
        } else {
          // Try parsing as number (minutes)
          const numValue = parseFloat(lateStr.replace(/,/g, ''));
          if (!isNaN(numValue)) {
            // If value is small (< 1), it's likely Excel time fraction
            // Convert to minutes by multiplying by 24 * 60
            if (numValue > 0 && numValue < 1) {
              parsedExcelLate = Math.round(numValue * 24 * 60);
            } else {
              parsedExcelLate = numValue;
            }
          }
        }
      }

      if (!isNaN(parsedExcelLate) && parsedExcelLate > 0) {
        // Use explicit late minutes from Excel only if it's a positive number
        minutesLate = parsedExcelLate;
      } else if (rawTimeIn && !isAbsent) {
        // Auto-calculate late based on actual clock in time
        minutesLate = calculateLateMinutes(rawTimeIn);
      }
    }

    // Calculate overtime hours
    // Standard work day = 8 hours (480 minutes)
    const STANDARD_WORK_MINUTES = 8 * 60; // 480 minutes

    let overtimeHours = 0;
    // Check if Excel has a valid positive overtime value (not "-", empty, or 0)
    // ... (rest of OT block) ... 
    // Excel time format (1:00) is stored as fraction of day (1/24 = 0.04166...)
    // String time format "01:00" or "1:00" needs to be parsed as hours:minutes
    const excelOtValue = mapping.overtimeHours ? rawRow[mapping.overtimeHours] : null;
    let parsedExcelOt = NaN;

    if (excelOtValue !== null && excelOtValue !== undefined && excelOtValue !== '') {
      const otStr = String(excelOtValue).trim();

      // Check if it's a time string format (h:mm or hh:mm)
      const timeMatch = otStr.match(/^(\d{1,2}):(\d{2})$/);
      if (timeMatch) {
        // Parse as hours:minutes → convert to decimal hours
        parsedExcelOt = parseInt(timeMatch[1]) + parseInt(timeMatch[2]) / 60;
      } else {
        // Try parsing as decimal number
        const numValue = parseFloat(otStr.replace(/,/g, ''));
        if (!isNaN(numValue)) {
          // If value is small (< 1), it's likely Excel time fraction (1:00 = 1/24 = 0.04166)
          // Convert to hours by multiplying by 24
          if (numValue > 0 && numValue < 1) {
            parsedExcelOt = numValue * 24; // Convert from day fraction to hours
          } else {
            parsedExcelOt = numValue;
          }
        }
      }
    }

    // Determine if OT should be calculated - allow OT for holidays (SPECIAL_HOLIDAY, REGULAR_HOLIDAY)
    // Only skip OT for VL, SL, OFFSET (pure leave days) and absences
    const shouldCalculateOT = !isAbsent && (!isOnLeave || leaveType === 'SPECIAL_HOLIDAY' || leaveType === 'REGULAR_HOLIDAY');

    if (!isNaN(parsedExcelOt) && parsedExcelOt > 0) {
      // Use explicit overtime hours from Excel only if it's a positive number
      overtimeHours = Math.round(parsedExcelOt * 100000) / 100000; // Round to 5 decimals
    } else if (mapping.otIn && mapping.otOut && rawRow[mapping.otIn] && rawRow[mapping.otOut]) {
      // Calculate from OT In/Out times if provided
      const otIn = parseTime(rawRow[mapping.otIn]);
      const otOut = parseTime(rawRow[mapping.otOut]);
      overtimeHours = calculateOvertimeFromOtTimes(otIn, otOut);
    } else if (hasMultipleClockIns && totalWorkedMinutes > 0 && shouldCalculateOT) {
      // Multiple clock-ins scenario: OT = total worked minutes - 8 hours
      // But must work at least 1 hour beyond shift to get OT
      const overtimeMinutes = totalWorkedMinutes - STANDARD_WORK_MINUTES;
      if (overtimeMinutes >= SHIFT_CONFIG.OT_MINIMUM_MINUTES) {
        overtimeHours = Math.round((overtimeMinutes / 60) * 100000) / 100000;
      }
    } else if (rawTimeIn && timeOut && shouldCalculateOT) {
      // Single clock-in scenario: Use rawTimeIn for shift detection
      // 8-5 shift: OT if clock out at 6:00 PM or later
      // 9-6 shift: OT if clock out at 7:00 PM or later
      overtimeHours = calculateOvertimeFromShift(rawTimeIn, timeOut);
    }

    // Calculate undertime (if left early based on shift)
    // 8-5 shift: Undertime if leave before 5:00 PM
    // 9-6 shift: Undertime if leave before 6:00 PM
    let undertimeMinutes = 0;
    // Check if Excel has a valid numeric undertime value (not "-" or empty)
    // Could be in minutes (number) or time format (h:mm)
    const excelUtValue = mapping.undertimeMinutes ? rawRow[mapping.undertimeMinutes] : null;
    let parsedExcelUt = NaN;

    if (excelUtValue !== null && excelUtValue !== undefined && excelUtValue !== '') {
      const utStr = String(excelUtValue).trim();

      // Check if it's a time string format (h:mm or hh:mm)
      const timeMatch = utStr.match(/^(\d{1,2}):(\d{2})$/);
      if (timeMatch) {
        // Parse as hours:minutes → convert to total minutes
        parsedExcelUt = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
      } else {
        // Try parsing as number (minutes)
        const numValue = parseFloat(utStr.replace(/,/g, ''));
        if (!isNaN(numValue)) {
          // If value is small (< 1), it's likely Excel time fraction
          // Convert to minutes by multiplying by 24 * 60
          if (numValue > 0 && numValue < 1) {
            parsedExcelUt = Math.round(numValue * 24 * 60);
          } else {
            parsedExcelUt = numValue;
          }
        }
      }
    }

    // Don't calculate undertime for leave days (VL, SL, OFFSET) - BUT allow for holidays
    const shouldCalculateUndertime = !isAbsent && (!isOnLeave || leaveType === 'SPECIAL_HOLIDAY' || leaveType === 'REGULAR_HOLIDAY');

    if (!isNaN(parsedExcelUt) && parsedExcelUt > 0) {
      // Use explicit undertime from Excel only if it's a positive number
      undertimeMinutes = parsedExcelUt;
    } else if (hasMultipleClockIns && totalWorkedMinutes > 0 && totalWorkedMinutes < STANDARD_WORK_MINUTES && shouldCalculateUndertime) {
      // Multiple clock-ins: undertime if total worked < 8 hours
      undertimeMinutes = STANDARD_WORK_MINUTES - totalWorkedMinutes;
    } else if (rawTimeIn && timeOut && shouldCalculateUndertime) {
      // Single clock-in scenario: Calculate undertime based on shift end time
      undertimeMinutes = calculateUndertimeFromShift(rawTimeIn, timeOut);
    }

    // Calculate hours worked (for special holiday pay calculation)
    // Use actual clock in time, not adjusted
    // For holidays, we need hours worked to calculate 30% pay
    let hoursWorked = 0;
    if (hasMultipleClockIns && totalWorkedMinutes > 0) {
      hoursWorked = Math.round((totalWorkedMinutes / 60) * 100000) / 100000;
    } else if (rawTimeIn && timeOut && !isAbsent) {
      // Calculate hours worked for holidays and regular days
      const workedMinutes = calculateMinutesBetween(rawTimeIn, timeOut);
      hoursWorked = Math.round((workedMinutes / 60) * 100000) / 100000;
    }

    // Parse other fields
    const row: ParsedTimesheetRow = {
      rowIndex: index + 2, // +2 for 1-based index and header row
      employeeId,
      employeeName,
      date: date || undefined,
      timeIn: rawTimeIn || undefined,  // Use actual time, not adjusted
      timeOut: timeOut || undefined,
      hoursWorked: hoursWorked > 0 ? hoursWorked : undefined,
      minutesLate,
      undertimeMinutes,
      isAbsent,
      isOnLeave,         // VL or SL - paid leave
      leaveType,         // 'VL' or 'SL' or null
      overtimeHours,
      holidayPay: mapping.holidayPay ? parseNumber(rawRow[mapping.holidayPay]) : 0,
      remarks: mapping.remarks ? String(rawRow[mapping.remarks] || '') : undefined,
      rawData: rawRow,
      errors,
    };

    rows.push(row);
  });

  return rows;
}

/**
 * Validate timesheet data against masterlist and cutoff period
 */
export function validateTimesheetData(
  rows: ParsedTimesheetRow[],
  employeeMasterlist: Array<{ id: string; employeeNo: string; name: string; status: string }>,
  cutoffStart: Date,
  cutoffEnd: Date
): TimesheetValidationResult {
  const validRows: ParsedTimesheetRow[] = [];
  const invalidRows: ParsedTimesheetRow[] = [];
  const unrecognizedEmployees: Array<{ identifier: string; row: ParsedTimesheetRow }> = [];

  // Create lookup maps - Employee ID is PRIMARY identifier
  const employeeByNo = new Map(employeeMasterlist.map(e => [e.employeeNo.toLowerCase(), e]));
  const employeeByFullName = new Map(employeeMasterlist.map(e => [e.name.toLowerCase(), e]));

  // Extract first names for fallback matching (e.g., "Garcia, Reymart" -> "reymart")
  const employeeByFirstName = new Map<string, typeof employeeMasterlist[0]>();
  for (const emp of employeeMasterlist) {
    // Name format is "LastName, FirstName MiddleName"
    const parts = emp.name.split(',');
    if (parts.length >= 2) {
      const firstName = parts[1].trim().split(' ')[0].toLowerCase();
      employeeByFirstName.set(firstName, emp);
    }
  }

  const foundEmployeeIds = new Set<string>();

  // Check date range
  let dateRangeValid = true;
  let dateRangeError: string | undefined;

  for (const row of rows) {
    if (row.errors.length > 0) {
      invalidRows.push(row);
      continue;
    }

    // Match employee - Employee ID is PRIMARY
    let matchedEmployee: typeof employeeMasterlist[0] | undefined;

    // PRIMARY: Match by Employee ID
    if (row.employeeId) {
      matchedEmployee = employeeByNo.get(row.employeeId.toLowerCase().trim());
    }

    // FALLBACK: Match by name if Employee ID not found
    if (!matchedEmployee && row.employeeName) {
      const nameLower = row.employeeName.toLowerCase().trim();
      matchedEmployee = employeeByFirstName.get(nameLower) ||  // "Reymart"
        employeeByFullName.get(nameLower);      // "Garcia, Reymart"
    }

    if (!matchedEmployee) {
      const identifier = row.employeeId || row.employeeName || 'Unknown';
      unrecognizedEmployees.push({ identifier, row });
      continue;
    }

    if (matchedEmployee.status !== 'ACTIVE') {
      row.errors.push(`Employee ${matchedEmployee.employeeNo} is not active`);
      invalidRows.push(row);
      continue;
    }

    // Validate date is within cutoff
    if (row.date) {
      const rowDate = new Date(row.date);
      rowDate.setHours(0, 0, 0, 0);

      const start = new Date(cutoffStart);
      start.setHours(0, 0, 0, 0);

      const end = new Date(cutoffEnd);
      end.setHours(23, 59, 59, 999);

      if (rowDate < start || rowDate > end) {
        dateRangeValid = false;
        dateRangeError = `Date ${row.date.toLocaleDateString()} is outside cutoff period (${cutoffStart.toLocaleDateString()} - ${cutoffEnd.toLocaleDateString()})`;
        row.errors.push(dateRangeError);
        invalidRows.push(row);
        continue;
      }
    }

    foundEmployeeIds.add(matchedEmployee.id);
    validRows.push(row);
  }

  // Find missing employees (active employees not in import)
  const missingEmployees = employeeMasterlist
    .filter(e => e.status === 'ACTIVE' && !foundEmployeeIds.has(e.id))
    .map(e => e.employeeNo);

  return {
    validRows,
    invalidRows,
    missingEmployees,
    unrecognizedEmployees,
    dateRangeValid: dateRangeValid && unrecognizedEmployees.length === 0,
    dateRangeError,
  };
}

/**
 * Generate sample Excel template
 */
export function generateSampleTemplate(): ArrayBuffer {
  const sampleData = [
    {
      'Employee ID': 'EMP-001',
      'Employee Name': 'Juan Dela Cruz',
      'Date': '2024-01-16',
      'Time In': '08:00',
      'Time Out': '17:00',
      'Minutes Late': 0,
      'Undertime Minutes': 0,
      'Absent': '',
      'Overtime Hours': 0,
      'Holiday Pay': 0,
      'Remarks': '',
    },
    {
      'Employee ID': 'EMP-001',
      'Employee Name': 'Juan Dela Cruz',
      'Date': '2024-01-17',
      'Time In': '08:15',
      'Time Out': '17:00',
      'Minutes Late': 15,
      'Undertime Minutes': 0,
      'Absent': '',
      'Overtime Hours': 0,
      'Holiday Pay': 0,
      'Remarks': '',
    },
    {
      'Employee ID': 'EMP-002',
      'Employee Name': 'Maria Santos',
      'Date': '2024-01-16',
      'Time In': '',
      'Time Out': '',
      'Minutes Late': 0,
      'Undertime Minutes': 0,
      'Absent': 'Yes',
      'Overtime Hours': 0,
      'Holiday Pay': 0,
      'Remarks': 'Sick leave',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Timesheet');

  // Set column widths
  worksheet['!cols'] = [
    { wch: 12 }, // Employee ID
    { wch: 20 }, // Employee Name
    { wch: 12 }, // Date
    { wch: 10 }, // Time In
    { wch: 10 }, // Time Out
    { wch: 14 }, // Minutes Late
    { wch: 18 }, // Undertime Minutes
    { wch: 8 },  // Absent
    { wch: 14 }, // Overtime Hours
    { wch: 12 }, // Holiday Pay
    { wch: 20 }, // Remarks
  ];

  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return buffer;
}
