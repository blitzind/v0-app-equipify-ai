import { NextResponse } from "next/server"
import { z } from "zod"
import { simulateAutomationFlowPreview } from "@/lib/growth/automation/growth-automation-service"
import { requireAutomationPlatformAccess } from "@/lib/growth/automation/growth-automation-platform-access"
import {
  automationApiSafetyPayload,
  automationSimulationApiSafetyPayload,
  mapAutomationError,
} from "@/lib/growth/automation/growth-automation-route-utils"
import { GROWTH_AUTOMATION_SIMULATION_QA_MARKER } from "@/lib/growth/automation/growth-automation-simulation-types"
import { GROWTH_AUTOMATION_BUILDER_QA_MARKER } from "@/lib/growth/automation/growth-automation-types"
import { SEQUENCE_BRANCH_SIMULATION_SCENARIOS } from "@/lib/growth/sequences/conditions/sequence-branch-simulation-types"
import {
  SEQUENCE_TRIGGER_RUNTIME_EVENTS,
  SEQUENCE_TRIGGER_RUNTIME_SOURCES,
  type SequenceTriggerRuntimeSimulationFixture,
} from "@/lib/growth/sequences/runtime/sequence-trigger-runtime-types"

export const runtime = "nodejs"

const SimulationBodySchema = z.object({
  trigger_event: z.string().optional(),
  lead_attributes: z.record(z.unknown()).optional(),
  company_attributes: z.record(z.unknown()).optional(),
  share_page_attributes: z.record(z.unknown()).optional(),
  media_attributes: z.record(z.unknown()).optional(),
  booking_attributes: z.record(z.unknown()).optional(),
  high_intent_attributes: z.record(z.unknown()).optional(),
  condition_overrides: z.record(z.boolean()).optional(),
  trigger_fixtures: z
    .array(
      z.object({
        source: z.enum(SEQUENCE_TRIGGER_RUNTIME_SOURCES),
        event: z.enum(SEQUENCE_TRIGGER_RUNTIME_EVENTS),
        scenario: z.enum(SEQUENCE_BRANCH_SIMULATION_SCENARIOS),
        conditionId: z.string(),
        matched: z.boolean(),
      }),
    )
    .optional(),
  scenario: z.enum(SEQUENCE_BRANCH_SIMULATION_SCENARIOS).optional(),
})

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return runSimulationPreview(request, context)
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return runSimulationPreview(request, context)
}

async function runSimulationPreview(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireAutomationPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const versionId = new URL(request.url).searchParams.get("version_id") ?? undefined
  const parsedBody =
    request.method === "POST"
      ? SimulationBodySchema.safeParse(await request.json().catch(() => ({})))
      : { success: true as const, data: {} }

  if (!parsedBody.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const simulation = await simulateAutomationFlowPreview(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
      versionId: versionId ?? undefined,
      simulationInput: {
        triggerEvent: parsedBody.data.trigger_event,
        leadAttributes: parsedBody.data.lead_attributes,
        companyAttributes: parsedBody.data.company_attributes,
        sharePageAttributes: parsedBody.data.share_page_attributes,
        mediaAttributes: parsedBody.data.media_attributes,
        bookingAttributes: parsedBody.data.booking_attributes,
        highIntentAttributes: parsedBody.data.high_intent_attributes,
        conditionOverrides: parsedBody.data.condition_overrides,
        triggerFixtures: parsedBody.data.trigger_fixtures as
          | SequenceTriggerRuntimeSimulationFixture[]
          | undefined,
        scenario: parsedBody.data.scenario,
      },
    })

    return NextResponse.json({
      ok: simulation.status === "simulated",
      simulation,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      simulation_qa_marker: GROWTH_AUTOMATION_SIMULATION_QA_MARKER,
      ...automationApiSafetyPayload(),
      ...automationSimulationApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}
