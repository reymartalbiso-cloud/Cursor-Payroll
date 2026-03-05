import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, canManageEmployees } from '@/lib/auth';

export const dynamic = 'force-dynamic';
import { z } from 'zod';

const updateEmployeeSchema = z.object({
  employeeNo: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  middleName: z.string().optional().nullable(),
  department: z.string().min(1).optional(),
  position: z.string().min(1).optional(),
  rateType: z.enum(['DAILY', 'MONTHLY']).optional(),
  monthlySalary: z.number().positive().optional(),
  dailyRate: z.number().optional(),  // Auto-calculated from monthlySalary / 26
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
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !canManageEmployees(session.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        payslips: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            payrollRun: {
              select: { name: true, cutoffStart: true, cutoffEnd: true },
            },
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error('Get employee error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !canManageEmployees(session.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateEmployeeSchema.parse(body);

    // Check if employee exists
    const existing = await prisma.employee.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // If changing employee number, check for duplicates
    if (validatedData.employeeNo && validatedData.employeeNo !== existing.employeeNo) {
      const duplicate = await prisma.employee.findUnique({
        where: { employeeNo: validatedData.employeeNo },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Employee ID already exists' },
          { status: 400 }
        );
      }
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        ...validatedData,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : existing.startDate,
      },
    });

    return NextResponse.json(employee);
  } catch (error) {
    console.error('Update employee error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !canManageEmployees(session.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check if employee has payroll history
    const payslipCount = await prisma.payslip.count({
      where: { employeeId: id },
    });

    if (payslipCount > 0) {
      // Soft delete if has payroll history
      await prisma.employee.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'TERMINATED' },
      });
      return NextResponse.json({ message: 'Employee archived (soft delete)' });
    }

    // Hard delete if no payroll history
    await prisma.employee.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Employee deleted' });
  } catch (error) {
    console.error('Delete employee error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
