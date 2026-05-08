import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { pickPreferredDocumentLogoUrl } from "@/lib/organization/document-branding"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Public-safe workspace branding for portal login when `organizationId` is known
 * (optional query param). Does not expose secrets — only org display name + logo URLs
 * already stored for workspace branding.
 */
export async function GET(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId")?.trim() ?? ""
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization" }, { status: 400 })
  }

  let svc: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }

  const { data: row, error } = await svc
    .from("organizations")
    .select("name, logo_url, document_logo_url, status")
    .eq("id", organizationId)
    .maybeSingle()

  if (error || !row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  if ((row as { status?: string }).status === "archived") {
    return NextResponse.json({ error: "unavailable" }, { status: 404 })
  }

  const name = String((row as { name?: string }).name ?? "").trim() || "Service provider"
  const docLogo = (row as { document_logo_url?: string | null }).document_logo_url
  const appLogo = (row as { logo_url?: string | null }).logo_url

  const branding = pickPreferredDocumentLogoUrl(
    docLogo != null ? String(docLogo) : null,
    appLogo != null ? String(appLogo) : null,
  )

  return NextResponse.json({
    organizationName: name,
    logoUrl: branding,
  })
}
