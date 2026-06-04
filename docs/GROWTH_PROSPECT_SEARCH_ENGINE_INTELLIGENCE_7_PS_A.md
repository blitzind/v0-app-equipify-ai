# Phase 7.PS-A — Prospect Search Intelligence Integration Foundation

Prospect Search consumes existing Growth Engine intelligence (7.2–7.7) without new discovery providers, scoring systems, or runtime orchestration.

## Integrated read paths

| System | Read surface |
|--------|----------------|
| Canonical companies | `resolveProspectSearchCanonicalCompanyId` / batch |
| Canonical persons | `resolveProspectSearchCanonicalPersonIdsBatch` + contact overlay `canonical_person_id` |
| Company intelligence (7.6) | Verified `company_intelligence_snapshots` + operator status summary |
| Buying committee (7.7A) | Verified `buying_committee_intelligence_members` merged into `committee_roles` |
| Email / phone / social (7.3–7.5) | Verified `person_emails`, `person_phones`, `person_profiles` at canonical company |
| Schema health | `probeProspectSearchIntelligenceSchema` (contact + engine probes) |

## Loader wiring

`loadProspectSearchContactIntelligenceBatch` → engine batch load → person ID resolution → `mergeEngineIntelligenceIntoContactIntelligence`.

`applyContactIntelligenceToCompanyResult` sets `canonical_company_id` on search company rows.

## QA marker

`growth-prospect-search-engine-intelligence-7-ps-a-v1`

## Test

```bash
pnpm test:growth-prospect-search-engine-intelligence-7-ps-a
```

## Gaps before Apollo/ZoomInfo-style filtering

- No prospect-level filters on verified intelligence categories, committee roles, or channel depth
- Legacy `CompanyIntelligenceCard` (company-signals) and `BuyingCommitteePanel` (contact-discovery) still render for external_discovered rows
- No batch rank_score / ICP scoring from engine intelligence
- Discovery job status rollups (email/phone/social/company intel pending) not exposed on search cards
- Person resolution for fused contact identities without stable staging IDs remains best-effort
