import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { insertActionAuditLog } from "@/lib/aiden/actions/action-audit-log"
import { parseBulkInvoiceCompletedWorkOrdersPreviewFromPreparedAction } from "@/lib/aiden/prepared-actions/bulk-invoice-completed-work-orders-preview-parse"
import { fetchAidenOrgApprovalSettings } from "@/lib/aiden/actions/aiden-org-approval-settings-repository"
import type { AidenPreparedWorkspaceActionDefinition, AidenPreparedWorkspaceActionId } from "@/lib/aiden/actions/action-types"
import { AIDEN_PREPARED_WORKSPACE_ACTION_IDS } from "@/lib/aiden/actions/action-types"
import { isFinancialAidenAction } from "@/lib/aiden/actions/action-permissions"
import { getPreparedWorkspaceActionDefinition } from "@/lib/aiden/actions/action-registry"
import { isFinancialRiskLevel } from "@/lib/aiden/actions/action-risk"
import { normalizeOrgMemberRole, type OrgMemberRole, type OrgPermissions } from "@/lib/permissions/model"

function isPreparedWorkspaceActionIdLocal(id: string): id is AidenPreparedWorkspaceActionId {
  return (AIDEN_PREPARED_WORKSPACE_ACTION_IDS as readonly string[]).includes(id)
}

/**
 * Policy band derived from registry risk + mutation semantics (for approval gates).
 * Mirrors product tiers: read_only → bulk_financial_write.
 */
export type AidenPreparedActionApprovalPolicyBand =
  | "read_only"
  | "draft_content"
  | "operational_write"
  | "financial_draft"
  | "financial_write"
  | "bulk_financial_write"

export type PreparedActionApprovalMetrics = {
  /** Included bulk rows after exclusions; null when not a bulk preview. */
  bulkIncludedCount: number | null
  /** Dollar amount used against org thresholds (single draft total, bulk estimated total, payment due, etc.). */
  financialAmountDollars: number | null
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

export function getEffectiveApprovalPolicyBand(
  def: AidenPreparedWorkspaceActionDefinition,
): AidenPreparedActionApprovalPolicyBand {
  if (def.id === "bulk_invoice_completed_work_orders") return "bulk_financial_write"
  if (def.id === "create_invoice_from_work_order") return "financial_write"
  if (isFinancialRiskLevel(def.riskLevel) || def.touchesFinancialRecords) return "financial_draft"
  if (def.riskLevel === "read_only") return "read_only"
  if (def.riskLevel === "draft_content") return "draft_content"
  return "operational_write"
}

export function extractPreparedActionApprovalMetrics(
  actionId: AidenPreparedWorkspaceActionId,
  previewPayload: unknown,
): PreparedActionApprovalMetrics {
  if (!isRecord(previewPayload)) {
    return { bulkIncludedCount: null, financialAmountDollars: null }
  }

  if (actionId === "bulk_invoice_completed_work_orders") {
    const parsed = parseBulkInvoiceCompletedWorkOrdersPreviewFromPreparedAction(previewPayload)
    if (!parsed.ok) {
      return { bulkIncludedCount: null, financialAmountDollars: null }
    }
    return {
      bulkIncludedCount: parsed.preview.summary.includedCount,
      financialAmountDollars: parsed.preview.summary.estimatedTotal,
    }
  }

  const preview = previewPayload.preview
  if (!isRecord(preview)) {
    return { bulkIncludedCount: null, financialAmountDollars: null }
  }

  if (actionId === "create_invoice_from_work_order" || actionId === "create_quote_from_work_order") {
    const total = preview.total
    if (typeof total === "number" && Number.isFinite(total)) {
      return { bulkIncludedCount: null, financialAmountDollars: Math.round(total * 100) / 100 }
    }
  }

  if (actionId === "prepare_invoice_payment_link") {
    const cents = preview.amountDueCents
    if (typeof cents === "number" && Number.isFinite(cents)) {
      return { bulkIncludedCount: null, financialAmountDollars: Math.round((cents / 100) * 100) / 100 }
    }
  }

  if (actionId === "prepare_quickbooks_invoice_sync") {
    const inv = preview.invoice
    if (isRecord(inv)) {
      const cents = inv.amountCents
      if (typeof cents === "number" && Number.isFinite(cents)) {
        return { bulkIncludedCount: null, financialAmountDollars: Math.round((cents / 100) * 100) / 100 }
      }
    }
  }

  return { bulkIncludedCount: null, financialAmountDollars: null }
}

function isOwnerOrAdmin(role: OrgMemberRole | null): boolean {
  return role === "owner" || role === "admin"
}

function isOwnerAdminManager(role: OrgMemberRole | null): boolean {
  return role === "owner" || role === "admin" || role === "manager"
}

function hasFinancialDraftEditCapability(def: AidenPreparedWorkspaceActionDefinition, perms: OrgPermissions): boolean {
  const needsInv = def.requiredPermissions.includes("canEditInvoices")
  const needsQuo = def.requiredPermissions.includes("canEditQuotes")
  if (needsInv && !perms.canEditInvoices) return false
  if (needsQuo && !perms.canEditQuotes) return false
  return true
}

function isOrgFinancialAction(def: AidenPreparedWorkspaceActionDefinition): boolean {
  return isFinancialAidenAction(def)
}

export type PreparedActionApprovalEvaluation = {
  allowed: boolean
  /** Machine-oriented code for clients and audit. */
  blockedReasonCode?: string
  blockedMessage?: string
  effectivePolicyBand: AidenPreparedActionApprovalPolicyBand
  /** Human-readable bullets for UI. */
  whyApprovalRequired: string[]
  /** Short labels describing roles that may pass the gate. */
  whoCanApprove: string[]
  /** When true, product UI should treat confirmation as mandatory (not optional). */
  requiresStrictConfirmation: boolean
  /** Bulk phrase step remains product-controlled; true when bulk financial policy applies. */
  confirmationPhraseRecommended: boolean
  /** True when platform staff bypassed role / amount / org bulk gates (not financial kill-switch). */
  platformAdminBypass: boolean
  metrics: PreparedActionApprovalMetrics
}

function pushWhy(list: string[], line: string) {
  if (!list.includes(line)) list.push(line)
}

export function evaluatePreparedActionApproval(input: {
  definition: AidenPreparedWorkspaceActionDefinition
  settings: Omit<AidenOrgApprovalSettingsRow, "organization_id">
  permissions: OrgPermissions
  memberRoleRaw: string | null
  isPlatformAdmin: boolean
  previewPayload: unknown
}): PreparedActionApprovalEvaluation {
  const def = input.definition
  const band = getEffectiveApprovalPolicyBand(def)
  const role = normalizeOrgMemberRole(input.memberRoleRaw)
  const metrics = extractPreparedActionApprovalMetrics(def.id, input.previewPayload)
  const why: string[] = []
  const who: string[] = []
  let requiresStrictConfirmation = false
  let confirmationPhraseRecommended = false

  const base: PreparedActionApprovalEvaluation = {
    allowed: true,
    effectivePolicyBand: band,
    whyApprovalRequired: why,
    whoCanApprove: who,
    requiresStrictConfirmation,
    confirmationPhraseRecommended,
    platformAdminBypass: false,
    metrics,
  }

  if (input.isPlatformAdmin) {
    if (!input.settings.allow_financial_aiden_actions && isOrgFinancialAction(def)) {
      pushWhy(why, "This workspace disabled AIden actions that touch billing records.")
      return {
        ...base,
        allowed: false,
        blockedReasonCode: "financial_aiden_disabled",
        blockedMessage:
          "Financial AIden actions are disabled for this workspace. A workspace owner or admin can re-enable them in AIden approval settings.",
        whyApprovalRequired: [...why],
        whoCanApprove: ["Workspace owner or admin"],
      }
    }
    return {
      ...base,
      allowed: true,
      platformAdminBypass: true,
      whyApprovalRequired: [],
      whoCanApprove: ["Platform support (elevated)"],
    }
  }

  switch (band) {
    case "read_only":
      return { ...base, whyApprovalRequired: [], whoCanApprove: ["Any member who can prepare this action"] }
    case "draft_content":
      pushWhy(why, "Draft content actions can change customer-facing copy — review before saving.")
      requiresStrictConfirmation = false
      who.push("Members with permission to prepare this action")
      return { ...base, whyApprovalRequired: [...why], whoCanApprove: who, requiresStrictConfirmation }
    case "operational_write":
      pushWhy(why, "This action creates or updates operational records (tasks, visits, inventory signals, etc.).")
      requiresStrictConfirmation = true
      who.push("Members with permission to prepare this action")
      return { ...base, whyApprovalRequired: [...why], whoCanApprove: who, requiresStrictConfirmation }
    case "financial_draft":
    case "financial_write":
    case "bulk_financial_write":
      requiresStrictConfirmation = true
      break
    default:
      return base
  }

  if (!input.settings.allow_financial_aiden_actions && isOrgFinancialAction(def)) {
    pushWhy(why, "Workspace policy disabled AIden actions that touch billing or aggregate financial previews.")
    return {
      ...base,
      allowed: false,
      blockedReasonCode: "financial_aiden_disabled",
      blockedMessage:
        "Financial AIden actions are disabled for this workspace. Ask a workspace owner or admin to adjust AIden approval settings.",
      whyApprovalRequired: [...why],
      whoCanApprove: ["Workspace owner or admin"],
      requiresStrictConfirmation: true,
      confirmationPhraseRecommended: band === "bulk_financial_write",
    }
  }

  if (band === "financial_write") {
    pushWhy(why, "Creating a draft invoice from a work order updates billing records.")
    if (!input.permissions.canEditInvoices) {
      return {
        ...base,
        allowed: false,
        blockedReasonCode: "financial_permission",
        blockedMessage: "Editing invoices is required to confirm this action.",
        whyApprovalRequired: [...why],
        whoCanApprove: ["Members with invoice edit access"],
        requiresStrictConfirmation: true,
      }
    }
    who.push("Members with invoice edit access who can prepare this action")
  }

  if (band === "financial_draft") {
    pushWhy(why, "This action touches quotes, invoices, payment links, or accounting sync previews.")
    if (!hasFinancialDraftEditCapability(def, input.permissions)) {
      return {
        ...base,
        allowed: false,
        blockedReasonCode: "financial_permission",
        blockedMessage: "You need the relevant billing permissions (quotes and/or invoices) to confirm this action.",
        whyApprovalRequired: [...why],
        whoCanApprove: ["Members with the billing permissions required for this action"],
        requiresStrictConfirmation: true,
      }
    }
    who.push("Members with the required billing permissions")
  }

  const maxAmt = input.settings.max_financial_action_amount_without_owner_approval
  const amount = metrics.financialAmountDollars
  const amountExceedsOwnerCap =
    maxAmt !== null && maxAmt !== undefined && amount !== null && amount > Number(maxAmt)

  if (band === "bulk_financial_write") {
    confirmationPhraseRecommended = true
    pushWhy(why, "Bulk draft invoices affect many work orders at once.")
    if (!isOwnerAdminManager(role)) {
      return {
        ...base,
        allowed: false,
        blockedReasonCode: "role_not_eligible",
        blockedMessage: "Only workspace owners, admins, or managers can approve bulk billing actions.",
        whyApprovalRequired: [...why],
        whoCanApprove: ["Workspace owner, admin, or manager"],
        requiresStrictConfirmation: true,
        confirmationPhraseRecommended: true,
        metrics,
      }
    }
    if (input.settings.require_owner_approval_for_bulk_financial_actions && !isOwnerOrAdmin(role)) {
      pushWhy(why, "Workspace policy requires an owner or admin to approve bulk billing actions.")
      return {
        ...base,
        allowed: false,
        blockedReasonCode: "bulk_requires_owner_admin",
        blockedMessage: "This workspace requires an owner or admin to run bulk invoice preparation.",
        whyApprovalRequired: [...why],
        whoCanApprove: ["Workspace owner or admin"],
        requiresStrictConfirmation: true,
        confirmationPhraseRecommended: true,
        metrics,
      }
    }
    const maxBulk = input.settings.max_bulk_action_count
    const cnt = metrics.bulkIncludedCount
    if (maxBulk !== null && cnt !== null && cnt > maxBulk) {
      return {
        ...base,
        allowed: false,
        blockedReasonCode: "bulk_count_exceeded",
        blockedMessage: `Bulk draft is limited to ${maxBulk} included work orders for this workspace (preview has ${cnt}).`,
        whyApprovalRequired: [...why, `Included work orders exceed the workspace limit (${maxBulk}).`],
        whoCanApprove: ["Workspace owner or admin (to raise the limit)"],
        requiresStrictConfirmation: true,
        confirmationPhraseRecommended: true,
        metrics,
      }
    }
    if (amountExceedsOwnerCap) {
      pushWhy(
        why,
        `Estimated draft total ($${amount?.toFixed(2)}) exceeds the workspace threshold ($${Number(maxAmt).toFixed(2)}) without owner or admin approval.`,
      )
      if (!isOwnerOrAdmin(role)) {
        return {
          ...base,
          allowed: false,
          blockedReasonCode: "amount_requires_owner_approval",
          blockedMessage: "Estimated total is above the amount that managers may approve for bulk billing.",
          whyApprovalRequired: [...why],
          whoCanApprove: ["Workspace owner or admin"],
          requiresStrictConfirmation: true,
          confirmationPhraseRecommended: true,
          metrics,
        }
      }
    }
    who.length = 0
    who.push("Workspace owner, admin, or manager (subject to workspace caps)")
    return {
      ...base,
      allowed: true,
      whyApprovalRequired: [...why],
      whoCanApprove: who,
      requiresStrictConfirmation: true,
      confirmationPhraseRecommended: true,
      metrics,
    }
  }

  if ((band === "financial_write" || band === "financial_draft") && amountExceedsOwnerCap) {
    pushWhy(
      why,
      `This preview’s dollar amount ($${amount?.toFixed(2)}) is above the workspace threshold ($${Number(maxAmt).toFixed(2)}) for non-owner/admin approvers.`,
    )
    if (!isOwnerOrAdmin(role)) {
      return {
        ...base,
        allowed: false,
        blockedReasonCode: "amount_requires_owner_approval",
        blockedMessage: "Amount exceeds the limit managers may approve for this workspace.",
        whyApprovalRequired: [...why],
        whoCanApprove: ["Workspace owner or admin"],
        requiresStrictConfirmation: true,
        metrics,
      }
    }
  }

  if (who.length === 0) {
    who.push("Members with permission to prepare this action")
  }

  return {
    ...base,
    allowed: true,
    whyApprovalRequired: [...why],
    whoCanApprove: who,
    requiresStrictConfirmation: true,
    metrics,
  }
}

function unknownActionEvaluation(): PreparedActionApprovalEvaluation {
  return {
    allowed: false,
    blockedReasonCode: "unknown_action",
    blockedMessage: "Unknown prepared workspace action.",
    effectivePolicyBand: "operational_write",
    whyApprovalRequired: [],
    whoCanApprove: [],
    requiresStrictConfirmation: true,
    confirmationPhraseRecommended: false,
    platformAdminBypass: false,
    metrics: { bulkIncludedCount: null, financialAmountDollars: null },
  }
}

export async function loadPreparedActionApprovalEvaluation(
  client: SupabaseClient,
  input: {
    organizationId: string
    memberRoleRaw: string | null
    isPlatformAdmin: boolean
    permissions: OrgPermissions
    row: AidenPreparedActionRow
  },
): Promise<{ evaluation: PreparedActionApprovalEvaluation | null; error: Error | null }> {
  if (!isPreparedWorkspaceActionIdLocal(input.row.action_id)) {
    return { evaluation: unknownActionEvaluation(), error: null }
  }
  const def = getPreparedWorkspaceActionDefinition(input.row.action_id)
  if (!def) {
    return { evaluation: unknownActionEvaluation(), error: null }
  }
  const loaded = await fetchAidenOrgApprovalSettings(client, input.organizationId)
  if (loaded.error || !loaded.data) {
    return { evaluation: null, error: loaded.error ?? new Error("Missing approval policy settings.") }
  }
  return {
    evaluation: evaluatePreparedActionApproval({
      definition: def,
      settings: loaded.data,
      permissions: input.permissions,
      memberRoleRaw: input.memberRoleRaw,
      isPlatformAdmin: input.isPlatformAdmin,
      previewPayload: input.row.preview_payload,
    }),
    error: null,
  }
}

export type SerializedPreparedActionApproval = {
  allowed: boolean
  blockedReasonCode?: string
  blockedMessage?: string
  effectivePolicyBand: AidenPreparedActionApprovalPolicyBand
  whyApprovalRequired: string[]
  whoCanApprove: string[]
  requiresStrictConfirmation: boolean
  confirmationPhraseRecommended: boolean
  platformAdminBypass: boolean
  metrics: PreparedActionApprovalMetrics
}

export function serializePreparedActionApproval(evaluation: PreparedActionApprovalEvaluation): SerializedPreparedActionApproval {
  return {
    allowed: evaluation.allowed,
    blockedReasonCode: evaluation.blockedReasonCode,
    blockedMessage: evaluation.blockedMessage,
    effectivePolicyBand: evaluation.effectivePolicyBand,
    whyApprovalRequired: evaluation.whyApprovalRequired,
    whoCanApprove: evaluation.whoCanApprove,
    requiresStrictConfirmation: evaluation.requiresStrictConfirmation,
    confirmationPhraseRecommended: evaluation.confirmationPhraseRecommended,
    platformAdminBypass: evaluation.platformAdminBypass,
    metrics: evaluation.metrics,
  }
}

export async function enforcePreparedActionApproval(args: {
  supabase: SupabaseClient
  svc: SupabaseClient
  organizationId: string
  preparedActionId: string
  actorUserId: string
  actionId: string
  memberRoleRaw: string | null
  isPlatformAdmin: boolean
  permissions: OrgPermissions
  row: AidenPreparedActionRow
  decisionPhase: "confirm" | "execute"
}): Promise<
  | { ok: true; evaluation: PreparedActionApprovalEvaluation }
  | { ok: false; response: NextResponse }
> {
  const loaded = await loadPreparedActionApprovalEvaluation(args.supabase, {
    organizationId: args.organizationId,
    memberRoleRaw: args.memberRoleRaw,
    isPlatformAdmin: args.isPlatformAdmin,
    permissions: args.permissions,
    row: args.row,
  })
  if (loaded.error || !loaded.evaluation) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "approval_settings_unavailable",
          message: loaded.error?.message ?? "Could not load approval policy.",
        },
        { status: 500 },
      ),
    }
  }
  const evaluation = loaded.evaluation
  if (!evaluation.allowed) {
    const audit = await insertActionAuditLog(args.svc, {
      organization_id: args.organizationId,
      prepared_action_id: args.preparedActionId,
      actor_user_id: args.actorUserId,
      event_type: "prepared_action_approval_denied",
      action_id: args.actionId,
      details: {
        approval: serializePreparedActionApproval(evaluation),
        decisionPhase: args.decisionPhase,
      },
    })
    if (audit.error) {
      return {
        ok: false,
        response: NextResponse.json({ error: "audit_failed", message: audit.error.message }, { status: 500 }),
      }
    }
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "approval_denied",
          message: evaluation.blockedMessage ?? "Approval policy blocked this action.",
          approval: serializePreparedActionApproval(evaluation),
        },
        { status: 403 },
      ),
    }
  }
  const auditPass = await insertActionAuditLog(args.svc, {
    organization_id: args.organizationId,
    prepared_action_id: args.preparedActionId,
    actor_user_id: args.actorUserId,
    event_type: "prepared_action_approval_passed",
    action_id: args.actionId,
    details: {
      approval: serializePreparedActionApproval(evaluation),
      decisionPhase: args.decisionPhase,
    },
  })
  if (auditPass.error) {
    return {
      ok: false,
      response: NextResponse.json({ error: "audit_failed", message: auditPass.error.message }, { status: 500 }),
    }
  }
  return { ok: true, evaluation }
}
