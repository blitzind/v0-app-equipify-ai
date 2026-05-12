# BlitzPay Phase 5A — Multi-entity / franchise financial foundations

**Status:** shipped (orchestration + reporting + accounting placeholders only).

Phase **5A** adds deterministic **multi-entity financial infrastructure** for franchise groups, regional operators, holding companies, and multi-location contractors. It is **not** a merged org database, **not** autonomous money movement, and **not** automatic GL consolidation.

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

`fetchBlitzpayOrgReportingSnapshot` adds eight Phase **5A** integer fields (`multiEntityRevenueExposure`, `multiEntityTreasuryExposure`, …) populated from linked org snapshots **only** when `skipMultiEntity` is false. The Financial Command Center tiles mirror those fields for staff visibility.

---

## 6. UI

- `BlitzpayMultiEntityFinancePanel` — Insights hub + Financial Command Center page; includes the disclaimer: *“Multi-entity reporting reflects linked organizations with authorized visibility permissions. Financial actions remain scoped to each organization.”*

---

## 7. Out of scope (by design)

- Autonomous inter-company settlement or treasury transfers
- Automatic consolidated GL journals
- Customer-level benchmark sharing across orgs
- Portal or anonymous access to multi-entity endpoints

---

## 8. Ops checklist

- Apply migration `20261118120000_blitzpay_phase_5a_multi_entity_finance.sql`
- Set `BLITZPAY_MULTI_ENTITY_AUDIT_PEPPER` in production (optional but recommended)
- Run `pnpm test:blitzpay-schema-health` after deploy
