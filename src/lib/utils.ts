import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, currency = 'PHP'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatNumber(num: number | string, decimals = 2): string {
  const value = typeof num === 'string' ? parseFloat(num) : num;
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(date: Date | string, format: 'short' | 'long' | 'full' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  switch (format) {
    case 'long':
      return d.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    case 'full':
      return d.toLocaleDateString('en-PH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    default:
      return d.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
  }
}

export function generateReferenceNo(prefix = 'PS'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertToWords(num: number): string {
  if (num === 0) return 'Zero';
  if (num < 0) return 'Negative ' + convertToWords(Math.abs(num));

  let words = '';

  if (Math.floor(num / 1000000) > 0) {
    words += convertToWords(Math.floor(num / 1000000)) + ' Million ';
    num %= 1000000;
  }

  if (Math.floor(num / 1000) > 0) {
    words += convertToWords(Math.floor(num / 1000)) + ' Thousand ';
    num %= 1000;
  }

  if (Math.floor(num / 100) > 0) {
    words += convertToWords(Math.floor(num / 100)) + ' Hundred ';
    num %= 100;
  }

  if (num > 0) {
    if (num < 20) {
      words += ones[num];
    } else {
      words += tens[Math.floor(num / 10)];
      if (num % 10 > 0) {
        words += '-' + ones[num % 10];
      }
    }
  }

  return words.trim();
}

export function numberToWords(amount: number, currency = 'Pesos'): string {
  const wholePart = Math.floor(amount);
  const centsPart = Math.round((amount - wholePart) * 100);

  let result = convertToWords(wholePart) + ` ${currency}`;

  if (centsPart > 0) {
    result += ' and ' + convertToWords(centsPart) + ' Centavos';
  } else {
    result += ' Only';
  }

  return result;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function parseDecimal(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;

  // Handle Prisma Decimal type (has toNumber method)
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    const num = (value as { toNumber: () => number }).toNumber();
    return isNaN(num) ? 0 : num;
  }

  // Handle string
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }

  // Handle number
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }

  return 0;
}

export function roundTo2Decimals(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
