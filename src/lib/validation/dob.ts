/**
 * Authoritative Date of Birth (DOB) and 18+ Age Validation Utilities
 * 
 * Rules enforced:
 * 1. Valid range: January 1, 1950 through Today (local calendar date).
 * 2. Lower bound: Dates before 1950-01-01 are rejected.
 * 3. Upper bound: Future dates are rejected.
 * 4. Age requirement: Exactly 18 years or older on the exact calendar day.
 * 5. Error messages:
 *    - Under 18: "You must be 18 or older to use CupidxChat."
 *    - Out of range or invalid format: "Please enter a valid date of birth."
 */

export interface DobValidationResult {
  valid: boolean;
  error?: string;
  age?: number;
  dob?: Date;
  dobString?: string;
}

export const MIN_DOB_STRING = '1950-01-01';
export const MIN_DOB_YEAR = 1950;

/**
 * Returns today's date formatted as YYYY-MM-DD in local time
 */
export function getTodayDateString(referenceDate: Date = new Date()): string {
  const y = referenceDate.getFullYear();
  const m = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const d = String(referenceDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Checks if a given year is a leap year
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns maximum number of days in a given month/year
 */
export function getDaysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  return 31;
}

/**
 * Parses any flexible date input (string YYYY-MM-DD, DD-MM-YYYY, YYYY/MM/DD, or Date object)
 * into calendar components: { year, month, day } where month is 1-12.
 * Returns null if input is malformed, not a real calendar date, or out of range.
 */
export function parseDateComponents(
  input: string | Date | null | undefined
): { year: number; month: number; day: number } | null {
  if (!input) return null;

  let year: number;
  let month: number; // 1-12
  let day: number;

  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    year = input.getFullYear();
    month = input.getMonth() + 1;
    day = input.getDate();
  } else {
    const str = String(input).trim();
    if (!str) return null;

    // 1. Check YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
    const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (ymdMatch) {
      year = parseInt(ymdMatch[1], 10);
      month = parseInt(ymdMatch[2], 10);
      day = parseInt(ymdMatch[3], 10);
    } else {
      // 2. Check DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
      const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
      if (dmyMatch) {
        day = parseInt(dmyMatch[1], 10);
        month = parseInt(dmyMatch[2], 10);
        year = parseInt(dmyMatch[3], 10);
      } else {
        // Fallback: parse via Date constructor
        const d = new Date(str);
        if (isNaN(d.getTime())) return null;
        year = d.getFullYear();
        month = d.getMonth() + 1;
        day = d.getDate();
      }
    }
  }

  // Validate numeric bounds
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  if (year < 1000 || year > 9999) return null;
  if (month < 1 || month > 12) return null;

  const maxDays = getDaysInMonth(year, month);
  if (day < 1 || day > maxDays) return null;

  return { year, month, day };
}

/**
 * Calculates exact age in years given birth components and reference date (default: now)
 */
export function calculateExactAge(
  birth: { year: number; month: number; day: number },
  referenceDate: Date = new Date()
): number {
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth() + 1; // 1-12
  const refDay = referenceDate.getDate();

  let age = refYear - birth.year;
  if (refMonth < birth.month || (refMonth === birth.month && refDay < birth.day)) {
    age--;
  }
  return age;
}

/**
 * Calculate dynamic age from any DOB input, safely returning a non-negative integer or 0
 */
export function calculateDobAge(
  dob: string | Date | null | undefined,
  referenceDate: Date = new Date()
): number {
  const parsed = parseDateComponents(dob);
  if (!parsed) return 0;
  return Math.max(0, calculateExactAge(parsed, referenceDate));
}

/**
 * Authoritative DOB and 18+ validation function
 */
export function validateDob(
  input: string | Date | null | undefined,
  referenceDate: Date = new Date()
): DobValidationResult {
  if (!input) {
    return { valid: false, error: 'Please enter a valid date of birth.' };
  }

  const parsed = parseDateComponents(input);
  if (!parsed) {
    return { valid: false, error: 'Please enter a valid date of birth.' };
  }

  const { year, month, day } = parsed;

  // 1. Lower bound check: January 1, 1950
  if (year < MIN_DOB_YEAR) {
    return { valid: false, error: 'Please enter a valid date of birth.' };
  }

  // 2. Future date check (cannot be after referenceDate/today)
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth() + 1;
  const refDay = referenceDate.getDate();

  if (
    year > refYear ||
    (year === refYear && month > refMonth) ||
    (year === refYear && month === refMonth && day > refDay)
  ) {
    return { valid: false, error: 'Please enter a valid date of birth.' };
  }

  // 3. Minimum age check: strictly 18 years or older on exact calendar day
  const age = calculateExactAge({ year, month, day }, referenceDate);
  if (age < 18) {
    return {
      valid: false,
      age,
      error: 'You must be 18 or older to use CupidxChat.',
    };
  }

  const dobString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  // Construct safe local noon Date object so serialization will not shift day
  const safeDate = new Date(year, month - 1, day, 12, 0, 0, 0);

  return {
    valid: true,
    age,
    dob: safeDate,
    dobString,
  };
}

/** Format a DOB for profile display. */
export function formatDisplayDob(dob: string | Date | null | undefined): string {
  if (!dob) return 'Not set';
  const birthDate = typeof dob === 'string' ? new Date(dob) : dob;
  if (isNaN(birthDate.getTime())) return 'Not set';
  return birthDate.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
