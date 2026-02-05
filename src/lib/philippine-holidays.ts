// Philippine Holidays for 2024, 2025, 2026
// Regular Holidays: 100% pay even without work
// Special Non-Working Holidays: 30% of daily rate

export interface PhilippineHoliday {
  name: string;
  date: string; // YYYY-MM-DD format
  type: 'REGULAR' | 'SPECIAL';
}

// 2024 Philippine Holidays
export const HOLIDAYS_2024: PhilippineHoliday[] = [
  // Regular Holidays
  { name: "New Year's Day", date: '2024-01-01', type: 'REGULAR' },
  { name: "Maundy Thursday", date: '2024-03-28', type: 'REGULAR' },
  { name: "Good Friday", date: '2024-03-29', type: 'REGULAR' },
  { name: "Araw ng Kagitingan", date: '2024-04-09', type: 'REGULAR' },
  { name: "Eid'l Fitr", date: '2024-04-10', type: 'REGULAR' },
  { name: "Labor Day", date: '2024-05-01', type: 'REGULAR' },
  { name: "Independence Day", date: '2024-06-12', type: 'REGULAR' },
  { name: "Eid'l Adha", date: '2024-06-17', type: 'REGULAR' },
  { name: "National Heroes Day", date: '2024-08-26', type: 'REGULAR' },
  { name: "Bonifacio Day", date: '2024-11-30', type: 'REGULAR' },
  { name: "Christmas Day", date: '2024-12-25', type: 'REGULAR' },
  { name: "Rizal Day", date: '2024-12-30', type: 'REGULAR' },
  // Special Non-Working Holidays
  { name: "Chinese New Year", date: '2024-02-10', type: 'SPECIAL' },
  { name: "EDSA People Power Revolution Anniversary", date: '2024-02-25', type: 'SPECIAL' },
  { name: "Black Saturday", date: '2024-03-30', type: 'SPECIAL' },
  { name: "Ninoy Aquino Day", date: '2024-08-21', type: 'SPECIAL' },
  { name: "All Saints' Day", date: '2024-11-01', type: 'SPECIAL' },
  { name: "All Souls' Day", date: '2024-11-02', type: 'SPECIAL' },
  { name: "Feast of the Immaculate Conception", date: '2024-12-08', type: 'SPECIAL' },
  { name: "Christmas Eve", date: '2024-12-24', type: 'SPECIAL' },
  { name: "Last Day of the Year", date: '2024-12-31', type: 'SPECIAL' },
];

// 2025 Philippine Holidays
export const HOLIDAYS_2025: PhilippineHoliday[] = [
  // Regular Holidays
  { name: "New Year's Day", date: '2025-01-01', type: 'REGULAR' },
  { name: "Eid'l Fitr", date: '2025-03-31', type: 'REGULAR' },
  { name: "Araw ng Kagitingan", date: '2025-04-09', type: 'REGULAR' },
  { name: "Maundy Thursday", date: '2025-04-17', type: 'REGULAR' },
  { name: "Good Friday", date: '2025-04-18', type: 'REGULAR' },
  { name: "Labor Day", date: '2025-05-01', type: 'REGULAR' },
  { name: "Eid'l Adha", date: '2025-06-07', type: 'REGULAR' },
  { name: "Independence Day", date: '2025-06-12', type: 'REGULAR' },
  { name: "National Heroes Day", date: '2025-08-25', type: 'REGULAR' },
  { name: "Bonifacio Day", date: '2025-11-30', type: 'REGULAR' },
  { name: "Christmas Day", date: '2025-12-25', type: 'REGULAR' },
  { name: "Rizal Day", date: '2025-12-30', type: 'REGULAR' },
  // Special Non-Working Holidays
  { name: "Chinese New Year", date: '2025-01-29', type: 'SPECIAL' },
  { name: "EDSA People Power Revolution Anniversary", date: '2025-02-25', type: 'SPECIAL' },
  { name: "Black Saturday", date: '2025-04-19', type: 'SPECIAL' },
  { name: "Ninoy Aquino Day", date: '2025-08-21', type: 'SPECIAL' },
  { name: "All Saints' Day", date: '2025-11-01', type: 'SPECIAL' },
  { name: "All Souls' Day", date: '2025-11-02', type: 'SPECIAL' },
  { name: "Feast of the Immaculate Conception", date: '2025-12-08', type: 'SPECIAL' },
  { name: "Christmas Eve", date: '2025-12-24', type: 'SPECIAL' },
  { name: "Last Day of the Year", date: '2025-12-31', type: 'SPECIAL' },
];

// 2026 Philippine Holidays
export const HOLIDAYS_2026: PhilippineHoliday[] = [
  // Regular Holidays
  { name: "New Year's Day", date: '2026-01-01', type: 'REGULAR' },
  { name: "Eid'l Fitr", date: '2026-03-20', type: 'REGULAR' },
  { name: "Maundy Thursday", date: '2026-04-02', type: 'REGULAR' },
  { name: "Good Friday", date: '2026-04-03', type: 'REGULAR' },
  { name: "Araw ng Kagitingan", date: '2026-04-09', type: 'REGULAR' },
  { name: "Labor Day", date: '2026-05-01', type: 'REGULAR' },
  { name: "Eid'l Adha", date: '2026-05-27', type: 'REGULAR' },
  { name: "Independence Day", date: '2026-06-12', type: 'REGULAR' },
  { name: "National Heroes Day", date: '2026-08-31', type: 'REGULAR' },
  { name: "Bonifacio Day", date: '2026-11-30', type: 'REGULAR' },
  { name: "Christmas Day", date: '2026-12-25', type: 'REGULAR' },
  { name: "Rizal Day", date: '2026-12-30', type: 'REGULAR' },
  // Special Non-Working Holidays
  { name: "Chinese New Year", date: '2026-02-17', type: 'SPECIAL' },
  { name: "EDSA People Power Revolution Anniversary", date: '2026-02-25', type: 'SPECIAL' },
  { name: "Black Saturday", date: '2026-04-04', type: 'SPECIAL' },
  { name: "Ninoy Aquino Day", date: '2026-08-21', type: 'SPECIAL' },
  { name: "All Saints' Day", date: '2026-11-01', type: 'SPECIAL' },
  { name: "All Souls' Day", date: '2026-11-02', type: 'SPECIAL' },
  { name: "Feast of the Immaculate Conception", date: '2026-12-08', type: 'SPECIAL' },
  { name: "Christmas Eve", date: '2026-12-24', type: 'SPECIAL' },
  { name: "Last Day of the Year", date: '2026-12-31', type: 'SPECIAL' },
];

// All holidays combined
export const ALL_PHILIPPINE_HOLIDAYS: PhilippineHoliday[] = [
  ...HOLIDAYS_2024,
  ...HOLIDAYS_2025,
  ...HOLIDAYS_2026,
];

// Get holidays for a specific year
export function getHolidaysForYear(year: number): PhilippineHoliday[] {
  switch (year) {
    case 2024:
      return HOLIDAYS_2024;
    case 2025:
      return HOLIDAYS_2025;
    case 2026:
      return HOLIDAYS_2026;
    default:
      return [];
  }
}
