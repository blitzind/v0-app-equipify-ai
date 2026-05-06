import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import type { PlanId } from "@/lib/plans"
import {
  ORGANIZATION_LOGOS_BUCKET,
  pathFromOrganizationLogoPublicUrl,
} from "@/lib/organization/logo-storage"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const DATE_FORMATS = new Set(["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"])
const CURRENCIES = new Set(["USD", "EUR", "GBP", "CAD", "AUD"])
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function planAllowsBranding(planId: PlanId): boolean {
  return planId === "growth" || planId === "scale"
}

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: code, message }, { status })
}

type OrgRow = {
  id: string
  name: string
  slug: string
  status: string
  company_email: string | null
  company_phone: string | null
  company_website: string | null
  company_address: string | null
  timezone: string | null
  date_format: string | null
  currency: string | null
  logo_url: string | null
  primary_color: string | null
  secondary_brand_color: string | null
  white_label_settings: Record<string, unknown> | null
}

function serializeOrg(row: OrgRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    companyEmail: row.company_email ?? "",
    companyPhone: row.company_phone ?? "",
    companyWebsite: row.company_website ?? "",
    companyAddress: row.company_address ?? "",
    timezone: row.timezone ?? "America/New_York",
    dateFormat: row.date_format ?? "MM/DD/YYYY",
    currency: row.currency ?? "USD",
    logoUrl: row.logo_url ?? "",
    primaryColor: row.primary_color ?? "#2563eb",
    secondaryBrandColor: row.secondary_brand_color ?? "",
    whiteLabelSettings: row.white_label_settings ?? {},
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return jsonError("invalid_organization", "Invalid organization.", 400)
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    return jsonError("unauthorized", "Sign in required.", 401)
  }

  const platformAdmin = isPlatformAdminEmail(user.email)
  let org: OrgRow | null = null
  let memberRole: string | null = null

  if (!platformAdmin) {
    const { data: mem } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
    if (!mem) {
      return jsonError("forbidden", "You are not a member of this organization.", 403)
    }
    memberRole = mem.role as string

    const { data: o, error } = await supabase
      .from("organizations")
      .select(
        "id, name, slug, status, company_email, company_phone, company_website, company_address, timezone, date_format, currency, logo_url, primary_color, secondary_brand_color, white_label_settings",
      )
      .eq("id", organizationId)
      .maybeSingle()
    if (error) {
      return jsonError("load_failed", error.message, 500)
    }
    org = o as OrgRow | null
  } else {
    const svc = createServiceRoleClient()
    if (!svc) {
      return jsonError("service_unavailable", "Server configuration error.", 503)
    }
    const { data: o, error } = await svc
      .from("organizations")
      .select(
        "id, name, slug, status, company_email, company_phone, company_website, company_address, timezone, date_format, currency, logo_url, primary_color, secondary_brand_color, white_label_settings",
      )
      .eq("id", organizationId)
      .maybeSingle()
    if (error) {
      return jsonError("load_failed", error.message, 500)
    }
    org = o as OrgRow | null
    memberRole = "owner"
  }

  if (!org) {
    return jsonError("not_found", "Organization not found.", 404)
  }

  const subClient = platformAdmin ? createServiceRoleClient() : null
  const client = subClient ?? supabase
  const { data: sub } = await client
    .from("organization_subscriptions")
    .select("plan_id")
    .eq("organization_id", organizationId)
    .maybeSingle()

  const planId = normalizePlanIdForRead((sub as { plan_id?: string } | null)?.plan_id ?? "solo")
  const canEdit = platformAdmin || memberRole === "owner" || memberRole === "admin"

  return NextResponse.json({
    organization: serializeOrg(org),
    planId,
    brandingAllowed: planAllowsBranding(planId),
    canEdit,
  })
}

type PatchBody = {
  name?: string
  companyEmail?: string
  companyPhone?: string
  companyWebsite?: string
  companyAddress?: string
  timezone?: string
  dateFormat?: string
  currency?: string
  primaryColor?: string
  logoUrl?: string | null
  whiteLabelSettings?: Record<string, unknown>
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return jsonError("invalid_organization", "Invalid organization.", 400)
  }

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return jsonError("invalid_json", "Invalid request body.", 400)
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    return jsonError("unauthorized", "Sign in required.", 401)
  }

  const platformAdmin = isPlatformAdminEmail(user.email)

  if (!platformAdmin) {
    const { data: mem } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
    if (!mem || (mem.role !== "owner" && mem.role !== "admin")) {
      return jsonError("forbidden", "Only owners and admins can update workspace settings.", 403)
    }
  }

  const admin = createServiceRoleClient()
  if (platformAdmin && !admin) {
    return jsonError("service_unavailable", "Server configuration error.", 503)
  }
  const readClient = platformAdmin ? admin! : supabase
  const writeClient = platformAdmin ? admin! : supabase

  const { data: orgBefore, error: loadErr } = await readClient
    .from("organizations")
    .select("id, status, slug, logo_url")
    .eq("id", organizationId)
    .maybeSingle()

  if (loadErr || !orgBefore) {
    return jsonError("not_found", "Organization not found.", 404)
  }

  if ((orgBefore as { status?: string }).status === "archived") {
    return jsonError("org_archived", "This workspace is archived and cannot be edited.", 403)
  }

  const { data: sub } = await readClient
    .from("organization_subscriptions")
    .select("plan_id")
    .eq("organization_id", organizationId)
    .maybeSingle()

  const planId = normalizePlanIdForRead((sub as { plan_id?: string } | null)?.plan_id ?? "solo")
  const brandingOk = planAllowsBranding(planId)

  const patch: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const n = String(body.name).trim()
    if (n.length < 1 || n.length > 200) {
      return jsonError("invalid_name", "Workspace name must be 1–200 characters.", 400)
    }
    patch.name = n
  }

  if (body.companyEmail !== undefined) {
    const e = String(body.companyEmail).trim()
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      return jsonError("invalid_email", "Enter a valid company email or leave blank.", 400)
    }
    patch.company_email = e || null
  }

  if (body.companyPhone !== undefined) {
    patch.company_phone = String(body.companyPhone).trim() || null
  }

  if (body.companyWebsite !== undefined) {
    const w = String(body.companyWebsite).trim()
    if (w) {
      try {
        const u = new URL(w.includes("://") ? w : `https://${w}`)
        if (!["http:", "https:"].includes(u.protocol)) {
          return jsonError("invalid_website", "Website must use http or https.", 400)
        }
        patch.company_website = u.toString()
      } catch {
        return jsonError("invalid_website", "Enter a valid website URL or leave blank.", 400)
      }
    } else {
      patch.company_website = null
    }
  }

  if (body.companyAddress !== undefined) {
    patch.company_address = String(body.companyAddress).trim() || null
  }

  if (body.timezone !== undefined) {
    const tz = String(body.timezone).trim()
    if (!tz || tz.length > 64) {
      return jsonError("invalid_timezone", "Invalid timezone.", 400)
    }
    patch.timezone = tz
  }

  if (body.dateFormat !== undefined) {
    const df = String(body.dateFormat).trim()
    if (!DATE_FORMATS.has(df)) {
      return jsonError("invalid_date_format", "Invalid date format.", 400)
    }
    patch.date_format = df
  }

  if (body.currency !== undefined) {
    const c = String(body.currency).trim().toUpperCase()
    if (!CURRENCIES.has(c)) {
      return jsonError("invalid_currency", "Unsupported currency.", 400)
    }
    patch.currency = c
  }

  if (body.primaryColor !== undefined) {
    if (!brandingOk) {
      return jsonError("plan_branding", "Brand color is available on Growth and Scale plans.", 403)
    }
    const c = String(body.primaryColor).trim()
    if (!HEX_COLOR.test(c)) {
      return jsonError("invalid_color", "Use a valid hex color (e.g. #2563eb).", 400)
    }
    patch.primary_color = c
  }

  if (body.logoUrl !== undefined) {
    if (!brandingOk) {
      return jsonError("plan_branding", "Custom logo is available on Growth and Scale plans.", 403)
    }
    if (body.logoUrl === null || body.logoUrl === "") {
      patch.logo_url = null
    } else {
      const url = String(body.logoUrl).trim()
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return jsonError("invalid_logo_url", "Logo URL must be an http(s) URL.", 400)
      }
      patch.logo_url = url
    }
  }

  if (body.whiteLabelSettings !== undefined) {
    if (!brandingOk) {
      return jsonError("plan_branding", "White-label settings require Growth or Scale.", 403)
    }
    const o = body.whiteLabelSettings
    if (o === null || typeof o !== "object" || Array.isArray(o)) {
      return jsonError("invalid_settings", "whiteLabelSettings must be an object.", 400)
    }
    patch.white_label_settings = o
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, unchanged: true })
  }

  patch.updated_at = new Date().toISOString()

  const { data: updated, error: upErr } = await writeClient
    .from("organizations")
    .update(patch)
    .eq("id", organizationId)
    .select(
      "id, name, slug, status, company_email, company_phone, company_website, company_address, timezone, date_format, currency, logo_url, primary_color, secondary_brand_color, white_label_settings",
    )
    .single()

  if (upErr) {
    return jsonError("update_failed", upErr.message, 400)
  }

  if (body.logoUrl !== undefined && (body.logoUrl === null || body.logoUrl === "")) {
    const prevPath = pathFromOrganizationLogoPublicUrl(
      (orgBefore as { logo_url?: string | null }).logo_url,
    )
    if (prevPath) {
      await writeClient.storage.from(ORGANIZATION_LOGOS_BUCKET).remove([prevPath])
    }
  }

  return NextResponse.json({
    ok: true,
    organization: serializeOrg(updated as OrgRow),
    planId,
    brandingAllowed: brandingOk,
  })
}
