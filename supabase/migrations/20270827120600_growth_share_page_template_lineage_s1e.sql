-- Growth Engine S1-E — Share Page Template instantiation lineage on share_pages.
-- Local migration only until explicitly applied to production.

alter table growth.share_pages
  add column if not exists share_page_template_id uuid
    references growth.share_page_templates (id) on delete set null,
  add column if not exists share_page_template_version_id uuid
    references growth.share_page_template_versions (id) on delete set null,
  add column if not exists template_blocks_snapshot jsonb;

create index if not exists idx_growth_share_pages_template_lineage
  on growth.share_pages (share_page_template_id, share_page_template_version_id)
  where share_page_template_id is not null;

comment on column growth.share_pages.share_page_template_id is
  'Source Share Page Template when instantiated from S1-E library workflow.';

comment on column growth.share_pages.share_page_template_version_id is
  'Immutable published template version used at instantiation time.';

comment on column growth.share_pages.template_blocks_snapshot is
  'Frozen template blocks_json snapshot captured at instantiation.';
