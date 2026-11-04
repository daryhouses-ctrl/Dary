import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocale } from '../../utils/LocaleContext';
import './DarySelect.css';

export interface DarySelectOption {
  value: string;
  label: string | { ar: string; en: string };
  count?: number;
  badge?: string;
  disabled?: boolean;
}

export interface DarySelectProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: DarySelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  searchable?: boolean;
  maxHeight?: number;
  compact?: boolean;
  icon?: React.ReactNode;
}

const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    className={`dary-select-chevron ${isOpen ? 'is-open' : ''}`}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CheckIcon = () => (
  <svg
    className="dary-select-check"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const DarySelect: React.FC<DarySelectProps> = ({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  className = '',
  searchable,
  maxHeight,
  compact = false,
  icon,
}) => {
  const { locale } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [openUpward, setOpenUpward] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Helper to resolve localized string
  const getLabelString = useCallback(
    (lbl: string | { ar: string; en: string }): string => {
      if (typeof lbl === 'object' && lbl !== null) {
        return lbl[locale] || lbl.ar || lbl.en || '';
      }
      return String(lbl || '');
    },
    [locale]
  );

  // Current selected option
  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value) || null;
  }, [options, value]);

  const displayValue = selectedOption
    ? getLabelString(selectedOption.label)
    : placeholder || (locale === 'ar' ? 'اختر...' : 'Select...');

  // Auto-enable search inside dropdown if option count is large (> 7) or explicitly requested
  const isSearchEnabled = searchable !== undefined ? searchable : options.length > 7;

  // Filtered options based on internal search
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const cleanSearch = searchTerm.trim().toLowerCase();
    return options.filter((opt) => {
      const text = getLabelString(opt.label).toLowerCase();
      return text.includes(cleanSearch);
    });
  }, [options, searchTerm, getLabelString]);

  // Recalculate collision & direction (flip upwards if near screen bottom)
  const updateDirection = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const estimatedHeight = Math.min(maxHeight || 240, filteredOptions.length * 44 + 50);

    // If space below is not enough and space above is larger, flip upward
    if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
      setOpenUpward(true);
    } else {
      setOpenUpward(false);
    }
  }, [maxHeight, filteredOptions.length]);

  // Toggle open
  const handleToggle = () => {
    if (isOpen) {
      setIsOpen(false);
    } else {
      updateDirection();
      setSearchTerm('');
      setHighlightedIndex(-1);
      setIsOpen(true);
    }
  };

  // Close when clicked outside
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      updateDirection();
    };

    document.addEventListener('mousedown', handleOutsideClick, true);
    document.addEventListener('touchstart', handleOutsideClick, true);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true);
      document.removeEventListener('touchstart', handleOutsideClick, true);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updateDirection]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && isSearchEnabled && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isSearchEnabled]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
        updateDirection();
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          const opt = filteredOptions[highlightedIndex];
          if (!opt.disabled) {
            onChange(opt.value);
            setIsOpen(false);
          }
        }
        break;
      default:
        break;
    }
  };

  const handleSelectOption = (optValue: string, disabled?: boolean) => {
    if (disabled) return;
    onChange(optValue);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      id={id}
      className={`dary-select-container ${compact ? 'is-compact' : ''} ${className} ${
        isOpen ? 'is-active' : ''
      }`}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <button
        type="button"
        className={`dary-select-trigger ${isOpen ? 'is-open' : ''} ${
          value ? 'has-value' : ''
        }`}
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || label || displayValue}
      >
        <div className="dary-select-texts">
          {label && <span className="dary-select-label">{label}</span>}
          <span className={`dary-select-value ${!selectedOption?.value ? 'is-placeholder' : ''}`}>
            {displayValue}
          </span>
        </div>

        <div className="dary-select-actions">
          {icon && <span className="dary-select-icon">{icon}</span>}
          <ChevronIcon isOpen={isOpen} />
        </div>
      </button>

      {/* Dropdown Floating Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          className={`dary-select-menu ${openUpward ? 'is-upward' : 'is-downward'}`}
          role="listbox"
          style={{
            maxHeight: maxHeight ? `${maxHeight}px` : undefined,
          }}
        >
          {/* Optional Search Input */}
          {isSearchEnabled && (
            <div className="dary-select-search-box" onClick={(e) => e.stopPropagation()}>
              <input
                ref={searchInputRef}
                type="text"
                className="dary-select-search-input"
                placeholder={locale === 'ar' ? 'ابحث في الخيارات...' : 'Search options...'}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setHighlightedIndex(0);
                }}
                aria-label="Filter options"
              />
              {searchTerm && (
                <button
                  type="button"
                  className="dary-select-search-clear"
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Options List */}
          <div className="dary-select-options-list">
            {filteredOptions.length === 0 ? (
              <div className="dary-select-empty">
                {locale === 'ar' ? 'لا توجد خيارات مطابقة' : 'No matching options'}
              </div>
            ) : (
              filteredOptions.map((opt, index) => {
                const isSelected = opt.value === value;
                const isHighlighted = index === highlightedIndex;
                const labelText = getLabelString(opt.label);

                return (
                  <button
                    key={`${opt.value}-${index}`}
                    type="button"
                    className={`dary-select-option ${isSelected ? 'is-selected' : ''} ${
                      isHighlighted ? 'is-highlighted' : ''
                    } ${opt.disabled ? 'is-disabled' : ''}`}
                    onClick={() => handleSelectOption(opt.value, opt.disabled)}
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                  >
                    <span className="dary-select-option-text">{labelText}</span>

                    <div className="dary-select-option-meta">
                      {opt.count !== undefined && opt.count > 0 && (
                        <span className="dary-select-option-count">
                          {opt.count}
                        </span>
                      )}
                      {opt.badge && (
                        <span className="dary-select-option-badge">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <CheckIcon />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DarySelect;
