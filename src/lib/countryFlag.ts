// Utility to convert ISO 3166-1 alpha-2 country code (e.g., 'IN', 'US') to flag emoji (🇮🇳, 🇺🇸)
export function getCountryFlag(countryCode?: string): string {
  if (!countryCode || countryCode.length !== 2) {
    return '🇮🇳'; // Default fallback flag for India
  }

  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));

  return String.fromCodePoint(...codePoints);
}

export function getCountryName(countryCode?: string): string {
  if (!countryCode) return 'India';
  const code = countryCode.toUpperCase();
  const names: Record<string, string> = {
    IN: 'India',
    US: 'United States',
    GB: 'United Kingdom',
    CA: 'Canada',
    AU: 'Australia',
    AE: 'United Arab Emirates',
    DE: 'Germany',
    FR: 'France',
    JP: 'Japan',
    BR: 'Brazil',
    RU: 'Russia',
    CN: 'China',
    PK: 'Pakistan',
    BD: 'Bangladesh',
    NP: 'Nepal',
    LK: 'Sri Lanka',
    SG: 'Singapore',
    ID: 'Indonesia',
    MY: 'Malaysia',
    PH: 'Philippines',
    KR: 'South Korea',
    SA: 'Saudi Arabia',
    ZA: 'South Africa',
  };
  return names[code] || countryCode.toUpperCase();
}

let cachedCountryResult: { countryCode: string; countryName: string; flag: string } | null = null;

// Auto-detect user country code via IP API with session caching
export async function detectUserCountry(): Promise<{ countryCode: string; countryName: string; flag: string }> {
  if (cachedCountryResult) {
    return cachedCountryResult;
  }

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const stored = sessionStorage.getItem('cupidx_user_country');
      if (stored) {
        cachedCountryResult = JSON.parse(stored);
        return cachedCountryResult!;
      }
    } catch {}
  }

  try {
    const res = await fetch('https://ipapi.co/json/', { cache: 'default' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.country_code) {
        const code = data.country_code.toUpperCase();
        const result = {
          countryCode: code,
          countryName: data.country_name || getCountryName(code),
          flag: getCountryFlag(code),
        };
        cachedCountryResult = result;
        if (typeof window !== 'undefined' && window.sessionStorage) {
          try {
            sessionStorage.setItem('cupidx_user_country', JSON.stringify(result));
          } catch {}
        }
        return result;
      }
    }
  } catch (err) {
    console.warn('GeoIP detection error, using fallback:', err);
  }

  const fallback = {
    countryCode: 'IN',
    countryName: 'India',
    flag: '🇮🇳',
  };
  cachedCountryResult = fallback;
  return fallback;
}
