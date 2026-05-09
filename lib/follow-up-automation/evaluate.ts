import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { mergeFollowUpAutomationConfig } from "@/lib/follow-up-automation/merge-config"
import {
  isInvoiceFollowUpEligibleStatus,
  pickInvoiceFollowUpRuleKey,
  priorityForInvoiceFollowUpRule,
  signedDaysRelativeToDueDate,
} from "@/lib/follow-up-automation/invoice-rules"
import type { FollowUpEntityType, FollowUpRuleKey } from "@/lib/follow-up-automation/types"

function todayUtcIsoDate(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

function addDaysUtcIsoDate(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function monthsAgoIso(months: number): string {
  const d = new Date()
  d.setUTCMonth(d.getUTCMonth() - months)
  return d.toISOString()
}

function dedupe(rule: FollowUpRuleKey, entityType: FollowUpEntityType, entityId: string): string {
  return `${rule}:${entityType}:${entityId}`
}

type Candidate = {
  entity_type: FollowUpEntityType
  entity_id: string
  rule_key: FollowUpRuleKey
  priority: "low" | "normal" | "high"
  assigned_to_user_id: string | null
  scheduled_for: string | null
  metadata: Record<string, unknown>
}

export async function evaluateFollowUpAutomationForOrganization(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ inserted: number; skippedDuplicates: number; evaluatedRules: Partial<Record<FollowUpRuleKey, number>> }> {
  const { data: settingsRow } = await admin
    .from("follow_up_automation_settings")
    .select("config")
    .eq("organization_id", organizationId)
    .maybeSingle()

  const cfg = mergeFollowUpAutomationConfig((settingsRow as { config?: unknown } | null)?.config ?? {})

  const { data: existingOpen } = await admin
    .from("follow_up_tasks")
    .select("dedupe_key")
    .eq("organization_id", organizationId)
    .in("status", ["pending", "approved"])

  const openKeys = new Set((existingOpen ?? []).map((r) => (r as { dedupe_key: string }).dedupe_key))

  const candidates: Candidate[] = []

  const { data: techRows } = await admin.from("technicians").select("id, user_id").eq("organization_id", organizationId)
  const techUserByTechId = new Map<string, string>()
  for (const t of techRows ?? []) {
    const row = t as { id: string; user_id: string | null }
    if (row.user_id) techUserByTechId.set(row.id, row.user_id)
  }

  /** Prospects */
  if (cfg.categories.prospects.enabled) {
    const th = cfg.thresholds
    const { data: prospects } = await admin
      .from("prospects")
      .select(
        "id, status, next_follow_up_at, last_contacted_at, updated_at, assigned_to_user_id, company_name, contact_email, is_sample",
      )
      .eq("organization_id", organizationId)
      .eq("is_sample", false)
      .is("archived_at", null)

    const nowMs = Date.now()
    for (const p of prospects ?? []) {
      const row = p as {
        id: string
        status: string
        next_follow_up_at: string | null
        last_contacted_at: string | null
        updated_at: string
        assigned_to_user_id: string | null
        company_name: string
        contact_email: string | null
      }

      if (row.next_follow_up_at) {
        const due = Date.parse(row.next_follow_up_at)
        if (!Number.isNaN(due) && due < nowMs) {
          candidates.push({
            entity_type: "prospect",
            entity_id: row.id,
            rule_key: "prospect_followup_overdue",
            priority: "high",
            assigned_to_user_id: row.assigned_to_user_id,
            scheduled_for: null,
            metadata: {
              summary: `Follow-up overdue for ${row.company_name}`,
              prospect_company: row.company_name,
              prospect_status: row.status,
            },
          })
        }
      }

      if (row.status === "proposal_sent") {
        const anchor = row.last_contacted_at ?? row.updated_at
        if (anchor && Date.parse(anchor) < Date.now() - th.prospectProposalNoResponseDays * 86400000) {
          candidates.push({
            entity_type: "prospect",
            entity_id: row.id,
            rule_key: "prospect_proposal_no_response",
            priority: "normal",
            assigned_to_user_id: row.assigned_to_user_id,
            scheduled_for: null,
            metadata: {
              summary: `Proposal sent — no response for ${th.prospectProposalNoResponseDays}+ days (${row.company_name})`,
              prospect_company: row.company_name,
              prospect_status: row.status,
            },
          })
        }
      }

      if (row.status === "nurture") {
        if (Date.parse(row.updated_at) < Date.now() - th.prospectNurtureInactiveDays * 86400000) {
          candidates.push({
            entity_type: "prospect",
            entity_id: row.id,
            rule_key: "prospect_nurture_inactive",
            priority: "low",
            assigned_to_user_id: row.assigned_to_user_id,
            scheduled_for: null,
            metadata: {
              summary: `Nurture prospect inactive (${row.company_name})`,
              prospect_company: row.company_name,
            },
          })
        }
      }
    }
  }

  /** Work orders */
  if (cfg.categories.work_orders.enabled) {
    const th = cfg.thresholds
    const { data: workOrders } = await admin
      .from("work_orders")
      .select(
        "id, status, scheduled_on, completed_at, updated_at, assigned_technician_id, customer_id, title, is_sample",
      )
      .eq("organization_id", organizationId)
      .eq("is_archived", false)
      .eq("is_sample", false)

    const sigCut = hoursAgoIso(th.woSignaturePendingHours)
    const completedCut = daysAgoIso(th.woCompletedFollowupDays)
    const today = todayUtcIsoDate()
    const schedUntil = addDaysUtcIsoDate(Math.max(2, Math.ceil(th.woScheduledReminderHoursBefore / 24)))

    for (const w of workOrders ?? []) {
      const row = w as {
        id: string
        status: string
        scheduled_on: string | null
        completed_at: string | null
        updated_at: string
        assigned_technician_id: string | null
        customer_id: string
        title: string | null
      }
      const techUid = row.assigned_technician_id ? techUserByTechId.get(row.assigned_technician_id) : undefined

      if (row.status === "completed_pending_signature" && row.updated_at < sigCut) {
        candidates.push({
          entity_type: "work_order",
          entity_id: row.id,
          rule_key: "wo_signature_pending",
          priority: "high",
          assigned_to_user_id: null,
          scheduled_for: null,
          metadata: {
            summary: `Signature pending — older than ${th.woSignaturePendingHours}h`,
            work_order_title: row.title ?? "Work order",
            technician_user_id: techUid ?? null,
          },
        })
      }

      if (
        row.status === "scheduled" &&
        row.scheduled_on &&
        row.scheduled_on >= today &&
        row.scheduled_on <= schedUntil
      ) {
        candidates.push({
          entity_type: "work_order",
          entity_id: row.id,
          rule_key: "wo_scheduled_reminder",
          priority: "normal",
          assigned_to_user_id: null,
          scheduled_for: row.scheduled_on ? `${row.scheduled_on}T12:00:00.000Z` : null,
          metadata: {
            summary: `Upcoming appointment (${row.scheduled_on})`,
            work_order_title: row.title ?? "Work order",
            scheduled_on: row.scheduled_on,
            technician_user_id: techUid ?? null,
          },
        })
      }

      if (
        (row.status === "completed" || row.status === "invoiced") &&
        row.completed_at &&
        row.completed_at < completedCut
      ) {
        candidates.push({
          entity_type: "work_order",
          entity_id: row.id,
          rule_key: "wo_completed_followup",
          priority: "normal",
          assigned_to_user_id: null,
          scheduled_for: null,
          metadata: {
            summary: `Completed work order — follow-up after ${th.woCompletedFollowupDays}+ days`,
            work_order_title: row.title ?? "Work order",
            technician_user_id: techUid ?? null,
          },
        })
      }
    }
  }

  /** Invoices — amounts never stored in queue metadata (drafts stay review-only). */
  if (cfg.categories.invoices.enabled) {
    const today = todayUtcIsoDate()
    const th = cfg.thresholds
    const soonUntil = addDaysUtcIsoDate(th.invoiceDueSoonDays)

    const { data: invoices } = await admin
      .from("org_invoices")
      .select("id, customer_id, title, status, due_date, invoice_number, issued_at, sent_at, is_sample")
      .eq("organization_id", organizationId)
      .eq("is_sample", false)
      .is("archived_at", null)

    for (const inv of invoices ?? []) {
      const row = inv as {
        id: string
        customer_id: string
        title: string
        status: string
        due_date: string | null
        invoice_number: string | null
        issued_at: string | null
        sent_at: string | null
      }
      if (!row.due_date) continue

      const signed = signedDaysRelativeToDueDate(today, row.due_date)
      const metaBase: Record<string, unknown> = {
        invoice_title: row.title,
        invoice_number: row.invoice_number,
        due_date: row.due_date,
        customer_id: row.customer_id,
        issued_at: row.issued_at,
        sent_at: row.sent_at,
        days_overdue: signed > 0 ? signed : null,
        days_until_due: signed < 0 ? -signed : signed === 0 ? 0 : null,
      }

      if (cfg.invoiceFollowUps.enabled) {
        if (!isInvoiceFollowUpEligibleStatus(row.status)) continue
        const invCfg = cfg.invoiceFollowUps
        const ruleKey = pickInvoiceFollowUpRuleKey({
          todayYmd: today,
          dueYmd: row.due_date,
          dueSoonDays: invCfg.dueSoonDays,
          finalNoticeDays: invCfg.finalNoticeDays,
        })
        if (!ruleKey) continue

        const summary =
          ruleKey === "invoice_due_soon"
            ? `Invoice due soon (${row.due_date}) — ${row.title}`
            : signed > 0
              ? `Invoice ${signed}d past due — ${row.title}`
              : `Invoice follow-up — ${row.title}`

        candidates.push({
          entity_type: "invoice",
          entity_id: row.id,
          rule_key: ruleKey,
          priority: priorityForInvoiceFollowUpRule(ruleKey),
          assigned_to_user_id: invCfg.defaultAssigneeUserId,
          scheduled_for:
            ruleKey === "invoice_due_soon" && row.due_date ? `${row.due_date}T12:00:00.000Z` : null,
          metadata: {
            ...metaBase,
            summary,
          },
        })
      } else {
        if (row.status === "paid" || row.status === "void" || row.status === "draft") continue

        if (row.due_date < today && row.status !== "paid") {
          candidates.push({
            entity_type: "invoice",
            entity_id: row.id,
            rule_key: "invoice_overdue",
            priority: "high",
            assigned_to_user_id: null,
            scheduled_for: null,
            metadata: {
              ...metaBase,
              summary: `Overdue invoice — ${row.title}`,
            },
          })
        } else if (
          row.due_date >= today &&
          row.due_date <= soonUntil &&
          (row.status === "sent" || row.status === "unpaid")
        ) {
          candidates.push({
            entity_type: "invoice",
            entity_id: row.id,
            rule_key: "invoice_due_soon",
            priority: "normal",
            assigned_to_user_id: null,
            scheduled_for: `${row.due_date}T12:00:00.000Z`,
            metadata: {
              ...metaBase,
              summary: `Invoice due soon (${row.due_date}) — ${row.title}`,
            },
          })
        }
      }
    }
  }

  /** Customers — stale completed WO */
  if (cfg.categories.customers.enabled) {
    const months = cfg.thresholds.customerStaleWoMonths
    const cutoff = monthsAgoIso(months)

    const { data: customers } = await admin
      .from("customers")
      .select("id, company_name, is_sample")
      .eq("organization_id", organizationId)
      .eq("is_archived", false)
      .eq("is_sample", false)

    const { data: woDone } = await admin
      .from("work_orders")
      .select("customer_id, completed_at")
      .eq("organization_id", organizationId)
      .eq("is_sample", false)
      .in("status", ["completed", "invoiced", "completed_pending_signature"])
      .not("completed_at", "is", null)

    const lastCompleted = new Map<string, string>()
    for (const r of woDone ?? []) {
      const row = r as { customer_id: string; completed_at: string }
      const prev = lastCompleted.get(row.customer_id)
      if (!prev || row.completed_at > prev) lastCompleted.set(row.customer_id, row.completed_at)
    }

    for (const c of customers ?? []) {
      const row = c as { id: string; company_name: string }
      const last = lastCompleted.get(row.id)
      if (!last || last < cutoff) {
        candidates.push({
          entity_type: "customer",
          entity_id: row.id,
          rule_key: "customer_stale_no_completed_wo",
          priority: "low",
          assigned_to_user_id: null,
          scheduled_for: null,
          metadata: {
            summary: last
              ? `No completed work order in ${months}+ months — ${row.company_name}`
              : `No completed work orders yet — ${row.company_name}`,
            customer_name: row.company_name,
            last_completed_at: last ?? null,
          },
        })
      }
    }
  }

  /** Equipment service / warranty — legacy path when maintenance reminder bundle is off */
  if (cfg.categories.equipment.enabled && !cfg.maintenanceReminders.enabled) {
    const th = cfg.thresholds
    const today = todayUtcIsoDate()
    const svcUntil = addDaysUtcIsoDate(th.equipmentServiceDueSoonDays)
    const warUntil = addDaysUtcIsoDate(th.equipmentWarrantyExpiringDays)

    const { data: equip } = await admin
      .from("equipment")
      .select(
        "id, customer_id, name, next_due_at, warranty_expiration_date, warranty_expires_at, is_archived, is_sample",
      )
      .eq("organization_id", organizationId)
      .eq("is_archived", false)
      .eq("is_sample", false)

    for (const e of equip ?? []) {
      const row = e as {
        id: string
        customer_id: string
        name: string
        next_due_at: string | null
        warranty_expiration_date: string | null
        warranty_expires_at: string | null
      }
      const wEnd = row.warranty_expiration_date ?? row.warranty_expires_at

      if (row.next_due_at && row.next_due_at >= today && row.next_due_at <= svcUntil) {
        candidates.push({
          entity_type: "equipment",
          entity_id: row.id,
          rule_key: "equipment_service_due_soon",
          priority: "normal",
          assigned_to_user_id: null,
          scheduled_for: `${row.next_due_at}T12:00:00.000Z`,
          metadata: {
            summary: `Service due soon — ${row.name}`,
            equipment_name: row.name,
            next_due_at: row.next_due_at,
          },
        })
      }

      if (wEnd && wEnd >= today && wEnd <= warUntil) {
        candidates.push({
          entity_type: "equipment",
          entity_id: row.id,
          rule_key: "equipment_warranty_expiring_soon",
          priority: "normal",
          assigned_to_user_id: null,
          scheduled_for: `${wEnd}T12:00:00.000Z`,
          metadata: {
            summary: `Warranty expiring soon — ${row.name}`,
            equipment_name: row.name,
            warranty_end: wEnd,
          },
        })
      }
    }
  }

  /** Maintenance reminders — preventive plans + calibration / service / warranty windows */
  if (cfg.maintenanceReminders.enabled) {
    const mr = cfg.maintenanceReminders
    const today = todayUtcIsoDate()
    const overdueCutoff = addDaysUtcIsoDate(-mr.overdueThresholdDays)
    const dueSoonEnd = addDaysUtcIsoDate(mr.dueSoonDays)
    const calUntil = addDaysUtcIsoDate(mr.calibrationDueSoonDays)
    const warUntil = addDaysUtcIsoDate(mr.warrantyDueSoonDays)

    const { data: plans } = await admin
      .from("maintenance_plans")
      .select(
        "id, customer_id, equipment_id, name, status, next_due_date, assigned_user_id, assigned_technician_id, archived_at",
      )
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .eq("status", "active")
      .not("next_due_date", "is", null)

    for (const p of plans ?? []) {
      const plan = p as {
        id: string
        customer_id: string
        equipment_id: string | null
        name: string
        next_due_date: string
        assigned_user_id: string | null
        assigned_technician_id: string | null
      }
      const techUid = plan.assigned_technician_id ? techUserByTechId.get(plan.assigned_technician_id) : null
      const assignUid =
        mr.defaultAssigneeUserId ?? plan.assigned_user_id ?? techUid ?? null

      if (plan.next_due_date < overdueCutoff) {
        candidates.push({
          entity_type: "maintenance_plan",
          entity_id: plan.id,
          rule_key: "maintenance_plan_overdue",
          priority: "high",
          assigned_to_user_id: assignUid,
          scheduled_for: `${plan.next_due_date}T12:00:00.000Z`,
          metadata: {
            summary: `Maintenance plan overdue — ${plan.name}`,
            maintenance_plan_name: plan.name,
            next_due_date: plan.next_due_date,
            equipment_id: plan.equipment_id,
            customer_id: plan.customer_id,
            assigned_technician_user_id: techUid ?? null,
          },
        })
      } else if (plan.next_due_date >= today && plan.next_due_date <= dueSoonEnd) {
        candidates.push({
          entity_type: "maintenance_plan",
          entity_id: plan.id,
          rule_key: "maintenance_plan_due_soon",
          priority: "normal",
          assigned_to_user_id: assignUid,
          scheduled_for: `${plan.next_due_date}T12:00:00.000Z`,
          metadata: {
            summary: `Maintenance plan due soon — ${plan.name}`,
            maintenance_plan_name: plan.name,
            next_due_date: plan.next_due_date,
            equipment_id: plan.equipment_id,
            customer_id: plan.customer_id,
            assigned_technician_user_id: techUid ?? null,
          },
        })
      }
    }

    const { data: equipMr } = await admin
      .from("equipment")
      .select(
        "id, customer_id, name, next_due_at, next_calibration_due_at, warranty_expiration_date, warranty_expires_at, is_archived, is_sample",
      )
      .eq("organization_id", organizationId)
      .eq("is_archived", false)
      .eq("is_sample", false)

    for (const e of equipMr ?? []) {
      const row = e as {
        id: string
        customer_id: string
        name: string
        next_due_at: string | null
        next_calibration_due_at: string | null
        warranty_expiration_date: string | null
        warranty_expires_at: string | null
      }
      const wEnd = row.warranty_expiration_date ?? row.warranty_expires_at

      if (row.next_due_at && row.next_due_at < overdueCutoff) {
        candidates.push({
          entity_type: "equipment",
          entity_id: row.id,
          rule_key: "equipment_service_overdue",
          priority: "high",
          assigned_to_user_id: mr.defaultAssigneeUserId,
          scheduled_for: `${row.next_due_at}T12:00:00.000Z`,
          metadata: {
            summary: `Service overdue — ${row.name}`,
            equipment_name: row.name,
            next_due_at: row.next_due_at,
            customer_id: row.customer_id,
          },
        })
      } else if (row.next_due_at && row.next_due_at >= today && row.next_due_at <= dueSoonEnd) {
        candidates.push({
          entity_type: "equipment",
          entity_id: row.id,
          rule_key: "equipment_service_due_soon",
          priority: "normal",
          assigned_to_user_id: mr.defaultAssigneeUserId,
          scheduled_for: `${row.next_due_at}T12:00:00.000Z`,
          metadata: {
            summary: `Service due soon — ${row.name}`,
            equipment_name: row.name,
            next_due_at: row.next_due_at,
            customer_id: row.customer_id,
          },
        })
      }

      if (
        row.next_calibration_due_at &&
        row.next_calibration_due_at >= today &&
        row.next_calibration_due_at <= calUntil
      ) {
        candidates.push({
          entity_type: "equipment",
          entity_id: row.id,
          rule_key: "equipment_calibration_due_soon",
          priority: "high",
          assigned_to_user_id: mr.defaultAssigneeUserId,
          scheduled_for: `${row.next_calibration_due_at}T12:00:00.000Z`,
          metadata: {
            summary: `Calibration due soon — ${row.name}`,
            equipment_name: row.name,
            next_calibration_due_at: row.next_calibration_due_at,
            customer_id: row.customer_id,
          },
        })
      }

      if (wEnd && wEnd >= today && wEnd <= warUntil) {
        candidates.push({
          entity_type: "equipment",
          entity_id: row.id,
          rule_key: "equipment_warranty_expiring_soon",
          priority: "normal",
          assigned_to_user_id: mr.defaultAssigneeUserId,
          scheduled_for: `${wEnd}T12:00:00.000Z`,
          metadata: {
            summary: `Warranty expiring soon — ${row.name}`,
            equipment_name: row.name,
            warranty_end: wEnd,
            customer_id: row.customer_id,
          },
        })
      }
    }
  }

  const evaluatedRules: Partial<Record<FollowUpRuleKey, number>> = {}
  let inserted = 0
  let skippedDuplicates = 0

  const rowsToInsert: Record<string, unknown>[] = []

  for (const c of candidates) {
    const dk = dedupe(c.rule_key, c.entity_type, c.entity_id)
    if (openKeys.has(dk)) {
      skippedDuplicates++
      continue
    }
    evaluatedRules[c.rule_key] = (evaluatedRules[c.rule_key] ?? 0) + 1
    openKeys.add(dk)
    rowsToInsert.push({
      organization_id: organizationId,
      entity_type: c.entity_type,
      entity_id: c.entity_id,
      rule_key: c.rule_key,
      status: "pending",
      priority: c.priority,
      assigned_to_user_id: c.assigned_to_user_id,
      dedupe_key: dk,
      scheduled_for: c.scheduled_for,
      metadata: c.metadata,
      draft_payload: {},
    })
  }

  const chunk = 40
  for (let i = 0; i < rowsToInsert.length; i += chunk) {
    const slice = rowsToInsert.slice(i, i + chunk)
    const { data, error } = await admin.from("follow_up_tasks").insert(slice).select("id")
    if (error) {
      console.error("[follow-up-automation] batch insert failed", error.message)
      continue
    }
    inserted += data?.length ?? 0
  }

  return { inserted, skippedDuplicates, evaluatedRules }
}
