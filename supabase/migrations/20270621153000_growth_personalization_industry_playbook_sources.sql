-- GS-AI-PLAYBOOK-1B — Extend personalization evidence source types for industry playbooks.

alter table growth.personalization_evidence
  drop constraint if exists personalization_evidence_source_type_check;

alter table growth.personalization_evidence
  add constraint personalization_evidence_source_type_check
  check (source_type in (
    'relationship_memory', 'opportunity_intelligence', 'booking_intelligence', 'market_graph',
    'territory_intelligence', 'website_intelligence', 'engagement_history', 'committee_context',
    'buying_signals', 'company_signals',
    'industry_playbook', 'capability_mapping', 'video_storyline'
  ));

comment on column growth.personalization_evidence.source_type is
  'Evidence source — industry_playbook/capability_mapping/video_storyline are industry-level intelligence, not company-verified facts.';
