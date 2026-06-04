# Growth Engine Phase 7.PS-D — Prospect Search Readiness & Prioritization

Deterministic account readiness from Growth Engine intelligence (7.2–7.7). **Not** lead scoring, intent, or predictive fit.

## Readiness dimensions

| Dimension | Sources |
|-----------|---------|
| Channel readiness | Verified email (7.3), phone (7.4), social (7.5) |
| Committee readiness | Verified members, critical roles, single-thread risk (7.7) |
| Company intelligence readiness | Verified categories, key category gaps (7.6) |
| Contactability readiness | Channels + committee + reachable verified decision makers |
| Overall research readiness | Weighted blend of the above |

## Prioritization tiers

- `ready_for_outreach` — verified channels, committee, company intel, reachable stakeholders
- `outreach_with_gaps` — outreach possible; review breakdown
- `research_first` — queue discovery before sequencing
- `insufficient_data` — missing canonical linkage

## Research completeness

- `fully_researched` / `partially_researched` / `research_recommended` / `research_blocked` / `insufficient_data`

## Libs

- `prospect-search-engine-readiness.ts` — build, merge, filter, prioritize
- `prospect-search-engine-readiness-types.ts` — types + QA marker
- `prospect-search-engine-readiness-ux.ts` — operator copy

## UI

- Filter accordion: readiness tiers + research completeness
- Search cards: readiness badges
- Intelligence panel: summary card + breakdown with evidence/reasons

## Tests

```bash
pnpm test:growth-prospect-search-readiness-7-ps-d
pnpm test:growth-prospect-search-actionable-research-7-ps-c
pnpm test:growth-prospect-search-intelligence-ux-7-ps-b
```

QA marker: `growth-prospect-search-readiness-7-ps-d-v1`
