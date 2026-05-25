import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  createGrowthHumanExecutionApprovalDraft,
  fetchGrowthHumanExecutionApprovalsView,
} from "@/lib/growth/human-execution/human-execution-service"
import {
  GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER,
  HUMAN_EXECUTION_APPROVAL_STATUSES,
  HUMAN_EXECUTION_CHANNELS,
} from "@/lib/growth/human-execution/human-execution-types"
import {
  GROWTH_HUMAN_EXECUTION_SCHEMA_SETUP_MESSAGE,
  isGrowthHumanExecutionSchemaReady,
} from "@/lib/growth/human-execution/human-execution-schema-health"

export const runtime = "nodejs"

const createSchema = z.object({
  leadId: z.string().uuid(),
  channel: z.enum(HUMAN_EXECUTION_CHANNELS),
  title: z.string().min(1).max(200),
  why: z.string().max(500).optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthHumanExecutionSchemaReady(access.admin))) {
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER,
      meta: { schemaReady: false, setupMessage: GROWTH_HUMAN_EXECUTION_SCHEMA_SETUP_MESSAGE },
      approvals: [],
    })
  }

  const url = new URL(request.url)
  const leadIdParam = url.searchParams.get("leadId")
  const leadId = leadIdParam && z.string().uuid().safeParse(leadIdParam).success ? leadIdParam : undefined
  const statusParam = url.searchParams.get("status")
  const status =
    statusParam && z.enum(HUMAN_EXECUTION_APPROVAL_STATUSES).safeParse(statusParam).success ? statusParam : undefined

  try {
    const approvals = await fetchGrowthHumanExecutionApprovalsView(access.admin, {
      leadId,
      status: status as never,
    })
    return NextResponse.json({ ok: true, qaMarker: GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER, approvals })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load approvals."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthHumanExecutionSchemaReady(access.admin))) {
    return NextResponse.json(
      { error: "schema_not_ready", message: GROWTH_HUMAN_EXECUTION_SCHEMA_SETUP_MESSAGE },
      { status: 503 },
    )
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid approval draft payload." }, { status: 400 })
  }

  try {
    const approval = await createGrowthHumanExecutionApprovalDraft(access.admin, {
      leadId: parsed.data.leadId,
      channel: parsed.data.channel,
      title: parsed.data.title,
      why: parsed.data.why ?? "Operator-created execution draft.",
      ownerUserId: parsed.data.ownerUserId ?? null,
      createdByUserId: access.userId,
    })
    return NextResponse.json({ ok: true, qaMarker: GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER, approval })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not create approval draft."
    return NextResponse.json({ error: "create_failed", message }, { status: 500 })
  }
}
