/** Shared `.select()` fragments so list/detail queries can retry without `work_order_number` if the column is missing. */

export const WO_LIST_SELECT_WITH_NUM =
  "id, work_order_number, customer_id, equipment_id, title, status, priority, type, scheduled_on, scheduled_time, completed_at, assigned_user_id, created_at, invoice_number, total_labor_cents, total_parts_cents, notes, maintenance_plan_id, created_by_pm_automation"

export const WO_LIST_SELECT = WO_LIST_SELECT_WITH_NUM.replace("work_order_number, ", "")

export const WO_DETAIL_SELECT_WITH_NUM =
  "id, work_order_number, organization_id, customer_id, equipment_id, title, status, priority, type, scheduled_on, scheduled_time, completed_at, assigned_user_id, created_at, invoice_number, total_labor_cents, total_parts_cents, notes, repair_log, maintenance_plan_id, created_by_pm_automation"

export const WO_DETAIL_SELECT = WO_DETAIL_SELECT_WITH_NUM.replace("work_order_number, ", "")

/** Same fields as detail drawer but without `organization_id` (e.g. work order `/[id]` page). */
export const WO_DETAIL_PAGE_SELECT_WITH_NUM =
  "id, work_order_number, customer_id, equipment_id, title, status, priority, type, scheduled_on, scheduled_time, completed_at, assigned_user_id, created_at, invoice_number, total_labor_cents, total_parts_cents, notes, repair_log, maintenance_plan_id"

export const WO_DETAIL_PAGE_SELECT = WO_DETAIL_PAGE_SELECT_WITH_NUM.replace("work_order_number, ", "")
