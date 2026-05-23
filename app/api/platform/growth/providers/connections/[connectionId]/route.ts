import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { mapGrowthProviderApiError } from "@/lib/growth/outbound/provider-api-errors"
import {
  fetchGrowthProviderConnectionInternal,
  GrowthProviderConnectionDeleteBlockedError,
  softDeleteGrowthProviderConnection,
  updateGrowthProviderConnectionDetails,
} from "@/lib/growth/outbound/provider-connection-repository"

export const runtime = "nodejs"

const PatchSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  apiBaseUrl: z.string().trim().url().nullable().optional(),
  config: z.record(z.unknown()).optional(),
  monthlyCostEstimate: z.number().min(0).nullable().optional(),
  seatCount: z.number().int().min(0).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  webhookSecret: z.string().trim().max(500).nullable().optional(),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { connectionId } = await context.params
  if (!z.string().uuid().safeParse(connectionId).success) {
    return NextResponse.json({ error: "invalid_connection_id", message: "Connection id must be a UUID." }, { status: 400 })
  }

  const rawBody = await request.json().catch(() => null)
  const parsed = PatchSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid connection payload." }, { status: 400 })
  }

  try {
    const existing = await fetchGrowthProviderConnectionInternal(access.admin, connectionId)
    if (!existing) {
      return NextResponse.json({ error: "not_found", message: "Connection not found." }, { status: 404 })
    }

    const connection = await updateGrowthProviderConnectionDetails(access.admin, connectionId, parsed.data)
    return NextResponse.json({ ok: true, connection })
  } catch (e) {
    const mapped = mapGrowthProviderApiError(e)
    return NextResponse.json({ error: mapped.error, message: mapped.message }, { status: mapped.status })
  }
}

export async function DELETE(
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
    const deleted = await softDeleteGrowthProviderConnection(access.admin, {
      connectionId,
      deletedBy: access.userId,
    })
    logGrowthEngine("provider_connection_deleted", {
      connectionId: deleted.id,
      deletedAt: deleted.deletedAt,
      deletedBy: access.userId,
    })
    return NextResponse.json({ ok: true, deleted })
  } catch (e) {
    if (e instanceof GrowthProviderConnectionDeleteBlockedError) {
      logGrowthEngine("provider_connection_delete_blocked", {
        connectionId,
        reason: e.code,
      })
      return NextResponse.json(
        {
          error: e.code,
          message:
            "This provider is the active email connection in Communication Settings. Select another provider or clear the active provider before deleting.",
        },
        { status: 409 },
      )
    }
    const message = e instanceof Error ? e.message : String(e)
    if (message === "connection_not_found") {
      return NextResponse.json({ error: "not_found", message: "Connection not found." }, { status: 404 })
    }
    const mapped = mapGrowthProviderApiError(e)
    logGrowthEngine("provider_connection_delete_failed", {
      connectionId,
      error: mapped.error,
      message: mapped.message,
      repositoryError: message,
    })
    return NextResponse.json({ error: mapped.error, message: mapped.message }, { status: mapped.status })
  }
}
