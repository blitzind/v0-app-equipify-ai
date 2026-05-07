/**
 * Workflow Automations Phase 1 — manager-friendly action catalog.
 *
 * Single source of truth for the action picker beside the JSON editor.
 * Each entry has:
 *   - human label + short description
 *   - whether the engine actually performs the action today (vs logged-only)
 *   - a starter snippet managers can paste to seed `action_config.actions`
 *   - which trigger groups it makes sense for (so the UI can mark
 *     unsupported combinations with a soft warning)
 *
 * Keep aligned with `WorkflowActionType` in `lib/workflows/types.ts` and
 * the `runOneAction` switch in `lib/workflows/execute-actions.ts`.
 */

import type { WorkflowActionType, WorkflowTriggerType } from "@/lib/workflows/types"
import { TRIGGER_CATALOG } from "@/lib/workflows/trigger-catalog"

export type ActionCatalogEntry = {
  id: WorkflowActionType
  /** Concise label for the action picker. */
  label: string
  /** Manager-facing "what this does" sentence — service-business voice. */
  description: string
  /**
   * Status of the action in the engine today.
   * - `live`: actually executes (writes to DB / fires side effects)
   * - `logged`: persists an audit row but is otherwise a no-op (e.g. SMS today)
   * - `coming_soon`: not implemented; surfaces a "coming soon" pill
   */
  availability: "live" | "logged" | "coming_soon"
  /**
   * Whether the action is safe to run *automatically* without a human
   * review. Phase 1 keeps anything that delivers an external customer
   * message (`send_email`, `send_sms`) marked `false` so the UI can warn
   * — even though the engine queues them today.
   */
  autoSafe: boolean
  /** Trigger groups where this action makes sense. */
  fitsTriggerGroups: Array<"prospects" | "work-orders" | "quotes-invoices" | "maintenance" | "certificates" | "equipment" | "ai">
  /** Sample JSON snippet for the actions array. */
  sampleSnippet: string
}

const snippet = (action: { type: string; config?: Record<string, unknown> }) =>
  JSON.stringify(action, null, 2)

export const ACTION_CATALOG: Record<WorkflowActionType, ActionCatalogEntry> = {
  notify_internal_user: {
    id: "notify_internal_user",
    label: "Notify staff",
    description:
      "Posts an in-app notification to the assigned user (or the rule's owner). Always safe — never reaches customers.",
    availability: "live",
    autoSafe: true,
    fitsTriggerGroups: ["prospects", "work-orders", "quotes-invoices", "maintenance", "certificates", "equipment", "ai"],
    sampleSnippet: snippet({
      type: "notify_internal_user",
      config: {
        title: "Follow-up needed",
        summary: "A prospect just moved to Quoted — review and reach out today.",
      },
    }),
  },
  send_email: {
    id: "send_email",
    label: "Send email (queued)",
    description:
      "Logs an email in the communications timeline with status 'queued'. Use carefully — once a delivery provider is wired in, this action will go out.",
    availability: "live",
    autoSafe: false,
    fitsTriggerGroups: ["prospects", "work-orders", "quotes-invoices", "maintenance", "certificates", "equipment"],
    sampleSnippet: snippet({
      type: "send_email",
      config: {
        to: "{{customer_email}}",
        subject: "Quick follow-up from your service team",
        body: "Hi there — checking in on your latest service. Reply to this email if anything looks off.",
      },
    }),
  },
  send_sms: {
    id: "send_sms",
    label: "Send SMS",
    description:
      "Logged-only today — Twilio integration is not active. Useful as a placeholder until SMS dispatch is wired in.",
    availability: "logged",
    autoSafe: false,
    fitsTriggerGroups: ["prospects", "work-orders", "quotes-invoices"],
    sampleSnippet: snippet({
      type: "send_sms",
      config: {
        to: "{{customer_phone}}",
        body: "Quick reminder: your service is scheduled for tomorrow.",
      },
    }),
  },
  assign_technician: {
    id: "assign_technician",
    label: "Assign technician",
    description: "Assigns the work order to the technician id provided in `config.user_id`.",
    availability: "live",
    autoSafe: true,
    fitsTriggerGroups: ["work-orders", "maintenance"],
    sampleSnippet: snippet({
      type: "assign_technician",
      config: { user_id: "<technician-user-id>" },
    }),
  },
  update_status: {
    id: "update_status",
    label: "Update status",
    description:
      "Updates the status field on the triggering record (work order today). Pair with conditions to scope the change.",
    availability: "live",
    autoSafe: true,
    fitsTriggerGroups: ["work-orders"],
    sampleSnippet: snippet({
      type: "update_status",
      config: { status: "in_progress" },
    }),
  },
  create_followup_task: {
    id: "create_followup_task",
    label: "Create follow-up task",
    description:
      "Creates an internal reminder task for the relevant team member. Service-friendly; never sends external messages.",
    availability: "live",
    autoSafe: true,
    fitsTriggerGroups: ["prospects", "quotes-invoices", "maintenance", "work-orders"],
    sampleSnippet: snippet({
      type: "create_followup_task",
      config: {
        title: "Follow up on quoted prospect",
        description: "Quoted prospect has been waiting — check in by phone.",
        due_in_days: 2,
      },
    }),
  },
  create_work_order: {
    id: "create_work_order",
    label: "Create work order",
    description:
      "Spawns a new work order from the triggering context (typical PM use case). Plan limits apply.",
    availability: "live",
    autoSafe: true,
    fitsTriggerGroups: ["maintenance", "equipment"],
    sampleSnippet: snippet({
      type: "create_work_order",
      config: {
        title: "Scheduled PM",
        priority: "medium",
      },
    }),
  },
  create_ai_task: {
    id: "create_ai_task",
    label: "Queue AI task",
    description:
      "Enqueues a job for the operational assistant queue (e.g. draft email, generate digest). Plan-gated.",
    availability: "live",
    autoSafe: true,
    fitsTriggerGroups: ["prospects", "ai", "work-orders", "quotes-invoices"],
    sampleSnippet: snippet({
      type: "create_ai_task",
      config: {
        task: "customer_email",
      },
    }),
  },
}

export const ACTION_CATALOG_ORDER: WorkflowActionType[] = [
  "notify_internal_user",
  "create_followup_task",
  "send_email",
  "send_sms",
  "assign_technician",
  "update_status",
  "create_work_order",
  "create_ai_task",
]

/** True when the action is a sensible default for the given trigger group. */
export function actionFitsTrigger(
  action: WorkflowActionType,
  trigger: WorkflowTriggerType,
): boolean {
  const t = TRIGGER_CATALOG[trigger]
  if (!t) return true
  return ACTION_CATALOG[action].fitsTriggerGroups.includes(t.group)
}

export function actionLabel(id: WorkflowActionType | string): string {
  if (id in ACTION_CATALOG) return ACTION_CATALOG[id as WorkflowActionType].label
  return String(id).replace(/_/g, " ")
}
