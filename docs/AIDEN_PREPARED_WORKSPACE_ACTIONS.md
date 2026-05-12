# AIden prepared workspace actions (foundation)

This document describes the **intent + gated execution** path for AIden **prepared workspace actions**. Optional LLM intent assist (see **Optional LLM intent assist** below) only proposes structured JSON; execution remains deterministic, resolver-backed, and confirmation-gated.

## Goals

- Typed catalog of high-value workspace operations AIden may **propose** as structured intents.
- Centralized **risk**, **permissions**, and **plan / feature** metadata for future prepare/confirm/execute pipelines.
- **No direct mutation** from model output: prepared JSON is **intent only** until a gated executor runs after confirmation.

## Code map

| File | Role |
|------|------|
| `lib/aiden/actions/action-types.ts` | Action ids, categories, `AidenPreparedWorkspaceActionDefinition`, plan gate shape. |
| `lib/aiden/actions/action-risk.ts` | Canonical risk level union + helpers (`isFinancialRiskLevel`, …). |
| `lib/aiden/actions/action-permissions.ts` | Permission checks, `canUseFeature` integration, `canPrepareAidenAction`, confirmation helpers. When `AIDEN_PREPARED_WORKSPACE_TIER_GATING=1`, `canPrepareAidenAction` uses the tier matrix in `prepared-workspace-tier-policy.ts` instead of definition `planGate` alone. |
| `docs/AIDEN_PREPARED_WORKSPACE_TIER_GATING.md` | Plan-tier packaging for prepared workspace actions (feature flag, matrix, platform-admin bypass). |
| `lib/aiden/actions/action-registry.ts` | Frozen definitions, `AIDEN_PREPARED_WORKSPACE_ACTION_REGISTRY`, getters, startup safety assert. |
| `lib/aiden/actions/prepared-action-status.ts` | Status union + `AIDEN_PREPARED_ACTION_STATUSES` (aligned with DB CHECK on `aiden_prepared_actions.status`). |
| `lib/aiden/actions/prepared-action-repository.ts` | Typed helpers to insert/update/list/get `aiden_prepared_actions` (writes: service-role client). |
| `lib/aiden/actions/action-audit-log.ts` | Append-only inserts + org-scoped reads for `aiden_action_audit_log`. |
| `lib/aiden/intent/parse-aiden-intent.ts` | **Deterministic** NL → prepared intent (`parseAidenPreparedWorkspaceIntent`). No DB writes. |
| `lib/aiden/intent/aiden-prepared-intent-llm-schema.ts` | Zod strict schema + `normalizeLlmIntentOutput` for optional LLM proposals (strips UUID-shaped “references”). |
| `lib/aiden/intent/aiden-prepared-intent-llm-thresholds.ts` | Confidence bands (`AIDEN_PREPARED_INTENT_LLM_HIGH` / `MEDIUM`) for prepare vs clarify vs low-confidence paths. |
| `lib/aiden/intent/merge-prepared-intent-llm.ts` | Merges deterministic + validated LLM output; **det-first** reference merge; action conflicts → `actionIntent` clarification. |
| `lib/aiden/intent/build-aiden-prepared-intent-llm-prompt.ts` | System/user prompt with guardrails (registered action ids only; no invented records/prices; no “completed/sync/charged” claims). |
| `lib/aiden/intent/parse-aiden-prepared-intent-llm.ts` | Server-only `runAiTask("aiden_prepared_workspace_intent_llm", …)` + schema parse; returns null on any failure. |
| `lib/aiden/intent/parse-prepared-workspace-intent-with-optional-llm.ts` | Orchestrator: env `AIDEN_PREPARED_INTENT_LLM_ENABLED` → optional LLM, else deterministic-only. |
| `lib/aiden/intent/aiden-prepared-intent-llm-enabled.ts` | Reads `AIDEN_PREPARED_INTENT_LLM_ENABLED`. |
| `lib/aiden/intent/aiden-prepared-workspace-intent-llm.schema.json` | Hand-authored JSON Schema (Draft 2020-12) mirroring the LLM contract for external tooling / review. |
| `lib/aiden/intent/intent-types.ts` | Parser result types (`AidenParsedPreparedIntent`, options, work-order reference union). |
| `lib/aiden/intent/customer-reference-parser.ts` | Rule-based customer name / “this customer” detection. |
| `lib/aiden/intent/work-order-reference-parser.ts` | Rule-based `latest` / `latest_completed` / explicit WO hints / “this work order”. |
| `lib/aiden/actions/resolvers/create-invoice-from-work-order-resolver.ts` | DB-backed **preview** for `create_invoice_from_work_order` (membership, permissions, customer/WO selection, line items). **No invoice insert.** |
| `lib/aiden/actions/resolvers/create-quote-from-work-order-resolver.ts` | DB-backed **preview** for `create_quote_from_work_order` (customer + work order + line items from labor/parts and open checklist tasks). **No `org_quotes` insert.** |
| `lib/aiden/actions/executors/create-quote-from-work-order-executor.ts` | **Execute** (after confirm): draft `org_quotes` from `preview_payload.preview`; no customer send. |
| `lib/aiden/actions/executors/create-invoice-from-work-order-executor.ts` | **Execute** (after confirm): draft `org_invoices` + line items from `preview_payload.preview`; no email, payment link, QuickBooks queue, or work-order billing-state sync for this path. |
| `lib/aiden/actions/resolvers/summarize-customer-history-resolver.ts` | DB-backed **read-only** preview for `summarize_customer_history` (bounded work orders, equipment, maintenance plans, communications; invoices/quotes only when role permissions allow). **No writes** in the resolver. |
| `lib/aiden/actions/resolvers/create-follow-up-task-resolver.ts` | DB-backed **preview** for `create_follow_up_task` (anchor record, suggested title, due date, assignee hint, notes). **No `follow_up_tasks` insert.** |
| `lib/aiden/actions/resolvers/schedule-maintenance-visit-resolver.ts` | DB-backed **preview** for `schedule_maintenance_visit` (customer / equipment / plan, service type, duration hint, technician suggestion, date from message or plan next due). **No work order insert.** |
| `lib/aiden/actions/resolvers/create-maintenance-plan-from-equipment-resolver.ts` | DB-backed **preview** for `create_maintenance_plan_from_equipment` (customer + equipment, suggested interval / next due / WO defaults from message + equipment, technician hint from last WO). **No `maintenance_plans` insert.** |
| `lib/aiden/actions/resolvers/create-parts-reorder-request-resolver.ts` | DB-backed **preview** for `create_parts_reorder_request` (work-order parts / consumption, equipment recent-job aggregation, or org low-stock rows; vendor + location hints; suggested quantities). **No PO or ledger writes.** |
| `lib/aiden/prepared-actions/follow-up-task-preview-merge.ts` | Validates and merges PATCH edits for follow-up preview (`title`, `notes`, `dueDate`; normalizes `scheduled_for` noon UTC). |
| `lib/aiden/prepared-actions/schedule-maintenance-visit-preview-merge.ts` | Validates and merges PATCH edits for maintenance visit preview (date, time, type, priority, notes, service reason). |
| `lib/aiden/prepared-actions/create-maintenance-plan-from-equipment-preview-merge.ts` | Validates and merges PATCH edits for maintenance plan preview (plan name, interval, dates, scope, WO defaults, notes; customer/equipment ids locked from resolver). |
| `lib/aiden/prepared-actions/create-parts-reorder-request-preview-merge.ts` | Validates and merges PATCH edits for parts reorder preview (line quantities, per-line vendor, execution mode; recomputes single-vendor draft PO eligibility). |
| `lib/aiden/actions/executors/create-follow-up-task-executor.ts` | **Execute** (after confirm): inserts `follow_up_tasks` with `rule_key` `aiden_manual_follow_up`, idempotent `dedupe_key`, draft subject/body from preview; **no customer send**. |
| `lib/aiden/actions/executors/schedule-maintenance-visit-executor.ts` | **Execute** (after confirm): inserts **`work_orders`** with status **`scheduled`** using the **user** Supabase client (JWT) so `created_by` triggers apply; assignment via `workOrderAssignmentColumns`. |
| `lib/aiden/actions/executors/create-maintenance-plan-from-equipment-executor.ts` | **Execute** (after confirm): inserts **`maintenance_plans`** via **`userSupabase`** after `requireMaintenancePlanCreate` + `maintenancePlanAssignmentColumns`; notes include `AIDEN_PREPARED_ACTION_ID` trace. |
| `lib/aiden/actions/executors/create-parts-reorder-request-executor.ts` | **Execute** (after confirm): either inserts a **draft** `org_purchase_orders` row (single vendor, billing `purchase_order` gate; **no vendor send**) or writes `inventory_transactions` with `reorder_recorded` + `metadata.restock_request` per line via **service role** (`args.svc`). |
| `lib/aiden/prepared-actions/execute-prepared-workspace-action.ts` | Dispatches execution after audit `prepared_action_execution_started`; wires `create_invoice_from_work_order`, `create_quote_from_work_order`, `prepare_invoice_payment_link`, `draft_customer_message`, `prepare_quickbooks_invoice_sync`, `create_follow_up_task`, `schedule_maintenance_visit`, `create_maintenance_plan_from_equipment`, `create_parts_reorder_request`, and a **no-op / idempotent finalize** path for `summarize_customer_history`; remaining ids return **501** via `record-not-implemented-execution`. |
| `lib/aiden/prepared-actions/prepared-actions-shared.ts` | **Client-safe** `UUID_RE`, `isPreparedWorkspaceActionId` (no `server-only`) — import from React components; never import `prepared-actions-api-helpers` in `"use client"` modules. |
| `lib/aiden/prepared-actions/prepared-actions-api-helpers.ts` | **Server-only** guards: AIden Actions entitlement, service-role accessor, `requireWorkspacePreparedActionPermissions`, serializers; re-exports shared UUID helpers for Route Handlers. |
| `lib/aiden/prepared-actions/record-not-implemented-execution.ts` | Audit-only stub for workspace executors that are not wired yet (**501**). |

**Related (existing, unchanged in this phase):**

- `lib/aiden/actions/registry.ts` — **executor** registry for legacy `AidenActionType` flows (`create_customer`, …) with `execute` functions.
- `lib/permissions/aiden-actions.ts` — plan override + `canExecuteAidenAction` for that executor surface.
- `lib/aiden/safe-actions/*` — bounded “safe actions” prepare/confirm path (separate product track).

Import **prepared** helpers from `action-registry.ts` (or split imports by concern). Do not confuse `getPreparedWorkspaceActionDefinition` with `getAidenActionDefinition` in `registry.ts` (different action id unions).

## Persistence (Supabase)

Two tables back **review → confirm → cancel → audit** flows without executing business mutations yet.

### `public.aiden_prepared_actions`

Stores one **prepared** intent per row: org, requester, `action_id`, `status`, `risk_level`, four JSONB payload columns (`input_payload`, `resolved_payload`, `preview_payload`, `execution_payload`), optional source/target record pointers, `confidence_score`, `requires_confirmation`, lifecycle actor columns (`confirmed_by` / `executed_by` / `canceled_by` + timestamps), `error_message`, and timestamps. `risk_level` is constrained to the same enum as `lib/aiden/actions/action-risk.ts`.

**Statuses** (see `AIDEN_PREPARED_ACTION_STATUSES`): `prepared`, `needs_clarification`, `ready_for_confirmation`, `confirmed`, `executing`, `completed`, `canceled`, `failed`.

### `public.aiden_action_audit_log`

Append-only events: `organization_id`, optional `prepared_action_id` (FK, `ON DELETE SET NULL`), optional `actor_user_id`, `event_type`, optional `action_id`, `details` JSONB, `created_at`. Use for every state transition and executor outcome so compliance and debugging stay traceable.

### RLS and clients

- **SELECT**: `authenticated` users may read rows where `public.is_org_member(organization_id)` — no cross-org reads.
- **INSERT / UPDATE / DELETE**: no policies for `authenticated` on these tables; the app should use a **service-role** Supabase client from trusted Route Handlers or jobs (`createServiceRoleSupabaseClient` in `lib/billing/service-role-client.ts`). Migrations grant `service_role` the table privileges required for those writes.
- **Reads** from the browser or user-scoped server code can use the normal server client; RLS enforces org membership.

Do **not** persist raw model output without validation; repositories assume callers already enforced registry + permission checks.

## Deterministic intent parser (phase 1)

`parseAidenPreparedWorkspaceIntent(userText, options?)` converts a **single user utterance** into a structured intent: `actionId` (prepared-workspace id when known), optional `customerReference` / `workOrderReference`, optional `sourceContext` echo (for “this customer” / “this work order”), `confidenceScore`, and `missingFields`. When the utterance is underspecified or multiple product intents compete, the parser returns `status: "needs_clarification"` with a non-empty `missingFields` list (for example `customerReference`, `workOrderReference`, `customerId`, `workOrderId`, or `actionIntent`). Unsupported text yields `status: "unsupported"` and an empty `actionId`.

This layer is **intent only**: it does not call OpenAI or other LLMs, does not resolve customers or work orders against the database, and does not enqueue execution, invoices, or quotes. Downstream code must still validate the `actionId` against `AIDEN_PREPARED_WORKSPACE_ACTION_IDS`, run permission and plan gates, optionally persist via `aiden_prepared_actions`, and only then run executors after explicit confirmation.

Run unit checks: `pnpm test:aiden-intent-parser`.

## Optional LLM intent assist

When `AIDEN_PREPARED_INTENT_LLM_ENABLED` is true, `POST …/aiden/prepared-actions/prepare` calls `parsePreparedWorkspaceIntentWithOptionalLlm`, which:

1. Always runs the deterministic parser first (`parseAidenPreparedWorkspaceIntent`).
2. Optionally calls `runAiTask` with task id **`aiden_prepared_workspace_intent_llm`** (plan-gated via the central AI router; **core** plan minimum in `lib/ai/tasks.ts`). The model must return JSON matching `AidenPreparedWorkspaceIntentLlmSchema` (see `aiden-prepared-workspace-intent-llm.schema.json`).
3. Merges via `mergeDeterministicAndLlmPreparedIntent`: registered `actionId` only; deterministic **prepared** at high confidence still wins for status when the same action is chosen; conflicting action ids yield `needs_clarification` with `missingFields` containing `actionIntent`.
4. Applies confidence bands on the merged result: **high** (`≥ AIDEN_PREPARED_INTENT_LLM_HIGH`) can yield `prepared` when no required fields are missing; **medium** forces clarification (adds `intentConfidence` when needed); **low** keeps clarification or unsupported when there is no actionable `actionId`.
5. Never executes SQL, arbitrary tools, or writes from LLM output alone — resolvers and existing confirm/execute gates still apply. Financial / sensitive actions continue to require explicit confirmation per `action-registry`.

`resolved_payload` / `input_payload` include `intentParse` metadata (`source`, `llmAttempted`, `llmOk`, optional `llmRejectedReason`, `effectiveConfidence`). Optional `suggestedDraftCopy` is stored when present (draft-style hints only).

If the LLM call fails, providers are unavailable, or the flag is off, behavior falls back to deterministic parsing only (`parseMeta.llmAttempted` may still be true with `llmRejectedReason: "llm_no_valid_output"` when an attempt was made).

Run merge/tier checks: `pnpm test:aiden-intent-llm-merge`.

## Resolver: `create_invoice_from_work_order` (preview only)

`resolveCreateInvoiceFromWorkOrderPreview(supabase, input)` in `lib/aiden/actions/resolvers/create-invoice-from-work-order-resolver.ts` turns a **resolved customer + work-order reference** into a structured **draft invoice preview**. It:

- Confirms the caller is an **active org member** and passes **`canPrepareAidenAction`** for `create_invoice_from_work_order` (plan gate + `canEditInvoices` / `canEditWorkOrders`).
- Resolves **customer** by id when provided, otherwise by deterministic **name / company / billing-name** matching (`rankCustomerMatches`). **Tied top scores** return `needs_clarification` with `customerCandidates` (no guess).
- Selects the **latest eligible work order** for `workOrderReference` `latest` (completed + completed-pending-signature) or `latest_completed` (strictly **completed**), skipping **archived**, **invoiced** status, **`billing_state` invoiced/paid**, **invoice_work_order_links** / legacy **`org_invoices.work_order_id`**, and **`billable_to_customer === false`**. A specific **work order UUID** may be supplied instead of `latest*`.
- Builds **line items** from **`total_labor_cents`** (+ optional hours from `repair_log`) and **`work_order_line_items`** (parts/materials). **Fees** are not modeled separately on the work order schema today.
- Surfaces **warnings** such as `missing_labor`, `missing_parts`, `missing_pricing`, `missing_tax_settings` (when not tax-exempt and no `default_tax_basis`), and `missing_billing_contact` when email and phone are both absent.
- Returns **`prepared`** with `preview` (`customer`, `workOrder`, `lineItems`, `subtotal`, `taxEstimate`, `total`, `notes`, `warnings`, `recommendedInvoiceTitle`, `sourceSummary`) or **`failed`** / **`needs_clarification`** with a human-readable `reason`.

**No `org_invoices` rows, invoice links, or billing mutations** are performed in the resolver — preview only. **Execution** (after explicit confirm + execute API) for `create_invoice_from_work_order` is implemented separately (see **Execution** section below): it inserts a **draft** invoice only, with duplicate guards and no side effects listed there.

Deterministic customer-ranking tests: `pnpm test:create-invoice-from-work-order-resolver`.

Executor helper tests (parse + line mapping): `pnpm test:create-invoice-from-work-order-executor`.

## Resolver: `summarize_customer_history` (read-only preview)

`resolveSummarizeCustomerHistoryPreview(supabase, input)` in `lib/aiden/actions/resolvers/summarize-customer-history-resolver.ts` resolves the **customer** (explicit id from UI context or deterministic name match), then loads **bounded** rows: recent work orders, equipment, maintenance plans, optional **communications**, and — only when `permissions.canViewFinancials` / `canViewQuotes` allow — recent **invoices** and **quotes**. It returns structured narrative fields plus `recommendedNextActions` and flags such as `financialsRedacted` and `showCreateInvoiceFromLatestWorkOrder` (when `canEditInvoices` and a billable, not-yet-invoiced completed work order exists).

The **`POST .../prepare`** route marks successful summaries **`completed`** immediately (read-only delivery), sets `target_record_type` = `customer`, writes `prepared_action_execution_completed` audit, and does **not** require confirmation (`requires_confirmation` is false for this action).

## Resolver + execution: `create_follow_up_task`

**Resolver** (`resolveCreateFollowUpTaskPreview`): From workspace context (invoice, quote, work order, equipment, maintenance plan, customer) or a parsed customer name, builds a **preview** with suggested **title**, **notes**, **due date** / `scheduled_for`, optional **assignee** hint (for example from work order assignment), **reason** text, and a **related record** (`entity_type` includes **`quote`** alongside invoice, work order, customer, equipment, maintenance plan, prospect). No row is written in the resolver.

**Preview PATCH**: `mergeAndValidateFollowUpTaskPreviewForPatch` accepts edits to `title`, `notes`, and `dueDate` (recomputes `scheduled_for` as noon UTC on that calendar date).

**Executor** (`executeCreateFollowUpTask`): After confirmation, inserts **`follow_up_tasks`** with `rule_key` **`aiden_manual_follow_up`**, a stable **`dedupe_key`** tied to the prepared action id, **draft** subject/body from the preview, and metadata marking AIden origin and **no auto-send**. Customers are **not** emailed or texted from this path.

## Resolver + execution: `schedule_maintenance_visit`

**Resolver** (`resolveScheduleMaintenanceVisitPreview`): Chooses anchor **maintenance plan** → **equipment** → **customer** (or name match), loads billing **location** summary, optional **equipment**, **service type** / **priority** / preferred time from plan `services` JSON, **technician** hint from plan or last work order on equipment, **duration** hint (reference only), and **date/time** from the user message (`tomorrow`, ISO date, simple time) or plan **`next_due_date`**, or a provisional +7 days when equipment/plan context exists. **Customer-only** context without a parseable date returns **`needs_clarification`**.

**Preview PATCH**: `mergeAndValidateScheduleMaintenanceVisitPreviewForPatch` for `suggestedDate`, `suggestedTime`, `serviceTypeUi`, `priorityUi`, `notes`, `serviceReason`.

**Executor** (`executeScheduleMaintenanceVisit`): After confirmation, inserts a **`work_orders`** row with **`scheduled`** status, `scheduled_on` / `scheduled_time`, optional **`maintenance_plan_id`**, **`workOrderAssignmentColumns`** for technician selection, and internal notes tagged with **`AIDEN_PREPARED_ACTION_ID`**. Uses **`userSupabase`** (authenticated JWT), not the service role, so **`created_by`** trigger receives **`auth.uid()`**. Plan gate: **`maintenance_plans`** feature; permissions: **`canManageDispatch`** or **`canEditWorkOrders`** (any).

## Resolver + execution: `create_maintenance_plan_from_equipment`

**Resolver** (`resolveCreateMaintenancePlanFromEquipmentPreview`): Resolves **equipment** from UI context, or **customer + equipment** from possessive phrasing (“plan for Acme’s pump”) or **`customerId` + `equipmentReference`**, ranks fuzzy equipment names within the customer, suggests **interval** and **next due** from the user message and equipment **`last_service_at`**, **service scope** (equipment notes or default copy), **WO type** (inspection vs PM from message), **duration** hint, **technician** from last work order on the asset, and **`auto_create_work_order`** default on.

**Preview PATCH**: `mergeAndValidateCreateMaintenancePlanFromEquipmentPreviewForPatch` for editable fields; customer/equipment ids stay fixed from the resolver.

**Executor** (`executeCreateMaintenancePlanFromEquipment`): After confirmation, calls **`requireMaintenancePlanCreate`**, then inserts **`maintenance_plans`** with **`userSupabase`**, **`maintenancePlanAssignmentColumns`**, `serializeServicesForDb` WO defaults, `notificationRulesToJsonb([])`, and trace notes. Returns **`maintenancePlanId`**; `target_record_type` **`maintenance_plan`**. Plan gate: **`maintenance_plans`** feature; permissions: **`canManageDispatch`** or **`canEditWorkOrders`** (any), matching **`schedule_maintenance_visit`**.

## Execution: `create_invoice_from_work_order` (draft invoice only)

After the prepared row is **`confirmed`**, `POST .../prepared-actions/{id}/execute` (or `POST .../confirm` with `{ "execute": true }`) runs `executePreparedWorkspaceAction`, which:

- Re-checks **financial prepare** permissions (`canPrepareWorkspaceActionForUser` in the dispatcher; executor re-checks `canPrepareAidenActionId` with plan + trial).
- Validates `preview_payload.preview` (customer, work order, line items, subtotal).
- Verifies the work order and customer still exist and match the preview.
- Blocks with **409** `duplicate_invoice_risk` + `needsConfirmation: true` when the work order is already linked to a **non-void, non-archived** invoice that is not the idempotent/recovery target, or when line cents no longer match the prepared subtotal.
- Inserts **`org_invoices`** with status **draft**, `line_items` from the preview, `invoice_work_order_links` to the source WO, **`internal_notes`** tag `AIDEN_PREPARED_ACTION_ID=<prepared_action_uuid>` for traceability, and passes `insertOrgInvoice` options **`skipQuickBooksQueue: true`** and **`skipWorkOrderBillingStateSync: true`** so nothing is auto-synced to QuickBooks and linked work orders are not flipped to **invoiced** billing state from this path.
- Sets `target_record_type` = `org_invoice`, `target_record_id` = new invoice id, `execution_payload` summary, `status` = `completed`, and writes **`prepared_action_execution_completed`** audit.

**Never** (by design in this executor): email the customer, generate a payment link, sync QuickBooks, auto-finalize beyond **draft**, or enqueue QB auto-sync.

On success the JSON body includes **`invoiceId`**, **`invoiceNumber`**, **`status`: `"draft"`**, **`message`**, and **`preparedAction`** (serialized row).

Idempotent replay: if the prepared action is already **`completed`** with a draft target invoice, the same response shape is returned without inserting again.

## HTTP API (prepared actions)

Routes live under `/api/organizations/{organizationId}/aiden/prepared-actions/`. Unless noted, responses use JSON with a `preparedAction` object in **camelCase** (see `serializePreparedAction`).

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/organizations/{organizationId}/aiden/prepared-actions` | List recent rows for the org (`requireOrgMemberSession`). Optional query: `limit`, `status` (must match `AIDEN_PREPARED_ACTION_STATUSES`). Uses the user Supabase client (**RLS**). |
| `POST` | `.../prepared-actions/prepare` | Body: `{ message: string, context?: object }`. Parses intent, checks **AIden Actions** entitlement (`getAidenActionAvailability`), `canPrepareAidenActionId`, technician/financial guard, runs the **invoice resolver** when applicable, inserts `aiden_prepared_actions` via **service role**, writes `prepared_action_created` audit. Returns `{ preparedAction }`. |
| `GET` | `.../prepared-actions/{actionId}` | Read one row by **row UUID** (`actionId` path segment). Org member + **RLS**. |
| `POST` | `.../prepared-actions/{actionId}/cancel` | Sets `canceled` + audit (`prepared_action_canceled`). Requires permissions for the row’s workspace `action_id` (`requireWorkspacePreparedActionPermissions`). Updates via **service role** after checks. |
| `POST` | `.../prepared-actions/{actionId}/confirm` | Body optional: `{ execute?: boolean }`. Sets `confirmed` + audit. If `execute: true`, runs `executePreparedWorkspaceAction` for implemented action ids (see execute row); unimplemented ids return **501**. Re-checks AIden entitlement, prepare permissions, and financial re-check. **Service role** updates. |
| `POST` | `.../prepared-actions/{actionId}/execute` | Allowed only when status is **`confirmed`**. Re-checks entitlement, definition permissions, financial rules, technician guard; for **`create_invoice_from_work_order`** creates a **draft** invoice (see execution section), audits start/complete/fail, returns **200** with `invoiceId`, `invoiceNumber`, `status`, `message`, `preparedAction`. For **`create_quote_from_work_order`** creates a **draft** quote (`quoteId`, `message`, `preparedAction`). For **`prepare_invoice_payment_link`** creates a hosted checkout URL. For **`draft_customer_message`** inserts a **Communications** draft (`communication_events`, not sent). For **`prepare_quickbooks_invoice_sync`** runs the existing QuickBooks invoice export for the prepared invoice after confirmation. For **`create_follow_up_task`** inserts a **`follow_up_tasks`** row (operational queue; no customer communication). For **`schedule_maintenance_visit`** inserts a **scheduled `work_orders`** row via the user-scoped client (see resolver section). For **`create_maintenance_plan_from_equipment`** inserts a **`maintenance_plans`** row (`maintenancePlanId` in the JSON body). For **`create_parts_reorder_request`** inserts either a **draft** `org_purchase_orders` row (`purchaseOrderId`) or **`inventory_transactions`** restock signals (`restockLedgerIds`); **no external PO submission**. Other action ids return **501** `not_implemented`. **Service role** reads/audits + user-scoped client for mutations (RLS). |

**Notes**

- `{actionId}` is the **`aiden_prepared_actions.id` UUID**, not the workspace registry string (`create_invoice_from_work_order`, …).
- **Writes** to `aiden_prepared_actions` / `aiden_action_audit_log` use the **service-role** client only after session auth + org membership + action-definition permission gates (same pattern as other privileged org routes).
- **Execute** for most workspace ids remains **501** until those executors ship; **`create_invoice_from_work_order`**, **`create_quote_from_work_order`**, **`prepare_invoice_payment_link`**, **`draft_customer_message`**, **`prepare_quickbooks_invoice_sync`**, **`create_follow_up_task`**, **`schedule_maintenance_visit`**, **`create_maintenance_plan_from_equipment`**, **`create_parts_reorder_request`**, and **`summarize_customer_history`** (idempotent finalize / no-op) have implemented paths as above.

## Action ids

1. `create_invoice_from_work_order`
2. `create_quote_from_work_order`
3. `draft_customer_message`
4. `summarize_customer_history`
5. `create_follow_up_task`
6. `schedule_maintenance_visit`
7. `create_maintenance_plan_from_equipment`
8. `create_parts_reorder_request`
9. `prepare_invoice_payment_link`
10. `prepare_quickbooks_invoice_sync`
11. `bulk_invoice_completed_work_orders`

## Risk levels

| Level | Meaning (prepared phase) |
|-------|---------------------------|
| `read_only` | Narrative / retrieval packaging only. |
| `draft_content` | Produces user-visible draft text or parameters without committing writes. |
| `operational_write` | Intended eventual path creates or updates operational rows (WO, tasks, inventory requests). |
| `financial_draft` | Touches invoice/quote/payment **draft** or payment-link **preparation** only. |
| `financial_write` | Reserved for single-record financial commits (not used until executors land). |
| `bulk_financial_write` | Batch financial impact — highest scrutiny. |

## Default safety rules

1. **Financial** and **bulk** prepared actions **always** require confirmation (`requiresAidenConfirmation` returns true even if a static flag were mis-set). Module load asserts registry invariants.
2. **No LLM execution of side effects:** optional LLM only proposes intent JSON; resolvers and executors remain deterministic and gated.
3. **Intent only**: any future `prepare` response must be validated (schema + permission re-check) before `confirm`/`execute`.
4. **Plan gates** use `canUseFeature` / minimum tier (trial maps to Scale for tier comparison, matching billing entitlements behavior).

## Helper summary

| Helper | Purpose |
|--------|---------|
| `getPreparedWorkspaceActionDefinition(id)` | Lookup (spec text referred to this role as `getAidenActionDefinition` — use this name to avoid clashing with `registry.ts`). |
| `listAidenActions()` | Stable-order list of all definitions. |
| `canPrepareAidenAction(args, def)` | Permission + plan gate check for a definition instance. |
| `canPrepareAidenActionId(args, id)` | Same, keyed by id. |
| `requiresAidenConfirmation(def)` | Financial / bulk OR explicit `requiresConfirmation`. |
| `isFinancialAidenAction(def)` | Financial risk or `touchesFinancialRecords`. |
| `isBulkAidenAction(def)` | Bulk risk or `supportsBulkExecution`. |

## QA & hardening (prepared workspace)

This section maps **product test scenarios** to **implementation surfaces** (resolver, API, UI, RLS). Automated scripts exercised in the latest pass are listed under **Automated checks**; everything else is **manual** unless you add integration tests against a seeded org.

### Scenario matrix

| # | Scenario | Expected behavior | Where to verify |
|---|----------|-------------------|-----------------|
| 1 | “Make invoice for Client A based on my last work order.” | Deterministic (or merged LLM) intent → `create_invoice_from_work_order` → resolver preview when customer + WO resolve. | `parse-aiden-intent.ts`, `prepare/route.ts`, resolver |
| 2 | Customer has one completed WO | Resolver picks that WO for `latest` / `latest_completed` per eligibility rules; preview `prepared`. | Resolver + `pnpm test:create-invoice-from-work-order-resolver` (ranking) |
| 3 | Multiple similar customer names | `needs_clarification` + `customerCandidates` (no silent pick). | Resolver |
| 4 | No completed / eligible WO | Resolver `failed` or `needs_clarification` with reason (no invoice rows). | Resolver |
| 5 | WO has no parts | Preview proceeds; **warnings** include `missing_parts` where applicable. | Resolver preview `warnings` |
| 6 | WO has no labor | Warnings include `missing_labor`; totals may be zero-side. | Resolver |
| 7 | WO already invoiced | Excluded from selection or **409** / duplicate path on execute (`duplicate_invoice_risk`). | Resolver selection + executor |
| 8 | User lacks invoice permission | **403** on prepare or execute (`insufficient_permissions` / `canPrepareWorkspaceActionForUser`). | `prepared-actions-api-helpers`, prepare/confirm/execute routes |
| 9 | User lacks tier access | **403** `plan_upgrade_required` when `AIDEN_PREPARED_WORKSPACE_TIER_GATING=1`. | `pnpm test:aiden-prepared-workspace-tier-policy`, prepare route |
| 10 | User cancels prepared action | Row → `canceled`; audit `prepared_action_canceled`. | `cancel/route.ts`, audit helper |
| 11 | User edits preview before creating | PATCH `…/preview` merges allowed fields (per action merge modules); totals recalc client-side for invoice UI where implemented. | `PreparedActionCard`, `*-preview-merge.ts`, preview route |
| 12 | User creates draft invoice | After confirm + execute: **draft** `org_invoices`, internal notes trace `AIDEN_PREPARED_ACTION_ID`, no email/QB queue from this path. | Executor + doc **Execution** |
| 13 | Execute same action twice | Idempotent: completed row returns same shape without second insert when recovery target matches. | Executor |
| 14 | Bulk invoice excludes one WO | `BulkPreparedInvoicePreview` checkbox updates excluded set; confirm phrase required for batch. | `BulkPreparedInvoicePreview`, bulk executor |
| 15 | Payment link prepared, not sent | `prepare_invoice_payment_link` prepares URL only; no customer send from prepared path. | Registry + resolver |
| 16 | QuickBooks disconnected | `prepare_quickbooks_invoice_sync` preview/execute should surface resolver/connection failure, not silent success. | QB resolver + UI |
| 17 | Mobile layout | AIden drawer + `PreparedActionCard` scroll/stack; Action Center `/aiden/actions` responsive table/cards. | `aiden-chat-panel`, `aiden-action-center-page` |
| 18 | Platform admin support context | PA often bypasses tier gates where coded; still org membership for routes using `requireOrgMemberSession`. | `canPrepareWorkspaceActionForUser`, tier policy |
| 19 | RLS / cross-org access | `GET` prepared-actions uses member client + RLS; writes use service role **after** session gate + org id match on row. | Repositories, routes |
| 20 | Audit log completeness | `prepared_action_created`, confirm, cancel, execution start/complete/fail appear for lifecycle. | `action-audit-log.ts`, audit API |

### Automated checks (latest pass)

- `pnpm lint` — **pass** (includes fixes: `AiInsightActions` import on `insights/page.tsx`, `PreparedInvoicePreview` import on `BulkPreparedInvoicePreview.tsx`).
- `pnpm build` — in a **git-tracked** clone, `pnpm build` runs `check:tracked-imports` first. In sandboxes without git, use `pnpm exec next build` to validate compile (same as CI compile step when prebuild is satisfied).
- `pnpm exec next build` — **pass** after **client/server split**: `PreparedActionCard` imports `UUID_RE` from `prepared-actions-shared.ts`, not `prepared-actions-api-helpers.ts` (avoids pulling `server-only` into the client graph).
- `pnpm test:aiden-intent-parser` — **pass** (27 cases).
- `pnpm test:aiden-intent-llm-merge` — **pass** (merge + confidence tiers).
- `pnpm test:aiden-prepared-workspace-tier-policy` — **pass** (6 cases).
- `pnpm test:create-invoice-from-work-order-resolver` — **pass** (5 ranking cases).
- `pnpm update:master-context` — **pass** (regenerates `master-context.generated.ts`, bumps `MASTER_CONTEXT_LAST_UPDATED_ISO`).

### Manual QA checklist (short)

1. Prepare invoice intent from customer WO page context vs global chat (context echo).
2. Walk **needs_clarification** → pick candidate → prepare again → confirm → execute.
3. Technician role: financial prepare blocked where `assertFinancialActionAllowedForTechnician` applies.
4. Bulk batch: exclude row, confirm phrase, verify audit + row counts.
5. Payment link + QB sync: disconnect QB in settings, retry prepare.
6. Mobile width: open AIden, run through prepared card to confirm/scroll.
7. Second org user: open another org’s `prepared_action` URL → expect **403**/not found, not data leak.

### Known limitations

- **No single end-to-end UI test** in repo for the full prepare → confirm → execute chain (requires Supabase + auth).
- **`pnpm build` without git index** fails `check:tracked-imports` by design; commit new files before shipping.
- **Optional LLM** (`AIDEN_PREPARED_INTENT_LLM_ENABLED`) adds latency and plan/AI router cost; failures fall back to deterministic intent with `intentParse` metadata.
- **Tier gating** is opt-in via env; default packaging may differ from matrix until flag is on.

## Future work (out of scope here)

- Zod payload schemas per action id (separate module to avoid coupling this registry to DB shapes).
- Route wiring from `aiden/chat` → prepare → `aiden_prepared_actions` + `aiden_action_audit_log` with idempotency keys (legacy `aiden_pending_actions` remains the safe-actions track).
- Additional executor mappings `AidenPreparedWorkspaceActionId` → server command (quotes, tasks, …) with the same confirm + permission discipline as invoice-from-WO.
