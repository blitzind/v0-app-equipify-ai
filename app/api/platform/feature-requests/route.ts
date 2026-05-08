import { NextResponse } from "next/server"
import { z } from "zod"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const STATUSES = ["new", "reviewed", "planned", "in_progress", "released", "declined"] as const

const PatchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUSES).optional(),
  internalNotes: z.string().trim().max(2000).optional().nullable(),
  priority: z.enum(["unreviewed", "low", "medium", "high", "urgent"]).optional(),
})

async function requirePlatformAdmin() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isPlatformAdminEmail(user.email)) {
    return { ok: false as const, response: NextResponse.json({ error: "forbidden", message: "Platform admin access required." }, { status: 403 }) }
  }
  try {
    return { ok: true as const, admin: createServiceRoleSupabaseClient() }
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "server_config", message: "Server is not configured for platform admin operations." },
        { status: 503 },
      ),
    }
  }
}

export async function GET() {
  const access = await requirePlatformAdmin()
  if (!access.ok) return access.response

  const { data: rows, error } = await access.admin
    .from("product_feature_requests")
    .select(
      "id, organization_id, submitted_by, source, title, original_question, module, current_path, current_limitation, suggested_improvement, business_value, chat_context, status, priority, internal_notes, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 })
  }

  const orgIds = [...new Set((rows ?? []).map((row) => row.organization_id).filter(Boolean))]
  const userIds = [...new Set((rows ?? []).map((row) => row.submitted_by).filter(Boolean))]

  const [{ data: orgs }, { data: profiles }] = await Promise.all([
    orgIds.length
      ? access.admin.from("organizations").select("id, name, slug").in("id", orgIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? access.admin.from("profiles").select("id, full_name, email").in("id", userIds)
      : Promise.resolve({ data: [] }),
  ])

  const orgById = new Map((orgs ?? []).map((org) => [org.id, org]))
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]))

  return NextResponse.json({
    ok: true,
    requests: (rows ?? []).map((row) => {
      const org = orgById.get(row.organization_id)
      const profile = row.submitted_by ? profileById.get(row.submitted_by) : null
      return {
        id: row.id,
        organizationId: row.organization_id,
        organizationName: org?.name ?? "Unknown organization",
        organizationSlug: org?.slug ?? null,
        submittedBy: row.submitted_by,
        submittedByName: profile?.full_name ?? null,
        submittedByEmail: profile?.email ?? null,
        source: row.source,
        title: row.title,
        originalQuestion: row.original_question,
        module: row.module,
        currentPath: row.current_path,
        currentLimitation: row.current_limitation,
        suggestedImprovement: row.suggested_improvement,
        businessValue: row.business_value,
        chatContext: row.chat_context,
        status: row.status,
        priority: row.priority,
        internalNotes: row.internal_notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    }),
  })
}

export async function PATCH(request: Request) {
  const access = await requirePlatformAdmin()
  if (!access.ok) return access.response

  const rawBody = await request.json().catch(() => null)
  const parsed = PatchSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Send id plus status, priority, or internalNotes." }, { status: 400 })
  }

  const patch: Record<string, string | null> = {}
  if (parsed.data.status) patch.status = parsed.data.status
  if (parsed.data.priority) patch.priority = parsed.data.priority
  if (parsed.data.internalNotes !== undefined) patch.internal_notes = parsed.data.internalNotes?.trim() || null

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "empty_patch", message: "No changes provided." }, { status: 400 })
  }

  const { data, error } = await access.admin
    .from("product_feature_requests")
    .update(patch)
    .eq("id", parsed.data.id)
    .select("id, status, priority, internal_notes, updated_at")
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "update_failed", message: error?.message ?? "Request not found." }, { status: 500 })
  }

  return NextResponse.json({ ok: true, request: data })
}
