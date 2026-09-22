// Server-side IP Country Detection with zero IP exposure
// Supports Vercel headers (x-vercel-ip-country), Cloudflare (cf-ipcountry), and fallbacks.

export interface CountryInfo {
  countryCode: string; // ISO 3166-1 alpha-2 (e.g. "IN", "US")
  countryName: string; // Full name (e.g. "India", "United States")
  countryFlag: string; // Flag emoji (e.g. "🇮🇳", "🇺🇸")
}

const COUNTRY_NAMES: Record<string, string> = {
  IN: 'India',
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  DE: 'Germany',
  FR: 'France',
  IT: 'Italy',
  ES: 'Spain',
  BR: 'Brazil',
  RU: 'Russia',
  JP: 'Japan',
  KR: 'South Korea',
  CN: 'China',
  ID: 'Indonesia',
  PK: 'Pakistan',
  BD: 'Bangladesh',
  NG: 'Nigeria',
  ZA: 'South Africa',
  EG: 'Egypt',
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  SG: 'Singapore',
  MY: 'Malaysia',
  TH: 'Thailand',
  VN: 'Vietnam',
  PH: 'Philippines',
  NL: 'Netherlands',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  PL: 'Poland',
  TR: 'Turkey',
  MX: 'Mexico',
  AR: 'Argentina',
  CO: 'Colombia',
  CL: 'Chile',
  NZ: 'New Zealand',
  IE: 'Ireland',
  CH: 'Switzerland',
  AT: 'Austria',
  BE: 'Belgium',
  PT: 'Portugal',
  GR: 'Greece',
  IL: 'Israel',
  UA: 'Ukraine',
  NP: 'Nepal',
  LK: 'Sri Lanka',
  QA: 'Qatar',
  KW: 'Kuwait',
  OM: 'Oman',
  BH: 'Bahrain',
};

/**
 * Generate Unicode Flag Emoji from 2-letter ISO Country Code.
 * ISO codes are converted to Regional Indicator Symbol pairs.
 */
export function getCountryFlag(countryCode?: string | null): string {
  if (!countryCode || countryCode.length !== 2) {
    return '🌐';
  }
  const clean = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(clean)) {
    return '🌐';
  }
  const codePoints = clean.split('').map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

/**
 * Get country name from 2-letter ISO code
 */
export function getCountryName(countryCode?: string | null): string {
  if (!countryCode) return 'Global';
  const clean = countryCode.toUpperCase();
  return COUNTRY_NAMES[clean] || clean;
}

/**
 * Extract country information from request headers safely without exposing raw IP.
 * Checks trusted edge headers first (Vercel and Cloudflare).
 */
export function detectCountryFromHeaders(
  headers: Headers | Record<string, string | string[] | undefined>
): CountryInfo {
  let rawCode: string | null = null;

  if (typeof (headers as any)?.get === 'function') {
    const h = headers as Headers;
    rawCode =
      h.get('x-vercel-ip-country') ||
      h.get('cf-ipcountry') ||
      h.get('x-country-code') ||
      null;
  } else {
    const r = headers as Record<string, string | string[] | undefined>;
    const getVal = (k: string) => {
      const v = r[k] || r[k.toLowerCase()];
      return Array.isArray(v) ? v[0] : v;
    };
    rawCode =
      getVal('x-vercel-ip-country') ||
      getVal('cf-ipcountry') ||
      getVal('x-country-code') ||
      null;
  }

  if (rawCode && rawCode.trim().length === 2 && rawCode.toUpperCase() !== 'XX') {
    const code = rawCode.trim().toUpperCase();
    return {
      countryCode: code,
      countryName: getCountryName(code),
      countryFlag: getCountryFlag(code),
    };
  }

  // Fallback default for localhost / unknown / direct dev connections
  return {
    countryCode: 'IN',
    countryName: 'India',
    countryFlag: '🇮🇳',
  };
}
