import { NextResponse } from "next/server"

import { requireOrgMemberSessionFromRequest } from "@/lib/api/require-org-permission"
import { requireFeatureAccess } from "@/lib/billing/server-guard"
import { logCustomerBusinessCardScanAudit } from "@/lib/customers/customer-business-card-scan-audit"
import { isDemoWorkspaceOrganization } from "@/lib/demo-workspace/is-demo-workspace-organization"
import { extractProspectFieldsFromBusinessCardUpload } from "@/lib/prospects/prospect-business-card-scan"

export const runtime = "nodejs"
export const maxDuration = 120

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Matches `customers_insert_owner_admin_manager` RLS — same roles as customer create. */
const CUSTOMER_BUSINESS_CARD_SCAN_ROLES = new Set(["owner", "admin", "manager"])

function jsonFailure(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status })
}

/**
 * POST /api/organizations/{org}/customers/business-card-scan
 *
 * Multipart business card image upload for AI customer field extraction.
 * Body: `multipart/form-data` with field `file` (jpg/jpeg/png/heic, max 10MB).
 *
 * Thin wrapper over the shared prospect extraction pipeline — no duplicated AI logic.
 * - No image or OCR persistence.
 * - Owner/admin/manager only (customer create roles).
 * - Growth+ AI entitlement.
 * - Demo workspace blocked.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const started = Date.now()
  const { organizationId } = await context.params

  if (!UUID_RE.test(organizationId)) {
    return jsonFailure("bad_request", "Invalid workspace identifier.", 400)
  }

  const session = await requireOrgMemberSessionFromRequest(request, organizationId)
  if ("error" in session) return session.error

  const { supabase, userId, role, isPlatformAdmin } = session

  if (
    !isPlatformAdmin &&
    (!role || !CUSTOMER_BUSINESS_CARD_SCAN_ROLES.has(role.trim().toLowerCase()))
  ) {
    await logCustomerBusinessCardScanAudit({
      supabase,
      organizationId,
      userId,
      success: false,
      failureReason: "forbidden",
      durationMs: Date.now() - started,
    })
    return jsonFailure(
      "forbidden",
      "Only owners, admins, and managers can scan business cards for customers.",
      403,
    )
  }

  if (await isDemoWorkspaceOrganization(supabase, organizationId)) {
    await logCustomerBusinessCardScanAudit({
      supabase,
      organizationId,
      userId,
      success: false,
      failureReason: "demo_mode_blocked",
      durationMs: Date.now() - started,
    })
    return jsonFailure(
      "demo_mode_blocked",
      "Business card scanning is unavailable in demo mode. Sign in with a live workspace to use AI customer tools.",
      403,
    )
  }

  if (!isPlatformAdmin) {
    const planGate = await requireFeatureAccess(supabase, organizationId, "ai")
    if (!planGate.ok) {
      await logCustomerBusinessCardScanAudit({
        supabase,
        organizationId,
        userId,
        success: false,
        failureReason: "NO_AI_ACCESS",
        durationMs: Date.now() - started,
      })
      return jsonFailure(
        "NO_AI_ACCESS",
        "Business card scanning is available on Growth, Scale, and Enterprise plans. Upgrade in billing to unlock AI customer tools.",
        planGate.httpStatus,
      )
    }
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    await logCustomerBusinessCardScanAudit({
      supabase,
      organizationId,
      userId,
      success: false,
      failureReason: "multipart_parse_failed",
      durationMs: Date.now() - started,
    })
    return jsonFailure(
      "UNSUPPORTED_FILE",
      "Could not read the upload. The file may be too large or the connection was interrupted.",
      400,
    )
  }

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    await logCustomerBusinessCardScanAudit({
      supabase,
      organizationId,
      userId,
      success: false,
      failureReason: "missing_file",
      durationMs: Date.now() - started,
    })
    return jsonFailure("UNSUPPORTED_FILE", "Please choose an image to upload.", 400)
  }

  let buffer: Buffer
  try {
    buffer = Buffer.from(await file.arrayBuffer())
  } catch {
    await logCustomerBusinessCardScanAudit({
      supabase,
      organizationId,
      userId,
      success: false,
      failureReason: "buffer_read_failed",
      durationMs: Date.now() - started,
    })
    return jsonFailure("INVALID_IMAGE", "Could not read the uploaded image.", 400)
  }

  const result = await extractProspectFieldsFromBusinessCardUpload({
    organizationId,
    buffer,
    fileName: file.name || "business-card.jpg",
  })

  await logCustomerBusinessCardScanAudit({
    supabase,
    organizationId,
    userId,
    success: result.ok,
    failureReason: result.ok ? null : result.code,
    durationMs: Date.now() - started,
  })

  if (!result.ok) {
    const status =
      result.code === "NO_AI_ACCESS"
        ? 403
        : result.code === "RATE_LIMITED"
          ? 429
          : result.code === "AI_UNAVAILABLE"
            ? 503
            : 400
    return jsonFailure(result.code, result.message, status)
  }

  return NextResponse.json({ ok: true, fields: result.fields })
}
