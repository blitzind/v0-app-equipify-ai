import { NextResponse } from "next/server"
import { findDuplicateCatalogItemId } from "@/lib/catalog/duplicate-find"
import type { DuplicateAction } from "@/lib/catalog/import-types"
import { parseStoredPriceListPayload } from "@/lib/catalog/parse-stored-payload"
import { requireOrgCatalogWrite } from "@/lib/catalog/require-org-catalog-write"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type CommitRow = {
  rowId: string
  duplicateAction: DuplicateAction
  existingCatalogItemId?: string | null
}

function finiteMoney(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  if (typeof v !== "number" || !Number.isFinite(v)) return null
  return v
}

function parseEffectiveDate(s: string | null): string | null {
  if (!s?.trim()) return null
  const t = s.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const d = new Date(t)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; importId: string }> },
) {
  const { organizationId, importId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(importId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireOrgCatalogWrite(organizationId)
  if ("error" in gate) return gate.error

  let body: { commits?: CommitRow[] }
  try {
    body = (await request.json()) as { commits?: CommitRow[] }
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON." }, { status: 400 })
  }

  const commits = Array.isArray(body.commits) ? body.commits : []
  if (commits.length === 0) {
    return NextResponse.json({ error: "empty", message: "No rows to save." }, { status: 400 })
  }

  const { data: imp, error: loadErr } = await gate.svc
    .from("price_list_imports")
    .select("id, file_name, file_url, vendor_id, manufacturer_name, extracted_json")
    .eq("id", importId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (loadErr || !imp) {
    return NextResponse.json({ error: "not_found", message: "Import not found." }, { status: 404 })
  }

  const payload = parseStoredPriceListPayload(imp.extracted_json)
  if (!payload) {
    return NextResponse.json({ error: "no_payload", message: "Nothing extracted yet." }, { status: 400 })
  }

  const rowById = new Map(payload.rows.map((r) => [r.id, r]))
  const docMfg = payload.manufacturerName ?? (imp.manufacturer_name as string | null)
  const effectiveDate = parseEffectiveDate(payload.effectiveDate)

  let saved = 0
  let skipped = 0
  const errors: string[] = []

  for (const c of commits) {
    const action = c.duplicateAction
    if (action !== "skip" && action !== "update" && action !== "create") {
      errors.push(`Invalid duplicateAction for ${c.rowId}`)
      continue
    }

    const row = rowById.get(c.rowId)
    if (!row || !row.selected) {
      skipped++
      continue
    }

    const dupId = await findDuplicateCatalogItemId(gate.svc, organizationId, {
      partNumber: row.partNumber,
      manufacturerName: docMfg,
      name: row.name,
    })

    if (action === "skip") {
      skipped++
      continue
    }

    const nowIso = new Date().toISOString()
    const aiConf =
      typeof row.confidence === "number" && Number.isFinite(row.confidence) ? row.confidence : null

    const base = {
      organization_id: organizationId,
      vendor_id: (imp.vendor_id as string | null) ?? null,
      manufacturer_name: docMfg,
      source_file_name: (imp.file_name as string) ?? "",
      source_file_url: (imp.file_url as string | null) ?? null,
      source_import_id: importId,
      category: row.category,
      item_type: row.itemType,
      part_number: row.partNumber,
      sku: null as string | null,
      name: row.name,
      description: row.description,
      list_price: finiteMoney(row.listPrice),
      cost: finiteMoney(row.cost),
      sale_price: null as number | null,
      margin_percent: null as number | null,
      unit: "ea",
      status: row.status,
      replacement_part_number: row.replacementPartNumber,
      effective_date: effectiveDate,
      notes: row.notes,
      raw_extracted_text: row.rawExtractedText,
      confidence_score: aiConf,
      ai_generated: true,
      ai_confidence: aiConf,
      human_verified_at: nowIso,
      human_verified_by: gate.userId,
      updated_at: nowIso,
    }

    if (action === "update") {
      const targetId = (c.existingCatalogItemId ?? dupId ?? "").trim()
      if (!targetId || !UUID_RE.test(targetId)) {
        errors.push(`Update requires an existing catalog item id (${row.name}).`)
        continue
      }
      if (dupId && dupId !== targetId) {
        errors.push(`Duplicate mismatch for row ${row.partNumber || row.name}.`)
        continue
      }
      const { error: upErr } = await gate.svc
        .from("catalog_items")
        .update(base)
        .eq("id", targetId)
        .eq("organization_id", organizationId)
      if (upErr) {
        errors.push(upErr.message)
        continue
      }
      saved++
      continue
    }

    // create — always insert a new row (even when dupId exists)
    const { error: insErr } = await gate.svc.from("catalog_items").insert({
      ...base,
      created_at: new Date().toISOString(),
    })
    if (insErr) {
      errors.push(insErr.message)
      continue
    }
    saved++
  }

  const reviewIso = new Date().toISOString()
  await gate.svc
    .from("price_list_imports")
    .update({
      status: errors.length === 0 ? "approved" : "needs_review",
      updated_at: reviewIso,
      ...(errors.length === 0 && saved > 0
        ? { human_reviewed_at: reviewIso, human_reviewed_by: gate.userId }
        : {}),
    })
    .eq("id", importId)

  return NextResponse.json({
    ok: errors.length === 0,
    saved,
    skipped,
    errors,
  })
}
