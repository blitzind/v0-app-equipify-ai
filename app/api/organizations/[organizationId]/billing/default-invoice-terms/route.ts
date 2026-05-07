/**
 * Invoicing Phase 3 — Workspace default invoice terms.
 *
 * GET  → returns the organization's stored default terms code (or null when
 *        not configured; the UI applies the Net 30 fallback).
 * PATCH → owners + admins (canEditOrgBilling) update the workspace default.
 *
 * Schema-drift safe: Phase 1 added `organizations.default_invoice_terms_code`.
 */

import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getOrganizationMemberRole } from "@/lib/api/org-role"
import {
  getOrgPermissionsForRole,
  normalizeOrgMemberRole,
} from "@/lib/permissions/model"
import { INVOICE_TERMS_CODES } from "@/lib/billing/invoice-terms"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function canEditBilling(role: string | null): boolean {
  return getOrgPermissionsForRole(normalizeOrgMemberRole(role)).canEditOrgBilling
}

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return jsonError("Unauthorized.", 401)

  const role = await getOrganizationMemberRole(supabase, user.id, organizationId)
  if (!role) return jsonError("Forbidden.", 403)

  const { data, error } = await supabase
    .from("organizations")
    .select("default_invoice_terms_code")
    .eq("id", organizationId)
    .maybeSingle()

  if (error) {
    // Schema-drift: column not yet added; treat as unset rather than failing.
    if (/default_invoice_terms_code/i.test(error.message)) {
      return NextResponse.json({ default_invoice_terms_code: null, schemaMigrationPending: true })
    }
    return jsonError(error.message, 500)
  }

  const code =
    (data as { default_invoice_terms_code?: string | null } | null)?.default_invoice_terms_code ?? null
  return NextResponse.json({ default_invoice_terms_code: code, schemaMigrationPending: false })
}

export async function PATCH(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return jsonError("Unauthorized.", 401)

  const role = await getOrganizationMemberRole(supabase, user.id, organizationId)
  if (!canEditBilling(role)) {
    return jsonError("Only owners and admins can change billing defaults.", 403)
  }

  let body: { default_invoice_terms_code?: unknown }
  try {
    body = (await request.json()) as { default_invoice_terms_code?: unknown }
  } catch {
    return jsonError("Invalid JSON body.", 400)
  }

  const raw = body.default_invoice_terms_code
  let code: string | null
  if (raw === null || raw === "" || raw === undefined) {
    code = null
  } else if (typeof raw === "string" && (INVOICE_TERMS_CODES as readonly string[]).includes(raw.trim())) {
    code = raw.trim()
    if (code === "custom") {
      // Custom requires per-invoice days; not allowed as workspace default.
      return jsonError("Custom terms cannot be set as a workspace default.", 400)
    }
  } else {
    return jsonError("Invalid default_invoice_terms_code.", 400)
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      default_invoice_terms_code: code,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId)

  if (error) {
    if (/default_invoice_terms_code/i.test(error.message)) {
      return jsonError(
        "Workspace billing terms not enabled in this database — apply migration 20260719120000_service_lifecycle_phase1.sql.",
        409,
      )
    }
    return jsonError(error.message, 500)
  }

  return NextResponse.json({ ok: true, default_invoice_terms_code: code })
}
