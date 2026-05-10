import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { z } from "zod"
import { requireAnyOrgPermission, requireOrgPermission } from "@/lib/api/require-org-permission"
import { DEFAULT_COMMUNICATION_TEMPLATES } from "@/lib/communications/default-templates"
import { COMMUNICATION_TEMPLATE_CATEGORIES } from "@/lib/communications/template-category"
import { hasOrgPermission } from "@/lib/permissions/model"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const CategoryEnum = z.enum(COMMUNICATION_TEMPLATE_CATEGORIES)

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  category: CategoryEnum,
  channel: z.enum(["email", "sms"]),
  subject: z.string().max(500).optional().nullable(),
  body: z.string().min(1).max(20000),
  enabled: z.boolean().optional(),
})

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, error: code ?? "error", message }, { status })
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization id.", 400, "invalid_organization")

  const gate = await requireAnyOrgPermission(organizationId, ["canViewCommunications"])
  if ("error" in gate) return gate.error

  const { count, error: countErr } = await gate.supabase
    .from("communication_templates")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)

  if (countErr) {
    return NextResponse.json({ error: "query_failed", message: countErr.message }, { status: 500 })
  }

  if ((count ?? 0) === 0 && hasOrgPermission(gate.permissions, "canManageCommunications")) {
    const seedRows = DEFAULT_COMMUNICATION_TEMPLATES.map((t) => ({
      organization_id: organizationId,
      template_key: t.template_key,
      name: t.name,
      category: t.category,
      subject: t.subject,
      body: t.body,
      channel: t.channel,
      enabled: true,
      created_by: gate.userId,
      updated_by: gate.userId,
    }))
    const { error: insErr } = await gate.supabase.from("communication_templates").insert(seedRows)
    if (insErr) {
      return NextResponse.json({ error: "seed_failed", message: insErr.message }, { status: 500 })
    }
  }

  const { data: rows, error: listErr } = await gate.supabase
    .from("communication_templates")
    .select("id, template_key, name, category, subject, body, channel, enabled, updated_at, created_by, updated_by")
    .eq("organization_id", organizationId)
    .order("category", { ascending: true })

  if (listErr) {
    return NextResponse.json({ error: "query_failed", message: listErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    templates: rows ?? [],
    needsManagerSeed: (count ?? 0) === 0 && !hasOrgPermission(gate.permissions, "canManageCommunications"),
  })
}

export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization id.", 400)

  const gate = await requireOrgPermission(organizationId, "canManageCommunications")
  if ("error" in gate) return gate.error

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return jsonError("Invalid JSON.", 400)
  }

  const parsed = CreateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", details: parsed.error.flatten() }, { status: 400 })
  }

  const p = parsed.data
  const templateKey = `custom_${randomUUID().replace(/-/g, "")}`

  const { data, error } = await gate.supabase
    .from("communication_templates")
    .insert({
      organization_id: organizationId,
      template_key: templateKey,
      name: p.name,
      category: p.category,
      channel: p.channel,
      subject: p.channel === "email" ? (p.subject ?? "") : null,
      body: p.body,
      enabled: p.enabled ?? true,
      created_by: gate.userId,
      updated_by: gate.userId,
    })
    .select("id, template_key, name, category, subject, body, channel, enabled, updated_at")
    .single()

  if (error) {
    return NextResponse.json({ error: "insert_failed", message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, template: data })
}
