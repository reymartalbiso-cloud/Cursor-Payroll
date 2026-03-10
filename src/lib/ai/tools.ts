import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { tool } from 'ai';

export const aiTools = {
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
        take: 5,
      });
      return employees;
    },
  }),

  getEmployeeDetails: tool({
    description: 'Get detailed information about a specific employee.',
    parameters: z.object({
      employeeId: z.string().describe('The database ID of the employee'),
    }),
    execute: async ({ employeeId }: any) => {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          user: {
            select: {
              email: true,
              role: true,
            },
          },
        },
      });
      return employee;
    },
  }),

  getEmployeePayslips: tool({
    description: 'Get the latest payslips for a specific employee.',
    parameters: z.object({
      employeeId: z.string().describe('The database ID of the employee'),
      limit: z.number().optional().default(3).describe('Number of payslips to return'),
    }),
    execute: async ({ employeeId, limit }: any) => {
      const payslips = await prisma.payslip.findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          referenceNo: true,
          employeeName: true,
          basicPay: true,
          netPay: true,
          grossPay: true,
          totalDeductions: true,
          createdAt: true,
          payrollRun: {
            select: {
              name: true,
              cutoffType: true,
              cutoffStart: true,
              cutoffEnd: true,
            },
          },
        },
      });
      return payslips;
    },
  }),

  getPayrollRunSummary: tool({
    description: 'Get a summary of a specific payroll run.',
    parameters: z.object({
      payrollRunId: z.string().describe('The database ID of the payroll run'),
    }),
    execute: async ({ payrollRunId }: any) => {
      const payrollRun = await prisma.payrollRun.findUnique({
        where: { id: payrollRunId },
        include: {
          _count: {
            select: { payslips: true },
          },
        },
      });

      if (!payrollRun) return null;

      const statistics = await prisma.payslip.aggregate({
        where: { payrollRunId },
        _sum: {
          netPay: true,
          grossPay: true,
          totalDeductions: true,
        },
        _avg: {
          netPay: true,
        },
      });

      return {
        ...payrollRun,
        statistics,
      };
    },
  }),
  
  getLatestPayrollRuns: tool({
    description: 'Get the most recent payroll runs.',
    parameters: z.object({
      limit: z.number().optional().default(5).describe('Number of runs to return'),
    }),
    execute: async ({ limit }: any) => {
      const runs = await prisma.payrollRun.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          name: true,
          status: true,
          cutoffStart: true,
          cutoffEnd: true,
          payDate: true,
        },
      });
      return runs;
    },
  }),
};
