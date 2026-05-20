-- Catalog import manufacturer cleanup (Josh / scoped bad import)
--
-- Clears manufacturer_name ONLY where it exactly matches a known bad value from a
-- specific import batch. Does NOT delete catalog items.
--
-- Before running:
-- 1. Identify organization_id and price_list_imports.id (source_import_id)
-- 2. Copy the exact bad manufacturer_name string from one affected row
-- 3. Narrow created_at to the import commit window
--
-- Example discovery queries (run read-only first):
--
-- SELECT id, file_name, manufacturer_name, status, created_at, updated_at
-- FROM price_list_imports
-- WHERE organization_id = :organization_id
-- ORDER BY created_at DESC
-- LIMIT 20;
--
-- SELECT id, name, manufacturer_name, source_import_id, created_at
-- FROM catalog_items
-- WHERE organization_id = :organization_id
--   AND source_import_id = :import_id
--   AND manufacturer_name IS NOT NULL
-- LIMIT 20;

BEGIN;

-- Preview rows that would be updated
SELECT
  ci.id,
  ci.name,
  ci.part_number,
  ci.manufacturer_name,
  ci.source_import_id,
  ci.created_at
FROM catalog_items ci
WHERE ci.organization_id = :organization_id
  AND ci.source_import_id = :import_id
  AND ci.manufacturer_name = :bad_manufacturer_text
  AND ci.created_at >= :created_at_start::timestamptz
  AND ci.created_at < :created_at_end::timestamptz;

-- Uncomment after verifying the preview SELECT above
-- UPDATE catalog_items ci
-- SET
--   manufacturer_name = NULL,
--   updated_at = NOW()
-- WHERE ci.organization_id = :organization_id
--   AND ci.source_import_id = :import_id
--   AND ci.manufacturer_name = :bad_manufacturer_text
--   AND ci.created_at >= :created_at_start::timestamptz
--   AND ci.created_at < :created_at_end::timestamptz;

-- Optional: clear import-level manufacturer hint on the draft record (does not change catalog rows by itself)
-- UPDATE price_list_imports pli
-- SET
--   manufacturer_name = NULL,
--   updated_at = NOW()
-- WHERE pli.organization_id = :organization_id
--   AND pli.id = :import_id
--   AND pli.manufacturer_name = :bad_manufacturer_text;

-- COMMIT;
-- ROLLBACK;
