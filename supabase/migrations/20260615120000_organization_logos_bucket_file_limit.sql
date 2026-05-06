-- Document logo route allows up to 4MB originals; bucket was capped at 2MB, causing silent storage rejections.
-- Bump limit so uploads can complete before server-side processing.

update storage.buckets
set file_size_limit = 6291456
where id = 'organization-logos';
