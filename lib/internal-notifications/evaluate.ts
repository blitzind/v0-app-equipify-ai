import type {
  EvaluateInternalRulesContext,
  InternalEscalationRuleRow,
  InternalNotificationCandidate,
  InternalNotificationEventType,
} from "@/lib/internal-notifications/types"
import { dateDaysFromNowYmd, dateTodayYmd, diffDaysUtc, numConfig } from "@/lib/internal-notifications/utils"

const RULE_LIMIT = 40
const OPEN_WO_DB = ["open", "scheduled", "in_progress"] as const
const SR_OPEN_DB = ["new", "reviewing", "needs_info", "approved"] as const
const DAY_MS = 24 * 60 * 60 * 1000
const MIN_MS = 60 * 1000

function dollarsFromCents(cents: number | null | undefined): string {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "$0"
  const dollars = cents / 100
  return dollars >= 1000 ? `$${(dollars / 1000).toFixed(1)}k` : `$${dollars.toFixed(0)}`
}

function withRulePrefix(rule: InternalEscalationRuleRow, key: string): string {
  return `${rule.id}:${key}`
}

export async function evaluateInternalNotificationRules(
  ctx: EvaluateInternalRulesContext,
): Promise<InternalNotificationCandidate[]> {
  const enabled = ctx.rules.filter((r) => r.enabled)
  const batches = await Promise.all(
    enabled.map((rule) => evaluateOneRule(rule, ctx).catch(() => [] as InternalNotificationCandidate[])),
  )
  return batches.flat()
}

async function evaluateOneRule(
  rule: InternalEscalationRuleRow,
  ctx: EvaluateInternalRulesContext,
): Promise<InternalNotificationCandidate[]> {
  const event = rule.event_type as InternalNotificationEventType

  switch (event) {
    case "service_request_new":
      return evalServiceRequestNew(rule, ctx)
    case "service_request_sla_at_risk":
      return evalServiceRequestSlaAtRisk(rule, ctx)
    case "service_request_sla_overdue":
      return evalServiceRequestSlaOverdue(rule, ctx)
    case "work_order_overdue":
      return evalWorkOrderOverdue(rule, ctx)
    case "work_order_unassigned":
      return evalWorkOrderUnassigned(rule, ctx)
    case "maintenance_due_soon":
      return evalMaintenanceDueSoon(rule, ctx)
    case "maintenance_overdue":
      return evalMaintenanceOverdue(rule, ctx)
    case "quote_approved":
      return evalQuoteApproved(rule, ctx)
    case "quote_declined":
      return evalQuoteDeclined(rule, ctx)
    case "invoice_overdue":
      if (!ctx.allowFinancialQueries) return []
      return evalInvoiceOverdue(rule, ctx)
    case "repeat_failure_risk":
      return evalRepeatFailure(rule, ctx)
    case "warranty_expiring_soon":
      return evalWarrantyExpiring(rule, ctx)
    default:
      return []
  }
}

async function evalServiceRequestNew(
  rule: InternalEscalationRuleRow,
  ctx: EvaluateInternalRulesContext,
): Promise<InternalNotificationCandidate[]> {
  const lookbackMin = rule.threshold_minutes ?? 7 * 24 * 60
  const cutoff = new Date(ctx.now.getTime() - lookbackMin * MIN_MS).toISOString()
  const { data, error } = await ctx.supabase
    .from("org_service_requests")
    .select("id, issue_summary, status, customer_id, created_at")
    .eq("organization_id", ctx.organizationId)
    .eq("status", "new")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(RULE_LIMIT)

  if (error || !data?.length) return []
  return data.map((row) => {
    const id = row.id as string
    const summary = ((row.issue_summary as string) || "Service request").slice(0, 120)
    return {
      dedupeKey: withRulePrefix(rule, `sr_new:${id}`),
      eventType: "service_request_new" as const,
      ruleId: rule.id,
      title: "New service request",
      body: `${summary}`,
      severity: "info" as const,
      href: `/communications/service-requests?open=${encodeURIComponent(id)}`,
      entityType: "service_request" as const,
      entityId: id,
      customerId: (row.customer_id as string | null) ?? null,
      equipmentId: null,
      workOrderId: null,
    }
  })
}

async function evalServiceRequestSlaAtRisk(
  rule: InternalEscalationRuleRow,
  ctx: EvaluateInternalRulesContext,
): Promise<InternalNotificationCandidate[]> {
  const thresholdMin = rule.threshold_minutes ?? 24 * 60
  const warningMin = rule.warning_minutes ?? 4 * 60
  const thresholdMs = thresholdMin * MIN_MS
  const warningMs = Math.min(warningMin * MIN_MS, Math.max(thresholdMs - 60_000, 0))

  const { data, error } = await ctx.supabase
    .from("org_service_requests")
    .select("id, issue_summary, status, customer_id, created_at")
    .eq("organization_id", ctx.organizationId)
    .in("status", [...SR_OPEN_DB])
    .order("created_at", { ascending: true })
    .limit(RULE_LIMIT)

  if (error || !data?.length) return []
  const nowMs = ctx.now.getTime()
  const out: InternalNotificationCandidate[] = []
  for (const row of data) {
    const id = row.id as string
    const createdMs = new Date(row.created_at as string).getTime()
    const deadline = createdMs + thresholdMs
    const warnLine = deadline - warningMs
    if (nowMs >= warnLine && nowMs < deadline) {
      const minsLeft = Math.max(0, Math.ceil((deadline - nowMs) / MIN_MS))
      out.push({
        dedupeKey: withRulePrefix(rule, `sr_sla_risk:${id}`),
        eventType: "service_request_sla_at_risk",
        ruleId: rule.id,
        title: "Service request SLA at risk",
        body: `${((row.issue_summary as string) || "Request").slice(0, 100)} — about ${minsLeft}m remaining vs response target.`,
        severity: "warning",
        href: `/communications/service-requests?open=${encodeURIComponent(id)}`,
        entityType: "service_request",
        entityId: id,
        customerId: (row.customer_id as string | null) ?? null,
        equipmentId: null,
        workOrderId: null,
      })
    }
  }
  return out
}

async function evalServiceRequestSlaOverdue(
  rule: InternalEscalationRuleRow,
  ctx: EvaluateInternalRulesContext,
): Promise<InternalNotificationCandidate[]> {
  const thresholdMin = rule.threshold_minutes ?? 24 * 60
  const thresholdMs = thresholdMin * MIN_MS
  const { data, error } = await ctx.supabase
    .from("org_service_requests")
    .select("id, issue_summary, status, customer_id, created_at")
    .eq("organization_id", ctx.organizationId)
    .in("status", [...SR_OPEN_DB])
    .order("created_at", { ascending: true })
    .limit(RULE_LIMIT)

  if (error || !data?.length) return []
  const nowMs = ctx.now.getTime()
  const out: InternalNotificationCandidate[] = []
  for (const row of data) {
    const id = row.id as string
    const createdMs = new Date(row.created_at as string).getTime()
    const deadline = createdMs + thresholdMs
    if (nowMs >= deadline) {
      const overdueMin = Math.max(0, Math.ceil((nowMs - deadline) / MIN_MS))
      out.push({
        dedupeKey: withRulePrefix(rule, `sr_sla_overdue:${id}`),
        eventType: "service_request_sla_overdue",
        ruleId: rule.id,
        title: "Service request SLA overdue",
        body: `${((row.issue_summary as string) || "Request").slice(0, 100)} — ${overdueMin}m past response target.`,
        severity: "critical",
        href: `/communications/service-requests?open=${encodeURIComponent(id)}`,
        entityType: "service_request",
        entityId: id,
        customerId: (row.customer_id as string | null) ?? null,
        equipmentId: null,
        workOrderId: null,
      })
    }
  }
  return out
}

async function evalWorkOrderOverdue(
  rule: InternalEscalationRuleRow,
  ctx: EvaluateInternalRulesContext,
): Promise<InternalNotificationCandidate[]> {
  const today = dateTodayYmd(ctx.now)
  const { data, error } = await ctx.supabase
    .from("work_orders")
    .select("id, title, status, scheduled_on, work_order_number, customer_id, equipment_id")
    .eq("organization_id", ctx.organizationId)
    .is("archived_at", null)
    .in("status", [...OPEN_WO_DB])
    .not("scheduled_on", "is", null)
    .lt("scheduled_on", today)
    .order("scheduled_on", { ascending: true })
    .limit(RULE_LIMIT)

  if (error || !data?.length) return []
  return data.map((row) => {
    const id = row.id as string
    const sched = row.scheduled_on as string
    const daysPast = diffDaysUtc(ctx.now, new Date(`${sched}T12:00:00Z`))
    const num = (row.work_order_number as number | null) != null ? String(row.work_order_number) : id.slice(0, 8)
    const titleLabel = ((row.title as string) || `WO ${num}`).slice(0, 80)
    return {
      dedupeKey: withRulePrefix(rule, `wo_overdue:${id}`),
      eventType: "work_order_overdue" as const,
      ruleId: rule.id,
      title: "Work order overdue",
      body: `${titleLabel} was scheduled ${sched} (${daysPast}d ago) and is still open.`,
      severity: daysPast >= 3 ? ("critical" as const) : ("warning" as const),
      href: `/work-orders?open=${encodeURIComponent(id)}`,
      entityType: "work_order" as const,
      entityId: id,
      customerId: (row.customer_id as string | null) ?? null,
      equipmentId: (row.equipment_id as string | null) ?? null,
      workOrderId: id,
    }
  })
}

async function evalWorkOrderUnassigned(
  rule: InternalEscalationRuleRow,
  ctx: EvaluateInternalRulesContext,
): Promise<InternalNotificationCandidate[]> {
  const thresholdMin = rule.threshold_minutes ?? 24 * 60
  const cutoffIso = new Date(ctx.now.getTime() - thresholdMin * MIN_MS).toISOString()
  const { data, error } = await ctx.supabase
    .from("work_orders")
    .select("id, title, status, created_at, work_order_number, customer_id, equipment_id, assigned_user_id, assigned_technician_id")
    .eq("organization_id", ctx.organizationId)
    .is("archived_at", null)
    .in("status", [...OPEN_WO_DB])
    .is("assigned_user_id", null)
    .is("assigned_technician_id", null)
    .lte("created_at", cutoffIso)
    .order("created_at", { ascending: true })
    .limit(RULE_LIMIT)

  if (error || !data?.length) return []
  return data.map((row) => {
    const id = row.id as string
    const num = (row.work_order_number as number | null) != null ? String(row.work_order_number) : id.slice(0, 8)
    const titleLabel = ((row.title as string) || `WO ${num}`).slice(0, 80)
    const ageH = Math.max(0, Math.round((ctx.now.getTime() - new Date(row.created_at as string).getTime()) / (60 * MIN_MS)))
    return {
      dedupeKey: withRulePrefix(rule, `wo_unassigned:${id}`),
      eventType: "work_order_unassigned" as const,
      ruleId: rule.id,
      title: "Work order unassigned",
      body: `${titleLabel} has no technician after ~${ageH}h.`,
      severity: "warning" as const,
      href: `/work-orders?open=${encodeURIComponent(id)}`,
      entityType: "work_order" as const,
      entityId: id,
      customerId: (row.customer_id as string | null) ?? null,
      equipmentId: (row.equipment_id as string | null) ?? null,
      workOrderId: id,
    }
  })
}

async function evalMaintenanceDueSoon(
  rule: InternalEscalationRuleRow,
  ctx: EvaluateInternalRulesContext,
): Promise<InternalNotificationCandidate[]> {
  const horizonDays = numConfig(rule.config, "maintenanceHorizonDays", 7)
  const today = dateTodayYmd(ctx.now)
  const horizon = dateDaysFromNowYmd(ctx.now, horizonDays)
  const { data, error } = await ctx.supabase
    .from("equipment")
    .select("id, name, equipment_code, next_calibration_due_at, customer_id")
    .eq("organization_id", ctx.organizationId)
    .is("archived_at", null)
    .gte("next_calibration_due_at", today)
    .lte("next_calibration_due_at", horizon)
    .order("next_calibration_due_at", { ascending: true })
    .limit(RULE_LIMIT)

  if (error || !data?.length) return []
  return data.map((row) => {
    const id = row.id as string
    const due = row.next_calibration_due_at as string
    const label = ((row.name as string) || (row.equipment_code as string) || "Equipment").slice(0, 80)
    const days = Math.max(0, diffDaysUtc(new Date(`${due}T12:00:00Z`), ctx.now))
    return {
      dedupeKey: withRulePrefix(rule, `maint_soon:${id}`),
      eventType: "maintenance_due_soon" as const,
      ruleId: rule.id,
      title: "Maintenance due soon",
      body: `${label} — calibration/pm due in ${days}d (${due}).`,
      severity: days <= 1 ? ("warning" as const) : ("info" as const),
      href: `/equipment/${encodeURIComponent(id)}`,
      entityType: "equipment" as const,
      entityId: id,
      customerId: (row.customer_id as string | null) ?? null,
      equipmentId: id,
      workOrderId: null,
    }
  })
}

async function evalMaintenanceOverdue(
  rule: InternalEscalationRuleRow,
  ctx: EvaluateInternalRulesContext,
): Promise<InternalNotificationCandidate[]> {
  const today = dateTodayYmd(ctx.now)
  const { data, error } = await ctx.supabase
    .from("equipment")
    .select("id, name, equipment_code, next_calibration_due_at, customer_id")
    .eq("organization_id", ctx.organizationId)
    .is("archived_at", null)
    .not("next_calibration_due_at", "is", null)
    .lt("next_calibration_due_at", today)
    .order("next_calibration_due_at", { ascending: true })
    .limit(RULE_LIMIT)

  if (error || !data?.length) return []
  return data.map((row) => {
    const id = row.id as string
    const due = row.next_calibration_due_at as string
    const label = ((row.name as string) || (row.equipment_code as string) || "Equipment").slice(0, 80)
    const days = Math.max(0, diffDaysUtc(ctx.now, new Date(`${due}T12:00:00Z`)))
    return {
      dedupeKey: withRulePrefix(rule, `maint_overdue:${id}`),
      eventType: "maintenance_overdue" as const,
      ruleId: rule.id,
      title: "Maintenance overdue",
      body: `${label} — due date ${due} (${days}d past).`,
      severity: "critical" as const,
      href: `/equipment/${encodeURIComponent(id)}`,
      entityType: "equipment" as const,
      entityId: id,
      customerId: (row.customer_id as string | null) ?? null,
      equipmentId: id,
      workOrderId: null,
    }
  })
}

async function evalQuoteApproved(
  rule: InternalEscalationRuleRow,
  ctx: EvaluateInternalRulesContext,
): Promise<InternalNotificationCandidate[]> {
  const lookbackMin = rule.threshold_minutes ?? 72 * 60
  const cutoff = new Date(ctx.now.getTime() - lookbackMin * MIN_MS).toISOString()
  const { data, error } = await ctx.supabase
    .from("org_quotes")
    .select("id, quote_number, title, customer_id, status, customer_portal_decision_at, created_at")
    .eq("organization_id", ctx.organizationId)
    .is("archived_at", null)
    .eq("status", "approved")
    .limit(RULE_LIMIT)

  if (error || !data?.length) return []
  const out: InternalNotificationCandidate[] = []
  for (const row of data) {
    const anchor = (row.customer_portal_decision_at as string | null) ?? (row.created_at as string)
    if (anchor < cutoff) continue
    const id = row.id as string
    const num = (row.quote_number as string) || "Quote"
    out.push({
      dedupeKey: withRulePrefix(rule, `quote_approved:${id}`),
      eventType: "quote_approved",
      ruleId: rule.id,
      title: "Quote approved",
      body: `${num} — ${((row.title as string) || "Quote").slice(0, 80)}`,
      severity: "info",
      href: `/quotes?open=${encodeURIComponent(id)}`,
      entityType: "quote",
      entityId: id,
      customerId: (row.customer_id as string | null) ?? null,
      equipmentId: null,
      workOrderId: null,
    })
  }
  return out
}

async function evalQuoteDeclined(
  rule: InternalEscalationRuleRow,
  ctx: EvaluateInternalRulesContext,
): Promise<InternalNotificationCandidate[]> {
  const lookbackMin = rule.threshold_minutes ?? 72 * 60
  const cutoff = new Date(ctx.now.getTime() - lookbackMin * MIN_MS).toISOString()
  const { data, error } = await ctx.supabase
    .from("org_quotes")
    .select("id, quote_number, title, customer_id, status, customer_portal_decision_at, created_at")
    .eq("organization_id", ctx.organizationId)
    .is("archived_at", null)
    .eq("status", "declined")
    .limit(RULE_LIMIT)

  if (error || !data?.length) return []
  const out: InternalNotificationCandidate[] = []
  for (const row of data) {
    const anchor = (row.customer_portal_decision_at as string | null) ?? (row.created_at as string)
    if (anchor < cutoff) continue
    const id = row.id as string
    const num = (row.quote_number as string) || "Quote"
    out.push({
      dedupeKey: withRulePrefix(rule, `quote_declined:${id}`),
      eventType: "quote_declined",
      ruleId: rule.id,
      title: "Quote declined",
      body: `${num} — ${((row.title as string) || "Quote").slice(0, 80)}`,
      severity: "warning",
      href: `/quotes?open=${encodeURIComponent(id)}`,
      entityType: "quote",
      entityId: id,
      customerId: (row.customer_id as string | null) ?? null,
      equipmentId: null,
      workOrderId: null,
    })
  }
  return out
}

async function evalInvoiceOverdue(
  rule: InternalEscalationRuleRow,
  ctx: EvaluateInternalRulesContext,
): Promise<InternalNotificationCandidate[]> {
  const today = dateTodayYmd(ctx.now)
  const { data, error } = await ctx.supabase
    .from("org_invoices")
    .select("id, customer_id, invoice_number, title, amount_cents, status, due_date")
    .eq("organization_id", ctx.organizationId)
    .is("archived_at", null)
    .neq("status", "paid")
    .neq("status", "void")
    .lt("due_date", today)
    .order("due_date", { ascending: true })
    .limit(RULE_LIMIT)

  if (error || !data?.length) return []
  return data.map((row) => {
    const id = row.id as string
    const due = row.due_date as string | null
    const days = due ? Math.max(0, diffDaysUtc(ctx.now, new Date(`${due}T12:00:00Z`))) : 0
    const number = (row.invoice_number as string) || "Invoice"
    const amt = dollarsFromCents(row.amount_cents as number | null)
    return {
      dedupeKey: withRulePrefix(rule, `inv_overdue:${id}`),
      eventType: "invoice_overdue" as const,
      ruleId: rule.id,
      title: "Invoice overdue",
      body: `${number} — ${days}d past due (${amt} outstanding).`,
      severity: days >= 30 ? ("critical" as const) : days >= 7 ? ("warning" as const) : ("info" as const),
      href: `/invoices?open=${encodeURIComponent(id)}`,
      entityType: "invoice" as const,
      entityId: id,
      customerId: (row.customer_id as string | null) ?? null,
      equipmentId: null,
      workOrderId: null,
    }
  })
}

async function evalRepeatFailure(
  rule: InternalEscalationRuleRow,
  ctx: EvaluateInternalRulesContext,
): Promise<InternalNotificationCandidate[]> {
  const minRepairs = numConfig(rule.config, "minRepairs90d", 3)
  const windowDays = numConfig(rule.config, "windowDays", 90)
  const since = new Date(ctx.now.getTime() - windowDays * DAY_MS).toISOString()

  const { data, error } = await ctx.supabase
    .from("work_orders")
    .select("equipment_id, type")
    .eq("organization_id", ctx.organizationId)
    .is("archived_at", null)
    .eq("type", "repair")
    .gte("created_at", since)
    .limit(500)

  if (error || !data?.length) return []
  const counts = new Map<string, number>()
  for (const row of data) {
    const eid = row.equipment_id as string | null
    if (!eid) continue
    counts.set(eid, (counts.get(eid) ?? 0) + 1)
  }
  const flagged = [...counts.entries()].filter(([, c]) => c >= minRepairs).slice(0, RULE_LIMIT)
  if (!flagged.length) return []

  const ids = flagged.map(([id]) => id)
  const { data: eq } = await ctx.supabase
    .from("equipment")
    .select("id, name, equipment_code, customer_id")
    .eq("organization_id", ctx.organizationId)
    .is("archived_at", null)
    .in("id", ids)

  const labelById = new Map<string, { label: string; customerId: string | null }>()
  for (const e of eq ?? []) {
    labelById.set(e.id as string, {
      label: ((e.name as string) || (e.equipment_code as string) || "Equipment").slice(0, 80),
      customerId: (e.customer_id as string | null) ?? null,
    })
  }

  return flagged.map(([id, count]): InternalNotificationCandidate => {
    const meta = labelById.get(id)
    return {
      dedupeKey: withRulePrefix(rule, `repeat_fail:${id}`),
      eventType: "repeat_failure_risk",
      ruleId: rule.id,
      title: "Repeat failure risk",
      body: `${meta?.label ?? "Equipment"} — ${count} repair work orders in ${windowDays}d.`,
      severity: count >= 5 ? "critical" : "warning",
      href: `/equipment/${encodeURIComponent(id)}`,
      entityType: "equipment",
      entityId: id,
      customerId: meta?.customerId ?? null,
      equipmentId: id,
      workOrderId: null,
    }
  })
}

async function evalWarrantyExpiring(
  rule: InternalEscalationRuleRow,
  ctx: EvaluateInternalRulesContext,
): Promise<InternalNotificationCandidate[]> {
  const horizonDays = numConfig(rule.config, "warrantyHorizonDays", 21)
  const today = dateTodayYmd(ctx.now)
  const horizon = dateDaysFromNowYmd(ctx.now, horizonDays)

  const { data, error } = await ctx.supabase
    .from("equipment")
    .select("id, name, equipment_code, warranty_expiration_date, warranty_expires_at, customer_id")
    .eq("organization_id", ctx.organizationId)
    .is("archived_at", null)
    .limit(250)

  if (error || !data?.length) return []
  const rows = data
    .filter((row) => {
      const end =
        (row.warranty_expiration_date as string | null) ?? (row.warranty_expires_at as string | null) ?? null
      if (!end) return false
      return end >= today && end <= horizon
    })
    .slice(0, RULE_LIMIT)

  return rows.map((row) => {
    const id = row.id as string
    const label = ((row.name as string) || (row.equipment_code as string) || "Equipment").slice(0, 80)
    const end =
      (row.warranty_expiration_date as string | null) ?? (row.warranty_expires_at as string | null) ?? ""
    const days = Math.max(0, diffDaysUtc(new Date(`${end}T12:00:00Z`), ctx.now))
    return {
      dedupeKey: withRulePrefix(rule, `warranty:${id}:${end}`),
      eventType: "warranty_expiring_soon" as const,
      ruleId: rule.id,
      title: "Warranty expiring soon",
      body: `${label} — coverage ends ${end} (${days}d).`,
      severity: days <= 7 ? ("warning" as const) : ("info" as const),
      href: `/equipment/${encodeURIComponent(id)}`,
      entityType: "equipment" as const,
      entityId: id,
      customerId: (row.customer_id as string | null) ?? null,
      equipmentId: id,
      workOrderId: null,
    }
  })
}
