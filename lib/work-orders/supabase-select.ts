/** Shared `.select()` fragments so list/detail queries can retry without `work_order_number` if the column is missing. */

export const WO_LIST_SELECT_WITH_NUM =
  "id, work_order_number, customer_id, customer_location_id, equipment_id, title, status, priority, type, scheduled_on, scheduled_time, completed_at, assigned_user_id, assigned_technician_id, created_at, invoice_number, total_labor_cents, total_parts_cents, notes, maintenance_plan_id, calibration_template_id, created_by_pm_automation, archived_at, billing_state, billable_to_customer, warranty_review_required"

export const WO_LIST_SELECT = WO_LIST_SELECT_WITH_NUM.replace("work_order_number, ", "")

/** Strip lifecycle/billing intelligence columns when DB migrations are not applied yet. */
export function stripOperationalBillingColumnsFromSelect(select: string): string {
  let s = select
  s = s.replace(
    /, archived_at, billing_state, billable_to_customer, warranty_review_required/g,
    ", archived_at",
  )
  s = s.replace(
    /, billable_to_customer, warranty_review_required, warranty_vendor_id, archived_at, billing_state/g,
    ", archived_at",
  )
  return s
}

/** Build list `.select()` when migrations may omit `work_order_number` and/or `assigned_technician_id`. */
export function buildWorkOrderListSelect(opts: {
  includeWorkOrderNumber?: boolean
  includeAssignedTechnician?: boolean
  /** When false, omit billing_state / billable_to_customer / warranty_review_required (older DBs). */
  includeOperationalBillingColumns?: boolean
}): string {
  const includeNum = opts.includeWorkOrderNumber !== false
  const includeTech = opts.includeAssignedTechnician !== false
  const includeBilling = opts.includeOperationalBillingColumns !== false
  let s = WO_LIST_SELECT_WITH_NUM
  if (!includeNum) s = s.replace("work_order_number, ", "")
  if (!includeTech) s = s.replace(", assigned_technician_id", "")
  if (!includeBilling) s = stripOperationalBillingColumnsFromSelect(s)
  return s
}

/** Same fields as detail drawer but without `organization_id` (e.g. work order `/[id]` page). Declared before builders reference it. */
export const WO_DETAIL_PAGE_SELECT_WITH_NUM =
  "id, work_order_number, customer_id, customer_location_id, equipment_id, title, status, priority, type, scheduled_on, scheduled_time, completed_at, assigned_user_id, assigned_technician_id, created_at, invoice_number, total_labor_cents, total_parts_cents, notes, repair_log, maintenance_plan_id, calibration_template_id, signature_url, signature_captured_at, problem_reported, billable_to_customer, warranty_review_required, warranty_vendor_id, archived_at, billing_state"

export const WO_DETAIL_PAGE_SELECT = WO_DETAIL_PAGE_SELECT_WITH_NUM.replace("work_order_number, ", "")

export const WO_DETAIL_SELECT_WITH_NUM =
  "id, work_order_number, organization_id, customer_id, customer_location_id, equipment_id, title, status, priority, type, scheduled_on, scheduled_time, completed_at, assigned_user_id, assigned_technician_id, created_at, invoice_number, total_labor_cents, total_parts_cents, notes, repair_log, maintenance_plan_id, calibration_template_id, created_by_pm_automation, signature_url, signature_captured_at, problem_reported, billable_to_customer, warranty_review_required, warranty_vendor_id, archived_at, billing_state"

export const WO_DETAIL_SELECT = WO_DETAIL_SELECT_WITH_NUM.replace("work_order_number, ", "")

/** Detail `.select()` when migrations omit `work_order_number` and/or `assigned_technician_id`. */
export function buildWorkOrderDetailSelect(opts: {
  includeWorkOrderNumber?: boolean
  includeAssignedTechnician?: boolean
  includeOperationalBillingColumns?: boolean
}): string {
  const includeNum = opts.includeWorkOrderNumber !== false
  const includeTech = opts.includeAssignedTechnician !== false
  const includeBilling = opts.includeOperationalBillingColumns !== false
  let s = WO_DETAIL_SELECT_WITH_NUM
  if (!includeNum) s = s.replace("work_order_number, ", "")
  if (!includeTech) s = s.replace(", assigned_technician_id", "")
  if (!includeBilling) s = stripOperationalBillingColumnsFromSelect(s)
  return s
}

/** Standalone detail page select (no organization_id) with same optional columns as detail drawer. */
export function buildWorkOrderDetailPageSelect(opts: {
  includeWorkOrderNumber?: boolean
  includeAssignedTechnician?: boolean
  includeOperationalBillingColumns?: boolean
}): string {
  const includeNum = opts.includeWorkOrderNumber !== false
  const includeTech = opts.includeAssignedTechnician !== false
  const includeBilling = opts.includeOperationalBillingColumns !== false
  let s = WO_DETAIL_PAGE_SELECT_WITH_NUM
  if (!includeNum) s = s.replace("work_order_number, ", "")
  if (!includeTech) s = s.replace(", assigned_technician_id", "")
  if (!includeBilling) s = stripOperationalBillingColumnsFromSelect(s)
  return s
}

/**
 * Dispatch board & service schedule: same operational shape as “full” selects minus
 * `billing_state`, `billable_to_customer`, `warranty_review_required` when DB lacks migrations.
 */
export const WO_DISPATCH_SCHEDULE_SELECT_NO_BILLING_WITH_NUM =
  "id, work_order_number, customer_id, customer_location_id, equipment_id, title, status, scheduled_on, scheduled_time, assigned_user_id, priority, type, maintenance_plan_id, calibration_template_id, total_parts_cents, created_at, completed_at"
