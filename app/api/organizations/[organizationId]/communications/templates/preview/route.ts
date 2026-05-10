import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { buildTemplatePreview } from "@/lib/communications/template-merge"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  subject: z.string().max(500).optional().nullable(),
  body: z.string().max(20000),
  channel: z.enum(["email", "sms", "in_app"]).optional(),
})

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, error: code ?? "error", message }, { status })
}

export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireAnyOrgPermission(organizationId, ["canViewCommunications"])
  if ("error" in gate) return gate.error

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return jsonError("Invalid JSON.", 400)
  }

  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", details: parsed.error.flatten() }, { status: 400 })
  }

  const includeFinancial = Boolean(gate.permissions.canViewFinancials || gate.permissions.canViewBilling)
  const preview = buildTemplatePreview({
    subject: parsed.data.subject,
    body: parsed.data.body,
    channel: parsed.data.channel ?? "email",
    includeFinancialInMap: includeFinancial,
  })

  return NextResponse.json({
    ok: true,
    preview,
    financialPreviewEnabled: includeFinancial,
  })
}
