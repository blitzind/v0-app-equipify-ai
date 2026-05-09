import { NextResponse } from "next/server"
import { mergeFollowUpAutomationConfig } from "@/lib/follow-up-automation/merge-config"
import { followUpAutomationConfigSchema } from "@/lib/follow-up-automation/types"
import { requireOrgPermission } from "@/lib/api/require-org-permission"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireOrgPermission(organizationId, "canManageWorkspaceSettings")
  if ("error" in gate) return gate.error

  const { data } = await gate.supabase
    .from("follow_up_automation_settings")
    .select("config, updated_at")
    .eq("organization_id", organizationId)
    .maybeSingle()

  const merged = mergeFollowUpAutomationConfig((data as { config?: unknown } | null)?.config ?? {})
  return NextResponse.json({
    config: merged,
    updatedAt: (data as { updated_at?: string } | null)?.updated_at ?? null,
  })
}

export async function PUT(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireOrgPermission(organizationId, "canManageWorkspaceSettings")
  if ("error" in gate) return gate.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("Invalid JSON.", 400)
  }

  const parsed = followUpAutomationConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_config", details: parsed.error.flatten() }, { status: 400 })
  }

  const { error } = await gate.supabase.from("follow_up_automation_settings").upsert(
    {
      organization_id: organizationId,
      config: parsed.data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  )

  if (error) return jsonError(error.message, 500)

  return NextResponse.json({ ok: true, config: parsed.data })
}
