import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  RealtimeProviderValidationCooldownError,
  validateRealtimeProviderConnection,
} from "@/lib/growth/realtime/providers/realtime-provider-validation"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  _request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { connectionId } = await context.params
  if (!UUID_RE.test(connectionId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid id." }, { status: 400 })
  }

  try {
    const result = await validateRealtimeProviderConnection(access.admin, {
      connectionId,
      actorUserId: access.userId,
    })
    return NextResponse.json({
      ok: true,
      health: {
        healthStatus: result.validation.healthStatus,
        latencyMs: result.validation.latencyMs,
        message: result.validation.message,
      },
      validation: result.validation,
      connection: result.connection,
    })
  } catch (e) {
    if (e instanceof RealtimeProviderValidationCooldownError) {
      return NextResponse.json(
        {
          error: "validation_cooldown",
          message: "Test connection cooldown active. Try again shortly.",
          cooldownRemainingMs: e.remainingMs,
        },
        { status: 429 },
      )
    }
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "validate_failed", message }, { status: 500 })
  }
}
