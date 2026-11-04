-- CreateIndex
CREATE INDEX "bookings_start_date_end_date_idx" ON "bookings"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "bookings_status_start_date_end_date_idx" ON "bookings"("status", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "bookings_tenant_id_created_at_idx" ON "bookings"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "properties_owner_id_deleted_at_idx" ON "properties"("owner_id", "deleted_at");

-- CreateIndex
CREATE INDEX "property_images_property_id_order_idx" ON "property_images"("property_id", "order");

-- CreateIndex
CREATE INDEX "reports_status_priority_idx" ON "reports"("status", "priority");
