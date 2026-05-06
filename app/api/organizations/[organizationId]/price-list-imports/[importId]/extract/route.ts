import { NextResponse } from "next/server"
import { PRICE_LIST_IMPORTS_BUCKET } from "@/lib/catalog/constants"
import { extractPriceListPayloadFromPdf, PriceListExtractConfigError } from "@/lib/catalog/extract-price-list-from-pdf"
import { parseStoredPriceListPayload } from "@/lib/catalog/parse-stored-payload"
import { requireOrgCatalogWrite } from "@/lib/catalog/require-org-catalog-write"

export const runtime = "nodejs"
export const maxDuration = 300

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string; importId: string }> },
) {
  const { organizationId, importId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(importId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireOrgCatalogWrite(organizationId)
  if ("error" in gate) return gate.error

  const { svc } = gate

  const { data: row, error: loadErr } = await svc
    .from("price_list_imports")
    .select("id, file_name, file_url, manufacturer_name, extracted_json")
    .eq("id", importId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (loadErr || !row?.file_url) {
    return NextResponse.json({ error: "not_found", message: "Import or stored PDF missing." }, { status: 404 })
  }

  const path = row.file_url as string
  const { data: bin, error: dlErr } = await svc.storage.from(PRICE_LIST_IMPORTS_BUCKET).download(path)
  if (dlErr || !bin) {
    return NextResponse.json({ error: "download_failed", message: dlErr?.message ?? "Could not read PDF." }, { status: 400 })
  }

  const buffer = Buffer.from(await bin.arrayBuffer())
  const prev = parseStoredPriceListPayload(row.extracted_json)

  await svc
    .from("price_list_imports")
    .update({ status: "processing", error_message: null, updated_at: new Date().toISOString() })
    .eq("id", importId)

  try {
    const payload = await extractPriceListPayloadFromPdf({
      buffer,
      fileName: (row.file_name as string) || "price-list.pdf",
    })

    const mergedMfg = payload.manufacturerName ?? (row.manufacturer_name as string | null)
    payload.manufacturerName = mergedMfg ?? null

    if (prev?.rows?.length) {
      const prevByPart = new Map(
        prev.rows.map((r) => [`${r.partNumber.trim().toLowerCase()}::${r.name.trim().toLowerCase()}`, r.selected]),
      )
      payload.rows = payload.rows.map((r) => ({
        ...r,
        selected: prevByPart.get(`${r.partNumber.trim().toLowerCase()}::${r.name.trim().toLowerCase()}`) ?? true,
      }))
    }

    await svc
      .from("price_list_imports")
      .update({
        extracted_json: payload as unknown as Record<string, unknown>,
        manufacturer_name: mergedMfg ?? (row.manufacturer_name as string | null),
        status: "needs_review",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", importId)

    return NextResponse.json({ ok: true, payload })
  } catch (e) {
    const msg =
      e instanceof PriceListExtractConfigError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Extraction failed."
    await svc
      .from("price_list_imports")
      .update({
        status: "failed",
        error_message: msg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", importId)

    if (e instanceof PriceListExtractConfigError) {
      return NextResponse.json({ error: "not_configured", message: msg }, { status: 503 })
    }
    return NextResponse.json({ error: "extract_failed", message: msg }, { status: 422 })
  }
}
