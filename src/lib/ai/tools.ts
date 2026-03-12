import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { tool } from 'ai';

export const aiTools = {

  // ─── EMPLOYEE READ ────────────────────────────────────────────────────────

  searchEmployees: tool({
    description: 'Search for employees by name or employee number.',
    parameters: z.object({
      query: z.string().describe('The name or employee number to search for'),
    }),
    execute: async ({ query }: any) => {
      const employees = await prisma.employee.findMany({
        where: {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { employeeNo: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          employeeNo: true,
          firstName: true,
          lastName: true,
          department: true,
          position: true,
          status: true,
        },
        take: 10,
      });
      return employees;
    },
  }),

  getEmployeeDetails: tool({
    description: 'Get full details of a specific employee including deductions and loans.',
    parameters: z.object({
      employeeId: z.string().describe('The database ID of the employee'),
    }),
    execute: async ({ employeeId }: any) => {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          user: { select: { email: true, role: true } },
        },
      });
      return employee;
    },
  }),

  listEmployeesWithPay: tool({
    description: 'Get a list of active employees with their pay and department.',
    parameters: z.object({
      department: z.string().optional().describe('Filter by department (optional)'),
    }),
    execute: async ({ department }: any) => {
      const employees = await prisma.employee.findMany({
        where: {
          status: 'ACTIVE',
          ...(department ? { department: { contains: department, mode: 'insensitive' } } : {}),
        },
        select: {
          id: true,
          employeeNo: true,
          firstName: true,
          lastName: true,
          department: true,
          position: true,
          dailyRate: true,
          monthlySalary: true,
          basicPayPerCutoff: true,
          sssContribution: true,
          philhealthContribution: true,
          pagibigContribution: true,
        },
        orderBy: { lastName: 'asc' },
      });
      return employees;
    },
  }),

  // ─── EMPLOYEE WRITE ───────────────────────────────────────────────────────

  createEmployee: tool({
    description: 'Create a new employee. Collect firstName, lastName, department, position, and dailyRate before calling. Ask for any missing required fields.',
    parameters: z.object({
      firstName: z.string(),
      lastName: z.string(),
      middleName: z.string().optional(),
      department: z.string(),
      position: z.string(),
      dailyRate: z.number().describe('Daily rate in PHP'),
      monthlySalary: z.number().optional().default(0),
      sssContribution: z.number().optional().default(0),
      philhealthContribution: z.number().optional().default(0),
      pagibigContribution: z.number().optional().default(0),
      startDate: z.string().optional().describe('ISO date e.g. 2024-01-15'),
      notes: z.string().optional(),
    }),
    execute: async (params: any) => {
      const lastEmployee = await prisma.employee.findFirst({
        orderBy: { employeeNo: 'desc' },
        select: { employeeNo: true },
      });
      let nextNum = 1;
      if (lastEmployee?.employeeNo) {
        const match = lastEmployee.employeeNo.match(/\d+$/);
        if (match) nextNum = parseInt(match[0]) + 1;
      }
      const employeeNo = `EMP-${String(nextNum).padStart(3, '0')}`;

      const employee = await prisma.employee.create({
        data: {
          employeeNo,
          firstName: params.firstName,
          lastName: params.lastName,
          middleName: params.middleName ?? null,
          department: params.department,
          position: params.position,
          rateType: 'DAILY',
          dailyRate: params.dailyRate,
          monthlySalary: params.monthlySalary ?? 0,
          basicPayPerCutoff: null,
          sssContribution: params.sssContribution ?? 0,
          philhealthContribution: params.philhealthContribution ?? 0,
          pagibigContribution: params.pagibigContribution ?? 0,
          defaultKpi: 0,
          startDate: params.startDate ? new Date(params.startDate) : null,
          notes: params.notes ?? null,
          status: 'ACTIVE',
        },
        select: {
          id: true, employeeNo: true, firstName: true, lastName: true,
          department: true, position: true, dailyRate: true, monthlySalary: true, status: true,
        },
      });
      return { success: true, employee };
    },
  }),

  updateEmployee: tool({
    description: 'Update an existing employee\'s details. Use searchEmployees first to get the employee ID. Confirm changes with user before calling.',
    parameters: z.object({
      employeeId: z.string().describe('Database ID of the employee'),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      middleName: z.string().optional().nullable(),
      department: z.string().optional(),
      position: z.string().optional(),
      dailyRate: z.number().optional(),
      monthlySalary: z.number().optional(),
      basicPayPerCutoff: z.number().optional().nullable(),
      defaultKpi: z.number().optional(),
      sssContribution: z.number().optional(),
      philhealthContribution: z.number().optional(),
      pagibigContribution: z.number().optional(),
      sssLoan: z.number().optional(),
      pagibigLoan: z.number().optional(),
      otherLoans: z.number().optional(),
      cashAdvance: z.number().optional(),
      status: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED']).optional(),
      startDate: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }),
    execute: async ({ employeeId, ...fields }: any) => {
      const existing = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (!existing) return { success: false, error: 'Employee not found' };

      const data: any = { ...fields };
      if (fields.startDate !== undefined) {
        data.startDate = fields.startDate ? new Date(fields.startDate) : null;
      }

      const employee = await prisma.employee.update({
        where: { id: employeeId },
        data,
        select: {
          id: true, employeeNo: true, firstName: true, lastName: true,
          department: true, position: true, dailyRate: true, status: true,
        },
      });
      return { success: true, employee };
    },
  }),

  deleteEmployee: tool({
    description: 'Delete or archive an employee. Employees with payroll history are soft-deleted (archived). Always confirm with the user before deleting.',
    parameters: z.object({
      employeeId: z.string().describe('Database ID of the employee to delete'),
    }),
    execute: async ({ employeeId }: any) => {
      const existing = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (!existing) return { success: false, error: 'Employee not found' };

      const payslipCount = await prisma.payslip.count({ where: { employeeId } });

      if (payslipCount > 0) {
        await prisma.employee.update({
          where: { id: employeeId },
          data: { deletedAt: new Date(), status: 'TERMINATED' },
        });
        return { success: true, action: 'archived', message: `${existing.firstName} ${existing.lastName} has been archived (soft-deleted) because they have payroll history.` };
      }

      await prisma.employee.delete({ where: { id: employeeId } });
      return { success: true, action: 'deleted', message: `${existing.firstName} ${existing.lastName} has been permanently deleted.` };
    },
  }),

  // ─── PAYSLIPS ─────────────────────────────────────────────────────────────

  getEmployeePayslips: tool({
    description: 'Get the latest payslips for a specific employee.',
    parameters: z.object({
      employeeId: z.string(),
      limit: z.number().optional().default(5),
    }),
    execute: async ({ employeeId, limit }: any) => {
      const payslips = await prisma.payslip.findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true, referenceNo: true, employeeName: true,
          basicPay: true, netPay: true, grossPay: true, totalDeductions: true,
          presentDays: true, absentDays: true, createdAt: true,
          payrollRun: {
            select: { name: true, cutoffType: true, cutoffStart: true, cutoffEnd: true },
          },
        },
      });
      return payslips;
    },
  }),

  // ─── PAYROLL RUNS READ ────────────────────────────────────────────────────

  getLatestPayrollRuns: tool({
    description: 'Get recent payroll runs, optionally filtered by status.',
    parameters: z.object({
      limit: z.number().optional().default(10),
      status: z.string().optional().describe('Filter by status: DRAFT, REVIEWED, FINALIZED'),
    }),
    execute: async ({ limit, status }: any) => {
      const runs = await prisma.payrollRun.findMany({
        where: status ? { status } : undefined,
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { cutoffType: 'desc' }],
        take: limit,
        include: { _count: { select: { payslips: true } } },
      });
      return runs;
    },
  }),

  getPayrollRunSummary: tool({
    description: 'Get detailed summary of a specific payroll run including totals.',
    parameters: z.object({
      payrollRunId: z.string(),
    }),
    execute: async ({ payrollRunId }: any) => {
      const payrollRun = await prisma.payrollRun.findUnique({
        where: { id: payrollRunId },
        include: { _count: { select: { payslips: true } } },
      });
      if (!payrollRun) return null;

      const statistics = await prisma.payslip.aggregate({
        where: { payrollRunId },
        _sum: { netPay: true, grossPay: true, totalDeductions: true },
        _avg: { netPay: true },
      });
      return { ...payrollRun, statistics };
    },
  }),

  // ─── PAYROLL RUNS WRITE ───────────────────────────────────────────────────

  createPayrollRun: tool({
    description: 'Create a new payroll run. Ask the user for year, month, cutoff period (first half: 1-15, or second half: 16-end), and pay date.',
    parameters: z.object({
      year: z.number().describe('Year e.g. 2026'),
      month: z.number().min(1).max(12).describe('Month number 1-12'),
      cutoffType: z.enum(['FIRST_HALF', 'SECOND_HALF']).describe('FIRST_HALF = 1-15, SECOND_HALF = 16-end'),
      payDate: z.string().describe('Pay date in ISO format e.g. 2026-03-20'),
      notes: z.string().optional(),
    }),
    execute: async ({ year, month, cutoffType, payDate, notes }: any) => {
      const {
        getEligibleWorkdays,
        getCutoffPeriod,
      } = await import('@/lib/payroll-calculator');

      const existing = await prisma.payrollRun.findUnique({
        where: { year_month_cutoffType: { year, month, cutoffType } },
      });
      if (existing) return { success: false, error: 'A payroll run for this period already exists.', existingId: existing.id };

      const { start, end } = getCutoffPeriod(year, month, cutoffType);
      const eligibleWorkdays = getEligibleWorkdays(year, month, cutoffType);

      const settings = await prisma.setting.findMany();
      const settingsMap = Object.fromEntries(settings.map((s: any) => [s.key, s.value]));

      const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      const cutoffLabel = cutoffType === 'FIRST_HALF' ? '1-15' : `16-${end.getDate()}`;
      const name = `${monthNames[month]} ${year} (${cutoffLabel})`;

      const run = await prisma.payrollRun.create({
        data: {
          name,
          cutoffType,
          cutoffStart: start,
          cutoffEnd: end,
          payDate: new Date(payDate),
          year,
          month,
          eligibleWorkdays,
          notes: notes ?? null,
          govDeductionMode: (settingsMap.gov_deduction_mode || 'fixed_per_cutoff') as any,
          standardDailyHours: parseInt(settingsMap.standard_daily_hours || '8'),
        },
      });
      return { success: true, payrollRun: run };
    },
  }),

  updatePayrollRunStatus: tool({
    description: 'Change a payroll run status. Use "FINALIZED" to finalize/lock it, "DRAFT" to unlock it, or "REVIEWED" to mark it reviewed.',
    parameters: z.object({
      payrollRunId: z.string(),
      status: z.enum(['DRAFT', 'REVIEWED', 'FINALIZED']),
    }),
    execute: async ({ payrollRunId, status }: any) => {
      const run = await prisma.payrollRun.findUnique({ where: { id: payrollRunId } });
      if (!run) return { success: false, error: 'Payroll run not found' };

      const data: any = { status };
      if (status === 'FINALIZED') data.finalizedAt = new Date();

      const updated = await prisma.payrollRun.update({
        where: { id: payrollRunId },
        data,
        select: { id: true, name: true, status: true, finalizedAt: true },
      });
      return { success: true, payrollRun: updated };
    },
  }),

  deletePayrollRun: tool({
    description: 'Delete a payroll run. Only DRAFT runs can be deleted. Always confirm with user first.',
    parameters: z.object({
      payrollRunId: z.string(),
    }),
    execute: async ({ payrollRunId }: any) => {
      const run = await prisma.payrollRun.findUnique({ where: { id: payrollRunId } });
      if (!run) return { success: false, error: 'Payroll run not found' };
      if (run.status === 'FINALIZED') return { success: false, error: 'Cannot delete a finalized payroll run. Unlock it first.' };

      await prisma.timesheetEntry.deleteMany({ where: { payrollRunId } });
      await prisma.payslip.deleteMany({ where: { payrollRunId } });
      await prisma.payrollRun.delete({ where: { id: payrollRunId } });

      return { success: true, message: `Payroll run "${run.name}" has been deleted.` };
    },
  }),

  // ─── TIMESHEET IMPORT ─────────────────────────────────────────────────────

  importTimesheetToPayrollRun: tool({
    description: 'Import timesheet data into a payroll run. Use this when the user uploads a timesheet file and wants to import it. Extract employee IDs/names, dates, and hours from the file data in the conversation context, then call this tool. The payroll run must exist first.',
    parameters: z.object({
      payrollRunId: z.string().describe('ID of the payroll run to import into'),
      rows: z.array(z.object({
        employeeId: z.string().optional().describe('Employee number e.g. EMP-001'),
        employeeName: z.string().optional().describe('Employee name (fallback if no ID)'),
        date: z.string().describe('Date in ISO format e.g. 2026-03-01'),
        hoursWorked: z.number().optional(),
        minutesLate: z.number().optional().default(0),
        undertimeMinutes: z.number().optional().default(0),
        isAbsent: z.boolean().optional().default(false),
        overtimeHours: z.number().optional().default(0),
        remarks: z.string().optional(),
      })).describe('Array of timesheet rows extracted from the uploaded file'),
    }),
    execute: async ({ payrollRunId, rows }: any) => {
      const {
        calculatePayslip,
        calculateAttendanceSummary,
        getEligibleWorkdays,
        isSunday,
      } = await import('@/lib/payroll-calculator');
      const { generateReferenceNo } = await import('@/lib/utils');

      const payrollRun = await prisma.payrollRun.findUnique({ where: { id: payrollRunId } });
      if (!payrollRun) return { success: false, error: 'Payroll run not found' };
      if (payrollRun.status === 'FINALIZED') return { success: false, error: 'Cannot import into a finalized payroll run' };

      const employees = await prisma.employee.findMany({ where: { deletedAt: null } });
      const byNo = new Map(employees.map((e: any) => [e.employeeNo.toLowerCase(), e]));
      const byFirstLast = new Map(employees.map((e: any) => [`${e.firstName} ${e.lastName}`.toLowerCase(), e]));
      const byLastFirst = new Map(employees.map((e: any) => [`${e.lastName}, ${e.firstName}`.toLowerCase(), e]));

      const settings = await prisma.setting.findMany();
      const settingsMap = Object.fromEntries(settings.map((s: any) => [s.key, s.value]));
      const payrollSettings = {
        govDeductionMode: (payrollRun as any).govDeductionMode || settingsMap.gov_deduction_mode || 'fixed_per_cutoff',
        standardDailyHours: (payrollRun as any).standardDailyHours || parseInt(settingsMap.standard_daily_hours || '8'),
      };

      const holidays = await prisma.holiday.findMany({ where: { year: payrollRun.year } });
      const holidayData = holidays.map((h: any) => ({ date: h.date, type: h.type, name: h.name }));

      const employeeRows = new Map<string, any[]>();

      for (const row of rows) {
        let employee: any = null;
        if (row.employeeId) employee = byNo.get(row.employeeId.toLowerCase().trim());
        if (!employee && row.employeeName) {
          const n = row.employeeName.toLowerCase().trim();
          employee = byFirstLast.get(n) || byLastFirst.get(n);
        }
        if (!employee || employee.status !== 'ACTIVE') continue;

        const date = new Date(row.date);
        if (isSunday(date)) continue;

        const existing = employeeRows.get(employee.id) || [];
        existing.push({ ...row, resolvedDate: date, employeeRecord: employee });
        employeeRows.set(employee.id, existing);
      }

      await prisma.timesheetEntry.deleteMany({ where: { payrollRunId } });

      const imported: string[] = [];

      for (const [employeeId, empRows] of Array.from(employeeRows.entries())) {
        const employee = empRows[0].employeeRecord;

        for (const row of empRows) {
          await prisma.timesheetEntry.upsert({
            where: { payrollRunId_employeeId_date: { payrollRunId, employeeId, date: row.resolvedDate } },
            create: {
              payrollRunId, employeeId, date: row.resolvedDate,
              hoursWorked: row.hoursWorked ?? null,
              minutesLate: row.minutesLate ?? 0,
              undertimeMinutes: row.undertimeMinutes ?? 0,
              isAbsent: row.isAbsent ?? false,
              isOnLeave: false,
              overtimeHours: row.overtimeHours ?? 0,
              remarks: row.remarks ?? null,
              rawData: row,
            },
            update: {
              hoursWorked: row.hoursWorked ?? null,
              minutesLate: row.minutesLate ?? 0,
              undertimeMinutes: row.undertimeMinutes ?? 0,
              isAbsent: row.isAbsent ?? false,
              overtimeHours: row.overtimeHours ?? 0,
              remarks: row.remarks ?? null,
              rawData: row,
            },
          });
        }

        const timesheetEntries = await prisma.timesheetEntry.findMany({
          where: { payrollRunId, employeeId },
        });

        const eligibleWorkdays = getEligibleWorkdays(payrollRun.year, payrollRun.month, payrollRun.cutoffType as any);
        const calculation = calculatePayslip(
          employee as any, timesheetEntries as any,
          payrollRun.year, payrollRun.month, payrollRun.cutoffType as any,
          parseFloat(String(employee.defaultKpi || 0)),
          payrollSettings as any, {}, undefined, holidayData as any
        );

        await prisma.payslip.upsert({
          where: { payrollRunId_employeeId: { payrollRunId, employeeId } },
          create: {
            referenceNo: generateReferenceNo('PS'),
            payrollRunId, employeeId,
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
            monthlyLateCount: calculation.monthlyAttendance?.lateCount ?? 0,
            monthlyAbsentCount: calculation.monthlyAttendance?.absentCount ?? 0,
            kpiVoided: calculation.kpiVoided,
            kpiVoidReason: calculation.kpiVoidReason ?? null,
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
            presentDays: calculation.attendance.presentDays,
            absentDays: calculation.attendance.absentDays,
            totalLateMinutes: calculation.attendance.totalLateMinutes,
            totalOvertimeHours: calculation.attendance.totalOvertimeHours,
            lateCount: calculation.attendance.lateCount,
            absentCount: calculation.attendance.absentCount,
            kpiVoided: calculation.kpiVoided,
            kpiVoidReason: calculation.kpiVoidReason ?? null,
            basicPay: calculation.earnings.basicPay,
            overtimePay: calculation.earnings.overtimePay,
            grossPay: calculation.earnings.grossPay,
            totalDeductions: calculation.deductions.totalDeductions,
            netPay: calculation.netPay,
            govDeductionsApplied: calculation.govDeductionsApplied,
            computationBreakdown: calculation.computationBreakdown as any,
            isMissing: false,
          },
        });

        imported.push(`${employee.firstName} ${employee.lastName}`);
      }

      return {
        success: true,
        payrollRunName: payrollRun.name,
        importedCount: imported.length,
        importedEmployees: imported,
        totalRows: rows.length,
      };
    },
  }),

  // ─── HOLIDAYS ─────────────────────────────────────────────────────────────

  listHolidays: tool({
    description: 'List all holidays for a given year.',
    parameters: z.object({
      year: z.number().describe('Year to list holidays for'),
    }),
    execute: async ({ year }: any) => {
      const holidays = await prisma.holiday.findMany({
        where: { year },
        orderBy: { date: 'asc' },
      });
      return holidays;
    },
  }),

  addHoliday: tool({
    description: 'Add a new holiday. Type must be REGULAR or SPECIAL. Confirm date and name with user first.',
    parameters: z.object({
      name: z.string().describe('Holiday name e.g. "Christmas Day"'),
      date: z.string().describe('Date in ISO format e.g. 2026-12-25'),
      type: z.enum(['REGULAR', 'SPECIAL']).describe('REGULAR = regular holiday, SPECIAL = special non-working day'),
      description: z.string().optional(),
    }),
    execute: async ({ name, date, type, description }: any) => {
      const holidayDate = new Date(date);
      const year = holidayDate.getFullYear();

      const existing = await prisma.holiday.findUnique({ where: { date: holidayDate } });
      if (existing) return { success: false, error: `A holiday (${existing.name}) already exists on ${date}` };

      const holiday = await prisma.holiday.create({
        data: { name, date: holidayDate, type, year, description: description ?? null },
      });
      return { success: true, holiday };
    },
  }),

  deleteHoliday: tool({
    description: 'Delete a holiday by ID. Use listHolidays first to find the ID. Confirm with user before deleting.',
    parameters: z.object({
      holidayId: z.string(),
    }),
    execute: async ({ holidayId }: any) => {
      const holiday = await prisma.holiday.findUnique({ where: { id: holidayId } });
      if (!holiday) return { success: false, error: 'Holiday not found' };

      await prisma.holiday.delete({ where: { id: holidayId } });
      return { success: true, message: `Holiday "${holiday.name}" on ${holiday.date.toISOString().split('T')[0]} has been deleted.` };
    },
  }),

  // ─── ATTENDANCE ───────────────────────────────────────────────────────────

  getAttendanceSummary: tool({
    description: 'Get attendance summary for all employees for a specific month and year.',
    parameters: z.object({
      year: z.number(),
      month: z.number().min(1).max(12),
    }),
    execute: async ({ year, month }: any) => {
      const employees = await prisma.employee.findMany({
        where: { deletedAt: null, status: 'ACTIVE' },
        select: { id: true, employeeNo: true, firstName: true, lastName: true, department: true },
        orderBy: { employeeNo: 'asc' },
      });

      const payslips = await prisma.payslip.findMany({
        where: { payrollRun: { year, month } },
        select: {
          employeeId: true, lateCount: true, absentCount: true,
          totalLateMinutes: true, kpiVoided: true, kpiVoidReason: true,
          payrollRun: { select: { cutoffType: true } },
        },
      });

      const summary = employees.map((emp: any) => {
        const empPayslips = payslips.filter((p: any) => p.employeeId === emp.id);
        return {
          employeeNo: emp.employeeNo,
          name: `${emp.lastName}, ${emp.firstName}`,
          department: emp.department,
          totalLate: empPayslips.reduce((s: number, p: any) => s + (p.lateCount || 0), 0),
          totalAbsent: empPayslips.reduce((s: number, p: any) => s + (p.absentCount || 0), 0),
          totalLateMinutes: empPayslips.reduce((s: number, p: any) => s + (p.totalLateMinutes || 0), 0),
          kpiVoided: empPayslips.some((p: any) => p.kpiVoided),
          hasData: empPayslips.length > 0,
        };
      });

      return { year, month, summary: summary.filter((s: any) => s.hasData) };
    },
  }),

  // ─── LIFESCAN INTEGRATION ─────────────────────────────────────────────────

  importFromLifeScan: tool({
    description: 'Import attendance data from the LifeScan app into a payroll run. This fetches DTR (Daily Time Record) data from the LifeScan API for the payroll run\'s cutoff period and generates payslips. A payroll run must exist first. Use this when user asks to import from LifeScan.',
    parameters: z.object({
      payrollRunId: z.string().describe('ID of the payroll run to import into. Use getLatestPayrollRuns to find it.'),
    }),
    execute: async ({ payrollRunId }: any) => {
      const { fetchLifeScanData } = await import('@/lib/lifescan');
      const { accountingService } = await import('@/services/accountingService');
      const {
        isSunday, calculatePayslip, getEligibleWorkdays,
        calculateAttendanceSummary,
      } = await import('@/lib/payroll-calculator');
      const { generateReferenceNo } = await import('@/lib/utils');

      if (!accountingService.isConfigured()) {
        return { success: false, error: 'LifeScan API is not configured. Set LIFESCAN_API_URL and LIFESCAN_API_KEY in environment variables.' };
      }

      const payrollRun = await prisma.payrollRun.findUnique({ where: { id: payrollRunId } });
      if (!payrollRun) return { success: false, error: 'Payroll run not found' };
      if (payrollRun.status === 'FINALIZED') return { success: false, error: 'Cannot import into a finalized payroll run. Unlock it first.' };

      const startStr = new Date(payrollRun.cutoffStart).toISOString().split('T')[0];
      const endStr = new Date(payrollRun.cutoffEnd).toISOString().split('T')[0];

      const records = await fetchLifeScanData({ start_date: startStr, end_date: endStr });

      if (records.length === 0) {
        return { success: false, error: `No LifeScan attendance records found for period ${startStr} to ${endStr}.` };
      }

      const processRecord = (record: any) => {
        const dateStr = record.created_at.split('T')[0];
        const date = new Date(dateStr);
        if (isSunday(date)) return null;

        let timeInStr = record.timeinmorning ? new Date(record.timeinmorning).toLocaleTimeString('en-US', { hour12: false }) : null;
        let timeOutStr = record.timeoutafternoon ? new Date(record.timeoutafternoon).toLocaleTimeString('en-US', { hour12: false }) : null;
        if (!timeInStr && record.created_at) {
          timeInStr = new Date(record.created_at).toLocaleTimeString('en-US', { hour12: false });
        }

        let minutesLate = 0, undertimeMinutes = 0, overtimeHours = 0, hoursWorked = 0;

        if (timeInStr && timeOutStr) {
          const timeInDate = new Date(`2000-01-01T${timeInStr}`);
          const timeOutDate = new Date(`2000-01-01T${timeOutStr}`);
          const splitTime = new Date('2000-01-01T08:10:00');

          let shiftStart: Date, shiftEnd: Date;
          const breakHours = 1;

          if (timeInDate <= splitTime) {
            shiftStart = new Date('2000-01-01T08:00:00');
            shiftEnd = new Date('2000-01-01T17:00:00');
          } else {
            shiftStart = new Date('2000-01-01T09:00:00');
            shiftEnd = new Date('2000-01-01T18:00:00');
          }

          if (timeInDate > shiftStart) {
            if (timeInDate > splitTime) {
              const grace9 = new Date('2000-01-01T09:05:00');
              if (timeInDate > grace9) {
                minutesLate = Math.round((timeInDate.getTime() - new Date('2000-01-01T09:00:00').getTime()) / 60000);
              }
            } else {
              minutesLate = Math.round((timeInDate.getTime() - shiftStart.getTime()) / 60000);
            }
          }

          if (timeOutDate < shiftEnd) {
            undertimeMinutes = Math.round((shiftEnd.getTime() - timeOutDate.getTime()) / 60000);
          }

          const otThreshold = new Date(shiftEnd.getTime() + 60 * 60 * 1000);
          if (timeOutDate >= otThreshold) {
            overtimeHours = (timeOutDate.getTime() - shiftEnd.getTime()) / (1000 * 60 * 60);
          }

          const diffMs = timeOutDate.getTime() - timeInDate.getTime();
          hoursWorked = (diffMs / (1000 * 60 * 60)) - breakHours;
          if (hoursWorked < 0) hoursWorked = 0;
        }

        return {
          employeeId: record.profiles?.employee_id || null,
          employeeName: record.profiles ? `${record.profiles.last_name}, ${record.profiles.first_name}` : 'Unknown',
          date, timeIn: timeInStr, timeOut: timeOutStr,
          hoursWorked, minutesLate, undertimeMinutes,
          isAbsent: record.status === 'absent',
          overtimeHours, remarks: 'Imported from LifeScan',
          rawData: record,
        };
      };

      const processedRows = records.map(processRecord).filter(Boolean);

      const employees = await prisma.employee.findMany({ where: { deletedAt: null } });
      const employeeByNo = new Map(employees.map((e: any) => [e.employeeNo.toLowerCase(), e]));

      const settings = await prisma.setting.findMany();
      const settingsMap = Object.fromEntries(settings.map((s: any) => [s.key, s.value]));
      const payrollSettings = {
        govDeductionMode: ((payrollRun as any).govDeductionMode || settingsMap.gov_deduction_mode || 'fixed_per_cutoff') as any,
        standardDailyHours: (payrollRun as any).standardDailyHours || parseInt(settingsMap.standard_daily_hours || '8'),
      };

      const holidays = await prisma.holiday.findMany({ where: { year: payrollRun.year } });
      const holidayData = holidays.map((h: any) => ({ date: h.date, type: h.type, name: h.name }));

      await prisma.timesheetEntry.deleteMany({ where: { payrollRunId } });

      const employeeEntries = new Map<string, any[]>();
      const importedEmployeeIds = new Set<string>();
      const unrecognized: string[] = [];

      for (const row of processedRows as any[]) {
        if (!row.employeeId) continue;
        const employee = employeeByNo.get(String(row.employeeId).toLowerCase().trim());
        if (!employee || employee.status !== 'ACTIVE') {
          if (!unrecognized.includes(String(row.employeeId))) unrecognized.push(String(row.employeeId));
          continue;
        }
        const entries = employeeEntries.get(employee.id) || [];
        entries.push(row);
        employeeEntries.set(employee.id, entries);
      }

      const imported: string[] = [];

      for (const [employeeId, rows] of Array.from(employeeEntries.entries())) {
        const employee = employees.find((e: any) => e.id === employeeId)!;
        importedEmployeeIds.add(employeeId);

        for (const row of rows) {
          await prisma.timesheetEntry.upsert({
            where: { payrollRunId_employeeId_date: { payrollRunId, employeeId, date: row.date } },
            create: {
              payrollRunId, employeeId, date: row.date,
              timeIn: row.timeIn, timeOut: row.timeOut,
              hoursWorked: row.hoursWorked, minutesLate: row.minutesLate,
              undertimeMinutes: row.undertimeMinutes, isAbsent: row.isAbsent,
              overtimeHours: row.overtimeHours, remarks: row.remarks,
              rawData: row.rawData,
            },
            update: {
              timeIn: row.timeIn, timeOut: row.timeOut,
              hoursWorked: row.hoursWorked, minutesLate: row.minutesLate,
              undertimeMinutes: row.undertimeMinutes, isAbsent: row.isAbsent,
              overtimeHours: row.overtimeHours, remarks: row.remarks,
              rawData: row.rawData,
            },
          });
        }

        const timesheetEntries = await prisma.timesheetEntry.findMany({ where: { payrollRunId, employeeId } });

        const getOtherCutoff = async () => {
          const otherType = payrollRun.cutoffType === 'FIRST_HALF' ? 'SECOND_HALF' : 'FIRST_HALF';
          const other = await prisma.payrollRun.findFirst({
            where: { year: payrollRun.year, month: payrollRun.month, cutoffType: otherType },
          });
          if (!other) return undefined;
          const otherEntries = await prisma.timesheetEntry.findMany({
            where: { payrollRunId: other.id, employeeId },
          });
          if (otherEntries.length === 0) return undefined;
          return calculateAttendanceSummary(otherEntries, getEligibleWorkdays(payrollRun.year, payrollRun.month, otherType as any));
        };

        const otherCutoffAttendance = await getOtherCutoff();

        const calculation = calculatePayslip(
          employee as any, timesheetEntries as any,
          payrollRun.year, payrollRun.month, payrollRun.cutoffType as any,
          parseFloat(String(employee.defaultKpi || 0)),
          payrollSettings, {}, otherCutoffAttendance, holidayData as any
        );

        await prisma.payslip.upsert({
          where: { payrollRunId_employeeId: { payrollRunId, employeeId } },
          create: {
            referenceNo: generateReferenceNo('PS'),
            payrollRunId, employeeId,
            employeeName: `${employee.lastName}, ${employee.firstName} ${employee.middleName || ''}`.trim(),
            employeeNo: employee.employeeNo,
            department: employee.department, position: employee.position,
            dailyRate: employee.dailyRate,
            eligibleWorkdays: calculation.attendance.eligibleWorkdays,
            presentDays: calculation.attendance.presentDays,
            absentDays: calculation.attendance.absentDays,
            totalLateMinutes: calculation.attendance.totalLateMinutes,
            totalUndertimeMinutes: calculation.attendance.totalUndertimeMinutes,
            totalOvertimeHours: calculation.attendance.totalOvertimeHours,
            lateCount: calculation.attendance.lateCount,
            absentCount: calculation.attendance.absentCount,
            monthlyLateCount: calculation.monthlyAttendance?.lateCount ?? 0,
            monthlyAbsentCount: calculation.monthlyAttendance?.absentCount ?? 0,
            kpiVoided: calculation.kpiVoided,
            kpiVoidReason: calculation.kpiVoidReason ?? null,
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
            presentDays: calculation.attendance.presentDays,
            absentDays: calculation.attendance.absentDays,
            totalLateMinutes: calculation.attendance.totalLateMinutes,
            totalUndertimeMinutes: calculation.attendance.totalUndertimeMinutes,
            totalOvertimeHours: calculation.attendance.totalOvertimeHours,
            lateCount: calculation.attendance.lateCount,
            absentCount: calculation.attendance.absentCount,
            kpiVoided: calculation.kpiVoided,
            basicPay: calculation.earnings.basicPay,
            grossPay: calculation.earnings.grossPay,
            totalDeductions: calculation.deductions.totalDeductions,
            netPay: calculation.netPay,
            govDeductionsApplied: calculation.govDeductionsApplied,
            computationBreakdown: calculation.computationBreakdown as any,
            isMissing: false,
          },
        });

        imported.push(`${employee.firstName} ${employee.lastName}`);
      }

      await prisma.payslip.updateMany({
        where: { payrollRunId, employeeId: { notIn: Array.from(importedEmployeeIds) } },
        data: { isMissing: true },
      });

      return {
        success: true,
        payrollRunName: payrollRun.name,
        period: `${startStr} to ${endStr}`,
        lifeScanRecords: records.length,
        importedEmployees: imported.length,
        importedNames: imported,
        unrecognizedIds: unrecognized.length > 0 ? unrecognized : undefined,
      };
    },
  }),

  checkLifeScanStatus: tool({
    description: 'Check if the LifeScan API is configured and connected. Use this to verify before importing.',
    parameters: z.object({}),
    execute: async () => {
      const { accountingService } = await import('@/services/accountingService');

      if (!accountingService.isConfigured()) {
        return { configured: false, message: 'LifeScan API is not configured. LIFESCAN_API_URL and LIFESCAN_API_KEY are missing.' };
      }

      try {
        const profiles = await accountingService.fetchUsersWithDTR({});
        return { configured: true, connected: true, employeeCount: profiles.length };
      } catch (error: any) {
        return { configured: true, connected: false, error: error.message || 'Failed to connect to LifeScan API' };
      }
    },
  }),

  // ─── BROADCAST ──────────────────────────────────────────────────────────

  sendBroadcast: tool({
    description: 'Send a broadcast announcement to all users via the LifeScan app. Requires LifeScan to be configured. Always confirm title and message with the user before sending.',
    parameters: z.object({
      title: z.string().describe('Title of the broadcast announcement'),
      message: z.string().describe('Body/content of the broadcast message'),
    }),
    execute: async ({ title, message }: any) => {
      const { accountingService } = await import('@/services/accountingService');

      if (!accountingService.isConfigured()) {
        return { success: false, error: 'LifeScan API is not configured. Set LIFESCAN_API_URL and LIFESCAN_API_KEY in environment variables.' };
      }

      try {
        const result = await accountingService.sendBroadcast(title, message);
        return { success: true, notificationCount: result.notificationCount, message: `Broadcast "${title}" sent successfully to ${result.notificationCount} users.` };
      } catch (error: any) {
        return { success: false, error: error.message || 'Failed to send broadcast' };
      }
    },
  }),

  // ─── SETTINGS ───────────────────────────────────────────────────────────

  getSettings: tool({
    description: 'Get all current system settings including company info and payroll configuration.',
    parameters: z.object({}),
    execute: async () => {
      const settings = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
      const settingsMap = Object.fromEntries(settings.map((s: any) => [s.key, { value: s.value, description: s.description, updatedAt: s.updatedAt }]));
      return settingsMap;
    },
  }),

  updateSettings: tool({
    description: 'Update one or more system settings. Valid keys: company_name, company_address, company_phone, company_email, gov_deduction_mode (fixed_per_cutoff or prorated_by_days), standard_daily_hours, currency (PHP or USD). Confirm changes with the user before applying.',
    parameters: z.object({
      settings: z.array(z.object({
        key: z.string().describe('Setting key e.g. company_name'),
        value: z.string().describe('New value for the setting'),
      })).describe('Array of settings to update'),
    }),
    execute: async ({ settings }: any) => {
      const validKeys = ['company_name', 'company_address', 'company_phone', 'company_email', 'gov_deduction_mode', 'standard_daily_hours', 'currency'];
      const results: any[] = [];

      for (const { key, value } of settings) {
        if (!validKeys.includes(key)) {
          results.push({ key, success: false, error: `Invalid setting key. Valid keys: ${validKeys.join(', ')}` });
          continue;
        }

        if (key === 'gov_deduction_mode' && !['fixed_per_cutoff', 'prorated_by_days'].includes(value)) {
          results.push({ key, success: false, error: 'gov_deduction_mode must be "fixed_per_cutoff" or "prorated_by_days"' });
          continue;
        }

        if (key === 'currency' && !['PHP', 'USD'].includes(value)) {
          results.push({ key, success: false, error: 'currency must be "PHP" or "USD"' });
          continue;
        }

        await prisma.setting.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        });
        results.push({ key, success: true, newValue: value });
      }

      return { results };
    },
  }),

  // ─── OUTSOURCE PROJECTS ─────────────────────────────────────────────────

  listOutsourceProjects: tool({
    description: 'List all outsource projects.',
    parameters: z.object({}),
    execute: async () => {
      const projects = await prisma.outsourceProject.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { requests: true } } },
      });
      return projects;
    },
  }),

  deleteOutsourceProject: tool({
    description: 'Delete an outsource project by ID. Always confirm with the user before deleting.',
    parameters: z.object({
      projectId: z.string().describe('ID of the outsource project to delete'),
    }),
    execute: async ({ projectId }: any) => {
      const project = await prisma.outsourceProject.findUnique({ where: { id: projectId } });
      if (!project) return { success: false, error: 'Outsource project not found' };

      await prisma.outsourceProject.delete({ where: { id: projectId } });
      return { success: true, message: `Outsource project "${project.name}" has been deleted.` };
    },
  }),

  listOutsourceRequests: tool({
    description: 'List outsource payroll requests, optionally filtered by project ID.',
    parameters: z.object({
      projectId: z.string().optional().describe('Filter by project ID (optional)'),
    }),
    execute: async ({ projectId }: any) => {
      const requests = await prisma.outsourcePayrollRequest.findMany({
        where: projectId ? { projectId } : undefined,
        orderBy: { createdAt: 'desc' },
        include: {
          project: { select: { name: true } },
          _count: { select: { entries: true } },
        },
        take: 20,
      });
      return requests;
    },
  }),

  deleteOutsourceRequest: tool({
    description: 'Delete an outsource payroll request by ID. Always confirm with the user before deleting.',
    parameters: z.object({
      requestId: z.string().describe('ID of the outsource payroll request to delete'),
    }),
    execute: async ({ requestId }: any) => {
      const request = await prisma.outsourcePayrollRequest.findUnique({
        where: { id: requestId },
        include: { project: { select: { name: true } } },
      });
      if (!request) return { success: false, error: 'Outsource payroll request not found' };

      await prisma.outsourcePayrollRequest.delete({ where: { id: requestId } });
      return { success: true, message: `Outsource payroll request for project "${request.project?.name}" has been deleted.` };
    },
  }),
};
