import { NextResponse } from "next/server"
import { enforceCanCreateRecord } from "@/app/actions/org-create-enforcement"
import { mapTemplateRow, normalizeTemplateFields } from "@/lib/calibration-certificates"
import { requireOrgCatalogWrite } from "@/lib/catalog/require-org-catalog-write"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireOrgCatalogWrite(organizationId, {
    capability: "canManageCertificateTemplates",
    forbiddenMessage:
      "Only owners, admins, and managers can manage calibration templates.",
  })
  if ("error" in gate) return gate.error

  const bill = await enforceCanCreateRecord(organizationId, "calibration_template")
  if (!bill.ok) {
    return NextResponse.json(
      { error: bill.code ?? "forbidden", message: bill.message },
      { status: bill.httpStatus ?? 403 },
    )
  }

  let body: {
    name?: unknown
    equipmentCategoryId?: unknown
    fields?: unknown
    aiConfidence?: unknown
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON." }, { status: 400 })
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name) {
    return NextResponse.json({ error: "name_required", message: "Template name is required." }, { status: 400 })
  }

  const fields = normalizeTemplateFields(body.fields)
  if (fields.length === 0) {
    return NextResponse.json({ error: "fields_required", message: "At least one field is required." }, { status: 400 })
  }

  const equipmentCategoryId =
    typeof body.equipmentCategoryId === "string" ? body.equipmentCategoryId.trim() || null : null

  const aiConfidence =
    typeof body.aiConfidence === "number" && Number.isFinite(body.aiConfidence)
      ? Math.min(1, Math.max(0, body.aiConfidence))
      : null

  const nowIso = new Date().toISOString()
  const insertRow = {
    organization_id: organizationId,
    name,
    equipment_category_id: equipmentCategoryId,
    fields,
    ai_generated: true,
    ai_confidence: aiConfidence,
    human_verified_at: nowIso,
    human_verified_by: gate.userId,
  }

  const { data, error } = await gate.svc
    .from("calibration_templates")
    .insert(insertRow)
    .select(
      "id, organization_id, name, equipment_category_id, fields, archived_at, ai_generated, ai_confidence, human_verified_at, human_verified_by, created_at, updated_at",
    )
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: "insert_failed", message: error?.message ?? "Could not save template." },
      { status: 500 },
    )
  }

  const template = mapTemplateRow(
    data as Parameters<typeof mapTemplateRow>[0],
  )
  return NextResponse.json({ template })
}
