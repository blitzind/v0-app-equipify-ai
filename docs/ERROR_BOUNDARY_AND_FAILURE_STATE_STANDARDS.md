# Error boundaries & failure-state standards (Phase 62.4)

Stabilization pass: **predictable recovery UX** without a parallel UI kit, fake retries, or leaking stack traces to users.

## Approved building blocks

| Piece | Location | Use |
| --- | --- | --- |
| **Canonical copy** | `lib/failure-states/copy.ts` | Import `FAILURE_COPY` for titles/descriptions shared across routes, drawers, and toasts. |
| **Route segment errors** | `RouteErrorFallback` — `components/failure-states/route-error-fallback.tsx` | Next.js `error.tsx` boundaries only. Props: `error`, `reset`, `scope`. |
| **Section / drawer / card errors** | `SectionFailureState` — `components/failure-states/section-failure-state.tsx` | Inline failures inside a layout that should not crash the whole page. Optional **real** `onRetry`. |
| **Empty states** | `components/ui/empty.tsx` | No data — not an error. Keep empty vs error visually distinct. |
| **Alerts** | `components/ui/alert.tsx` | Short inline banners (`role="alert"`). |

## Route-level boundaries (Next.js App Router)

| File | Role |
| --- | --- |
| `app/error.tsx` | Catches errors under the root layout’s children (generic staff-oriented copy). |
| `app/global-error.tsx` | Catches failures that break the root layout; includes minimal `html`/`body` + `globals.css`. |
| `app/not-found.tsx` | Honest 404 — no fake “success”. |
| `app/(dashboard)/error.tsx` | Dashboard subtree — sidebar/top chrome from layout may remain; copy tuned for “this section”. |
| `app/(portal)/error.tsx` | Portal subtree — customer-facing tone. |
| `app/(admin)/error.tsx` | Platform admin subtree. |

Nested boundaries **do not** replace server permission or entitlement checks — they only prevent a thrown render error from blanking the entire app when a closer boundary exists.

## When retry is allowed

- **Route boundary:** `reset()` from Next.js — remounts the failed segment; **legitimate** retry.
- **Data fetch:** `onRetry` only when it re-runs the same fetch/mutation (e.g. incrementing a fetch nonce, calling an existing loader). **Do not** add buttons that only dismiss UI without repeating work.
- **`router.refresh()`** — use where the app already relies on server component re-fetch after recovery.

## Copy patterns (honest, non-technical)

Prefer strings from `FAILURE_COPY`, e.g.:

- Load failures → “We couldn't load this data.” / “We couldn't load this screen.”
- Permissions → “You don't have permission to view this.”
- Plans → “This feature is not available on your current plan.”
- Offline → “This action needs an internet connection.”
- QuickBooks → “QuickBooks could not complete the sync.”
- Missing entity → “This record may have been deleted or moved.”

Avoid defaulting every surface to a single vague line; **do** avoid raw stack traces and misleading success language.

## Permission, entitlement, offline, integrations

- **No change** to server gates (RLS, `requireOrgPermission`, `requireFeatureAccess`, billing guards).
- Failure UI must **reflect** denials clearly; do not substitute a generic route error for a known 403/feature/offline response when the component already receives that signal.
- **QuickBooks / catalog metadata** — product docs remain source of truth for integration posture (`docs/INTEGRATION_CATALOG_INVENTORY.md`, `lib/integrations/catalog-metadata.ts`).

## Drawer / sheet hardening (pattern)

- Related-data load failures should use **`SectionFailureState`** (or equivalent) so the shell stays usable.
- Example implemented: **`FeedDetailDrawer`** — failed detail fetch shows standardized copy + retry that re-triggers the load effect.

## Intentionally unchanged / deferred

- **Broad API error-shape refactor** — only fix dangerous drift case-by-case; contracts stay stable.
- **Every list page** — not exhaustively migrated to `SectionFailureState`; adopt incrementally when touching a surface.
- **`loading.tsx`** — not added globally; add per-route when a route benefits without flicker (optional follow-up).

## Related docs

- `docs/ACCESSIBILITY_AND_RESPONSIVE_VALIDATION.md` — Phase 62.3.
- `docs/PLAN_ENTITLEMENT_ENFORCEMENT_AUDIT.md` — entitlements vs permissions.
- `docs/WORK_ORDER_OFFLINE_OPERATIONAL_VALIDATION.md` — offline/sync honesty.
