import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, canManagePayroll } from '@/lib/auth';

export const dynamic = 'force-dynamic';
import {
  parseExcelFile,
  parseTimesheetData,
  validateTimesheetData,
  ColumnMapping,
} from '@/lib/excel-parser';
import {
  calculatePayslip,
  calculateAttendanceSummary,
  getCutoffPeriod,
  getEligibleWorkdays,
  isSunday,
  AttendanceSummary,
  HolidayData,
} from '@/lib/payroll-calculator';
import { generateReferenceNo } from '@/lib/utils';
import { CutoffType } from '@prisma/client';

// Helper to get attendance from the other cutoff of the same month
async function getOtherCutoffAttendance(
  employeeId: string,
  year: number,
  month: number,
  currentCutoffType: CutoffType
): Promise<AttendanceSummary | undefined> {
  const otherCutoffType = currentCutoffType === CutoffType.FIRST_HALF
    ? CutoffType.SECOND_HALF
    : CutoffType.FIRST_HALF;

  // Find the other payroll run for the same month
  const otherPayrollRun = await prisma.payrollRun.findFirst({
    where: {
      year,
      month,
      cutoffType: otherCutoffType,
    },
  });

  if (!otherPayrollRun) {
    return undefined;
  }

  // Get timesheet entries from the other cutoff
  const otherEntries = await prisma.timesheetEntry.findMany({
    where: {
      payrollRunId: otherPayrollRun.id,
      employeeId,
    },
  });

  if (otherEntries.length === 0) {
    return undefined;
  }

  const eligibleWorkdays = getEligibleWorkdays(year, month, otherCutoffType);
  return calculateAttendanceSummary(otherEntries, eligibleWorkdays);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sheetName = formData.get('sheetName') as string;
    const mappingJson = formData.get('mapping') as string;
    const payrollRunId = formData.get('payrollRunId') as string;

    if (!file || !sheetName || !mappingJson || !payrollRunId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const mapping: ColumnMapping = JSON.parse(mappingJson);

    // Get payroll run
    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
    });

    if (!payrollRun) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    if (payrollRun.status === 'FINALIZED') {
      return NextResponse.json(
        { error: 'Cannot import to a finalized payroll run' },
        { status: 400 }
      );
    }

    // Parse Excel
    const buffer = await file.arrayBuffer();
    const sheets = parseExcelFile(buffer);
    const sheet = sheets.find(s => s.name === sheetName);

    if (!sheet) {
      return NextResponse.json({ error: 'Sheet not found' }, { status: 400 });
    }

    // Parse timesheet data with mapping
    const parsedRows = parseTimesheetData(sheet, mapping);

    // Get employee masterlist
    const employees = await prisma.employee.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        employeeNo: true,
        firstName: true,
        lastName: true,
        middleName: true,
        status: true,
      },
    });

    const employeeMasterlist = employees.map(e => ({
      id: e.id,
      employeeNo: e.employeeNo,
      name: `${e.lastName}, ${e.firstName} ${e.middleName || ''}`.trim(),
      status: e.status,
    }));

    // Validate
    const validation = validateTimesheetData(
      parsedRows,
      employeeMasterlist,
      payrollRun.cutoffStart,
      payrollRun.cutoffEnd
    );

    return NextResponse.json({
      validRows: validation.validRows.length,
      invalidRows: validation.invalidRows,
      missingEmployees: validation.missingEmployees,
      unrecognizedEmployees: validation.unrecognizedEmployees,
      dateRangeValid: validation.dateRangeValid,
      dateRangeError: validation.dateRangeError,
    });
  } catch (error) {
    console.error('Process import error:', error);
    return NextResponse.json({ error: 'Failed to process import' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !canManagePayroll(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sheetName = formData.get('sheetName') as string;
    const mappingJson = formData.get('mapping') as string;
    const payrollRunId = formData.get('payrollRunId') as string;

    if (!file || !sheetName || !mappingJson || !payrollRunId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const mapping: ColumnMapping = JSON.parse(mappingJson);

    // Get payroll run
    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
    });

    if (!payrollRun) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    if (payrollRun.status === 'FINALIZED') {
      return NextResponse.json(
        { error: 'Cannot import to a finalized payroll run' },
        { status: 400 }
      );
    }

    // Parse Excel
    const buffer = await file.arrayBuffer();
    const sheets = parseExcelFile(buffer);
    const sheet = sheets.find(s => s.name === sheetName);

    if (!sheet) {
      return NextResponse.json({ error: 'Sheet not found' }, { status: 400 });
    }

    // Parse timesheet data
    const parsedRows = parseTimesheetData(sheet, mapping);

    // Get all employees
    const employees = await prisma.employee.findMany({
      where: { deletedAt: null },
    });

    // Primary lookup: by Employee ID (employeeNo) - THIS IS THE MAIN IDENTIFIER
    const employeeByNo = new Map(employees.map(e => [e.employeeNo.toLowerCase(), e]));

    // Secondary lookups for fallback matching
    const employeeByFirstName = new Map(employees.map(e => [e.firstName.toLowerCase(), e]));
    const employeeByFullName = new Map(employees.map(e => [
      `${e.lastName}, ${e.firstName} ${e.middleName || ''}`.trim().toLowerCase(), e
    ]));
    const employeeByFirstLastName = new Map(employees.map(e => [
      `${e.firstName} ${e.lastName}`.toLowerCase(), e
    ]));

    // Get settings
    // Get settings from PayrollRun (snapshot) or fall back to global settings/defaults
    const settings = await prisma.setting.findMany();
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

    const payrollSettings = {
      govDeductionMode: (payrollRun.govDeductionMode || settingsMap.gov_deduction_mode || 'fixed_per_cutoff') as 'fixed_per_cutoff' | 'prorated_by_days',
      standardDailyHours: payrollRun.standardDailyHours || parseInt(settingsMap.standard_daily_hours || '8'),
    };

    // Get holidays for this payroll period
    const holidays = await prisma.holiday.findMany({
      where: {
        year: payrollRun.year,
      },
    });
    const holidayData: HolidayData[] = holidays.map(h => ({
      date: h.date,
      type: h.type,
      name: h.name,
    }));

    // Delete existing timesheet entries for this payroll run
    await prisma.timesheetEntry.deleteMany({
      where: { payrollRunId },
    });

    // Group rows by employee
    const employeeEntries = new Map<string, typeof parsedRows>();

    for (const row of parsedRows) {
      if (row.errors.length > 0) continue;

      let employee;

      // PRIMARY: Match by Employee ID (most reliable)
      if (row.employeeId) {
        employee = employeeByNo.get(row.employeeId.toLowerCase().trim());
      }

      // FALLBACK: Match by name if Employee ID not found
      if (!employee && row.employeeName) {
        const nameLower = row.employeeName.toLowerCase().trim();
        // Try different name formats
        employee = employeeByFirstName.get(nameLower) ||      // "Reymart"
          employeeByFirstLastName.get(nameLower) ||   // "Reymart Garcia"
          employeeByFullName.get(nameLower);          // "Garcia, Reymart"
      }

      if (!employee || employee.status !== 'ACTIVE') continue;

      const entries = employeeEntries.get(employee.id) || [];
      entries.push(row);
      employeeEntries.set(employee.id, entries);
    }

    // Create timesheet entries and update payslips
    const importedEmployeeIds = new Set<string>();

    for (const [employeeId, rows] of Array.from(employeeEntries.entries())) {
      const employee = employees.find(e => e.id === employeeId)!;
      importedEmployeeIds.add(employeeId);

      // Create timesheet entries
      for (const row of rows) {
        if (!row.date) continue;

        // Skip Sundays
        if (isSunday(row.date)) continue;

        await prisma.timesheetEntry.upsert({
          where: {
            payrollRunId_employeeId_date: {
              payrollRunId,
              employeeId,
              date: row.date,
            },
          },
          create: {
            payrollRunId,
            employeeId,
            date: row.date,
            timeIn: row.timeIn || null,
            timeOut: row.timeOut || null,
            hoursWorked: row.hoursWorked || null,
            minutesLate: row.minutesLate || 0,
            undertimeMinutes: row.undertimeMinutes || 0,
            isAbsent: row.isAbsent || false,
            isOnLeave: row.isOnLeave || false,    // VL or SL
            leaveType: row.leaveType || null,      // 'VL' or 'SL'
            overtimeHours: row.overtimeHours || 0,
            holidayPay: row.holidayPay || 0,
            remarks: row.remarks || null,
            rawData: row.rawData as any,
          },
          update: {
            timeIn: row.timeIn || null,
            timeOut: row.timeOut || null,
            hoursWorked: row.hoursWorked || null,
            minutesLate: row.minutesLate || 0,
            undertimeMinutes: row.undertimeMinutes || 0,
            isAbsent: row.isAbsent || false,
            isOnLeave: row.isOnLeave || false,    // VL or SL
            leaveType: row.leaveType || null,      // 'VL' or 'SL'
            overtimeHours: row.overtimeHours || 0,
            holidayPay: row.holidayPay || 0,
            remarks: row.remarks || null,
            rawData: row.rawData as any,
          },
        });
      }

      // Get all timesheet entries for recalculation
      const timesheetEntries = await prisma.timesheetEntry.findMany({
        where: { payrollRunId, employeeId },
      });

      // Get the other cutoff's attendance for monthly KPI voiding calculation
      const otherCutoffAttendance = await getOtherCutoffAttendance(
        employeeId,
        payrollRun.year,
        payrollRun.month,
        payrollRun.cutoffType
      );

      // Recalculate payslip (with monthly attendance for KPI voiding and holidays)
      const calculation = calculatePayslip(
        employee,
        timesheetEntries,
        payrollRun.year,
        payrollRun.month,
        payrollRun.cutoffType,
        parseFloat(String(employee.defaultKpi)),
        payrollSettings,
        {},
        otherCutoffAttendance,  // Pass other cutoff's attendance for monthly KPI check
        holidayData             // Pass holidays for holiday pay calculation
      );

      // Update or create payslip
      await prisma.payslip.upsert({
        where: {
          payrollRunId_employeeId: { payrollRunId, employeeId },
        },
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
          // KPI voiding (monthly)
          lateCount: calculation.attendance.lateCount,
          absentCount: calculation.attendance.absentCount,
          monthlyLateCount: calculation.monthlyAttendance.lateCount,
          monthlyAbsentCount: calculation.monthlyAttendance.absentCount,
          kpiVoided: calculation.kpiVoided,
          kpiVoidReason: calculation.kpiVoidReason,
          // Earnings
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
          computationBreakdown: calculation.computationBreakdown as any,
          isMissing: false,
        },
        update: {
          eligibleWorkdays: calculation.attendance.eligibleWorkdays,
          presentDays: calculation.attendance.presentDays,
          absentDays: calculation.attendance.absentDays,
          totalLateMinutes: calculation.attendance.totalLateMinutes,
          totalUndertimeMinutes: calculation.attendance.totalUndertimeMinutes,
          totalOvertimeHours: calculation.attendance.totalOvertimeHours,
          // KPI voiding (monthly)
          lateCount: calculation.attendance.lateCount,
          absentCount: calculation.attendance.absentCount,
          monthlyLateCount: calculation.monthlyAttendance.lateCount,
          monthlyAbsentCount: calculation.monthlyAttendance.absentCount,
          kpiVoided: calculation.kpiVoided,
          kpiVoidReason: calculation.kpiVoidReason,
          // Earnings & deductions
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
          computationBreakdown: calculation.computationBreakdown as any,
          isMissing: false,
        },
      });
    }

    // Mark employees not in import as missing
    await prisma.payslip.updateMany({
      where: {
        payrollRunId,
        employeeId: { notIn: Array.from(importedEmployeeIds) },
      },
      data: { isMissing: true },
    });

    // Save import history
    await prisma.importHistory.create({
      data: {
        payrollRunId,
        fileName: file.name,
        sheetName,
        columnMapping: mapping as any,
        totalRows: parsedRows.length,
        successRows: importedEmployeeIds.size,
        errorRows: parsedRows.filter(r => r.errors.length > 0).length,
        importedBy: session.userId,
      },
    });

    return NextResponse.json({
      success: true,
      imported: importedEmployeeIds.size,
      total: parsedRows.length,
    });
  } catch (error) {
    console.error('Finalize import error:', error);
    return NextResponse.json({ error: 'Failed to finalize import' }, { status: 500 });
  }
}
