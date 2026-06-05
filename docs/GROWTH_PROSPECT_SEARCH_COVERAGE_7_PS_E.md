# Growth Engine Phase 7.PS-E — Prospect Search Coverage & Resolution Hardening

Deterministic canonical company/person linkage and coverage metrics from existing Growth Engine tables (7.2–7.7). No new providers, enrichment, discovery, or AI matching.

## Company resolution (ordered)

1. Lead `metadata.canonical_company_id`
2. Lead staging candidate IDs → `external_company_candidates` / `real_world_company_candidates`
3. External row `canonical_company_id` by candidate id
4. `companies.primary_domain` / `company_domains` normalized domain
5. Staging candidate domain lineage when canonical already linked on candidate row

Each result includes `method`, `confidence`, `reasons`, and `evidence`.

## Person linkage (ordered)

1. Overlay `canonical_person_id` hint
2. `company_contacts` column + `person_source_lineage`
3. `lead_decision_makers` column + lineage
4. `contact_candidates` column + lineage
5. Committee member `person_id` when hint matches verified committee (7.7)

## Coverage overlay

`contact_intelligence.engine_coverage` exposes company resolution, per-contact linkage, and metrics:

- Canonical company / person coverage %
- Verified channel counts
- Committee verified count & coverage
- Company intelligence category coverage %

## Libs

- `prospect-search-coverage-resolution.ts` — batch resolution (server)
- `prospect-search-coverage-metrics.ts` — metrics builders (client-safe)
- `prospect-search-coverage-merge.ts` — overlay merge
- `prospect-search-canonical-resolution.ts` — re-exports for PS-A compatibility

## Tests

```bash
pnpm test:growth-prospect-search-coverage-7-ps-e
pnpm test:growth-prospect-search-readiness-7-ps-d
```

QA marker: `growth-prospect-search-coverage-7-ps-e-v1`
