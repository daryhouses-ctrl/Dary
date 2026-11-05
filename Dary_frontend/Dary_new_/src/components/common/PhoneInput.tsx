import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import {
  COUNTRIES,
  getCountryInfo,
  parseAndNormalizePhone,
  type PhoneValidationResult,
} from '../../utils/phoneUtils';
import type { CountryCode } from 'libphonenumber-js';
import './PhoneInput.css';

export interface PhoneInputProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string, validationResult: PhoneValidationResult) => void;
  selectedCountry?: CountryCode;
  onCountryChange?: (country: CountryCode) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  hint?: string;
  locale?: string;
  className?: string;
  autoComplete?: string;
}

export default function PhoneInput({
  id = 'phone-input',
  name = 'phone',
  value,
  onChange,
  selectedCountry = 'EG',
  onCountryChange,
  placeholder,
  required = false,
  disabled = false,
  error,
  hint,
  locale = 'ar',
  className = '',
  autoComplete = 'tel',
}: PhoneInputProps) {
  const [internalCountry, setInternalCountry] = useState<CountryCode>(selectedCountry);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeCountryCode = selectedCountry || internalCountry;
  const currentCountry = useMemo(
    () => getCountryInfo(activeCountryCode),
    [activeCountryCode]
  );

  // Sync internal state if prop changes
  useEffect(() => {
    if (selectedCountry && selectedCountry !== internalCountry) {
      setInternalCountry(selectedCountry);
    }
  }, [selectedCountry, internalCountry]);

  // Handle clicking outside to dismiss dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search box when dropdown opens
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Validation calculation
  const validationResult = useMemo(
    () => parseAndNormalizePhone(value, activeCountryCode),
    [value, activeCountryCode]
  );

  // Filter countries for search
  const filteredCountries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => {
      return (
        c.nameAr.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.callingCode.includes(q)
      );
    });
  }, [searchQuery]);

  const handleCountrySelect = useCallback(
    (code: CountryCode) => {
      setInternalCountry(code);
      onCountryChange?.(code);
      setIsDropdownOpen(false);
      setSearchQuery('');

      // Re-validate existing input under new country rules
      const newValidation = parseAndNormalizePhone(value, code);
      onChange(value, newValidation);
      inputRef.current?.focus();
    },
    [onCountryChange, onChange, value]
  );

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;

    // Fast check: did the user paste/type a full international number with a different country code?
    const trimmed = rawVal.trim().replace(/\s+/g, '');
    let activeCountry = activeCountryCode;

    if (trimmed.startsWith('+') && trimmed.length >= 4) {
      // Find matching country calling code
      const match = COUNTRIES.find((c) => trimmed.startsWith(`+${c.callingCode}`));
      if (match && match.code !== activeCountryCode) {
        activeCountry = match.code;
        setInternalCountry(match.code);
        onCountryChange?.(match.code);
      }
    }

    const valResult = parseAndNormalizePhone(rawVal, activeCountry);
    onChange(rawVal, valResult);
  };

  const isRtl = locale === 'ar';
  const effectivePlaceholder = placeholder || currentCountry.placeholder;

  return (
    <div className={`dary-phone-field ${className}`} ref={containerRef}>
      <div
        className={`dary-phone-group ${error ? 'dary-phone-group--error' : ''} ${
          disabled ? 'dary-phone-group--disabled' : ''
        }`}
      >
        {/* Country Code Trigger Button */}
        <button
          type="button"
          className="dary-phone-country-btn"
          onClick={() => !disabled && setIsDropdownOpen((prev) => !prev)}
          disabled={disabled}
          aria-expanded={isDropdownOpen}
          aria-haspopup="listbox"
          title={isRtl ? currentCountry.nameAr : currentCountry.nameEn}
        >
          <span className="dary-phone-flag" aria-hidden="true">
            {currentCountry.flag}
          </span>
          <span className="dary-phone-dial-code">+{currentCountry.callingCode}</span>
          <svg
            className={`dary-phone-chevron ${isDropdownOpen ? 'dary-phone-chevron--open' : ''}`}
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Number Input Field */}
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="tel"
          className="dary-phone-input"
          value={value}
          onChange={handleInputChange}
          placeholder={effectivePlaceholder}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          dir="ltr"
          aria-invalid={Boolean(error)}
        />

        {/* Subtle Checkmark Indicator when Valid */}
        {validationResult.isValid && (
          <span
            className="dary-phone-valid-icon"
            title={isRtl ? 'رقم هاتف صحيح' : 'Valid phone number'}
            aria-hidden="true"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}

        {/* Country Picker Dropdown */}
        {isDropdownOpen && (
          <div className="dary-phone-dropdown" role="listbox">
            <div className="dary-phone-search-wrap">
              <input
                ref={searchInputRef}
                type="text"
                className="dary-phone-search-input"
                placeholder={isRtl ? 'ابحث عن دولة أو كود الاتصال...' : 'Search country or code...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                dir={isRtl ? 'rtl' : 'ltr'}
              />
            </div>

            <ul className="dary-phone-list">
              {filteredCountries.length > 0 ? (
                filteredCountries.map((c) => {
                  const isSelected = c.code === activeCountryCode;
                  return (
                    <li
                      key={c.code}
                      className={`dary-phone-item ${isSelected ? 'dary-phone-item--active' : ''}`}
                      onClick={() => handleCountrySelect(c.code)}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <div className="dary-phone-item-main">
                        <span className="dary-phone-item-flag" aria-hidden="true">
                          {c.flag}
                        </span>
                        <span className="dary-phone-item-name">
                          {isRtl ? c.nameAr : c.nameEn}
                        </span>
                      </div>
                      <span className="dary-phone-item-code">+{c.callingCode}</span>
                    </li>
                  );
                })
              ) : (
                <div className="dary-phone-empty">
                  {isRtl ? 'لا توجد دول مطابقة' : 'No matching countries'}
                </div>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Field Hint or Error */}
      {error ? (
        <span className="dary-phone-error" role="alert">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </span>
      ) : hint ? (
        <span className="dary-phone-hint">{hint}</span>
      ) : null}
    </div>
  );
}
