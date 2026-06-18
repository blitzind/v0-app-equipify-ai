# Equipify Plan Naming Migration

**Phase:** EC-1 — Documentation only (no implementation)  
**Related:** Workspace switcher naming is **NOT part of EC-1**. Document dependencies here for safe EC-3+ implementation.

---

## Locked decisions

### Plan structure (no migrations)

| Internal `plan_id` | Branded display name | Notes |
|--------------------|----------------------|-------|
| `solo` | **Equipify Solo** | Legacy `starter` normalizes to `solo` |
| `core` | **Equipify Core** | Purchasable tier ($197/mo) |
| `growth` | **Equipify Growth** | Purchasable tier ($397/mo) |
| `scale` | **Equipify Scale** | Purchasable tier ($797/mo) |
| `enterprise` | **Equipify Enterprise** | Admin/internal/contract only |

**Explicitly out of scope:**

- No database `plan_id` changes
- No Stripe product/price migrations
- No entitlement or billing logic changes

### Workspace switcher

**Current (production today):**

```txt
Equipify Core          → operations workspace (/)
Growth Engine          → internal sales workspace (/growth)
```

**Future (post EC-1, separate implementation phase):**

```txt
Equipify {Subscribed Plan}    → operations workspace (/)
Growth Engine                 → unchanged (/growth)
```

Examples when subscribed to Growth plan: switcher shows **Equipify Growth**, not the static label **Equipify Core**.

**Implementation dependency:** Workspace switcher label must read `organization_subscriptions.plan_id` (via `getOrganizationSubscription` / `BillingAccessProvider`) and map through a centralized display helper. Must **not** conflate workspace routing key (`workspace: "core"`) with plan tier.

---

## Naming architecture (proposed — not implemented)

Single helper source of truth extending `lib/plan-display.ts`:

```ts
getEquipifyPlanDisplayName({ planId, subscription, branded: true })
```

| Input | Branded output | Fallback |
|-------|----------------|----------|
| `solo` | Equipify Solo | Equipify |
| `core` | Equipify Core | Equipify |
| `growth` | Equipify Growth | Equipify |
| `scale` | Equipify Scale | Equipify |
| `enterprise` | Equipify Enterprise | Equipify |
| Active trial | Equipify Scale Trial (or intended-plan hint) | Equipify |
| null / unknown | **Equipify** | — |

**Recommended unknown fallback:** `Equipify` (not `Equipify Core`, not `Unknown Plan`).

---

## Surface inventory

### Replace with plan-aware branded name

| Surface | File(s) | Current | Target |
|---------|---------|---------|--------|
| **Workspace switcher** | `components/workspace/workspace-switcher.tsx` | Static `Equipify Core` | `Equipify {Subscribed Plan}` |
| **Sidebar badges** | `components/app-sidebar.tsx` | `Core`, `Growth`, etc. via `planBadgeFromWorkspace()` | `Equipify Core`, etc. |
| **Account footer** | `components/workspace/workspace-topbar-account-controls.tsx` | `Equipify.ai · Core · Active` | `Equipify.ai · Equipify Core · Active` |
| **Billing page** | `app/(dashboard)/settings/billing/page.tsx` | `{currentPlanData.name} plan` | `Equipify {Tier} plan` |
| **Onboarding plan cards** | `app/(auth)/onboarding/page.tsx` | `Solo`, `Core`, `Growth`, `Scale` from `PLANS` | Optional: `Equipify Solo`, etc. |
| **Upgrade copy** | `components/blitzpay/executive-overview/executive-overview-dashboard.tsx`, `lib/billing/feature-access.ts`, `app/(dashboard)/settings/api/page.tsx` | `Upgrade to Core`, `Growth or higher` | `Upgrade to Equipify Core`, etc. |
| **AI gate messages** | `lib/ai/plan-gate.ts`, `components/aiden/aiden-chat-panel.tsx` | `requires Growth plan` / raw `scale` | `requires Equipify Growth` |
| **BlitzPay plan strip** | `components/blitzpay/blitzpay-plan-awareness-strip.tsx` | `shortLabel: "Core"` | Branded short label |
| **Workspace settings preview** | `app/(dashboard)/settings/workspace/page.tsx` | `planMeta.name` pill | Branded name |
| **Settings AI usage** | `app/(dashboard)/settings/ai-usage/page.tsx` | `planAi.planLabel` | Branded via helper |

### Keep unchanged (generic platform brand)

| Surface | Reason |
|---------|--------|
| `app/layout.tsx` title (`Equipify.ai — …`) | Platform marketing |
| Portal `ProvidedByEquipify` / `Powered by Equipify` | Generic platform attribution |
| Customer PDFs (invoice, quote, PO) | Organization branding only |
| Transactional emails (`wrapEquipifyEmail`) | Org name + platform; not plan tier |
| Legal footer ("Blitz Industries, Inc.") | Legal entity |
| Email sender domains | Infrastructure |
| Growth Engine chrome (`Growth Engine`) | Separate internal product |
| `lib/plans.ts` `id` fields and Stripe metadata `plan_id` | Internal keys |
| Database `organization_subscriptions.plan_id` | No migration |
| Stripe Dashboard product names | Manual audit only; no code migration in EC-1 |

### Needs decision before implementation

| Surface | Issue |
|---------|-------|
| `lib/platform-analytics-compute.ts` | `scale` id labeled `Enterprise` in admin charts |
| `app/(dashboard)/settings/audit-log/page.tsx` | Mixes Growth / Enterprise; no Scale |
| Business-card scan error copy | References Enterprise vs Scale |
| Stripe Checkout product titles | Controlled in Stripe Dashboard, not app code |

---

## Workspace vs plan: routing keys (do not rename)

These are **technical identifiers**, not customer-facing copy:

```ts
// components/workspace/workspace-search.tsx
workspace: "core"   // operations workspace namespace
workspace: "growth" // Growth Engine namespace (internal)
```

Future plan-aware **labels** must not change these routing keys unless a dedicated routing migration is approved.

---

## Implementation phases (post EC-1)

| Phase | Scope |
|-------|-------|
| **EC-2** | Production certification execution (no naming changes) |
| **EC-3** | Add `getEquipifyPlanDisplayName()` + unit tests |
| **EC-4** | Chrome surfaces: sidebar, account footer, billing header |
| **EC-5** | Workspace switcher dynamic plan label |
| **EC-6** | Upgrade/gate copy + Enterprise/Scale drift cleanup |
| **EC-7** | Stripe Dashboard product title alignment (manual) |

---

## EC-1 dependency note

The workspace switcher change **depends on**:

1. EC-2 confirming billing/subscription reads work correctly on production (`plan_id`, trial, `intended_plan_id`).
2. EC-3 introducing `getEquipifyPlanDisplayName()` without changing `plan_id` storage.
3. `BillingAccessProvider` / `planBadgeFromWorkspace()` consuming the same helper to avoid sidebar vs switcher mismatch.

**Risk if implemented before EC-2:** Switcher could show wrong tier if subscription row missing, stale, or trial mapping misunderstood.

---

## References

- `lib/plans.ts` — plan catalog (generic names today)
- `lib/plan-display.ts` — `planBadgeFromWorkspace()`, `PLAN_BADGE_META`
- `components/workspace/workspace-switcher.tsx` — only literal `Equipify Core` in codebase
- `docs/EQUIPIFY_CORE_PRODUCTION_CERTIFICATION.md` — EC-1 certification inventory
