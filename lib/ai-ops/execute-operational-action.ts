/**
 * AI Ops Phase 5 — approval-gated operational actions. Each branch verifies
 * permissions, re-derives the recommendation server-side, performs at most
 * one mutation (or returns a safe redirect / client hint), and writes an
 * append-only event row.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { requireCanCreateRecord } from "@/lib/billing/server-guard"
import { insertLedger } from "@/lib/inventory/inventory-mutations"
import { generateRecommendations } from "@/lib/ai-ops/engine"
import type { OrgPermissions } from "@/lib/permissions/model"
import type { Recommendation, RecommendationCategory } from "@/lib/ai-ops/types"
import { insertRecommendationEvent } from "@/lib/ai-ops/lifecycle-db"
import { sendInvoicePaymentReminderFromAiOps } from "@/lib/ai-ops/actions/send-invoice-payment-reminder"
import { buildAutomationSuggestion, suggestionUrl } from "@/components/ai-ops/automation-suggestion"

import type { OperationalActionId } from "@/lib/ai-ops/operational-action-ids"

export type { OperationalActionId }
export { OPERATIONAL_ACTION_IDS } from "@/lib/ai-ops/operational-action-ids"

export type ExecuteOperationalActionResult =
  | {
      ok: true
      effect:
        | { kind: "mutation"; summary: string }
        | { kind: "redirect"; url: string; summary: string }
        | { kind: "client"; action: "draft_followup"; summary: string }
    }
  | { ok: false; code: string; message: string }

export async function executeOperationalAction(args: {
  supabase: SupabaseClient
  organizationId: string
  userId: string
  permissions: OrgPermissions
  recommendationKey: string
  action: OperationalActionId
  confirm: true
  payload?: {
    technicianUserId?: string
    recipientEmail?: string
    taskNotes?: string
  }
}): Promise<ExecuteOperationalActionResult> {
  const rec = await deriveRecommendation(args.supabase, args.organizationId, args.permissions, args.recommendationKey)
  if (!rec) {
    return { ok: false, code: "recommendation_not_found", message: "This recommendation is no longer active." }
  }

  switch (args.action) {
    case "send_invoice_reminder":
      if (!args.permissions.canEditInvoices) {
        return { ok: false, code: "forbidden", message: "You do not have permission to email invoices." }
      }
      if (rec.entity?.type !== "invoice") {
        return { ok: false, code: "invalid_entity", message: "This action only applies to invoice recommendations." }
      }
      const send = await sendInvoicePaymentReminderFromAiOps({
        supabase: args.supabase,
        organizationId: args.organizationId,
        invoiceId: rec.entity.id,
        actorUserId: args.userId,
        toEmail: args.payload?.recipientEmail ?? null,
      })
      if (!send.ok) {
        return { ok: false, code: send.code, message: send.message }
      }
      await logEvt(args, rec, "communication_sent", "sent", {
        channel: "email",
        related_entity_type: "invoice",
      })
      return { ok: true, effect: { kind: "mutation", summary: "Payment reminder email was sent to the customer." } }

    case "create_follow_up_task": {
      const billingGate = await requireCanCreateRecord(args.supabase, args.userId, args.organizationId, "org_task")
      if (!billingGate.ok) {
        return { ok: false, code: "billing_gate", message: billingGate.message }
      }
      const title = rec.title.slice(0, 500)
      const description =
        [rec.explanation, args.payload?.taskNotes].filter(Boolean).join("\n\n").slice(0, 8000) ||
        rec.explanation.slice(0, 8000)
      const sourceId = rec.entity?.id ?? null
      const { error } = await args.supabase.from("org_tasks").insert({
        organization_id: args.organizationId,
        title,
        description,
        source_type: "ai_ops",
        source_id: sourceId,
        status: "open",
        due_date: null,
      })
      if (error) {
        return { ok: false, code: "insert_failed", message: error.message }
      }
      await logEvt(args, rec, "action_executed", "created", { task: true })
      return { ok: true, effect: { kind: "mutation", summary: "Follow-up task was created in your workspace." } }
    }

    case "create_workflow_automation": {
      if (!args.permissions.canManageAutomations) {
        return { ok: false, code: "forbidden", message: "You do not have permission to manage automations." }
      }
      const suggestion = buildAutomationSuggestion(rec)
      if (!suggestion) {
        return {
          ok: false,
          code: "no_suggestion",
          message: "No workflow template is mapped for this category yet.",
        }
      }
      const url = suggestionUrl(args.organizationId, suggestion)
      await logEvt(args, rec, "workflow_triggered", "navigation", { redirect: "/settings/automations" })
      return {
        ok: true,
        effect: {
          kind: "redirect",
          url,
          summary: "Opening the automation builder with a suggested trigger — review and save when ready.",
        },
      }
    }

    case "assign_technician": {
      if (!args.permissions.canEditWorkOrders) {
        return { ok: false, code: "forbidden", message: "You do not have permission to edit work orders." }
      }
      if (rec.entity?.type !== "work_order") {
        return { ok: false, code: "invalid_entity", message: "Assign technician applies to work order recommendations." }
      }
      const techId = args.payload?.technicianUserId?.trim()
      if (!techId) {
        return { ok: false, code: "invalid_payload", message: "Choose a technician to assign." }
      }
      const { error } = await args.supabase
        .from("work_orders")
        .update({ assigned_user_id: techId, updated_at: new Date().toISOString() })
        .eq("id", rec.entity.id)
        .eq("organization_id", args.organizationId)
      if (error) {
        return { ok: false, code: "update_failed", message: error.message }
      }
      await logEvt(args, rec, "action_executed", "assigned", { work_order_id: rec.entity.id })
      return { ok: true, effect: { kind: "mutation", summary: "Technician assignment was saved on the work order." } }
    }

    case "restock_inventory": {
      if (!args.permissions.canConsumePartsOnWorkOrders) {
        return { ok: false, code: "forbidden", message: "You do not have permission to log inventory requests." }
      }
      if (rec.entity?.type !== "inventory_stock") {
        return { ok: false, code: "invalid_entity", message: "Restock applies to low-stock inventory alerts." }
      }
      const { data: stock, error: stockErr } = await args.supabase
        .from("inventory_stock")
        .select("catalog_item_id, location_id")
        .eq("organization_id", args.organizationId)
        .eq("id", rec.entity.id)
        .maybeSingle()
      if (stockErr || !stock) {
        return { ok: false, code: "not_found", message: "Stock row could not be loaded." }
      }
      await insertLedger(args.supabase, {
        organization_id: args.organizationId,
        catalog_item_id: stock.catalog_item_id as string,
        location_id: stock.location_id as string,
        transaction_type: "reorder_recorded",
        quantity: 0,
        delta_on_hand: 0,
        delta_allocated: 0,
        notes: `AI Ops restock signal · ${rec.title}`.slice(0, 500),
        metadata: {
          restock_request: true,
          ai_ops: true,
        },
        created_by: args.userId,
      })
      await logEvt(args, rec, "action_executed", "recorded", { inventory: true })
      return {
        ok: true,
        effect: { kind: "mutation", summary: "Restock request was recorded on the inventory ledger." },
      }
    }

    case "release_certificate": {
      if (!args.permissions.canReleaseCertificatesToPortal) {
        return { ok: false, code: "forbidden", message: "You do not have permission to release certificates." }
      }
      if (rec.entity?.type !== "calibration_record") {
        return {
          ok: false,
          code: "invalid_entity",
          message: "Release applies to certificate recommendations.",
        }
      }
      const now = new Date().toISOString()
      const { error } = await args.supabase
        .from("calibration_records")
        .update({ portal_released_at: now })
        .eq("id", rec.entity.id)
        .eq("organization_id", args.organizationId)
      if (error) {
        return { ok: false, code: "update_failed", message: error.message }
      }
      await logEvt(args, rec, "action_executed", "released", { calibration_record_id: rec.entity.id })
      return {
        ok: true,
        effect: {
          kind: "mutation",
          summary: "Certificate was released to the customer portal.",
        },
      }
    }

    case "schedule_maintenance": {
      if (!args.permissions.canManageDispatch && !args.permissions.canEditWorkOrders) {
        return {
          ok: false,
          code: "forbidden",
          message: "You need dispatch or work-order edit access to schedule maintenance.",
        }
      }
      const q = new URLSearchParams({ new: "1" })
      if (rec.entity?.type === "equipment") q.set("equipmentId", rec.entity.id)
      if (rec.entity?.type === "customer") q.set("customerId", rec.entity.id)
      const url = `/maintenance-plans?${q.toString()}`
      await logEvt(args, rec, "workflow_triggered", "navigation", { maintenance: true })
      return {
        ok: true,
        effect: {
          kind: "redirect",
          url,
          summary: "Opening maintenance planning with context prefilled where possible.",
        },
      }
    }

    case "draft_prospect_followup": {
      if (!args.permissions.canManageProspects) {
        return { ok: false, code: "forbidden", message: "You do not have permission to manage prospects." }
      }
      if (rec.entity?.type !== "prospect") {
        return { ok: false, code: "invalid_entity", message: "Draft follow-up applies to prospect recommendations." }
      }
      await logEvt(args, rec, "action_executed", "draft_opened", { prospect_id: rec.entity.id })
      return {
        ok: true,
        effect: {
          kind: "client",
          action: "draft_followup",
          summary: "Opening the draft follow-up composer — nothing is sent until you approve there.",
        },
      }
    }
  }
}

async function deriveRecommendation(
  supabase: SupabaseClient,
  organizationId: string,
  permissions: OrgPermissions,
  recommendationKey: string,
): Promise<Recommendation | null> {
  const res = await generateRecommendations({
    supabase,
    organizationId,
    permissions,
    filter: {
      recommendationKey,
      includeDismissed: true,
      limit: 5,
    },
  })
  return res.items[0] ?? null
}

async function logEvt(
  args: {
    supabase: SupabaseClient
    organizationId: string
    userId: string
    recommendationKey: string
    action: OperationalActionId
  },
  rec: Recommendation,
  eventType: string,
  outcome: string,
  metadata: Record<string, unknown>,
) {
  await insertRecommendationEvent({
    supabase: args.supabase,
    organizationId: args.organizationId,
    recommendationKey: args.recommendationKey,
    category: rec.category as RecommendationCategory,
    eventType,
    actorUserId: args.userId,
    outcome,
    metadata: {
      ...metadata,
      action: args.action,
    },
  })
}
