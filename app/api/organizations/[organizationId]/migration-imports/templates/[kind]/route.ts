import { NextResponse } from "next/server"
import {
  buildCsvTemplateContent,
  CSV_TEMPLATE_FILENAMES,
  UTF8_BOM,
  type CsvTemplateDownloadKind,
} from "@/lib/migration-imports/csv-templates"
import { requireOrgMigrationAccess } from "@/lib/migration-imports/require-org-migration-access"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const TEMPLATE_KINDS = new Set<CsvTemplateDownloadKind>([
  "customer",
  "equipment",
  "work_order",
  "appointment",
  "invoice",
  "quote",
])

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; kind: string }> },
) {
  const { organizationId, kind: kindRaw } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireOrgMigrationAccess(organizationId)
  if ("error" in gate) return gate.error

  const kind = kindRaw as CsvTemplateDownloadKind
  if (!TEMPLATE_KINDS.has(kind)) {
    return NextResponse.json({ error: "invalid_kind", message: "Unknown template type." }, { status: 400 })
  }

  const body = UTF8_BOM + buildCsvTemplateContent(kind)
  const filename = CSV_TEMPLATE_FILENAMES[kind]

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  })
}
