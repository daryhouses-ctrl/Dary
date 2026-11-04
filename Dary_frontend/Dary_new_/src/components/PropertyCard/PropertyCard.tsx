import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '../../utils/LocaleContext';
import type { Property } from '../../types/property';
import { getPropertyOccupancySummary } from '../../services/occupancyService';
import './PropertyCard.css';

interface PropertyCardProps {
  property: Property;
  customBookings?: any[];
}

export default function PropertyCard({ property, customBookings }: PropertyCardProps) {
  const { t, locale } = useLocale();

  const occ = useMemo(() => {
    return getPropertyOccupancySummary(property, customBookings, locale);
  }, [property, customBookings, locale]);

  const currencyLabel = useMemo(() => {
    if (locale === 'ar') {
      return property.currency === 'AED' || property.currency === 'EGP' || !property.currency
        ? 'ج.م'
        : property.currency;
    }
    return property.currency === 'AED' || !property.currency ? 'EGP' : property.currency;
  }, [locale, property.currency]);

  return (
    <article className="property-card">
      <Link
        to={`/properties/${property.id}`}
        state={{ property }}
        className="property-card-link-wrapper"
      >
        {/* Media */}
        <div className="property-card-media">
          <img
            src={property.image}
            alt={property.title[locale]}
            className="property-card-image"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&q=80&w=600&h=400&fit=crop';
            }}
          />

          {/* Top Right: Property Type Badge */}
          <span className="property-badge-type">{property.type[locale]}</span>

          {/* Top Left: Availability Badge */}
          {occ.badgeType === 'occupied' && (
            <span className="property-badge-availability badge-occupied">
              {occ.vacatingDate
                ? (locale === 'ar' ? `محجوز حتى ${occ.vacatingDate}` : `Booked until ${occ.vacatingDate}`)
                : (locale === 'ar' ? 'محجوز بالكامل' : 'Fully Booked')}
            </span>
          )}

          {occ.badgeType === 'partial' && (
            <span className="property-badge-availability badge-partial">
              {locale === 'ar'
                ? (occ.totalBeds > 1 ? `متاح من ${occ.availableBeds} أسرة` : 'متاح للحجز')
                : `${occ.availableBeds} beds available`}
            </span>
          )}

          {occ.badgeType === 'available' && (
            <span className="property-badge-availability badge-available">
              {locale === 'ar' ? 'متاح للحجز' : 'Available'}
            </span>
          )}
        </div>

        {/* Content Body */}
        <div className="property-card-content">
          {/* 1. Location */}
          <div className="property-card-location">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="property-location-text">{property.location[locale]}</span>
          </div>

          {/* 2. Property Title */}
          <h3 className="property-card-title" title={property.title[locale]}>
            {property.title[locale]}
          </h3>

          {/* 3. Property Details (Bedrooms & Bathrooms) */}
          <div className="property-card-specs">
            <span className="property-spec-item">
              {property.bedrooms} {t.bedrooms_label || (locale === 'ar' ? 'غرفة' : 'Bedrooms')}
            </span>
            <span className="property-spec-dot">•</span>
            <span className="property-spec-item">
              {property.bathrooms} {t.bathrooms_label || (locale === 'ar' ? 'حمام' : 'Bathrooms')}
            </span>
          </div>

          {/* 4. Dedicated Availability Section */}
          <div className={`property-availability-box box-${occ.badgeType}`}>
            {occ.badgeType === 'occupied' && (
              <div className="property-avail-content">
                <span className="property-avail-status text-occupied">
                  {occ.vacatingDate
                    ? (locale === 'ar' ? `محجوز حتى ${occ.vacatingDate}` : `Booked until ${occ.vacatingDate}`)
                    : (locale === 'ar' ? 'محجوز بالكامل' : 'Fully Booked')}
                </span>
              </div>
            )}

            {occ.badgeType === 'partial' && (
              <div className="property-avail-content">
                <span className="property-avail-status text-partial">
                  {locale === 'ar'
                    ? (occ.totalBeds > 1 ? `متاح من ${occ.availableBeds} أسرة` : 'متاح للحجز')
                    : `${occ.availableBeds} of ${occ.totalBeds} beds available`}
                </span>
                {(occ.rangeDisplay || (occ.startFormatted && occ.endFormatted)) && (
                  <span className="property-avail-period">
                    {locale === 'ar' ? 'فترة الحجز: ' : 'Booking period: '}
                    <span className="property-avail-dates">
                      {occ.rangeDisplay || `${occ.startFormatted} – ${occ.endFormatted}`}
                    </span>
                  </span>
                )}
              </div>
            )}

            {occ.badgeType === 'available' && (
              <div className="property-avail-content">
                <span className="property-avail-status text-available">
                  {locale === 'ar' ? 'شاغر ومتاح للحجز' : 'Vacant & Available'}
                </span>
              </div>
            )}
          </div>

          {/* 5. Footer: Price & CTA button on the same horizontal level */}
          <div className="property-card-footer">
            <div className="property-card-price-wrap">
              <span className="property-card-price">
                {property.price.toLocaleString()}
              </span>
              <span className="property-card-currency">
                {currencyLabel}
              </span>
              <span className="property-card-period">
                /{t.per_month || (locale === 'ar' ? 'شهر' : 'mo')}
              </span>
            </div>

            <span className="property-card-btn">
              <span>{t.featured_view || (locale === 'ar' ? 'عرض التفاصيل' : 'View Details')}</span>
              <svg
                className="property-card-btn-arrow"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {locale === 'ar' ? (
                  <path d="m15 18-6-6 6-6" />
                ) : (
                  <path d="m9 18 6-6-6-6" />
                )}
              </svg>
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
