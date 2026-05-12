# AIden prepared workspace tier gating

Prepared workspace actions (natural language → preview → confirm → execute) can be **packaged by Equipify plan tier** when the server enables strict checks.

## Feature flag

| Variable | Meaning |
|----------|---------|
| `AIDEN_PREPARED_WORKSPACE_TIER_GATING=1` | Enforce the tier matrix in `canPrepareAidenAction` (API + executor re-asserts). |
| unset / `0` | **Legacy behavior**: only each action’s `planGate` in `action-registry.ts` applies (permissive defaults on several actions). |

Set in the deploy environment (see `.env.local.example`). **Do not enable in production** until product is ready to communicate plan changes to customers.

## Tier matrix (when gating is on)

| Tier | Prepared workspace actions |
|------|-----------------------------|
| **Solo** | None (all actions blocked for non-trial orgs). |
| **Core** | `summarize_customer_history`, `draft_customer_message` |
| **Growth** | Core + `create_follow_up_task`, `schedule_maintenance_visit`, `create_maintenance_plan_from_equipment` (maintenance actions still require `maintenance_plans` entitlement). |
| **Scale** | Growth + financial / inventory: `create_invoice_from_work_order`, `create_quote_from_work_order`, `prepare_invoice_payment_link`, `prepare_quickbooks_invoice_sync`, `create_parts_reorder_request`, `bulk_invoice_completed_work_orders` |

There is no separate **Enterprise** product `plan_id` today; bulk invoicing uses **Scale** as the minimum tier until an Enterprise plan exists.

**Trialing** orgs are evaluated like **Scale** for this matrix (same as `getEffectivePlanId` / `canUseFeature` trial mapping).

## Platform admin

Org routes attach `isPlatformAdmin` from the session email allowlist (`requireOrgMemberSession` / `requireOrgPermission`). When true:

- Session permissions are already **owner-equivalent** for capability checks.
- **Plan / tier** evaluation uses a synthetic **Scale, non-trial** row so support can exercise customer workspaces without changing the customer’s subscription (see `platformAdminPlanBypass` on `CanPrepareAidenActionArgs`).

## Code map

| Piece | Location |
|-------|-----------|
| Tier matrix + `getMinimumPlanForPreparedWorkspaceAction` | `lib/aiden/prepared-workspace-tier-policy.ts` |
| Env gate | `lib/aiden/prepared-workspace-tier-gate-env.ts` |
| `canPrepareAidenAction` / `diagnosePreparedWorkspacePrepareDenial` | `lib/aiden/actions/action-permissions.ts` |
| Resolver session alignment | `routeGate` on invoice / quote / bulk resolvers + `lib/aiden/prepared-workspace-route-gate.ts` |
| Prepare / preview / confirm / execute | `app/api/organizations/.../aiden/prepared-actions/**` |
| Client hints | `GET .../aiden/productivity/eligibility` + `lib/aiden/aiden-capability-messaging.ts` |
| Upgrade copy on prepare `403` | `components/aiden/aiden-chat-panel.tsx` (`plan_upgrade_required`) |

## Tests

`pnpm test:aiden-prepared-workspace-tier-policy` (see `scripts/test-aiden-prepared-workspace-tier-policy.ts`).
