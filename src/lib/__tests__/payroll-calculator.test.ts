import {
  getEligibleWorkdays,
  getCutoffPeriod,
  getCutoffDates,
  isSunday,
  calculateAttendanceSummary,
  calculateDeductions,
} from '../payroll-calculator';
import { CutoffType } from '@prisma/client';

describe('Payroll Calculator', () => {
  describe('isSunday', () => {
    it('should return true for Sundays', () => {
      // January 5, 2025 is a Sunday
      expect(isSunday(new Date(2025, 0, 5))).toBe(true);
      // January 12, 2025 is a Sunday
      expect(isSunday(new Date(2025, 0, 12))).toBe(true);
    });

    it('should return false for non-Sundays', () => {
      // January 6, 2025 is a Monday
      expect(isSunday(new Date(2025, 0, 6))).toBe(false);
      // January 11, 2025 is a Saturday
      expect(isSunday(new Date(2025, 0, 11))).toBe(false);
    });
  });

  describe('getCutoffPeriod', () => {
    it('should return 1-15 for FIRST_HALF', () => {
      const { start, end } = getCutoffPeriod(2025, 1, CutoffType.FIRST_HALF);
      expect(start.getDate()).toBe(1);
      expect(end.getDate()).toBe(15);
    });

    it('should return 16-31 for SECOND_HALF in January', () => {
      const { start, end } = getCutoffPeriod(2025, 1, CutoffType.SECOND_HALF);
      expect(start.getDate()).toBe(16);
      expect(end.getDate()).toBe(31);
    });

    it('should return 16-30 for SECOND_HALF in April', () => {
      const { start, end } = getCutoffPeriod(2025, 4, CutoffType.SECOND_HALF);
      expect(start.getDate()).toBe(16);
      expect(end.getDate()).toBe(30);
    });

    it('should return 16-28 for SECOND_HALF in February (non-leap year)', () => {
      const { start, end } = getCutoffPeriod(2025, 2, CutoffType.SECOND_HALF);
      expect(start.getDate()).toBe(16);
      expect(end.getDate()).toBe(28);
    });

    it('should return 16-29 for SECOND_HALF in February (leap year)', () => {
      const { start, end } = getCutoffPeriod(2024, 2, CutoffType.SECOND_HALF);
      expect(start.getDate()).toBe(16);
      expect(end.getDate()).toBe(29);
    });
  });

  describe('getEligibleWorkdays', () => {
    it('should exclude Sundays from FIRST_HALF cutoff', () => {
      // January 2025: 1-15 has dates 1(Wed), 2(Thu), 3(Fri), 4(Sat), 5(Sun), 
      // 6(Mon), 7(Tue), 8(Wed), 9(Thu), 10(Fri), 11(Sat), 12(Sun), 13(Mon), 14(Tue), 15(Wed)
      // Sundays: 5, 12 -> excluded
      // Eligible: 15 - 2 = 13 days
      const workdays = getEligibleWorkdays(2025, 1, CutoffType.FIRST_HALF);
      expect(workdays).toBe(13);
    });

    it('should exclude Sundays from SECOND_HALF cutoff (16-31)', () => {
      // January 2025: 16-31
      // 16(Thu), 17(Fri), 18(Sat), 19(Sun), 20(Mon), 21(Tue), 22(Wed), 23(Thu),
      // 24(Fri), 25(Sat), 26(Sun), 27(Mon), 28(Tue), 29(Wed), 30(Thu), 31(Fri)
      // Sundays: 19, 26 -> excluded
      // Eligible: 16 - 2 = 14 days
      const workdays = getEligibleWorkdays(2025, 1, CutoffType.SECOND_HALF);
      expect(workdays).toBe(14);
    });

    it('should exclude Sundays from SECOND_HALF cutoff (16-30)', () => {
      // April 2025: 16-30
      // 16(Wed), 17(Thu), 18(Fri), 19(Sat), 20(Sun), 21(Mon), 22(Tue), 23(Wed),
      // 24(Thu), 25(Fri), 26(Sat), 27(Sun), 28(Mon), 29(Tue), 30(Wed)
      // Sundays: 20, 27 -> excluded
      // Eligible: 15 - 2 = 13 days
      const workdays = getEligibleWorkdays(2025, 4, CutoffType.SECOND_HALF);
      expect(workdays).toBe(13);
    });
  });

  describe('calculateDeductions - Government Deductions', () => {
    const mockEmployee = {
      id: '1',
      employeeNo: 'EMP-001',
      firstName: 'Test',
      lastName: 'Employee',
      middleName: null,
      department: 'IT',
      position: 'Developer',
      rateType: 'DAILY' as const,
      dailyRate: 1000 as any,
      monthlyRate: null,
      basicPayPerCutoff: null,
      defaultKpi: 0 as any,
      sssContribution: 1350 as any,
      philhealthContribution: 450 as any,
      pagibigContribution: 100 as any,
      sssLoan: 0 as any,
      pagibigLoan: 0 as any,
      otherLoans: 0 as any,
      cashAdvance: 0 as any,
      status: 'ACTIVE' as const,
      startDate: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    const mockAttendance = {
      eligibleWorkdays: 13,
      presentDays: 13,
      absentDays: 0,
      totalLateMinutes: 0,
      totalUndertimeMinutes: 0,
      totalOvertimeHours: 0,
      totalHolidayPay: 0,
    };

    const settings = {
      govDeductionMode: 'fixed_per_cutoff' as const,
      standardDailyHours: 8,
      overtimeMultiplier: 1.25,
    };

    it('should NOT apply government deductions for FIRST_HALF cutoff (1-15)', () => {
      const deductions = calculateDeductions(
        mockEmployee,
        mockAttendance,
        CutoffType.FIRST_HALF,
        settings
      );

      expect(deductions.sssDeduction).toBe(0);
      expect(deductions.philhealthDeduction).toBe(0);
      expect(deductions.pagibigDeduction).toBe(0);
    });

    it('should apply government deductions for SECOND_HALF cutoff (16-end)', () => {
      const deductions = calculateDeductions(
        mockEmployee,
        mockAttendance,
        CutoffType.SECOND_HALF,
        settings
      );

      expect(deductions.sssDeduction).toBe(1350);
      expect(deductions.philhealthDeduction).toBe(450);
      expect(deductions.pagibigDeduction).toBe(100);
    });

    it('should apply prorated government deductions when mode is prorated_by_days', () => {
      const proratedSettings = { ...settings, govDeductionMode: 'prorated_by_days' as const };
      const partialAttendance = { ...mockAttendance, presentDays: 10, absentDays: 3 };

      const deductions = calculateDeductions(
        mockEmployee,
        partialAttendance,
        CutoffType.SECOND_HALF,
        proratedSettings
      );

      // Proration factor = 10 / 13 = 0.769...
      const factor = 10 / 13;
      expect(deductions.sssDeduction).toBeCloseTo(1350 * factor, 2);
      expect(deductions.philhealthDeduction).toBeCloseTo(450 * factor, 2);
      expect(deductions.pagibigDeduction).toBeCloseTo(100 * factor, 2);
    });
  });

  describe('getCutoffDates', () => {
    it('should return all dates in FIRST_HALF range', () => {
      const dates = getCutoffDates(2025, 1, CutoffType.FIRST_HALF);
      expect(dates.length).toBe(15);
      expect(dates[0].getDate()).toBe(1);
      expect(dates[14].getDate()).toBe(15);
    });

    it('should return all dates in SECOND_HALF range for 31-day month', () => {
      const dates = getCutoffDates(2025, 1, CutoffType.SECOND_HALF);
      expect(dates.length).toBe(16); // 16-31
      expect(dates[0].getDate()).toBe(16);
      expect(dates[15].getDate()).toBe(31);
    });

    it('should return all dates in SECOND_HALF range for 30-day month', () => {
      const dates = getCutoffDates(2025, 4, CutoffType.SECOND_HALF);
      expect(dates.length).toBe(15); // 16-30
      expect(dates[0].getDate()).toBe(16);
      expect(dates[14].getDate()).toBe(30);
    });

    it('should return all dates in SECOND_HALF range for February', () => {
      const dates = getCutoffDates(2025, 2, CutoffType.SECOND_HALF);
      expect(dates.length).toBe(13); // 16-28
      expect(dates[0].getDate()).toBe(16);
      expect(dates[12].getDate()).toBe(28);
    });
  });
});
