import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { getOrganizationMemberRole } from "@/lib/api/org-role"
import { getOrgPermissionsForRole, normalizeOrgMemberRole } from "@/lib/permissions/model"
import { defaultDigestSettings, loadDigestSettings } from "@/lib/ai-ops/digest"
import type { RecommendationCategory, RecommendationPriority } from "@/lib/ai-ops/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ALLOWED_CATEGORIES: ReadonlyArray<RecommendationCategory> = [
  "prospect",
  "financial",
  "dispatch",
  "equipment",
  "certificate",
  "inventory",
  "communications",
  "automation",
  "maintenance",
]
const ALLOWED_PRIORITIES: ReadonlyArray<RecommendationPriority> = ["high", "medium", "low"]

function jsonError(message: string, status: number, code = "error") {
  return NextResponse.json({ error: code, message }, { status })
}

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  recipients: z
    .array(z.string().trim().min(1).max(254))
    .max(20)
    .optional(),
  sendHour: z.number().int().min(0).max(23).optional(),
  priorityThreshold: z.enum(["high", "medium", "low"] as [RecommendationPriority, ...RecommendationPriority[]]).optional(),
  categories: z.array(z.string()).max(20).optional(),
  slackWebhookUrl: z.string().url().max(512).nullable().optional(),
  teamsWebhookUrl: z.string().url().max(512).nullable().optional(),
  slackEnabled: z.boolean().optional(),
  teamsEnabled: z.boolean().optional(),
  skipWeekends: z.boolean().optional(),
})

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  const guard = await ensureMember(context)
  if ("error" in guard) return guard.error
  const { supabase, organizationId } = guard

  const result = await loadDigestSettings(supabase, organizationId)
  const row = result.row ?? defaultDigestSettings(organizationId)
  return NextResponse.json({
    ok: true,
    settings: serialize(row),
    categoryOptions: ALLOWED_CATEGORIES,
    priorityOptions: ALLOWED_PRIORITIES,
  })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  const guard = await ensureManager(context)
  if ("error" in guard) return guard.error
  const { supabase, organizationId, userId } = guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("Invalid JSON body.", 400, "invalid_body")
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join("; "), 400, "invalid_body")
  }
  const data = parsed.data

  // Validate recipients shape — staff emails only.
  if (data.recipients) {
    const dedup = Array.from(new Set(data.recipients.map((r) => r.trim().toLowerCase())))
    for (const r of dedup) {
      if (!EMAIL_RE.test(r)) {
        return jsonError(`Invalid email: ${r}`, 400, "invalid_email")
      }
    }
    data.recipients = dedup
  }

  if (data.categories) {
    const allowed = new Set<string>(ALLOWED_CATEGORIES)
    const filtered = data.categories.filter((c) => allowed.has(c))
    data.categories = filtered
  }

  // Snapshot the org timezone whenever we write.
  const orgRes = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", organizationId)
    .maybeSingle()
  const tz = (orgRes.data as { timezone?: string | null } | null)?.timezone ?? null

  const upsert: Record<string, unknown> = {
    organization_id: organizationId,
    timezone_snapshot: tz,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }
  if (data.enabled !== undefined) upsert.enabled = data.enabled
  if (data.recipients !== undefined) upsert.recipients = data.recipients
  if (data.sendHour !== undefined) upsert.send_hour = data.sendHour
  if (data.priorityThreshold !== undefined) upsert.priority_threshold = data.priorityThreshold
  if (data.categories !== undefined) upsert.categories = data.categories
  if (data.slackWebhookUrl !== undefined) upsert.slack_webhook_url = data.slackWebhookUrl
  if (data.teamsWebhookUrl !== undefined) upsert.teams_webhook_url = data.teamsWebhookUrl
  if (data.slackEnabled !== undefined) upsert.slack_enabled = data.slackEnabled
  if (data.teamsEnabled !== undefined) upsert.teams_enabled = data.teamsEnabled
  if (data.skipWeekends !== undefined) upsert.skip_weekends = data.skipWeekends

  // Phase 4 safety: silently disable a destination if its webhook URL is cleared.
  if (data.slackWebhookUrl === null) upsert.slack_enabled = false
  if (data.teamsWebhookUrl === null) upsert.teams_enabled = false

  const { error } = await supabase
    .from("ai_ops_digest_settings")
    .upsert(upsert, { onConflict: "organization_id" })
  if (error) return jsonError(error.message, 500, "upsert_failed")

  const next = await loadDigestSettings(supabase, organizationId)
  const row = next.row ?? defaultDigestSettings(organizationId)
  return NextResponse.json({ ok: true, settings: serialize(row) })
}

function serialize(row: ReturnType<typeof defaultDigestSettings>) {
  return {
    enabled: row.enabled,
    recipients: row.recipients,
    sendHour: row.send_hour,
    timezone: row.timezone_snapshot,
    priorityThreshold: row.priority_threshold,
    categories: row.categories,
    /**
     * Phase 4 — webhook URLs are masked once saved. The UI only
     * needs to know that one is configured and what its host is so
     * the admin can recognise it; the full URL stays server-side.
     */
    slackWebhookConfigured: Boolean(row.slack_webhook_url),
    slackWebhookHint: maskWebhook(row.slack_webhook_url),
    slackEnabled: row.slack_enabled,
    teamsWebhookConfigured: Boolean(row.teams_webhook_url),
    teamsWebhookHint: maskWebhook(row.teams_webhook_url),
    teamsEnabled: row.teams_enabled,
    skipWeekends: row.skip_weekends,
    lastSentAt: row.last_sent_at,
  }
}

function maskWebhook(url: string | null): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const tail = parsed.pathname.split("/").filter(Boolean).slice(-1)[0] ?? ""
    const lastFour = tail.slice(-4)
    return `${parsed.host}/…/${"*".repeat(Math.max(0, tail.length - 4))}${lastFour}`
  } catch {
    return "configured"
  }
}

type Guard =
  | { error: NextResponse }
  | {
      supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
      organizationId: string
      userId: string
    }

async function ensureMember(
  context: { params: Promise<{ organizationId: string }> },
): Promise<Guard> {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return { error: jsonError("Invalid organization.", 400, "invalid_org") }
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { error: jsonError("Sign in required.", 401, "unauthorized") }
  const isPlatformAdmin = isPlatformAdminEmail(user.email)
  const rawRole = isPlatformAdmin
    ? "owner"
    : await getOrganizationMemberRole(supabase, user.id, organizationId)
  const role = normalizeOrgMemberRole(rawRole)
  if (!role && !isPlatformAdmin) return { error: jsonError("Forbidden.", 403, "forbidden") }
  return { supabase, organizationId, userId: user.id }
}

async function ensureManager(
  context: { params: Promise<{ organizationId: string }> },
): Promise<Guard> {
  const guard = await ensureMember(context)
  if ("error" in guard) return guard
  const supabase = guard.supabase
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { error: jsonError("Sign in required.", 401, "unauthorized") }
  const isPlatformAdmin = isPlatformAdminEmail(user.email)
  const rawRole = isPlatformAdmin
    ? "owner"
    : await getOrganizationMemberRole(supabase, user.id, guard.organizationId)
  const role = normalizeOrgMemberRole(rawRole)
  const permissions = getOrgPermissionsForRole(role)
  if (!permissions.canManageWorkspaceSettings && !isPlatformAdmin) {
    return {
      error: jsonError(
        "Only owners, admins, and managers can edit digest settings.",
        403,
        "forbidden",
      ),
    }
  }
  return guard
}
