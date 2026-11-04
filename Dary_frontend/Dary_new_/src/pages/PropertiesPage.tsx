import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLocale } from '../utils/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { propertyService, matchesPropertyFilters, type PropertyFilterParams, type PropertyFilterFacets } from '../services/propertyService';
import { fetchGlobalActiveBookings } from '../services/occupancyService';
import type { Property } from '../types/property';
import PropertyCard from '../components/PropertyCard/PropertyCard';
import AnimatedCounter from '../components/common/AnimatedCounter';
import InteractiveMap from '../components/common/InteractiveMap';
import DarySelect from '../components/common/DarySelect';
import {
  LocationService,
  resolveCoordinates,
  calculateDistanceKm,
  normalizeArabicForSearch,
  DEFAULT_CAIRO_LAT,
  DEFAULT_CAIRO_LNG,
} from '../services/locationService';
import type { Coordinates } from '../services/locationService';
import './PropertiesPage.css';

interface PriceRangeOption {
  value: string;
  label: { ar: string; en: string };
  min?: number;
  max?: number;
}

const priceRanges: PriceRangeOption[] = [
  { value: '', label: { ar: 'أي ميزانية', en: 'Any Budget' }, min: undefined, max: undefined },
  { value: 'under-1000', label: { ar: 'أقل من 1,000 ج.م', en: 'Under 1,000 EGP' }, min: undefined, max: 1000 },
  { value: '1000-2000', label: { ar: '1,000 – 2,000 ج.م', en: '1,000 – 2,000 EGP' }, min: 1000, max: 2000 },
  { value: '2000-3000', label: { ar: '2,000 – 3,000 ج.م', en: '2,000 – 3,000 EGP' }, min: 2000, max: 3000 },
  { value: '3000-5000', label: { ar: '3,000 – 5,000 ج.م', en: '3,000 – 5,000 EGP' }, min: 3000, max: 5000 },
  { value: '3000-6000', label: { ar: '3,000 – 6,000 ج.م', en: '3,000 – 6,000 EGP' }, min: 3000, max: 6000 },
  { value: 'over-5000', label: { ar: 'أكثر من 5,000 ج.م', en: 'Over 5,000 EGP' }, min: 5000, max: undefined },
  { value: 'custom', label: { ar: 'تحديد ميزانية مخصصة...', en: 'Custom Price Range...' }, min: undefined, max: undefined },
];

const baseCityOptions = [
  { value: '', label: { ar: 'جميع المواقع', en: 'All Locations' } },
  { value: 'cairo', label: { ar: 'القاهرة الكبرى (مدينة نصر / المعادي)', en: 'Cairo (Nasr City / Maadi)' } },
  { value: 'new_cairo', label: { ar: 'القاهرة الجديدة / التجمع الخامس', en: 'New Cairo / Fifth Settlement' } },
  { value: 'giza', label: { ar: 'الجيزة (الدقي / المهندسين)', en: 'Giza (Dokki / Mohandessin)' } },
  { value: 'october', label: { ar: '6 أكتوبر والشيخ زايد', en: '6th of October & Sheikh Zayed' } },
  { value: 'mansoura', label: { ar: 'المنصورة / الدقهلية', en: 'Mansoura / Dakahlia' } },
  { value: 'tanta', label: { ar: 'طنطا / الغربية', en: 'Tanta / Gharbia' } },
  { value: 'alexandria', label: { ar: 'الإسكندرية', en: 'Alexandria' } },
  { value: 'zagazig', label: { ar: 'الزقازيق / الشرقية', en: 'Zagazig / Sharqia' } },
  { value: 'kafr_el_sheikh', label: { ar: 'كفر الشيخ', en: 'Kafr El Sheikh' } },
  { value: 'benha', label: { ar: 'بنها / القليوبية', en: 'Benha / Qalyubia' } },
  { value: 'menoufia', label: { ar: 'شبين الكوم / المنوفية', en: 'Menoufia / Shebin El Kom' } },
  { value: 'damietta', label: { ar: 'دمياط / دمياط الجديدة', en: 'Damietta' } },
  { value: 'ismailia', label: { ar: 'الإسماعيلية / قناة السويس', en: 'Ismailia' } },
  { value: 'assiut', label: { ar: 'أسيوط', en: 'Assiut' } },
  { value: 'fayoum', label: { ar: 'الفيوم / بني سويف', en: 'Fayoum / Beni Suef' } },
  { value: 'minya', label: { ar: 'المنيا', en: 'Minya' } },
  { value: 'sohag', label: { ar: 'سوهاج / قنا / أسوان', en: 'Sohag / Qena / Aswan' } },
];

const baseUniversityOptions = [
  { value: '', label: { ar: 'جميع الجامعات', en: 'All Universities' } },
  { value: 'جامعة القاهرة', label: { ar: 'جامعة القاهرة', en: 'Cairo University' } },
  { value: 'جامعة عين شمس', label: { ar: 'جامعة عين شمس', en: 'Ain Shams University' } },
  { value: 'جامعة المنصورة', label: { ar: 'جامعة المنصورة', en: 'Mansoura University' } },
  { value: 'جامعة طنطا', label: { ar: 'جامعة طنطا', en: 'Tanta University' } },
  { value: 'جامعة الإسكندرية', label: { ar: 'جامعة الإسكندرية', en: 'Alexandria University' } },
  { value: 'جامعة الزقازيق', label: { ar: 'جامعة الزقازيق', en: 'Zagazig University' } },
  { value: 'جامعة الأزهر', label: { ar: 'جامعة الأزهر', en: 'Al-Azhar University' } },
  { value: 'جامعة حلوان', label: { ar: 'جامعة حلوان', en: 'Helwan University' } },
  { value: 'جامعة كفر الشيخ', label: { ar: 'جامعة كفر الشيخ', en: 'Kafr El Sheikh University' } },
  { value: 'جامعة بنها', label: { ar: 'جامعة بنها', en: 'Benha University' } },
  { value: 'جامعة المنوفية', label: { ar: 'جامعة المنوفية', en: 'Menoufia University' } },
  { value: 'جامعة أسيوط', label: { ar: 'جامعة أسيوط', en: 'Assiut University' } },
  { value: 'جامعة 6 أكتوبر', label: { ar: 'جامعة 6 أكتوبر / MSA / MUST', en: '6th of October / MSA / MUST' } },
  { value: 'الجامعة الأمريكية', label: { ar: 'الجامعة الأمريكية / الألمانية (AUC / GUC)', en: 'AUC / GUC / FUE' } },
];

const typeOptions = [
  { value: '', label: { ar: 'جميع الأنواع', en: 'All Types' } },
  { value: 'shared_apartment', label: { ar: 'سكن طلابي (شقة مشتركة)', en: 'Shared Apartment' } },
  { value: 'private_room', label: { ar: 'غرفة خاصة', en: 'Private Room' } },
  { value: 'shared_room', label: { ar: 'غرفة مشتركة', en: 'Shared Room' } },
  { value: 'studio', label: { ar: 'استوديو مستقل', en: 'Studio' } },
  { value: 'entire_apartment', label: { ar: 'شقة كاملة', en: 'Entire Apartment' } },
];

const roomTypeOptions = [
  { value: '', label: { ar: 'جميع أنواع الغرف', en: 'All Room Types' } },
  { value: 'SINGLE', label: { ar: 'غرفة فردية (سرير واحد)', en: 'Single Room (1 Bed)' } },
  { value: 'DOUBLE', label: { ar: 'غرفة ثنائية (سريران)', en: 'Double Room (2 Beds)' } },
  { value: 'TRIPLE', label: { ar: 'غرفة ثلاثية (3 أسرة)', en: 'Triple Room (3 Beds)' } },
  { value: 'QUAD', label: { ar: 'غرفة رباعية (4 أسرة)', en: 'Quad Room (4 Beds)' } },
];

const genderOptions = [
  { value: '', label: { ar: 'الكل (شباب وبنات)', en: 'All (Male & Female)' } },
  { value: 'male_only', label: { ar: 'سكن شباب فقط', en: 'Male Students Only' } },
  { value: 'female_only', label: { ar: 'سكن بنات فقط', en: 'Female Students Only' } },
];

const classOptions = [
  { value: '', label: { ar: 'جميع الفئات', en: 'All Classes' } },
  { value: 'STANDARD', label: { ar: 'قياسي / اقتصادي', en: 'Standard / Economy' } },
  { value: 'LUXURY', label: { ar: 'فاخر / مميز', en: 'Luxury / Premium' } },
];

const bedroomOptions = [
  { value: '', label: { ar: 'أي عدد غرف', en: 'Any Number of Rooms' } },
  { value: '1', label: { ar: 'غرفة واحدة (1)', en: '1 Room' } },
  { value: '2', label: { ar: 'غرفتان (2)', en: '2 Rooms' } },
  { value: '3', label: { ar: '3 غرف', en: '3 Rooms' } },
  { value: '4', label: { ar: '4 غرف أو أكثر', en: '4+ Rooms' } },
];

const distanceOptions = [
  { value: '', label: { ar: 'أي مسافة عن الجامعة', en: 'Any Distance' } },
  { value: '1', label: { ar: 'أقل من 1 كم (دقائق مشياً)', en: 'Within 1 km (Walking)' } },
  { value: '2', label: { ar: 'أقل من 2 كم عن الجامعة', en: 'Within 2 km' } },
  { value: '5', label: { ar: 'أقل من 5 كم عن الجامعة', en: 'Within 5 km' } },
  { value: '10', label: { ar: 'أقل من 10 كم عن الجامعة', en: 'Within 10 km' } },
];

const sortOptions = [
  { value: 'newest', label: { ar: 'الأحدث أولاً', en: 'Newest First' } },
  { value: 'recommended', label: { ar: 'الموصى به', en: 'Recommended' } },
  { value: 'popular', label: { ar: 'الأكثر طلباً ومشاهدة', en: 'Most Popular' } },
  { value: 'nearest', label: { ar: 'الأقرب لموقعي (GPS)', en: 'Nearest to Me' } },
  { value: 'university_distance', label: { ar: 'الأقرب للجامعة', en: 'Closest to University' } },
  { value: 'price_asc', label: { ar: 'السعر: من الأقل للأعلى', en: 'Price: Low to High' } },
  { value: 'price_desc', label: { ar: 'السعر: من الأعلى للأقل', en: 'Price: High to Low' } },
];

const ChevronDownIcon = () => (
  <svg
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

export default function PropertiesPage() {
  const { t, locale } = useLocale();
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Primary Filter States
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [university, setUniversity] = useState(searchParams.get('university') || '');
  const [propertyType, setPropertyType] = useState(searchParams.get('propertyType') || '');
  const [genderAllowed, setGenderAllowed] = useState(searchParams.get('genderAllowed') || '');
  const [priceRange, setPriceRange] = useState(searchParams.get('priceRange') || '');
  const [customMinPrice, setCustomMinPrice] = useState(searchParams.get('minPrice') || '');
  const [customMaxPrice, setCustomMaxPrice] = useState(searchParams.get('maxPrice') || '');

  // Secondary / Precision Filter States
  const [roomType, setRoomType] = useState(searchParams.get('roomType') || '');
  const [bedrooms, setBedrooms] = useState(searchParams.get('bedrooms') || searchParams.get('rooms') || '');
  const [propertyClass, setPropertyClass] = useState(searchParams.get('propertyClass') || '');
  const [maxDistance, setMaxDistance] = useState(searchParams.get('maxDistance') || '');
  const [availableOnly, setAvailableOnly] = useState(searchParams.get('availableOnly') === 'true');
  const [isFurnished, setIsFurnished] = useState(searchParams.get('isFurnished') === 'true');
  const [internetIncluded, setInternetIncluded] = useState(searchParams.get('internetIncluded') === 'true');
  const [billsIncluded, setBillsIncluded] = useState(searchParams.get('billsIncluded') === 'true');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'recommended');

  // Mobile Filter Drawer State
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Lock body scroll and handle ESC key when mobile drawer is open
  useEffect(() => {
    if (mobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setMobileDrawerOpen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [mobileDrawerOpen]);

  // Data & Lifecycle States (allProperties holds the full normalized list from the backend)
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Proactively fetch global active bookings (admin only) so property cards reflect live vacancy schedules
  useEffect(() => {
    if (isAdmin) {
      fetchGlobalActiveBookings().catch(() => {});
    }
  }, [isAdmin]);

  // Debounce search input (250ms for snappy feedback)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Sync state to URL query params
  useEffect(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (city) params.city = city;
    if (university) params.university = university;
    if (propertyType) params.propertyType = propertyType;
    if (genderAllowed) params.genderAllowed = genderAllowed;
    if (priceRange) params.priceRange = priceRange;
    if (priceRange === 'custom' && customMinPrice) params.minPrice = customMinPrice;
    if (priceRange === 'custom' && customMaxPrice) params.maxPrice = customMaxPrice;
    if (roomType) params.roomType = roomType;
    if (bedrooms) params.rooms = bedrooms;
    if (propertyClass) params.propertyClass = propertyClass;
    if (maxDistance) params.maxDistance = maxDistance;
    if (availableOnly) params.availableOnly = 'true';
    if (isFurnished) params.isFurnished = 'true';
    if (internetIncluded) params.internetIncluded = 'true';
    if (billsIncluded) params.billsIncluded = 'true';
    if (sortBy && sortBy !== 'recommended') params.sort = sortBy;
    setSearchParams(params, { replace: true });
  }, [
    debouncedSearch,
    city,
    university,
    propertyType,
    genderAllowed,
    priceRange,
    customMinPrice,
    customMaxPrice,
    roomType,
    bedrooms,
    propertyClass,
    maxDistance,
    availableOnly,
    isFurnished,
    internetIncluded,
    billsIncluded,
    sortBy,
    setSearchParams,
  ]);

  // Reload counter for manual retries
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Dynamic filter facets from database
  const [facets, setFacets] = useState<PropertyFilterFacets | null>(null);

  useEffect(() => {
    propertyService
      .getFilterFacets()
      .then((res) => {
        if (res) setFacets(res);
      })
      .catch(() => {});
  }, [reloadTrigger]);

  // Fetch full public dataset from backend once (and on reloadTrigger) so filtering is instant and 100% accurate
  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);

    propertyService
      .getProperties({ limit: 100 })
      .then((data) => {
        if (!ignore) {
          setAllProperties(data);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (!ignore) {
          console.error('Failed to load properties from API:', err);
          setError(t.properties_error_desc);
          setAllProperties([]);
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [reloadTrigger, t.properties_error_desc]);

  const loadProperties = useCallback(() => {
    setReloadTrigger((prev) => prev + 1);
  }, []);

  const handleRetry = loadProperties;

  // Expose loadProperties on window for dev/console/debugging convenience
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).loadProperties = loadProperties;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).loadProperties;
      }
    };
  }, [loadProperties]);

  // Dynamically enrich city options with primary options + backend facets + discovered locations
  const cityOptions = useMemo(() => {
    const withCounts = baseCityOptions.map((opt) => {
      if (!opt.value) return { ...opt, count: allProperties.length };
      const count = allProperties.filter((p) => matchesPropertyFilters(p, { city: opt.value })).length;
      return { ...opt, count };
    });

    const seenNorms = new Set<string>();
    for (const opt of baseCityOptions) {
      if (opt.value) {
        seenNorms.add(normalizeArabicForSearch(opt.value));
        seenNorms.add(normalizeArabicForSearch(opt.label.ar));
      }
    }

    const discoveredCities = new Map<string, number>();

    // 1. From backend facets
    const facetLocations = [
      ...(facets?.governorates || []),
      ...(facets?.cities || []),
      ...(facets?.districts || []),
    ];
    for (const loc of facetLocations) {
      const clean = (loc || '').trim();
      if (!clean) continue;
      const norm = normalizeArabicForSearch(clean);
      if (norm.length >= 3 && !seenNorms.has(norm)) {
        seenNorms.add(norm);
        discoveredCities.set(clean, 0);
      }
    }

    // 2. From allProperties with live property counts
    for (const p of allProperties) {
      const c = (p.city || p.governorate || p.district || '').trim();
      if (!c) continue;
      const norm = normalizeArabicForSearch(c);
      const isAlreadyBase = baseCityOptions.some(
        (opt) => opt.value && matchesPropertyFilters(p, { city: opt.value })
      );
      if (!isAlreadyBase) {
        const existingKey = Array.from(discoveredCities.keys()).find(
          (k) => normalizeArabicForSearch(k) === norm
        );
        const key = existingKey || c;
        discoveredCities.set(key, (discoveredCities.get(key) || 0) + 1);
      }
    }

    const extraOptions = Array.from(discoveredCities.entries()).map(([cName, count]) => ({
      value: cName,
      label: { ar: cName, en: cName },
      count,
    }));

    return [...withCounts, ...extraOptions];
  }, [allProperties, facets]);

  // Dynamically enrich university options with primary options + backend facets + discovered universities
  const universityOptions = useMemo(() => {
    const withCounts = baseUniversityOptions.map((opt) => {
      if (!opt.value) return { ...opt, count: allProperties.length };
      const count = allProperties.filter((p) => matchesPropertyFilters(p, { university: opt.value })).length;
      return { ...opt, count };
    });

    const seen = new Set(baseUniversityOptions.map((u) => normalizeArabicForSearch(u.value.replace(/^جامعة\s+/, ''))));
    const extraMap = new Map<string, number>();

    // 1. From facets
    for (const u of facets?.universities || []) {
      const clean = (u || '').trim();
      if (!clean) continue;
      const normCore = normalizeArabicForSearch(clean.replace(/^جامعة\s+/, ''));
      if (normCore && !seen.has(normCore)) {
        seen.add(normCore);
        extraMap.set(clean, 0);
      }
    }

    // 2. From allProperties with live property counts
    for (const p of allProperties) {
      const u = (p.nearestUniversity || '').trim();
      if (!u) continue;
      const normCore = normalizeArabicForSearch(u.replace(/^جامعة\s+/, ''));
      if (!normCore) continue;
      const matchedBase = baseUniversityOptions.some((b) => b.value && matchesPropertyFilters(p, { university: b.value }));
      if (!matchedBase) {
        const existingKey = Array.from(extraMap.keys()).find(
          (k) => normalizeArabicForSearch(k.replace(/^جامعة\s+/, '')) === normCore
        );
        const key = existingKey || u;
        extraMap.set(key, (extraMap.get(key) || 0) + 1);
      }
    }

    const extra = Array.from(extraMap.entries()).map(([uName, count]) => ({
      value: uName,
      label: { ar: uName, en: uName },
      count,
    }));

    return [...withCounts, ...extra];
  }, [allProperties, facets]);

  // Dynamically enrich property types
  const propertyTypeOptions = useMemo(() => {
    const withCounts = typeOptions.map((opt) => {
      if (!opt.value) return { ...opt, count: allProperties.length };
      const count = allProperties.filter((p) => matchesPropertyFilters(p, { propertyType: opt.value })).length;
      return { ...opt, count };
    });

    const seen = new Set(typeOptions.map((t) => t.value.toLowerCase()));
    const extra: Array<{ value: string; label: { ar: string; en: string }; count: number }> = [];

    const candidateTypes = [
      ...(facets?.propertyTypes || []),
      ...allProperties.map((p) => (p as any).propertyType || (typeof p.type === 'object' ? p.type.en : p.type)).filter(Boolean),
    ];

    for (const pt of candidateTypes) {
      const strVal = String(pt).trim();
      if (!strVal || seen.has(strVal.toLowerCase())) continue;
      seen.add(strVal.toLowerCase());
      const count = allProperties.filter((p) => matchesPropertyFilters(p, { propertyType: strVal })).length;
      extra.push({
        value: strVal,
        label: { ar: strVal, en: strVal },
        count,
      });
    }

    return [...withCounts, ...extra];
  }, [allProperties, facets]);

  // Dynamically enrich property classes
  const propertyClassOptions = useMemo(() => {
    const withCounts = classOptions.map((opt) => {
      if (!opt.value) return { ...opt, count: allProperties.length };
      const count = allProperties.filter((p) => matchesPropertyFilters(p, { propertyClass: opt.value })).length;
      return { ...opt, count };
    });

    const seen = new Set(classOptions.map((c) => c.value.toUpperCase()));
    const extra: Array<{ value: string; label: { ar: string; en: string }; count: number }> = [];

    for (const pc of facets?.propertyClasses || []) {
      const strVal = String(pc).trim();
      if (!strVal || seen.has(strVal.toUpperCase())) continue;
      seen.add(strVal.toUpperCase());
      const count = allProperties.filter((p) => matchesPropertyFilters(p, { propertyClass: strVal })).length;
      extra.push({
        value: strVal,
        label: { ar: strVal, en: strVal },
        count,
      });
    }

    return [...withCounts, ...extra];
  }, [allProperties, facets]);

  // Dynamically enrich room types
  const roomTypeOptionsEnriched = useMemo(() => {
    const withCounts = roomTypeOptions.map((opt) => {
      if (!opt.value) return { ...opt, count: allProperties.length };
      const count = allProperties.filter((p) => matchesPropertyFilters(p, { roomType: opt.value })).length;
      return { ...opt, count };
    });

    const seen = new Set(roomTypeOptions.map((r) => r.value.toUpperCase()));
    const extra: Array<{ value: string; label: { ar: string; en: string }; count: number }> = [];

    for (const rt of facets?.roomTypes || []) {
      const strVal = String(rt).trim();
      if (!strVal || seen.has(strVal.toUpperCase())) continue;
      seen.add(strVal.toUpperCase());
      const count = allProperties.filter((p) => matchesPropertyFilters(p, { roomType: strVal })).length;
      extra.push({
        value: strVal,
        label: { ar: strVal, en: strVal },
        count,
      });
    }

    return [...withCounts, ...extra];
  }, [allProperties, facets]);

  // Dynamically enrich gender options
  const genderOptionsEnriched = useMemo(() => {
    const withCounts = genderOptions.map((opt) => {
      if (!opt.value) return { ...opt, count: allProperties.length };
      const count = allProperties.filter((p) => matchesPropertyFilters(p, { genderAllowed: opt.value })).length;
      return { ...opt, count };
    });

    const seen = new Set(genderOptions.map((g) => g.value.toLowerCase()));
    const extra: Array<{ value: string; label: { ar: string; en: string }; count: number }> = [];

    for (const ga of facets?.genderAllowed || []) {
      const strVal = String(ga).trim();
      if (!strVal || seen.has(strVal.toLowerCase())) continue;
      seen.add(strVal.toLowerCase());
      const count = allProperties.filter((p) => matchesPropertyFilters(p, { genderAllowed: strVal })).length;
      extra.push({
        value: strVal,
        label: { ar: strVal, en: strVal },
        count,
      });
    }

    return [...withCounts, ...extra];
  }, [allProperties, facets]);

  // Dynamically enrich bedroom counts
  const bedroomOptionsEnriched = useMemo(() => {
    return bedroomOptions.map((opt) => {
      if (!opt.value) return { ...opt, count: allProperties.length };
      const count = allProperties.filter((p) => matchesPropertyFilters(p, { bedrooms: parseInt(opt.value, 10) })).length;
      return { ...opt, count };
    });
  }, [allProperties]);

  // Build active filter object and filter allProperties instantaneously
  const activeFilterParams: PropertyFilterParams = useMemo(() => {
    const activePrice = priceRanges.find((p) => p.value === priceRange);
    const minP =
      priceRange === 'custom'
        ? customMinPrice !== '' && !Number.isNaN(Number(customMinPrice))
          ? Number(customMinPrice)
          : undefined
        : activePrice?.min;
    const maxP =
      priceRange === 'custom'
        ? customMaxPrice !== '' && !Number.isNaN(Number(customMaxPrice))
          ? Number(customMaxPrice)
          : undefined
        : activePrice?.max;

    return {
      search: debouncedSearch || undefined,
      city: city || undefined,
      university: university || undefined,
      propertyType: propertyType || undefined,
      roomType: roomType || undefined,
      genderAllowed: genderAllowed || undefined,
      propertyClass: propertyClass || undefined,
      minPrice: minP,
      maxPrice: maxP,
      rooms: bedrooms ? parseInt(bedrooms, 10) : undefined,
      maxDistanceToUniversity: maxDistance ? parseFloat(maxDistance) : undefined,
      availableOnly: availableOnly ? true : undefined,
      isFurnished: isFurnished ? true : undefined,
      internetIncluded: internetIncluded ? true : undefined,
      billsIncluded: billsIncluded ? true : undefined,
    };
  }, [
    debouncedSearch,
    city,
    university,
    propertyType,
    roomType,
    genderAllowed,
    propertyClass,
    priceRange,
    customMinPrice,
    customMaxPrice,
    bedrooms,
    maxDistance,
    availableOnly,
    isFurnished,
    internetIncluded,
    billsIncluded,
  ]);

  const properties = useMemo(() => {
    return allProperties.filter((prop) => matchesPropertyFilters(prop, activeFilterParams));
  }, [allProperties, activeFilterParams]);

  // Client-side Sorting & Map View State
  const [showMap, setShowMap] = useState(false);
  const [userCoords, setUserCoords] = useState<Coordinates | null>(() =>
    LocationService.getCachedUserLocation()
  );
  const [detectingNearMe, setDetectingNearMe] = useState(false);
  const [geocodeTick, setGeocodeTick] = useState(0);

  // Dynamically geocode any property from the backend that does not yet have explicit latitude/longitude
  useEffect(() => {
    let cancelled = false;
    const missing = allProperties.filter(
      (p) =>
        (p.latitude === undefined || p.latitude === null || Number.isNaN(Number(p.latitude))) &&
        Boolean(p.address || p.district || p.nearestUniversity || p.city || p.governorate)
    );
    if (missing.length === 0) return;

    (async () => {
      for (const prop of missing) {
        if (cancelled) break;
        const res = await LocationService.geocodeAddress({
          address: prop.address,
          district: prop.district,
          nearestUniversity: prop.nearestUniversity,
          city: prop.city,
          governorate: prop.governorate,
          location: prop.location,
        });
        if (!cancelled && res) {
          setGeocodeTick((t) => t + 1);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [allProperties]);

  const handleSortNearMe = async () => {
    setDetectingNearMe(true);
    try {
      const coords = await LocationService.detectAndSyncProfileLocation(true);
      setUserCoords(coords);
      setSortBy('nearest');
      setShowMap(true);
    } catch {
      setShowMap(true);
    } finally {
      setDetectingNearMe(false);
    }
  };

  const sortedProperties = useMemo(() => {
    const list = [...properties];
    if (sortBy === 'price_asc') {
      return list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    }
    if (sortBy === 'price_desc') {
      return list.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    }
    if (sortBy === 'newest') {
      return list.sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    }
    if (sortBy === 'popular') {
      return list.sort(
        (a, b) => Number((b as any).viewsCount || 0) - Number((a as any).viewsCount || 0)
      );
    }
    if (sortBy === 'university_distance') {
      return list.sort(
        (a, b) =>
          Number(a.distanceToUniversity ?? 999) - Number(b.distanceToUniversity ?? 999)
      );
    }
    if (sortBy === 'nearest') {
      const refLat = userCoords?.latitude ?? DEFAULT_CAIRO_LAT;
      const refLng = userCoords?.longitude ?? DEFAULT_CAIRO_LNG;
      return list.sort((a, b) => {
        const cA = resolveCoordinates(a);
        const cB = resolveCoordinates(b);
        return (
          calculateDistanceKm(refLat, refLng, cA.latitude, cA.longitude) -
          calculateDistanceKm(refLat, refLng, cB.latitude, cB.longitude)
        );
      });
    }
    return list;
  }, [properties, sortBy, userCoords, geocodeTick]);

  // Check if any filter is active
  const activeFilterCount = [
    Boolean(searchTerm.trim()),
    Boolean(city),
    Boolean(university),
    Boolean(propertyType),
    Boolean(genderAllowed),
    Boolean(priceRange),
    Boolean(roomType),
    Boolean(bedrooms),
    Boolean(propertyClass),
    Boolean(maxDistance),
    availableOnly,
    isFurnished,
    internetIncluded,
    billsIncluded,
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  // Active filters list for chips display
  const activeFiltersList = useMemo(() => {
    const list: Array<{ id: string; label: string; value: string; onRemove: () => void }> = [];

    if (searchTerm.trim()) {
      list.push({
        id: 'search',
        label: locale === 'ar' ? 'البحث' : 'Search',
        value: searchTerm.trim(),
        onRemove: () => {
          setSearchTerm('');
          setDebouncedSearch('');
        },
      });
    }

    if (city) {
      const found = cityOptions.find((o) => o.value === city);
      list.push({
        id: 'city',
        label: locale === 'ar' ? 'الموقع' : 'Location',
        value: found ? found.label[locale] : city,
        onRemove: () => setCity(''),
      });
    }

    if (university) {
      const found = universityOptions.find((u) => u.value === university);
      list.push({
        id: 'university',
        label: locale === 'ar' ? 'قرب للجامعة' : 'Near University',
        value: found ? found.label[locale] : university,
        onRemove: () => setUniversity(''),
      });
    }

    if (propertyType) {
      const found = typeOptions.find((t) => t.value === propertyType);
      list.push({
        id: 'propertyType',
        label: locale === 'ar' ? 'نوع السكن' : 'Housing Type',
        value: found ? found.label[locale] : propertyType,
        onRemove: () => setPropertyType(''),
      });
    }

    if (priceRange) {
      if (priceRange === 'custom') {
        const val = `${customMinPrice || 0} – ${customMaxPrice || (locale === 'ar' ? 'غير محدد' : 'Any')} ${locale === 'ar' ? 'جنيه' : 'EGP'}`;
        list.push({
          id: 'priceRange',
          label: locale === 'ar' ? 'الميزانية' : 'Budget',
          value: val,
          onRemove: () => {
            setPriceRange('');
            setCustomMinPrice('');
            setCustomMaxPrice('');
          },
        });
      } else {
        const found = priceRanges.find((p) => p.value === priceRange);
        list.push({
          id: 'priceRange',
          label: locale === 'ar' ? 'الميزانية' : 'Budget',
          value: found ? found.label[locale] : priceRange,
          onRemove: () => setPriceRange(''),
        });
      }
    }

    if (availableOnly) {
      list.push({
        id: 'availableOnly',
        label: locale === 'ar' ? 'الحجز' : 'Booking',
        value: locale === 'ar' ? 'متاح للحجز الفوري' : 'Available Now',
        onRemove: () => setAvailableOnly(false),
      });
    }

    if (isFurnished) {
      list.push({
        id: 'isFurnished',
        label: locale === 'ar' ? 'الفرش' : 'Furnishing',
        value: locale === 'ar' ? 'مفروش بالكامل' : 'Fully Furnished',
        onRemove: () => setIsFurnished(false),
      });
    }

    if (internetIncluded) {
      list.push({
        id: 'internetIncluded',
        label: locale === 'ar' ? 'الإنترنت' : 'Internet',
        value: locale === 'ar' ? 'شامل الإنترنت (Wi-Fi)' : 'Wi-Fi Included',
        onRemove: () => setInternetIncluded(false),
      });
    }

    if (billsIncluded) {
      list.push({
        id: 'billsIncluded',
        label: locale === 'ar' ? 'الفواتير' : 'Bills',
        value: locale === 'ar' ? 'شامل الفواتير' : 'Bills Included',
        onRemove: () => setBillsIncluded(false),
      });
    }

    if (genderAllowed) {
      const found = genderOptions.find((g) => g.value === genderAllowed);
      list.push({
        id: 'genderAllowed',
        label: locale === 'ar' ? 'السكن مخصص لـ' : 'Gender',
        value: found ? found.label[locale] : genderAllowed,
        onRemove: () => setGenderAllowed(''),
      });
    }

    if (roomType) {
      const found = roomTypeOptions.find((r) => r.value === roomType);
      list.push({
        id: 'roomType',
        label: locale === 'ar' ? 'نوع الغرفة' : 'Room Type',
        value: found ? found.label[locale] : roomType,
        onRemove: () => setRoomType(''),
      });
    }

    if (bedrooms) {
      const found = bedroomOptions.find((b) => b.value === bedrooms);
      list.push({
        id: 'bedrooms',
        label: locale === 'ar' ? 'الغرف' : 'Rooms',
        value: found ? found.label[locale] : bedrooms,
        onRemove: () => setBedrooms(''),
      });
    }

    if (propertyClass) {
      const found = classOptions.find((c) => c.value === propertyClass);
      list.push({
        id: 'propertyClass',
        label: locale === 'ar' ? 'الفئة' : 'Class',
        value: found ? found.label[locale] : propertyClass,
        onRemove: () => setPropertyClass(''),
      });
    }

    if (maxDistance) {
      const found = distanceOptions.find((d) => d.value === maxDistance);
      list.push({
        id: 'maxDistance',
        label: locale === 'ar' ? 'المسافة' : 'Distance',
        value: found ? found.label[locale] : maxDistance,
        onRemove: () => setMaxDistance(''),
      });
    }

    return list;
  }, [
    searchTerm,
    city,
    cityOptions,
    university,
    universityOptions,
    propertyType,
    priceRange,
    customMinPrice,
    customMaxPrice,
    availableOnly,
    isFurnished,
    internetIncluded,
    billsIncluded,
    genderAllowed,
    roomType,
    bedrooms,
    propertyClass,
    maxDistance,
    locale,
  ]);

  const activeAdvancedCount = [
    Boolean(genderAllowed),
    Boolean(roomType),
    Boolean(bedrooms),
    Boolean(propertyClass),
    Boolean(maxDistance),
    priceRange === 'custom' && Boolean(customMinPrice || customMaxPrice),
  ].filter(Boolean).length;

  const handleResetFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setCity('');
    setUniversity('');
    setPropertyType('');
    setGenderAllowed('');
    setPriceRange('');
    setCustomMinPrice('');
    setCustomMaxPrice('');
    setRoomType('');
    setBedrooms('');
    setPropertyClass('');
    setMaxDistance('');
    setAvailableOnly(false);
    setIsFurnished(false);
    setInternetIncluded(false);
    setBillsIncluded(false);
    setMobileDrawerOpen(false);
  };

  return (
    <main className="properties-page">
      <div className="container">
        {/* Page Header */}
        <header className="properties-header">
          <h1 className="properties-title">{t.page_properties_title}</h1>
          <p className="properties-subtitle">{t.properties_subtitle}</p>
        </header>

        {/* Main Filters Card Container */}
        <div className="dary-filters-card">
          {/* Row 1: Primary Filters Grid */}
          <div className="dary-main-filters-grid">
            {/* 1. Keyword / Location Search */}
            <div className="dary-search-box">
              <input
                type="text"
                className="dary-search-input"
                placeholder={
                  locale === 'ar'
                    ? 'ابحث بالاسم، أو المدينة، أو المنطقة...'
                    : 'Search by title, city, or district...'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search"
              />
              {searchTerm && (
                <button
                  type="button"
                  className="dary-search-clear"
                  onClick={() => {
                    setSearchTerm('');
                    setDebouncedSearch('');
                  }}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 2. Location (City / Governorate) */}
            <DarySelect
              id="filter-city"
              label={locale === 'ar' ? 'الموقع' : 'Location'}
              value={city}
              onChange={setCity}
              options={cityOptions}
              searchable
              ariaLabel={locale === 'ar' ? 'الموقع' : 'Location'}
            />

            {/* 3. University */}
            <DarySelect
              id="filter-university"
              label={locale === 'ar' ? 'الجامعة' : 'University'}
              value={university}
              onChange={setUniversity}
              options={universityOptions}
              searchable
              ariaLabel={locale === 'ar' ? 'الجامعة' : 'University'}
            />

            {/* 4. Property Type */}
            <DarySelect
              id="filter-property-type"
              label={locale === 'ar' ? 'نوع السكن' : 'Property Type'}
              value={propertyType}
              onChange={setPropertyType}
              options={propertyTypeOptions}
              ariaLabel={locale === 'ar' ? 'نوع السكن' : 'Property Type'}
            />

            {/* 5. Budget */}
            <DarySelect
              id="filter-budget"
              label={locale === 'ar' ? 'الميزانية' : 'Budget'}
              value={priceRange}
              onChange={setPriceRange}
              options={priceRanges}
              ariaLabel={locale === 'ar' ? 'الميزانية' : 'Budget'}
            />

            {/* 6. Search Submit Button */}
            <button
              type="button"
              className="dary-search-btn"
              onClick={() => {
                setDebouncedSearch(searchTerm);
                const el = document.getElementById('properties-results-toolbar');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            >
              {locale === 'ar' ? 'بحث' : 'Search'}
            </button>
          </div>

          {/* Row 2: Quick Filter Chips + Advanced Filters Toggle */}
          <div className="dary-quick-filters-row">
            <div className="dary-quick-chips">
              <button
                type="button"
                className={`dary-quick-chip ${availableOnly ? 'is-active' : ''}`}
                onClick={() => setAvailableOnly((prev) => !prev)}
              >
                {locale === 'ar' ? 'متاح للحجز الفوري' : 'Instant Booking'}
              </button>

              <button
                type="button"
                className={`dary-quick-chip ${isFurnished ? 'is-active' : ''}`}
                onClick={() => setIsFurnished((prev) => !prev)}
              >
                {locale === 'ar' ? 'مفروش بالكامل' : 'Fully Furnished'}
              </button>

              <button
                type="button"
                className={`dary-quick-chip ${internetIncluded ? 'is-active' : ''}`}
                onClick={() => setInternetIncluded((prev) => !prev)}
              >
                {locale === 'ar' ? 'شامل الإنترنت (Wi-Fi)' : 'Wi-Fi Included'}
              </button>

              <button
                type="button"
                className={`dary-quick-chip ${billsIncluded ? 'is-active' : ''}`}
                onClick={() => setBillsIncluded((prev) => !prev)}
              >
                {locale === 'ar' ? 'شامل الفواتير' : 'Bills Included'}
              </button>
            </div>

            <div className="dary-quick-divider" />

            <button
              type="button"
              className={`dary-advanced-toggle ${showAdvancedFilters ? 'is-open' : ''} ${activeAdvancedCount > 0 ? 'has-active' : ''}`}
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
            >
              <span>{locale === 'ar' ? 'فلاتر متقدمة' : 'Advanced Filters'}</span>
              <span className={`dary-advanced-arrow ${showAdvancedFilters ? 'is-rotated' : ''}`}>
                <ChevronDownIcon />
              </span>
              {activeAdvancedCount > 0 && (
                <span className="dary-filter-count-badge">{activeAdvancedCount}</span>
              )}
            </button>
          </div>

          {/* Row 3: Collapsible Advanced Filters Panel */}
          {showAdvancedFilters && (
            <div className="dary-advanced-panel">
              {/* Gender Allowed */}
              <DarySelect
                id="filter-gender"
                label={locale === 'ar' ? 'السكن مخصص لـ' : 'Gender Allowed'}
                value={genderAllowed}
                onChange={setGenderAllowed}
                options={genderOptionsEnriched}
                ariaLabel={locale === 'ar' ? 'السكن مخصص لـ' : 'Gender Allowed'}
              />

              {/* Room Type */}
              <DarySelect
                id="filter-room-type"
                label={locale === 'ar' ? 'نوع الغرفة' : 'Room Type'}
                value={roomType}
                onChange={setRoomType}
                options={roomTypeOptionsEnriched}
                ariaLabel={locale === 'ar' ? 'نوع الغرفة' : 'Room Type'}
              />

              {/* Bedrooms Count */}
              <DarySelect
                id="filter-bedrooms"
                label={locale === 'ar' ? 'عدد الغرف' : 'Rooms Count'}
                value={bedrooms}
                onChange={setBedrooms}
                options={bedroomOptionsEnriched}
                ariaLabel={locale === 'ar' ? 'عدد الغرف' : 'Bedrooms'}
              />

              {/* Property Class */}
              <DarySelect
                id="filter-class"
                label={locale === 'ar' ? 'فئة السكن' : 'Property Class'}
                value={propertyClass}
                onChange={setPropertyClass}
                options={propertyClassOptions}
                ariaLabel={locale === 'ar' ? 'فئة السكن' : 'Property Class'}
              />

              {/* Max Distance */}
              <DarySelect
                id="filter-distance"
                label={locale === 'ar' ? 'المسافة للجامعة' : 'Distance to University'}
                value={maxDistance}
                onChange={setMaxDistance}
                options={distanceOptions}
                ariaLabel={locale === 'ar' ? 'المسافة للجامعة' : 'Distance to University'}
              />

              {/* Custom Price Range Row */}
              {priceRange === 'custom' && (
                <div className="dary-custom-price-box">
                  <span className="dary-custom-price-title">
                    {locale === 'ar' ? 'تحديد الميزانية الشهرية (ج.م):' : 'Monthly Budget Range (EGP):'}
                  </span>
                  <div className="dary-custom-price-inputs">
                    <input
                      type="number"
                      min={0}
                      step={100}
                      placeholder={locale === 'ar' ? 'الحد الأدنى' : 'Min price'}
                      value={customMinPrice}
                      onChange={(e) => setCustomMinPrice(e.target.value)}
                      className="dary-custom-input"
                    />
                    <span className="dary-custom-dash">—</span>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      placeholder={locale === 'ar' ? 'الحد الأقصى' : 'Max price'}
                      value={customMaxPrice}
                      onChange={(e) => setCustomMaxPrice(e.target.value)}
                      className="dary-custom-input"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Active Filters Section (Shows ONLY when filters are active) */}
        {activeFiltersList.length > 0 && (
          <div className="dary-active-filters-bar">
            <div className="dary-active-filters-content">
              <span className="dary-active-filters-title">
                {locale === 'ar' ? 'الفلاتر النشطة:' : 'Active Filters:'}
              </span>
              <div className="dary-active-chips-wrap">
                {activeFiltersList.map((item) => (
                  <div key={item.id} className="dary-active-chip">
                    <span className="dary-active-chip-text">
                      {item.label}: {item.value}
                    </span>
                    <button
                      type="button"
                      className="dary-active-chip-x"
                      onClick={item.onRemove}
                      aria-label={`Remove ${item.label}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="dary-clear-all-btn"
              onClick={handleResetFilters}
            >
              {locale === 'ar' ? 'مسح الكل' : 'Clear All'}
            </button>
          </div>
        )}

        {/* Results Toolbar */}
        <div id="properties-results-toolbar" className="dary-results-toolbar">
          {/* Results Count */}
          <div className="dary-results-count">
            {!loading && !error && (
              <span>
                <strong>
                  <AnimatedCounter value={sortedProperties.length} duration={500} />
                </strong>{' '}
                {locale === 'ar' ? 'عقارات متوفرة' : 'properties available'}
              </span>
            )}
          </div>

          {/* Actions & Sorting */}
          <div className="dary-results-actions">
            <button
              type="button"
              className={`dary-toolbar-btn dary-map-btn ${showMap ? 'is-active' : ''}`}
              onClick={() => setShowMap((prev) => !prev)}
            >
              <span>
                {showMap
                  ? locale === 'ar'
                    ? 'إخفاء الخريطة'
                    : 'Hide Map'
                  : locale === 'ar'
                  ? 'عرض على الخريطة'
                  : 'Show on Map'}
              </span>
            </button>

            <button
              type="button"
              className={`dary-toolbar-btn dary-gps-btn ${sortBy === 'nearest' ? 'is-active' : ''}`}
              onClick={handleSortNearMe}
              disabled={detectingNearMe}
            >
              <span>
                {detectingNearMe
                  ? locale === 'ar'
                    ? 'جاري التحديد...'
                    : 'Detecting...'
                  : locale === 'ar'
                  ? 'الأقرب لموقعي (GPS)'
                  : 'Nearest to Me (GPS)'}
              </span>
            </button>

            <div className="dary-sort-field">
              <span className="dary-sort-label">
                {locale === 'ar' ? 'ترتيب حسب:' : 'Sort by:'}
              </span>
              <DarySelect
                id="properties-sort-select"
                value={sortBy}
                onChange={setSortBy}
                options={sortOptions}
                compact
                ariaLabel={t.properties_sort_by}
              />
            </div>
          </div>
        </div>

        {/* Collapsible Interactive Map showing all properties */}
        {showMap && (
          <div style={{ marginBottom: '2rem' }}>
            <InteractiveMap
              latitude={userCoords?.latitude ?? (sortedProperties[0] ? resolveCoordinates(sortedProperties[0]).latitude : DEFAULT_CAIRO_LAT)}
              longitude={userCoords?.longitude ?? (sortedProperties[0] ? resolveCoordinates(sortedProperties[0]).longitude : DEFAULT_CAIRO_LNG)}
              locationContext={
                !userCoords && city !== 'all' && city !== ''
                  ? { city }
                  : sortedProperties[0]
                  ? {
                      address: sortedProperties[0].address,
                      district: sortedProperties[0].district,
                      city: sortedProperties[0].city,
                      governorate: sortedProperties[0].governorate,
                      nearestUniversity: sortedProperties[0].nearestUniversity,
                    }
                  : undefined
              }
              title={locale === 'ar' ? '🗺️ خريطة السكن الطلابي والأماكن القريبة' : '🗺️ Student Housing Map & Nearby'}
              subtitle={
                userCoords
                  ? locale === 'ar'
                    ? 'مرتبة حسب الأقرب لموقعك الحالي'
                    : 'Sorted by proximity to your GPS location'
                  : city && city !== 'all'
                  ? city
                  : locale === 'ar'
                  ? 'مواقع العقارات المتاحة والأماكن القريبة'
                  : 'Available Property Locations & Nearby Places'
              }
              height="400px"
              showNearby={true}
              syncProfileOnDetect={true}
              locale={locale}
              onProfileSynced={(lat, lng) => {
                setUserCoords({ latitude: lat, longitude: lng });
                setSortBy('nearest');
              }}
              markers={sortedProperties.map((p) => {
                const c = resolveCoordinates(p);
                const tTitle =
                  typeof p.title === 'object' ? p.title[locale] || p.title.ar || p.title.en : String(p.title);
                const tLoc =
                  typeof p.location === 'object' ? p.location[locale] || p.location.ar || p.location.en : String(p.location);
                return {
                  id: p.id,
                  latitude: c.latitude,
                  longitude: c.longitude,
                  title: tTitle,
                  subtitle: tLoc,
                  priceText: `${Number(p.price || 0).toLocaleString()} ${p.currency}`,
                  href: `/properties/${p.id}`,
                };
              })}
            />
          </div>
        )}

        {/* State 1: Loading Skeleton Grid */}
        {loading && (
          <div className="properties-grid" aria-busy="true" aria-label="Loading properties">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="property-skeleton-card" aria-hidden="true">
                <div className="skeleton-media shimmer">
                  <div className="skeleton-badge shimmer" />
                </div>
                <div className="skeleton-body">
                  <div className="skeleton-location shimmer" />
                  <div className="skeleton-title shimmer" />
                  <div className="skeleton-specs">
                    <div className="skeleton-spec shimmer" />
                    <div className="skeleton-spec shimmer" />
                  </div>
                  <div className="skeleton-footer">
                    <div className="skeleton-price shimmer" />
                    <div className="skeleton-btn shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* State 2: Error State */}
        {!loading && error && (
          <div className="properties-error-state" role="alert">
            <div className="error-icon-wrap" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="error-title">{t.properties_error_title}</h3>
            <p className="error-desc">{error}</p>
            <button
              type="button"
              className="error-retry-btn"
              onClick={handleRetry}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 21h5v-5" />
              </svg>
              <span>{t.properties_error_retry}</span>
            </button>
          </div>
        )}

        {/* State 3: Empty State */}
        {!loading && !error && sortedProperties.length === 0 && (
          <div className="properties-empty-state">
            <div className="empty-icon-wrap" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </div>
            <h3 className="empty-title">{t.properties_empty_title}</h3>
            <p className="empty-desc">{t.properties_empty_desc}</p>
            {hasActiveFilters && (
              <button
                type="button"
                className="empty-reset-btn"
                onClick={handleResetFilters}
              >
                {t.properties_reset_filters}
              </button>
            )}
          </div>
        )}

        {/* State 4: Real Properties Grid */}
        {!loading && !error && sortedProperties.length > 0 && (
          <div className="properties-grid">
            {sortedProperties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}
      </div>

      {/* Mobile Filters Slide-Over Drawer */}
      {mobileDrawerOpen && (
        <div
          className="mobile-drawer-overlay"
          onClick={() => setMobileDrawerOpen(false)}
          aria-hidden="true"
        >
          <div
            className="mobile-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t.properties_mobile_filters_btn}
          >
            <div className="mobile-drawer-header">
              <h3 className="mobile-drawer-title">{t.properties_mobile_filters_btn}</h3>
              <button
                type="button"
                className="mobile-drawer-close"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label={t.properties_mobile_close}
              >
                ✕
              </button>
            </div>

            <div className="mobile-drawer-body">
              {/* Location */}
              <div className="mobile-drawer-group">
                <DarySelect
                  label={t.properties_filter_location}
                  value={city}
                  onChange={setCity}
                  options={cityOptions}
                  searchable
                />
              </div>

              {/* Nearest University */}
              <div className="mobile-drawer-group">
                <DarySelect
                  label={locale === 'ar' ? 'الجامعة الأقرب' : 'Nearest University'}
                  value={university}
                  onChange={setUniversity}
                  options={universityOptions}
                  searchable
                />
              </div>

              {/* Property Type */}
              <div className="mobile-drawer-group">
                <DarySelect
                  label={t.properties_filter_type}
                  value={propertyType}
                  onChange={setPropertyType}
                  options={propertyTypeOptions}
                />
              </div>

              {/* Gender Allowed */}
              <div className="mobile-drawer-group">
                <DarySelect
                  label={locale === 'ar' ? 'مخصص لـ' : 'Gender Allowed'}
                  value={genderAllowed}
                  onChange={setGenderAllowed}
                  options={genderOptionsEnriched}
                />
              </div>

              {/* Room Type */}
              <div className="mobile-drawer-group">
                <DarySelect
                  label={locale === 'ar' ? 'نوع الغرفة' : 'Room Type'}
                  value={roomType}
                  onChange={setRoomType}
                  options={roomTypeOptionsEnriched}
                />
              </div>

              {/* Price Range */}
              <div className="mobile-drawer-group">
                <DarySelect
                  label={t.properties_filter_price}
                  value={priceRange}
                  onChange={setPriceRange}
                  options={priceRanges}
                />
              </div>

              {/* Bedrooms */}
              <div className="mobile-drawer-group">
                <DarySelect
                  label={t.properties_filter_bedrooms}
                  value={bedrooms}
                  onChange={setBedrooms}
                  options={bedroomOptionsEnriched}
                />
              </div>

              {/* Property Class */}
              <div className="mobile-drawer-group">
                <DarySelect
                  label={locale === 'ar' ? 'فئة السكن' : 'Property Class'}
                  value={propertyClass}
                  onChange={setPropertyClass}
                  options={propertyClassOptions}
                />
              </div>
            </div>

            <div className="mobile-drawer-footer">
              <button
                type="button"
                className="mobile-drawer-reset-btn"
                onClick={handleResetFilters}
              >
                {t.properties_reset_filters}
              </button>
              <button
                type="button"
                className="mobile-drawer-apply-btn"
                onClick={() => setMobileDrawerOpen(false)}
              >
                {t.properties_apply_filters}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

