import { NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { COMMUNICATION_TEMPLATE_CATEGORIES } from "@/lib/communications/template-category"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const CategoryEnum = z.enum(COMMUNICATION_TEMPLATE_CATEGORIES)

const PatchSchema = z
  .object({
    subject: z.string().max(500).optional().nullable(),
    body: z.string().min(1).max(20000).optional(),
    name: z.string().trim().min(1).max(160).optional(),
    enabled: z.boolean().optional(),
    category: CategoryEnum.optional(),
    channel: z.enum(["email", "sms", "in_app"]).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "empty_patch" })

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, error: code ?? "error", message }, { status })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; templateId: string }> },
) {
  const { organizationId, templateId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(templateId)) {
    return jsonError("Invalid ids.", 400, "invalid_ids")
  }

  const gate = await requireOrgPermission(organizationId, "canManageCommunications")
  if ("error" in gate) return gate.error

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return jsonError("Invalid JSON.", 400)
  }

  const parsed = PatchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", details: parsed.error.flatten() }, { status: 400 })
  }

  const p = parsed.data
  const patch: Record<string, unknown> = { updated_by: gate.userId }
  if (p.subject !== undefined) patch.subject = p.subject
  if (p.body !== undefined) patch.body = p.body
  if (p.name !== undefined) patch.name = p.name
  if (p.enabled !== undefined) patch.enabled = p.enabled
  if (p.category !== undefined) patch.category = p.category
  if (p.channel !== undefined) patch.channel = p.channel

  const { data: row, error: upErr } = await gate.supabase
    .from("communication_templates")
    .update(patch)
    .eq("id", templateId)
    .eq("organization_id", organizationId)
    .select("id, template_key, name, category, subject, body, channel, enabled, updated_at")
    .maybeSingle()

  if (upErr) {
    return NextResponse.json({ error: "update_failed", message: upErr.message }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: "not_found", message: "Template not found." }, { status: 404 })
  }

  return NextResponse.json({ ok: true, template: row })
}
