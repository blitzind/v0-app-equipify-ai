/** Workflow automation — stored JSON shapes and trigger/action enums. */

export type WorkflowTriggerType =
  | "work_order_created"
  | "work_order_completed"
  | "work_order_status_changed"
  | "maintenance_due"
  | "invoice_overdue"
  | "quote_accepted"
  | "equipment_warranty_expiring"
  | "certificate_uploaded"

export type WorkflowActionType =
  | "send_email"
  | "send_sms"
  | "create_work_order"
  | "assign_technician"
  | "notify_internal_user"
  | "create_ai_task"
  | "update_status"
  | "create_followup_task"

export type ConditionOperator = "and" | "or"

export type ConditionRule = {
  field: string
  op: "eq" | "neq" | "in" | "gte" | "lte" | "contains"
  value?: string | number | boolean | string[] | null
}

export type ConditionConfig = {
  operator?: ConditionOperator
  rules?: ConditionRule[]
}

export type WorkflowActionSpec = {
  type: WorkflowActionType
  /** Action-specific payload (recipients, templates, ids). */
  config?: Record<string, unknown>
}

export type ActionConfigFile = {
  actions?: WorkflowActionSpec[]
}

/** Runtime payload passed to condition evaluation and actions. */
export type WorkflowEventContext = {
  organization_id: string
  trigger_type: WorkflowTriggerType
  /** ISO date for cron-style triggers */
  today?: string
  work_order?: Record<string, unknown>
  previous_work_order?: Record<string, unknown>
  maintenance_plan?: Record<string, unknown>
  invoice?: Record<string, unknown>
  quote?: Record<string, unknown>
  equipment?: Record<string, unknown>
  calibration_record?: Record<string, unknown>
  /** Flattened helpers */
  equipment_category?: string | null
}

export type WorkflowAutomationRow = {
  id: string
  organization_id: string
  name: string
  description: string
  enabled: boolean
  trigger_type: WorkflowTriggerType
  trigger_config: Record<string, unknown>
  condition_config: ConditionConfig | Record<string, unknown>
  action_config: ActionConfigFile | Record<string, unknown>
  created_by: string
  created_at: string
  updated_at: string
}
