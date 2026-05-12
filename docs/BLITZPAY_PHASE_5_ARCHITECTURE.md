# BlitzPay Phase 5A — Multi-entity / franchise financial foundations

**Status:** shipped (orchestration + reporting + accounting placeholders only).

Phase **5A** adds deterministic **multi-entity financial infrastructure** for franchise groups, regional operators, holding companies, and multi-location contractors. It is **not** a merged org database, **not** autonomous money movement, and **not** automatic GL consolidation.

---

# BlitzPay Phase 5B — Vendor & supplier network foundations

**Status:** shipped (orchestration + aggregate reporting only).

Phase **5B** adds **opt-in supplier / procurement networks**: explicit anchor orgs, membership rows, preferred vendor programs (informational), bulk coordination placeholders, aggregate-only shared procurement benchmarks, vendor financing **visibility** rows, org-local supplier performance scores, and an append-only network audit log. It does **not** negotiate pricing, execute procurement, originate financing, merge AP systems, or expose customer-level data across tenants.

---

# BlitzPay Phase 5C — Warranty reserves, claims workflow & protection foundations

**Status:** shipped (orchestration + reporting + accounting placeholders only).

Phase **5C** adds **deterministic** warranty **reserve** rows, **claims** workflow tracking (statuses and amounts only), **reserve movements**, **equipment protection plans** (operational exposure tracking), **claims payout tracking** with **opaque** `payout_reference_hash` (no external payment identifiers), **storm-event financial** planning rows, **append-only claims audit** (`immutable_hash`), **protection-plan reporting snapshots**, **GL claims COA placeholders** via `ensureBlitzpayDefaultClaimsAccounts`, bounded org-scoped APIs, eight new **reporting snapshot + FCC** fields, and **Claims & protection** UI on Insights + Financial Command Center. It does **not** underwrite insurance, autonomously approve or deny claims, issue payouts, act as an insurer, create legal warranties, adjudicate claims, automate disaster response, or expose customer-sensitive claim data across organizations.

## Phase 5C — Database

Migration: `20261120120000_blitzpay_phase_5c_insurance_warranty_claims.sql`

| Table | Role |
|-------|------|
| `blitzpay_warranty_reserves` | Tracked reserve buckets (integer cents; optional GL `linked_account_id`) |
| `blitzpay_claims` | Workflow rows (status/type/reference/amounts; **no** autonomous adjudication) |
| `blitzpay_claim_reserve_movements` | Accrual / adjustment / utilization / reversal / replenishment movements |
| `blitzpay_equipment_protection_plans` | Operational protection-plan tracking (not legal coverage) |
| `blitzpay_claims_payout_tracking` | Internal payout **tracking** rows + opaque reference hash |
| `blitzpay_storm_event_financials` | Storm-season **forecasting** placeholders (no response automation) |
| `blitzpay_claims_audit_log` | Append-only audit (`immutable_hash`; updates blocked) |
| `blitzpay_protection_plan_snapshots` | Point-in-time reporting snapshots |

**RLS:** authenticated finance-role reads on own `organization_id` only; authenticated writes are not used — APIs use service role after Next.js permission gates (same BlitzPay staff pattern).

## Phase 5C — Services & APIs

- `lib/blitzpay/blitzpay-warranty-reserves.ts`, `blitzpay-protection-plans.ts`, `blitzpay-storm-financials.ts` — pure integer math + deterministic scores.
- `lib/blitzpay/blitzpay-claims-audit.ts` — audit + payout reference hashing (`BLITZPAY_CLAIMS_AUDIT_PEPPER` optional).
- `lib/blitzpay/blitzpay-claims-orchestration.ts` — bounded reads, `prioritizeClaimsDeterministic`, `buildPhase5cClaimsReportingSlice`, create helpers + audit inserts (**no** auto-approval / **no** payouts).

Base: `/api/organizations/[organizationId]/blitzpay/…`

| Method | Path | Notes |
|--------|------|------|
| GET/POST | `…/claims/reserves` | Bounded list; POST creates reserve + audit |
| GET/POST | `…/claims` | Bounded list (no raw customer/equipment ids in GET select); POST creates claim + audit |
| GET/POST | `…/claims/payouts` | Tracking rows only; responses use `payout_reference_hash` only |
| GET | `…/claims/health` | Phase **5C** slice + disclaimer |
| GET/POST | `…/protection-plans` | Bounded list; POST creates plan + audit |
| GET/POST | `…/storm-events` | Bounded list; POST creates storm row + audit |

---

## Phase 5B — Database

Migration: `20261119120000_blitzpay_phase_5b_vendor_supplier_network.sql`

| Table | Role |
|-------|------|
| `blitzpay_supplier_networks` | Network metadata (type, visibility scope, status) |
| `blitzpay_supplier_network_members` | Explicit org ↔ network membership |
| `blitzpay_preferred_vendor_programs` | Preferred pricing structures (orchestration signals; optional `supplier_network_id`) |
| `blitzpay_bulk_purchase_opportunities` | Bulk coordination placeholders (no auto-buy) |
| `blitzpay_supplier_performance_scores` | Org-local vendor score rows |
| `blitzpay_vendor_financing_network_offers` | Financing visibility placeholders (no execution) |
| `blitzpay_supplier_network_audit_log` | Append-only audit (mutations blocked by trigger) |
| `blitzpay_shared_procurement_benchmarks` | **Aggregate-only** benchmark rows for a network |

**RLS:** finance-role visibility consistent with other BlitzPay staff tables — membership or anchor org required; no unscoped cross-org reads.

---

## Phase 5B — Services

- `lib/blitzpay/blitzpay-supplier-network.ts` — bounded list/create helpers, Phase **5B** reporting slice (`buildPhase5bSupplierNetworkReportingSlice`), `skipSupplierNetwork` recursion guard input for nested snapshot fetches.
- `lib/blitzpay/blitzpay-supplier-network-audit.ts` — SHA-256 audit hash (`BLITZPAY_SUPPLIER_NETWORK_AUDIT_PEPPER` optional).
- `lib/blitzpay/blitzpay-procurement-benchmarks.ts` — merge Phase **5B** extension fields from aggregate context (integer cents + 0–100 scores).
- `lib/blitzpay/blitzpay-vendor-performance.ts` — deterministic overall score + averages.
- `lib/blitzpay/blitzpay-bulk-purchasing.ts` — preferred-pricing opportunity cents + bulk savings sums (integer math, per-row caps).

**Integration:** `fetchBlitzpayOrgReportingSnapshot` merges eight Phase **5B** fields when `skipSupplierNetwork` is false. Nested multi-entity snapshot fetches pass `skipSupplierNetwork: true` to cap load. Financial Command Center tiles mirror the same fields.

---

## Phase 5B — Org APIs

Base: `/api/organizations/[organizationId]/blitzpay/supplier-network/…`

| Method | Path | Notes |
|--------|------|------|
| GET/POST | `…/networks` | List visible networks; create (anchor org) |
| GET/POST | `…/members` | `GET ?supplier_network_id=`; `POST` anchor-only |
| GET/POST | `…/preferred-programs` | Bounded list; anchor creates programs |
| GET/POST | `…/bulk-opportunities` | List for visible networks; anchor creates rows |
| GET | `…/vendor-performance` | Org-local scores (bounded) |
| GET | `…/benchmarks` | Aggregate benchmarks for visible networks |
| GET | `…/health` | Phase **5B** slice + disclaimer |

---

## Phase 5B — Ops checklist

- Apply migration `20261119120000_blitzpay_phase_5b_vendor_supplier_network.sql`
- Optional: `BLITZPAY_SUPPLIER_NETWORK_AUDIT_PEPPER` in production
- Run `pnpm test:blitzpay-schema-health` and `pnpm test:blitzpay-phase-5b-supplier-network` after deploy

---

## 1. Explicit visibility model

- **Anchor org:** each `blitzpay_financial_groups` row is owned by `organization_id` (the anchor). Only the anchor may **mutate** group membership and inter-company tracking rows via org APIs (service role after staff permission gates).
- **Linked orgs:** `blitzpay_financial_group_members` records explicit membership (`parent`, `child`, `regional`, `observer`). Staff at a linked org can **read** group-scoped rows when they hold finance permissions on their own org (RLS + app checks).
- **No automatic cross-org admin:** membership does **not** grant settings or payout control on sibling orgs.

---

## 2. Database (migration `20261118120000_blitzpay_phase_5a_multi_entity_finance.sql`)

| Table | Role |
|-------|------|
| `blitzpay_financial_groups` | Group metadata; optional `parent_group_id` for hierarchy |
| `blitzpay_financial_group_members` | Explicit org ↔ group linkage |
| `blitzpay_intercompany_balances` | **Tracking only** balances between orgs (cents, non-negative); **no** settlement worker in 5A |
| `blitzpay_consolidated_snapshots` | Optional persisted KPI snapshots per group per day (not authoritative GL) |
| `blitzpay_multi_entity_audit_log` | Append-only audit (mutations blocked by trigger) |
| `blitzpay_shared_operational_benchmarks` | Aggregate benchmark rows (no customer PII) |

**RLS:** authenticated `SELECT` where caller has finance role on **anchor** org **or** active membership on the group plus finance role on their member org. **Writes** for authenticated inserts are intentionally absent — APIs use the **service role** after Next.js permission gates (same pattern as other BlitzPay staff tables).

---

## 3. Services & deterministic aggregation

- `lib/blitzpay/blitzpay-multi-entity-finance.ts` — group/member/intercompany list helpers, Phase **5A** reporting slice builder (`buildPhase5aLinkedOrgReportingSlice`), bounded linked-org snapshot fetch with `skipMultiEntity` recursion guard.
- `lib/blitzpay/blitzpay-consolidated-reporting.ts` — pure merge of linked `BlitzpayOrgReportingSnapshot` rows + intercompany active exposure into Phase **5A** extension fields.
- `lib/blitzpay/blitzpay-intercompany-balances.ts` — deterministic sorts + treasury/payroll/procurement rollups (integer cents).
- `lib/blitzpay/blitzpay-shared-benchmarks.ts` — shared benchmark coverage (0–100) from aggregate signals only.
- `lib/blitzpay/blitzpay-multi-entity-audit.ts` — canonical SHA-256 audit hash (`BLITZPAY_MULTI_ENTITY_AUDIT_PEPPER` optional).

**GL integration:** `BLITZPAY_INTERCOMPANY_COA_EXTENSION` + `ensureBlitzpayDefaultIntercompanyAccounts()` seed **1180 / 2180** placeholder accounts (merged by `fetchGlReportingSnapshotFields` best-effort). **No auto-posting** from inter-company rows in Phase **5A**.

---

## 4. Org APIs (`/api/organizations/[organizationId]/blitzpay/multi-entity/…`)

| Method | Path | Notes |
|--------|------|------|
| GET/POST | `…/groups` | List visible groups; create anchor group (settings-capable roles) |
| GET/POST | `…/group-members` | `GET ?financial_group_id=` lists members; `POST` anchor-only |
| GET/POST | `…/intercompany-balances` | List visible balances; `POST` anchor-only tracking row |
| GET | `…/consolidated-snapshots` | Bounded list for visible groups |
| GET | `…/benchmarks` | Bounded list for visible groups |
| GET | `…/health` | Phase **5A** KPI slice + regional rollups + disclaimer |

All routes call `blitzpaySchemaGuardNextResponse` and `requireAnyOrgPermission` with financial read gates; mutations additionally require `canManageSettings` + `canViewFinancials`.

---

## 5. Reporting snapshot + FCC

`fetchBlitzpayOrgReportingSnapshot` adds eight Phase **5A** integer fields (`multiEntityRevenueExposure`, `multiEntityTreasuryExposure`, …) populated from linked org snapshots **only** when `skipMultiEntity` is false. It adds eight Phase **5B** fields (`supplierNetworkParticipationScore`, `procurementBenchmarkScore`, `preferredPricingOpportunityCents`, …) when `skipSupplierNetwork` is false (nested linked-org fetches pass `skipSupplierNetwork: true` to cap extra reads). It adds eight Phase **5C** fields (`warrantyReserveExposure`, `claimsExposureCents`, `claimsReserveCoverageScore`, `protectionPlanRecurringRevenue`, `stormEventTreasuryPressure`, `contractorProtectionHealthScore`, `claimsPayoutExposure`, `protectionPlanCoverageRate`) when `skipClaimsWarranty` is false (nested fetches pass `skipClaimsWarranty: true` where needed). Phase **6A** adds eight mobile fields when `skipMobilePhase6a` is false; nested health-style fetches pass `skipMobilePhase6a: true` where needed (see `docs/BLITZPAY_PHASE_6_ARCHITECTURE.md`). The Financial Command Center tiles mirror Phase **5A**, **5B**, **5C**, and **6A** fields for staff visibility.

---

## 6. UI

- `BlitzpayMultiEntityFinancePanel` — Insights hub + Financial Command Center page; includes the disclaimer: *“Multi-entity reporting reflects linked organizations with authorized visibility permissions. Financial actions remain scoped to each organization.”*
- `BlitzpaySupplierNetworkPanel` — same surfaces; includes the supplier-network disclaimer (see Phase **5B** section above).
- `BlitzpayClaimsProtectionPanel` — same surfaces; includes the Phase **5C** disclaimer (claims / warranty / protection tracking only; coverage and payouts remain with the org’s review processes).

---

## 7. Out of scope (by design)

- Autonomous inter-company settlement or treasury transfers
- Automatic consolidated GL journals
- Customer-level benchmark sharing across orgs
- Portal or anonymous access to multi-entity endpoints

---

## 8. Ops checklist

- Apply migrations `20261118120000_blitzpay_phase_5a_multi_entity_finance.sql`, `20261119120000_blitzpay_phase_5b_vendor_supplier_network.sql`, and `20261120120000_blitzpay_phase_5c_insurance_warranty_claims.sql`
- Set `BLITZPAY_MULTI_ENTITY_AUDIT_PEPPER` and optionally `BLITZPAY_SUPPLIER_NETWORK_AUDIT_PEPPER` / `BLITZPAY_CLAIMS_AUDIT_PEPPER` in production (recommended)
- Run `pnpm test:blitzpay-schema-health`, `pnpm test:blitzpay-phase-5b-supplier-network`, and `pnpm test:blitzpay-phase-5c-insurance-warranty-claims` after deploy
