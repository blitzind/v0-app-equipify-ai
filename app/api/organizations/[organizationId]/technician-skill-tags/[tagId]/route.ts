import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { slugifySkillTagName } from "@/lib/technicians/skill-tags"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; tagId: string }> },
) {
  const { organizationId, tagId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(tagId)) return jsonError("Invalid tag.", 400)

  const gate = await requireOrgPermission(organizationId, "canManageTechnicians")
  if ("error" in gate) return gate.error

  const body = (await request.json().catch(() => null)) as {
    name?: string
    color?: string | null
    isActive?: boolean
    sortOrder?: number
  } | null

  const patch: Record<string, unknown> = {}
  if (body?.name !== undefined) {
    const name = body.name.trim()
    if (!name) return jsonError("Skill tag name is required.", 400)
    const slug = slugifySkillTagName(name)
    if (!slug) return jsonError("Skill tag name must contain letters or numbers.", 400)
    patch.name = name
    patch.slug = slug
  }
  if (body?.color !== undefined) {
    if (body.color && !HEX_COLOR.test(body.color)) return jsonError("Color must be a #RRGGBB value.", 400)
    patch.color = body.color || null
  }
  if (body?.isActive !== undefined) patch.is_active = Boolean(body.isActive)
  if (body?.sortOrder !== undefined && Number.isFinite(body.sortOrder)) {
    patch.sort_order = Number(body.sortOrder)
  }
  if (Object.keys(patch).length === 0) return jsonError("No changes provided.", 400)

  const { data, error } = await gate.supabase
    .from("technician_skill_tags")
    .update(patch)
    .eq("organization_id", organizationId)
    .eq("id", tagId)
    .select("id, organization_id, name, slug, color, is_active, sort_order")
    .maybeSingle()

  if (error) return jsonError(error.message, 400)
  if (!data) return jsonError("Skill tag not found.", 404)

  return NextResponse.json({ tag: data })
}
