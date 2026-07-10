# GE-AIOS-LIVE-1B — Equipify Production Equipment-Service ICP

QA marker: `ge-aios-live-1b-equipify-equipment-service-icp-v1`

## Canonical paths

| Concern | Path |
|--------|------|
| **UI (edit / approve)** | `/growth/training/company-profile` (Training → Company Profile) |
| **Storage** | `growth.organization_business_profiles` |
| **Service** | `lib/growth/business-profile/business-profile-service.ts` |
| **API** | `/api/platform/growth/business-profile/*` (draft → PATCH → approve) |
| **Admission read** | `getActiveApprovedBusinessProfile` via `loadGrowthLeadAdmissionContext` |
| **Prospect Search UI** | `/growth/leads/prospect-search/discover` → Advanced filters → Industry accordion |

## Why the profile was hard to find

1. **Triple naming** — product says “Company Profile,” code says `business-profile`, some docs say “Growth Profile.”
2. **Moved off Home** — editor removed from Home workspace (19C-2G); lives under **Training**, not Settings.
3. **Settings trap** — `/growth/settings/profile` is the **user** profile, not the company ICP.
4. **Read-only approved view** — operators must click **Update Business Profile** to create a new draft before editing.
5. **No prior approved row** — production had zero approved profiles, so admission and LIVE-1 gates failed until LIVE-1B apply.

## Production writes (completed)

Organization: `00757488-1026-44a5-aac4-269533ac21be`

Applied via operator-approved script (`pnpm apply:ge-aios-live-1b-equipify-production-company-profile -- --apply`), which uses the canonical `insertBusinessProfileDraft` → `approveBusinessProfileForOrganization` flow.

| Field | Value |
|-------|-------|
| Profile ID | `7a672c08-bef6-45b2-a71e-ce53ad36613d` |
| Status | `approved` |
| Approved at | `2026-07-10T16:56:14.476+00:00` |
| Active objective ID | `d702724e-6565-4db7-a2f0-d686fea7623a` |
| Mission title | Equipment-service technician ICP (full text in profile content module) |

Prior profile history preserved (first approved row for this org).

## ICP summary

- **Primary ICP:** companies that maintain, service, inspect, install, repair, or operate physical equipment.
- **Manufacturing:** qualifies only with meaningful maintenance / field service / installed-base service evidence.
- **NAICS/SIC on profile:** search filters and evidence signals only — **do not bypass 21C admission.**

Operator-approved profile codes:

- **Preferred NAICS:** 811310, 811219, 811412, 238220, 541380, 811210
- **Excluded SIC:** 7372

## NAICS / SIC architecture audit

### Existing support found

| Layer | Support |
|-------|---------|
| `BusinessProfileIdealCustomersSection` | `preferredNaicsCodes`, `excludedNaicsCodes`, `preferredSicCodes`, `excludedSicCodes`, `industryCodeNotes` |
| `GrowthProspectSearchFilters` | `naics_codes`, `excluded_naics_codes`, `sic_codes`, `excluded_sic_codes` |
| `industry-taxonomy.ts` | NAICS/SIC per industry playbook entry |
| `industry-playbook-resolver.ts` | exact NAICS/SIC resolution for playbooks |
| Lead metadata | `naics` / `sic` on personalization and outreach context |
| 21C admission | Uses industries, disqualifiers, keywords — **no NAICS auto-accept** |

### Provider mapping (approximate)

| Provider | Native NAICS | Native SIC | Notes |
|----------|--------------|------------|-------|
| Internal index / growth leads | Post-classification | Post-classification | Filter uses taxonomy keyword approximation when row lacks codes |
| Google Places / SERP | No | No | Codes preserved in search metadata; keyword/industry substitution |
| Apollo | No | No | Industry/title/keyword substitutes; admission gate on every record |
| Datamoon | No | No | Topic/audience criteria only |

Requested codes are stored on saved searches and mission context; provider diagnostics should mark non-native mapping as approximate.

### LIVE-1B code additions

- `lib/growth/prospect-search/prospect-search-industry-code-filters.ts` — validation, NL suggestions, row matching
- `components/growth/prospect-search/industry-code-filter-card.tsx` — Prospect Search UI (Industry accordion)
- Company Profile UI fields in `growth-home-business-profile-section.tsx`

Certification: `pnpm test:ge-aios-live-1b-industry-code-filters`

## Validation results (Vercel Production)

```bash
pnpm validate:ge-aios-live-1-production-operations
pnpm validate:ge-aios-21c-lead-admission-production
pnpm inspect:ge-aios-live-1b-production-profile-state
```

| Gate | Result |
|------|--------|
| `approved_profile` (LIVE-1) | ✓ Approved Company Profile: Equipify |
| `approved profile` (21C) | ✓ |
| Overall LIVE-1 verdict | NO-GO (other gates: legacy queue cleanup, 21C metadata migration, company evidence v22) |

Profile and mission objectives for LIVE-1B are satisfied.

## Operator scripts

```bash
# Read-only inspect
pnpm inspect:ge-aios-live-1b-production-profile-state

# Dry-run preview
pnpm apply:ge-aios-live-1b-equipify-production-company-profile

# Production write (explicit)
pnpm apply:ge-aios-live-1b-equipify-production-company-profile -- --apply
```

## Safe commit (if bundling LIVE-1B code changes)

```bash
git add \
  lib/growth/business-profile/business-profile-types.ts \
  lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content.ts \
  lib/growth/prospect-search/prospect-search-industry-code-filters.ts \
  lib/growth/prospect-search/prospect-search-filters.ts \
  lib/growth/prospect-search/prospect-search-filter-health.ts \
  lib/growth/prospect-search/prospect-search-types.ts \
  components/growth/workspace/executive-briefing/growth-home-business-profile-section.tsx \
  components/growth/prospect-search/industry-code-filter-card.tsx \
  components/growth/prospect-search/guided-icp-builder.tsx \
  scripts/inspect-ge-aios-live-1b-production-profile-state.ts \
  scripts/apply-ge-aios-live-1b-equipify-production-company-profile.ts \
  scripts/test-ge-aios-live-1b-industry-code-filters.ts \
  docs/GE-AIOS-LIVE-1B_EQUIPMENT_SERVICE_ICP.md \
  package.json

git commit -m "$(cat <<'EOF'
GE-AIOS-LIVE-1B: equipment-service ICP profile tools and NAICS/SIC search filters.

Adds operator-approved production profile content, apply/inspect scripts, Company Profile and Prospect Search industry-code UI, without changing 21C admission logic.
EOF
)"
```
