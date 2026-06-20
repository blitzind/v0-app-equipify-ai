import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  buildMissingRuntimeObservabilitySnapshot,
  getGrowthRuntimeObservabilitySnapshot,
} from "@/lib/growth/runtime-guardrails/growth-runtime-observability-service"
import { GROWTH_RUNTIME_GUARDRAILS_QA_MARKER } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

export const runtime = "nodejs"

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500)
  return "runtime_observability_unavailable"
}

/** Read-only runtime guardrails observability — never 500 on missing schema. */
export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId() ?? undefined

  try {
    const snapshot = await getGrowthRuntimeObservabilitySnapshot(access.admin, {
      organizationId,
      userId: access.userId,
    })

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
      read_only: true,
      status: snapshot.status,
      schemaStatus: snapshot.status,
      snapshot,
    })
  } catch (error) {
    const message = safeErrorMessage(error)
    const snapshot = buildMissingRuntimeObservabilitySnapshot({ message })

    return NextResponse.json(
      {
        ok: false,
        qa_marker: GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
        read_only: true,
        status: "MISSING",
        schemaStatus: "MISSING",
        error: "runtime_observability_unavailable",
        message,
        snapshot,
      },
      { status: 200 },
    )
  }
}
