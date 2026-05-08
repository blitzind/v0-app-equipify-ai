import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { requireAnyOrgPermission, requireOrgPermission } from "@/lib/api/require-org-permission"
import { DEFAULT_TECHNICIAN_SKILL_TAGS, slugifySkillTagName } from "@/lib/technicians/skill-tags"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status })
}

async function seedDefaultTagsIfEmpty(organizationId: string) {
  const svc = createServiceRoleSupabaseClient()
  const { count } = await svc
    .from("technician_skill_tags")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)

  if ((count ?? 0) > 0) return

  await svc.from("technician_skill_tags").insert(
    DEFAULT_TECHNICIAN_SKILL_TAGS.map((name, index) => ({
      organization_id: organizationId,
      name,
      slug: slugifySkillTagName(name),
      sort_order: (index + 1) * 10,
    })),
  )
}

async function usageCounts(organizationId: string): Promise<Map<string, number>> {
  const svc = createServiceRoleSupabaseClient()
  const counts = new Map<string, number>()
  const [{ data: members }, { data: techs }] = await Promise.all([
    svc.from("organization_members").select("skills").eq("organization_id", organizationId),
    svc.from("technicians").select("skills").eq("organization_id", organizationId),
  ])
  for (const row of [
    ...((members ?? []) as Array<{ skills?: string[] | null }>),
    ...((techs ?? []) as Array<{ skills?: string[] | null }>),
  ]) {
    for (const skill of row.skills ?? []) {
      const key = skill.trim().toLowerCase()
      if (!key) continue
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return counts
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireAnyOrgPermission(organizationId, ["canViewTechnicians", "canManageTechnicians"])
  if ("error" in gate) return gate.error

  await seedDefaultTagsIfEmpty(organizationId)

  const { data, error } = await gate.supabase
    .from("technician_skill_tags")
    .select("id, organization_id, name, slug, color, is_active, sort_order")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (error) return jsonError(error.message, 500)

  const counts = await usageCounts(organizationId)
  const tags = ((data ?? []) as Array<{
    id: string
    organization_id: string
    name: string
    slug: string
    color: string | null
    is_active: boolean
    sort_order: number
  }>).map((tag) => ({
    ...tag,
    usage_count: counts.get(tag.name.trim().toLowerCase()) ?? 0,
  }))

  return NextResponse.json({ tags })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireOrgPermission(organizationId, "canManageTechnicians")
  if ("error" in gate) return gate.error

  const body = (await request.json().catch(() => null)) as {
    name?: string
    color?: string | null
    sortOrder?: number
  } | null
  const name = body?.name?.trim() ?? ""
  if (!name) return jsonError("Skill tag name is required.", 400)
  if (body?.color && !HEX_COLOR.test(body.color)) return jsonError("Color must be a #RRGGBB value.", 400)

  await seedDefaultTagsIfEmpty(organizationId)

  const slug = slugifySkillTagName(name)
  if (!slug) return jsonError("Skill tag name must contain letters or numbers.", 400)

  const { data, error } = await gate.supabase
    .from("technician_skill_tags")
    .insert({
      organization_id: organizationId,
      name,
      slug,
      color: body?.color ?? null,
      sort_order: Number.isFinite(body?.sortOrder) ? Number(body?.sortOrder) : 0,
      is_active: true,
    })
    .select("id, organization_id, name, slug, color, is_active, sort_order")
    .maybeSingle()

  if (error) return jsonError(error.message, 400)
  return NextResponse.json({ tag: data }, { status: 201 })
}
