import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { getOrganizationMemberRole } from "@/lib/api/org-role"
import { normalizeOrgMemberRole } from "@/lib/permissions/model"
import {
  upsertLifecycleState,
  insertRecommendationEvent,
} from "@/lib/ai-ops/lifecycle-db"
import type { RecommendationCategory, RecommendationLifecycleState } from "@/lib/ai-ops/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const patchSchema = z.object({
  state: z.enum([
    "pending",
    "acknowledged",
    "in_progress",
    "completed",
    "ignored",
    "escalated",
  ] as [RecommendationLifecycleState, ...RecommendationLifecycleState[]]),
  category: z.string().min(1).max(40),
  notes: z.string().max(2000).nullable().optional(),
})

function jsonError(message: string, status: number, code = "error") {
  return NextResponse.json({ error: code, message }, { status })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string; recommendationKey: string }> },
) {
  const { organizationId, recommendationKey: rawKey } = await context.params
  const recommendationKey = decodeURIComponent(rawKey)
  if (!UUID_RE.test(organizationId) || !recommendationKey.trim()) {
    return jsonError("Invalid request.", 400, "invalid_request")
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return jsonError("Sign in required.", 401, "unauthorized")

  const isPlatformAdmin = isPlatformAdminEmail(user.email)
  const rawRole = isPlatformAdmin
    ? "owner"
    : await getOrganizationMemberRole(supabase, user.id, organizationId)
  const role = normalizeOrgMemberRole(rawRole)
  if (!role && !isPlatformAdmin) return jsonError("Forbidden.", 403, "forbidden")

  const managerRoles = ["owner", "admin", "manager"]
  if (!isPlatformAdmin && (!role || !managerRoles.includes(role))) {
    return jsonError("Only owners, admins, and managers can update lifecycle.", 403, "forbidden")
  }

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

  const up = await upsertLifecycleState({
    supabase,
    organizationId,
    recommendationKey,
    category: parsed.data.category as RecommendationCategory,
    state: parsed.data.state,
    notes: parsed.data.notes ?? null,
    userId: user.id,
  })
  if (!up.ok) return jsonError(up.error ?? "Save failed.", 500, "save_failed")

  await insertRecommendationEvent({
    supabase,
    organizationId,
    recommendationKey,
    category: parsed.data.category as RecommendationCategory,
    eventType: "lifecycle_updated",
    actorUserId: user.id,
    outcome: parsed.data.state,
    metadata: { notes: parsed.data.notes ?? null },
  })

  return NextResponse.json({ ok: true, state: parsed.data.state })
}
