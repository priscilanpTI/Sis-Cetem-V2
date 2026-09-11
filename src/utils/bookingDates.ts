import type { Booking, WeekdayCode } from '../types';

export const WEEKDAYS: Array<{ code: WeekdayCode; short: string; label: string }> = [
  { code: 'SEG', short: 'Seg', label: 'Segunda-feira' },
  { code: 'TER', short: 'Ter', label: 'Terça-feira' },
  { code: 'QUA', short: 'Qua', label: 'Quarta-feira' },
  { code: 'QUI', short: 'Qui', label: 'Quinta-feira' },
  { code: 'SEX', short: 'Sex', label: 'Sexta-feira' },
  { code: 'SAB', short: 'Sáb', label: 'Sábado' },
  { code: 'DOM', short: 'Dom', label: 'Domingo' }
];

const JS_DAY_TO_CODE: WeekdayCode[] = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateBr(value: string): string {
  if (!value) return '';
  return value.split('-').reverse().join('/');
}

export function addDays(value: string, days: number): string {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

export function startOfWeekMonday(value: string): string {
  const date = parseLocalDate(value);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return formatLocalDate(date);
}

export function weekdayCodeForDate(value: string): WeekdayCode {
  return JS_DAY_TO_CODE[parseLocalDate(value).getDay()];
}

export function countPeriodDays(startDate: string, endDate: string): number {
  const start = parseLocalDate(startDate).getTime();
  const end = parseLocalDate(endDate).getTime();
  return Math.floor((end - start) / 86400000) + 1;
}

export function generateOccurrences(
  startDate: string,
  endDate: string,
  weekdays: WeekdayCode[]
): string[] {
  if (!startDate || !endDate || endDate < startDate || weekdays.length === 0) return [];

  const allowed = new Set(weekdays);
  const result: string[] = [];
  let current = startDate;

  while (current <= endDate) {
    if (allowed.has(weekdayCodeForDate(current))) {
      result.push(current);
    }
    current = addDays(current, 1);
  }

  return result;
}

export function bookingOccursOnDate(booking: Booking, date: string): boolean {
  if (booking.status !== 'Confirmado') return false;
  if (date < booking.startDate || date > booking.endDate) return false;
  return booking.weekdays.includes(weekdayCodeForDate(date));
}

export function timesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  return startA < endB && endA > startB;
}

export function bookingMatchesDateRange(
  booking: Booking,
  filterStartDate: string,
  filterEndDate?: string
): boolean {
  if (!filterStartDate) return true;

  const end = filterEndDate || filterStartDate;
  const overlapStart = booking.startDate > filterStartDate ? booking.startDate : filterStartDate;
  const overlapEnd = booking.endDate < end ? booking.endDate : end;

  if (overlapEnd < overlapStart) return false;

  let current = overlapStart;
  while (current <= overlapEnd) {
    if (booking.weekdays.includes(weekdayCodeForDate(current))) return true;
    current = addDays(current, 1);
  }

  return false;
}
