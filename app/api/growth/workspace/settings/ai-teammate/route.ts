import { NextResponse } from "next/server"
import { z } from "zod"
import {
  GE_AI_UX_3B_QA_MARKER,
  type AiTeammateIdentity,
} from "@/lib/growth/settings/growth-ai-teammate-identity-types"
import {
  loadAiTeammateIdentity,
  updateAiTeammateIdentity,
} from "@/lib/growth/settings/growth-ai-teammate-identity-service"
import {
  growthWorkspaceSettingsJsonError,
  requireGrowthWorkspaceSettingsAccess,
} from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { AI_TEAMMATE_NAME_MAX_LENGTH, AI_TEAMMATE_NAME_MIN_LENGTH } from "@/lib/workspace/ai-teammate-identity"

export const runtime = "nodejs"

const patchSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(AI_TEAMMATE_NAME_MIN_LENGTH)
      .max(AI_TEAMMATE_NAME_MAX_LENGTH)
      .optional(),
    onboardingCompleted: z.boolean().optional(),
  })
  .strict()

function mapResponse(identity: AiTeammateIdentity, persisted: boolean) {
  return {
    ok: true as const,
    qa_marker: GE_AI_UX_3B_QA_MARKER,
    identity,
    persisted,
  }
}

export async function GET(request: Request) {
  const access = await requireGrowthWorkspaceSettingsAccess(request)
  if (!access.ok) return access.response

  try {
    const identity = await loadAiTeammateIdentity(access.admin, {
      organizationId: access.organizationId,
      userId: access.userId,
    })
    const persisted = identity.source === "organization" || identity.onboardingCompleted
    return NextResponse.json(mapResponse(identity, persisted))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load AI teammate identity."
    return growthWorkspaceSettingsJsonError("ai_teammate_identity_load_failed", message, 500)
  }
}

export async function PATCH(request: Request) {
  const access = await requireGrowthWorkspaceSettingsAccess(request)
  if (!access.ok) return access.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return growthWorkspaceSettingsJsonError("invalid_json", "Request body must be JSON.", 400)
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return growthWorkspaceSettingsJsonError(
      "invalid_ai_teammate_identity",
      parsed.error.issues[0]?.message ?? "Invalid AI teammate identity payload.",
      400,
    )
  }

  if (Object.keys(parsed.data).length === 0) {
    return growthWorkspaceSettingsJsonError("invalid_body", "No fields to update.", 400)
  }

  if (parsed.data.name !== undefined && !access.organizationId) {
    return growthWorkspaceSettingsJsonError(
      "organization_required",
      "Organization context is required to save AI teammate name.",
      400,
    )
  }

  try {
    const identity = await updateAiTeammateIdentity(access.admin, {
      organizationId: access.organizationId,
      userId: access.userId,
      patch: parsed.data,
    })
    return NextResponse.json(mapResponse(identity, true))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save AI teammate identity."
    const status = message.includes("2–32") ? 400 : 500
    return growthWorkspaceSettingsJsonError("ai_teammate_identity_save_failed", message, status)
  }
}
