import { NextResponse } from "next/server"
import { requireOrgInventoryRead, requireOrgInventoryWrite } from "@/lib/inventory/require-org-inventory-access"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireOrgInventoryRead(organizationId)
  if ("error" in gate) return gate.error

  const { data, error } = await gate.svc
    .from("inventory_locations")
    .select("id, name, code, location_type, technician_id, is_active, notes, created_at")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  const rows = data ?? []
  const techIds = [...new Set(rows.map((r) => r.technician_id).filter(Boolean))] as string[]
  let techMap = new Map<string, string>()
  if (techIds.length > 0) {
    const { data: techs } = await gate.svc
      .from("technicians")
      .select("id, full_name")
      .eq("organization_id", organizationId)
      .in("id", techIds)
    techMap = new Map((techs ?? []).map((t) => [t.id as string, (t.full_name as string) ?? ""]))
  }

  const items = rows.map((raw) => {
    const row = raw as Record<string, unknown>
    const tid = row.technician_id as string | null
    return {
      ...row,
      technician_name: tid ? (techMap.get(tid) ?? null) : null,
    }
  })

  return NextResponse.json({ locations: items })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireOrgInventoryWrite(organizationId)
  if ("error" in gate) return gate.error

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 })
  }

  const name = String(body.name ?? "").trim()
  if (!name) {
    return NextResponse.json({ message: "Name is required." }, { status: 400 })
  }

  const locationTypeRaw = String(body.location_type ?? "warehouse").trim().toLowerCase()
  const allowedTypes = new Set(["warehouse", "vehicle", "job_site", "staging", "other"])
  const location_type = allowedTypes.has(locationTypeRaw) ? locationTypeRaw : "warehouse"

  const technicianId =
    typeof body.technician_id === "string" && UUID_RE.test(body.technician_id) ? body.technician_id : null

  if (technicianId) {
    const { data: tech } = await gate.svc
      .from("technicians")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", technicianId)
      .maybeSingle()
    if (!tech) {
      return NextResponse.json({ message: "Technician not found for this organization." }, { status: 400 })
    }
  }

  const { data: inserted, error } = await gate.svc
    .from("inventory_locations")
    .insert({
      organization_id: organizationId,
      name,
      code: typeof body.code === "string" ? body.code.trim() || null : null,
      location_type,
      technician_id: technicianId,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      is_active: body.is_active === false ? false : true,
    })
    .select("id")
    .single()

  if (error || !inserted) {
    return NextResponse.json({ message: error?.message ?? "Insert failed." }, { status: 500 })
  }

  return NextResponse.json({ id: inserted.id as string })
}
