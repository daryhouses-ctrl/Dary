-- 1. Enable pg_trgm extension for ultra-fast ILIKE and substring text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. GIN trigram indexes for property title, city, and district to accelerate ILIKE '%...%' searches
CREATE INDEX IF NOT EXISTS "properties_title_trgm_idx" ON "properties" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "properties_city_trgm_idx" ON "properties" USING gin ("city" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "properties_district_trgm_idx" ON "properties" USING gin ("district" gin_trgm_ops);

-- 3. Partial Unique Index to physically prevent duplicate concurrent bookings for the same tenant and room
CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_booking_per_tenant_room" 
  ON "bookings" ("tenant_id", "room_id") 
  WHERE "status" IN ('PENDING', 'CONTACTED');

-- 4. Index on property_images to accelerate primary image batch loading
CREATE INDEX IF NOT EXISTS "property_images_property_id_is_primary_idx" 
  ON "property_images" ("property_id", "is_primary");
