import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GrowthProviderValidationCooldownError,
  validateGrowthProviderConnection,
} from "@/lib/growth/outbound/validate-connection"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { connectionId } = await context.params
  if (!z.string().uuid().safeParse(connectionId).success) {
    return NextResponse.json({ error: "invalid_connection_id", message: "Connection id must be a UUID." }, { status: 400 })
  }

  try {
    const result = await validateGrowthProviderConnection(access.admin, {
      connectionId,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    if (e instanceof GrowthProviderValidationCooldownError) {
      return NextResponse.json(
        {
          error: "validation_cooldown",
          message: "Validation cooldown active. Try again shortly.",
          remainingMs: e.remainingMs,
        },
        { status: 429 },
      )
    }
    const message = e instanceof Error ? e.message : String(e)
    if (message === "connection_not_found") {
      return NextResponse.json({ error: "not_found", message: "Connection not found." }, { status: 404 })
    }
    return NextResponse.json({ error: "validation_failed", message }, { status: 500 })
  }
}
