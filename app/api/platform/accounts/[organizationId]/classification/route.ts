import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin"
import {
  buildOrganizationMetricsClassificationPatch,
  mapOrganizationMetricsClassificationFromRow,
  parseOrganizationAccountType,
} from "@/lib/platform/platform-metrics-organizations"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization id." }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email || !isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ error: "forbidden", message: "Platform admin access required." }, { status: 403 })
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_config", message: "Server is not configured." }, { status: 503 })
  }

  const { data: org, error } = await admin
    .from("organizations")
    .select(
      "id, name, slug, status, account_type, exclude_from_platform_metrics, exclusion_reason, excluded_at, excluded_by",
    )
    .eq("id", organizationId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 })
  }
  if (!org) {
    return NextResponse.json({ error: "not_found", message: "Organization not found." }, { status: 404 })
  }

  const classification = mapOrganizationMetricsClassificationFromRow(org)

  return NextResponse.json({
    ok: true,
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
    },
    classification,
  })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization id." }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email || !isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ error: "forbidden", message: "Platform admin access required." }, { status: 403 })
  }

  let json: Record<string, unknown>
  try {
    json = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Invalid JSON." }, { status: 400 })
  }

  const accountTypeRaw = json.accountType ?? json.account_type
  const accountType = parseOrganizationAccountType(accountTypeRaw)
  if (!accountType) {
    return NextResponse.json(
      {
        error: "invalid_account_type",
        message: "accountType must be customer, demo, internal, test, or unbillable.",
      },
      { status: 400 },
    )
  }

  const exclusionReasonRaw = json.exclusionReason ?? json.exclusion_reason
  const exclusionReason =
    exclusionReasonRaw == null || String(exclusionReasonRaw).trim() === ""
      ? null
      : String(exclusionReasonRaw).trim()

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_config", message: "Server is not configured." }, { status: 503 })
  }

  const patch = buildOrganizationMetricsClassificationPatch({
    accountType,
    exclusionReason,
    excludedByUserId: user.id,
  })

  const { data: updated, error } = await admin
    .from("organizations")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId)
    .select(
      "id, name, slug, status, account_type, exclude_from_platform_metrics, exclusion_reason, excluded_at, excluded_by",
    )
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: "update_failed", message: error.message }, { status: 400 })
  }
  if (!updated) {
    return NextResponse.json({ error: "not_found", message: "Organization not found." }, { status: 404 })
  }

  try {
    await admin.from("platform_admin_audit_events").insert({
      action: "organization_metrics_classification_updated",
      organization_id: organizationId,
      admin_user_id: user.id,
      metadata: {
        account_type: accountType,
        exclude_from_platform_metrics: patch.exclude_from_platform_metrics,
        exclusion_reason: patch.exclusion_reason,
      },
    })
  } catch {
    /* audit best-effort */
  }

  return NextResponse.json({
    ok: true,
    classification: mapOrganizationMetricsClassificationFromRow(updated),
  })
}
