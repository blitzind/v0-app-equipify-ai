/** Shared `.select()` fragments so list/detail queries can retry without `work_order_number` if the column is missing. */

export const WO_LIST_SELECT_WITH_NUM =
  "id, work_order_number, customer_id, equipment_id, title, status, priority, type, scheduled_on, scheduled_time, completed_at, assigned_user_id, assigned_technician_id, created_at, invoice_number, total_labor_cents, total_parts_cents, notes, maintenance_plan_id, calibration_template_id, created_by_pm_automation, archived_at"

export const WO_LIST_SELECT = WO_LIST_SELECT_WITH_NUM.replace("work_order_number, ", "")

/** Build list `.select()` when migrations may omit `work_order_number` and/or `assigned_technician_id`. */
export function buildWorkOrderListSelect(opts: {
  includeWorkOrderNumber?: boolean
  includeAssignedTechnician?: boolean
}): string {
  const includeNum = opts.includeWorkOrderNumber !== false
  const includeTech = opts.includeAssignedTechnician !== false
  let s = WO_LIST_SELECT_WITH_NUM
  if (!includeNum) s = s.replace("work_order_number, ", "")
  if (!includeTech) s = s.replace(", assigned_technician_id", "")
  return s
}

export const WO_DETAIL_SELECT_WITH_NUM =
  "id, work_order_number, organization_id, customer_id, equipment_id, title, status, priority, type, scheduled_on, scheduled_time, completed_at, assigned_user_id, assigned_technician_id, created_at, invoice_number, total_labor_cents, total_parts_cents, notes, repair_log, maintenance_plan_id, calibration_template_id, created_by_pm_automation, signature_url, signature_captured_at, problem_reported, billable_to_customer, warranty_review_required, warranty_vendor_id, archived_at"

export const WO_DETAIL_SELECT = WO_DETAIL_SELECT_WITH_NUM.replace("work_order_number, ", "")

/** Same fields as detail drawer but without `organization_id` (e.g. work order `/[id]` page). */
export const WO_DETAIL_PAGE_SELECT_WITH_NUM =
  "id, work_order_number, customer_id, equipment_id, title, status, priority, type, scheduled_on, scheduled_time, completed_at, assigned_user_id, assigned_technician_id, created_at, invoice_number, total_labor_cents, total_parts_cents, notes, repair_log, maintenance_plan_id, calibration_template_id, signature_url, signature_captured_at, problem_reported, billable_to_customer, warranty_review_required, warranty_vendor_id, archived_at"

export const WO_DETAIL_PAGE_SELECT = WO_DETAIL_PAGE_SELECT_WITH_NUM.replace("work_order_number, ", "")
