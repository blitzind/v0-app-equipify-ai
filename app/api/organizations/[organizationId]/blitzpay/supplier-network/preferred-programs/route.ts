import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import {
  assertSupplierNetworkVisibleToOrganization,
  createPreferredVendorProgram,
  listVisibleSupplierNetworksForOrganization,
} from "@/lib/blitzpay/blitzpay-supplier-network"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PRICING = new Set([
  "standard_discount",
  "volume_discount",
  "rebate",
  "fixed_pricing",
  "preferred_financing",
  "custom",
])

const LIST_CAP = 30

export async function GET(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/supplier-network/preferred-programs",
  )
  if (schemaResp) return schemaResp
  let filterNetworkId: string | null = null
  try {
    const u = new URL(request.url)
    const raw = u.searchParams.get("supplier_network_id")
    if (raw && UUID_RE.test(raw)) filterNetworkId = raw
  } catch {
    /* ignore */
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    if (filterNetworkId) {
      await assertSupplierNetworkVisibleToOrganization(admin, organizationId, filterNetworkId)
      const { data, error } = await admin
        .from("blitzpay_preferred_vendor_programs")
        .select("*")
        .eq("supplier_network_id", filterNetworkId)
        .order("id", { ascending: true })
        .limit(LIST_CAP)
      if (error) throw new Error(error.message)
      return NextResponse.json({ programs: data ?? [] })
    }
    const networks = await listVisibleSupplierNetworksForOrganization(admin, organizationId)
    const networkIds = networks.map((n) => n.id).sort((a, b) => a.localeCompare(b))
    const seen = new Set<string>()
    const merged: Record<string, unknown>[] = []
    if (networkIds.length) {
      const { data: pr, error } = await admin
        .from("blitzpay_preferred_vendor_programs")
        .select("*")
        .in("supplier_network_id", networkIds)
        .order("id", { ascending: true })
        .limit(LIST_CAP)
      if (error) throw new Error(error.message)
      for (const r of pr ?? []) {
        const id = String((r as { id: string }).id)
        if (seen.has(id)) continue
        seen.add(id)
        merged.push(r as Record<string, unknown>)
      }
    }
    const { data: vid } = await admin.from("blitzpay_vendors").select("id").eq("organization_id", organizationId).limit(40)
    const vids = (vid ?? []).map((x: { id: string }) => x.id).sort((a, b) => a.localeCompare(b))
    if (vids.length) {
      const { data: pr2, error: e2 } = await admin
        .from("blitzpay_preferred_vendor_programs")
        .select("*")
        .is("supplier_network_id", null)
        .in("vendor_id", vids)
        .order("id", { ascending: true })
        .limit(LIST_CAP)
      if (e2) throw new Error(e2.message)
      for (const r of pr2 ?? []) {
        const id = String((r as { id: string }).id)
        if (seen.has(id)) continue
        seen.add(id)
        merged.push(r as Record<string, unknown>)
      }
    }
    merged.sort((a, b) => String(a.id).localeCompare(String(b.id)))
    return NextResponse.json({ programs: merged.slice(0, LIST_CAP) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === "supplier_network_forbidden" || msg === "supplier_network_not_found") {
      return NextResponse.json({ error: "forbidden", message: "Network is not visible for this organization." }, { status: 403 })
    }
    return blitzpayStaffLoadFailedResponse("GET blitzpay/supplier-network/preferred-programs", e)
  }
}

export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canManageSettings", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "POST /api/organizations/[organizationId]/blitzpay/supplier-network/preferred-programs",
  )
  if (schemaResp) return schemaResp
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }
  const vendor_id = String(body.vendor_id ?? "").trim()
  const program_name = String(body.program_name ?? "").trim()
  const pricing_structure = String(body.pricing_structure ?? "").trim()
  const supplier_network_id =
    body.supplier_network_id != null && String(body.supplier_network_id).trim() ?
      String(body.supplier_network_id).trim()
    : null
  if (!UUID_RE.test(vendor_id) || !program_name || !PRICING.has(pricing_structure)) {
    return NextResponse.json(
      { error: "bad_request", message: "vendor_id, program_name, and pricing_structure are required." },
      { status: 400 },
    )
  }
  if (supplier_network_id && !UUID_RE.test(supplier_network_id)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid supplier_network_id." }, { status: 400 })
  }
  const estimated_savings_basis_points =
    body.estimated_savings_basis_points != null ? Math.round(Number(body.estimated_savings_basis_points)) : null
  const minimum_volume_cents = body.minimum_volume_cents != null ? Math.round(Number(body.minimum_volume_cents)) : null
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const program = await createPreferredVendorProgram(admin, organizationId, {
      supplier_network_id: supplier_network_id && UUID_RE.test(supplier_network_id) ? supplier_network_id : null,
      vendor_id,
      program_name,
      pricing_structure,
      estimated_savings_basis_points,
      minimum_volume_cents,
      effective_start_date: body.effective_start_date != null ? String(body.effective_start_date) : null,
      effective_end_date: body.effective_end_date != null ? String(body.effective_end_date) : null,
      actorUserId: gate.userId,
    })
    return NextResponse.json({ program })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === "supplier_network_anchor_required" || msg === "supplier_network_vendor_org_mismatch") {
      return NextResponse.json({ error: "forbidden", message: "Program cannot be created for this vendor/network combination." }, { status: 403 })
    }
    return blitzpayStaffLoadFailedResponse("POST blitzpay/supplier-network/preferred-programs", e)
  }
}
