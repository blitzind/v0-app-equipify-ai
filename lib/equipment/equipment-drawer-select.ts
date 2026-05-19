/** Equipment drawer load — includes calibration intelligence columns when present in DB. */

export const EQUIPMENT_DRAWER_SELECT_FULL =
  "id, organization_id, customer_id, equipment_code, name, manufacturer, category, subcategory, serial_number, status, install_date, warranty_start_date, warranty_expiration_date, warranty_expires_at, last_service_at, next_due_at, next_calibration_due_at, calibration_interval_months, location_label, customer_location_id, notes, archived_at"

export const EQUIPMENT_DRAWER_SELECT_LEGACY =
  "id, organization_id, customer_id, equipment_code, name, manufacturer, category, serial_number, status, install_date, warranty_start_date, warranty_expiration_date, warranty_expires_at, last_service_at, next_due_at, location_label, customer_location_id, notes, archived_at"
