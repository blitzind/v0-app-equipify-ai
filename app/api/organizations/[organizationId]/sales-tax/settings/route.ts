import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { organizationTaxSettingsPatchSchema } from "@/lib/tax/org-settings-schema"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireAnyOrgPermission(organizationId, ["canViewBilling", "canEditInvoices", "canApproveInvoices"])
  if ("error" in gate) return gate.error

  const { data, error } = await gate.supabase
    .from("organization_tax_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) return jsonError(error.message, 500)

  if (!data) {
    return NextResponse.json({
      settings: {
        autoTaxEnabled: false,
        fallbackTaxRatePercent: 0,
        taxableLaborDefault: true,
        taxablePartsDefault: true,
        sourcingMode: "destination",
        manualOverrideAllowed: true,
        primaryProvider: "equipify_native",
      },
      updatedAt: null,
    })
  }

  const r = data as Record<string, unknown>
  return NextResponse.json({
    settings: {
      autoTaxEnabled: Boolean(r.auto_tax_enabled),
      fallbackTaxRatePercent: Number(r.fallback_tax_rate_percent ?? 0),
      taxableLaborDefault: r.taxable_labor_default !== false,
      taxablePartsDefault: r.taxable_parts_default !== false,
      sourcingMode: r.sourcing_mode === "origin" ? "origin" : "destination",
      manualOverrideAllowed: r.manual_override_allowed !== false,
      primaryProvider: String(r.primary_provider ?? "equipify_native"),
    },
    updatedAt: r.updated_at ?? null,
  })
}

export async function PATCH(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireAnyOrgPermission(organizationId, ["canEditOrgBilling"])
  if ("error" in gate) return gate.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("Invalid JSON.", 400)
  }

  const parsed = organizationTaxSettingsPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 })
  }

  const p = parsed.data
  const row: Record<string, unknown> = {
    organization_id: organizationId,
    updated_at: new Date().toISOString(),
  }
  if (p.autoTaxEnabled !== undefined) row.auto_tax_enabled = p.autoTaxEnabled
  if (p.fallbackTaxRatePercent !== undefined) row.fallback_tax_rate_percent = p.fallbackTaxRatePercent
  if (p.taxableLaborDefault !== undefined) row.taxable_labor_default = p.taxableLaborDefault
  if (p.taxablePartsDefault !== undefined) row.taxable_parts_default = p.taxablePartsDefault
  if (p.sourcingMode !== undefined) row.sourcing_mode = p.sourcingMode
  if (p.manualOverrideAllowed !== undefined) row.manual_override_allowed = p.manualOverrideAllowed
  if (p.primaryProvider !== undefined) row.primary_provider = p.primaryProvider

  const { error } = await gate.supabase.from("organization_tax_settings").upsert(row, { onConflict: "organization_id" })
  if (error) return jsonError(error.message, 500)

  return NextResponse.json({ ok: true })
}
