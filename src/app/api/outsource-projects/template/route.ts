import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sampleData = [
    { 'Employee Name': 'Juan Dela Cruz', 'Output': 8.5 },
    { 'Employee Name': 'Maria Santos', 'Output': 10 },
    { 'Employee Name': 'Pedro Reyes', 'Output': 7.25 },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Operators');

  worksheet['!cols'] = [
    { wch: 25 }, // Employee Name
    { wch: 12 }, // Output
  ];

  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="outsource-operator-template.xlsx"`,
    },
  });
}
