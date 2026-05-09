import "server-only"

import { NextResponse } from "next/server"
import type { PlanId } from "@/lib/plans"
import { canUseAidenCapability } from "@/lib/aiden/tier-capabilities"
import { canAccessApp } from "@/lib/billing/access"
import { getEffectivePlanId } from "@/lib/billing/effective-plan"
import { getOrganizationSubscription } from "@/lib/billing/subscriptions"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import {
  canAccessAssignedWorkResource,
  isAssignedWorkOnly,
  loadAssignedWorkScope,
  type AssignedWorkScope,
} from "@/lib/permissions/technician-scope"
import type { OrgPermissions } from "@/lib/permissions/model"
import { PRODUCTIVITY_PLAN_MESSAGE } from "@/lib/aiden/productivity-messages"

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: code, message }, { status })
}

export type ProductivityRequestContext = {
  userId: string
  organizationId: string
  planId: PlanId
  permissions: OrgPermissions
  supabase: import("@supabase/supabase-js").SupabaseClient
  assignedScope: AssignedWorkScope | null
}

/**
 * Shared gate for AIden productivity routes: membership, view-work permission, billing, Growth+ plan.
 */
export async function resolveProductivityRequest(
  organizationId: string,
): Promise<{ ok: true; ctx: ProductivityRequestContext } | { ok: false; response: NextResponse }> {
  const gate = await requireAnyOrgPermission(organizationId, [
    "canViewAllWorkOrders",
    "canViewAssignedWorkOrdersOnly",
  ])
  if ("error" in gate) {
    return { ok: false, response: gate.error }
  }

  const subscription = await getOrganizationSubscription(gate.supabase, organizationId)
  if (!canAccessApp(subscription)) {
    return {
      ok: false,
      response: jsonError(
        "billing_inactive",
        "AIden productivity is unavailable while billing is restricted for this workspace.",
        403,
      ),
    }
  }

  const planId = getEffectivePlanId(subscription?.plan_id ?? "solo", subscription)
  if (!canUseAidenCapability(planId, "productivity_ai")) {
    return {
      ok: false,
      response: jsonError("plan_required", PRODUCTIVITY_PLAN_MESSAGE, 403),
    }
  }

  let assignedScope: AssignedWorkScope | null = null
  if (isAssignedWorkOnly(gate.permissions)) {
    assignedScope = await loadAssignedWorkScope(gate.supabase, {
      organizationId,
      userId: gate.userId,
    })
  }

  return {
    ok: true,
    ctx: {
      userId: gate.userId,
      organizationId,
      planId,
      permissions: gate.permissions,
      supabase: gate.supabase,
      assignedScope,
    },
  }
}

export async function assertCustomerProductivityAccess(
  ctx: ProductivityRequestContext,
  customerId: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (!isAssignedWorkOnly(ctx.permissions)) {
    return { ok: true }
  }
  const scope = ctx.assignedScope
  if (!scope?.customerIds.includes(customerId)) {
    return { ok: false, response: jsonError("not_found", "Customer not found.", 404) }
  }
  return { ok: true }
}

export async function assertWorkOrderProductivityAccess(
  ctx: ProductivityRequestContext,
  workOrderId: string,
): Promise<{ ok: true; customerId: string | null } | { ok: false; response: NextResponse }> {
  const { data: row } = await ctx.supabase
    .from("work_orders")
    .select("id, customer_id")
    .eq("id", workOrderId)
    .eq("organization_id", ctx.organizationId)
    .is("archived_at", null)
    .maybeSingle()

  if (!row) {
    return { ok: false, response: jsonError("not_found", "Work order not found.", 404) }
  }

  const customerId = (row as { customer_id?: string | null }).customer_id ?? null

  const allowed = await canAccessAssignedWorkResource(ctx.supabase, {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    permissions: ctx.permissions,
    resource: { workOrderId, customerId: customerId ?? undefined },
  })

  if (!allowed) {
    return { ok: false, response: jsonError("not_found", "Work order not found.", 404) }
  }

  return { ok: true, customerId }
}
