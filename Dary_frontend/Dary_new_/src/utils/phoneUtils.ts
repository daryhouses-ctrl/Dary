import {
  parsePhoneNumberFromString,
  getCountryCallingCode,
  type CountryCode,
} from 'libphonenumber-js';

export interface CountryInfo {
  code: CountryCode;
  nameAr: string;
  nameEn: string;
  callingCode: string;
  flag: string;
  placeholder: string;
}

/**
 * Curated list of countries with priority to Arab/MENA region followed by major international destinations
 */
export const COUNTRIES: CountryInfo[] = [
  { code: 'EG', nameAr: 'مصر', nameEn: 'Egypt', callingCode: '20', flag: '🇪🇬', placeholder: '010 1234 5678' },
  { code: 'SA', nameAr: 'السعودية', nameEn: 'Saudi Arabia', callingCode: '966', flag: '🇸🇦', placeholder: '050 123 4567' },
  { code: 'AE', nameAr: 'الإمارات', nameEn: 'UAE', callingCode: '971', flag: '🇦🇪', placeholder: '050 123 4567' },
  { code: 'KW', nameAr: 'الكويت', nameEn: 'Kuwait', callingCode: '965', flag: '🇰🇼', placeholder: '9876 5432' },
  { code: 'JO', nameAr: 'الأردن', nameEn: 'Jordan', callingCode: '962', flag: '🇯🇴', placeholder: '07 9123 4567' },
  { code: 'QA', nameAr: 'قطر', nameEn: 'Qatar', callingCode: '974', flag: '🇶🇦', placeholder: '3312 3456' },
  { code: 'OM', nameAr: 'عُمان', nameEn: 'Oman', callingCode: '968', flag: '🇴🇲', placeholder: '9123 4567' },
  { code: 'BH', nameAr: 'البحرين', nameEn: 'Bahrain', callingCode: '973', flag: '🇧🇭', placeholder: '3612 3456' },
  { code: 'IQ', nameAr: 'العراق', nameEn: 'Iraq', callingCode: '964', flag: '🇮🇶', placeholder: '0790 123 4567' },
  { code: 'PS', nameAr: 'فلسطين', nameEn: 'Palestine', callingCode: '970', flag: '🇵🇸', placeholder: '059 912 3456' },
  { code: 'LB', nameAr: 'لبنان', nameEn: 'Lebanon', callingCode: '961', flag: '🇱🇧', placeholder: '70 123 456' },
  { code: 'SY', nameAr: 'سوريا', nameEn: 'Syria', callingCode: '963', flag: '🇸🇾', placeholder: '0944 123 456' },
  { code: 'YE', nameAr: 'اليمن', nameEn: 'Yemen', callingCode: '967', flag: '🇾🇪', placeholder: '771 234 567' },
  { code: 'SD', nameAr: 'السودان', nameEn: 'Sudan', callingCode: '249', flag: '🇸🇩', placeholder: '091 234 5678' },
  { code: 'LY', nameAr: 'ليبيا', nameEn: 'Libya', callingCode: '218', flag: '🇱🇾', placeholder: '091 234 5678' },
  { code: 'TN', nameAr: 'تونس', nameEn: 'Tunisia', callingCode: '216', flag: '🇹🇳', placeholder: '20 123 456' },
  { code: 'DZ', nameAr: 'الجزائر', nameEn: 'Algeria', callingCode: '213', flag: '🇩🇿', placeholder: '0551 23 45 67' },
  { code: 'MA', nameAr: 'المغرب', nameEn: 'Morocco', callingCode: '212', flag: '🇲🇦', placeholder: '0612 34 56 78' },
  { code: 'TR', nameAr: 'تركيا', nameEn: 'Turkey', callingCode: '90', flag: '🇹🇷', placeholder: '0512 345 67 89' },
  { code: 'US', nameAr: 'الولايات المتحدة / كندا', nameEn: 'USA / Canada', callingCode: '1', flag: '🇺🇸', placeholder: '(201) 555-0123' },
  { code: 'GB', nameAr: 'المملكة المتحدة', nameEn: 'United Kingdom', callingCode: '44', flag: '🇬🇧', placeholder: '07123 456789' },
  { code: 'DE', nameAr: 'ألمانيا', nameEn: 'Germany', callingCode: '49', flag: '🇩🇪', placeholder: '0151 23456789' },
  { code: 'FR', nameAr: 'فرنسا', nameEn: 'France', callingCode: '33', flag: '🇫🇷', placeholder: '06 12 34 56 78' },
  { code: 'IT', nameAr: 'إيطاليا', nameEn: 'Italy', callingCode: '39', flag: '🇮🇹', placeholder: '312 345 6789' },
  { code: 'MY', nameAr: 'ماليزيا', nameEn: 'Malaysia', callingCode: '60', flag: '🇲🇾', placeholder: '012-345 6789' },
  { code: 'ID', nameAr: 'إندونيسيا', nameEn: 'Indonesia', callingCode: '62', flag: '🇮🇩', placeholder: '0812-3456-7890' },
  { code: 'IN', nameAr: 'الهند', nameEn: 'India', callingCode: '91', flag: '🇮🇳', placeholder: '98123 45678' },
];

export interface PhoneValidationResult {
  isValid: boolean;
  e164: string;
  nationalNumber: string;
  formattedInternational: string;
  formattedNational: string;
  country: CountryCode;
  callingCode: string;
  error?: 'empty' | 'invalid';
}

/**
 * Finds country info by CountryCode (defaults to 'EG')
 */
export function getCountryInfo(code: CountryCode = 'EG'): CountryInfo {
  return COUNTRIES.find((c) => c.code === code) || COUNTRIES[0];
}

/**
 * Normalizes and validates any telephone input across different formats:
 * - Local formats: 01098198514, 0501234567
 * - Missing leading zero: 1098198514, 501234567
 * - International formats: +201098198514, 00201098198514, 201098198514
 * - Redundant zeros: +2001098198514 -> +201098198514
 * - Clean characters: spaces, dashes, brackets removed
 */
export function parseAndNormalizePhone(
  rawInput: string,
  defaultCountry: CountryCode = 'EG'
): PhoneValidationResult {
  if (!rawInput || !rawInput.trim()) {
    const info = getCountryInfo(defaultCountry);
    return {
      isValid: false,
      e164: '',
      nationalNumber: '',
      formattedInternational: '',
      formattedNational: '',
      country: defaultCountry,
      callingCode: info.callingCode,
      error: 'empty',
    };
  }

  // 1. Remove spaces, dashes, dots, and brackets
  let clean = rawInput.trim().replace(/[\s\-\(\)\.]+/g, '');

  // 2. Convert leading "00" to "+"
  if (clean.startsWith('00')) {
    clean = '+' + clean.slice(2);
  }

  // 3. Resolve calling code for selected country
  let callingCode = '20';
  try {
    callingCode = getCountryCallingCode(defaultCountry);
  } catch {
    callingCode = getCountryInfo(defaultCountry).callingCode;
  }

  // 4. Handle edge case: +{callingCode}0... -> strip the extra national 0
  // e.g. +2001098198514 -> +201098198514
  const doubleZeroPrefix = `+${callingCode}0`;
  if (clean.startsWith(doubleZeroPrefix)) {
    clean = `+${callingCode}` + clean.slice(doubleZeroPrefix.length);
  }

  // 5. Handle edge case: user typed calling code without +
  // e.g. "201098198514" when default is "EG" (20)
  if (!clean.startsWith('+') && clean.startsWith(callingCode) && clean.length > callingCode.length + 6) {
    clean = `+${clean}`;
  }

  // 6. Attempt parsing with libphonenumber-js
  let parsed = clean.startsWith('+')
    ? parsePhoneNumberFromString(clean)
    : parsePhoneNumberFromString(clean, defaultCountry);

  // Fallback: If not starting with + but parsing returned null, try again with default country
  if ((!parsed || !parsed.isValid()) && !clean.startsWith('+')) {
    parsed = parsePhoneNumberFromString(clean, defaultCountry);
  }

  // Fallback 2: If user entered an international number like +966... while default was EG,
  // libphonenumber-js accurately detects parsed.country as 'SA'
  const detectedCountry = (parsed?.country as CountryCode) || defaultCountry;

  if (parsed && parsed.isValid()) {
    return {
      isValid: true,
      e164: parsed.number,
      nationalNumber: parsed.nationalNumber,
      formattedInternational: parsed.formatInternational(),
      formattedNational: parsed.formatNational(),
      country: detectedCountry,
      callingCode: parsed.countryCallingCode,
    };
  }

  return {
    isValid: false,
    e164: parsed ? parsed.number : clean,
    nationalNumber: parsed ? parsed.nationalNumber : clean,
    formattedInternational: clean,
    formattedNational: clean,
    country: detectedCountry,
    callingCode,
    error: 'invalid',
  };
}
