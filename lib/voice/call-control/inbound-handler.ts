import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateVoiceBusinessHours } from "@/lib/voice/business-hours/business-hours-evaluator"
import {
  resolveInboundDialTargetsWithBrowser,
  resolveRoundRobinMemberUserId,
} from "@/lib/voice/browser-calling/inbound-browser-routing"
import { createInboundVoiceCallFromTwilio,
  provisionInboundBrowserWorkspaceOffers,
} from "@/lib/voice/browser-calling/workspace-bridge"
import { startAiReceptionistSessionForCall } from "@/lib/voice/ai-receptionist/receptionist-service"
import { isVoiceAiReceptionistEnabled } from "@/lib/voice/ai-receptionist/provider-types"
import {
  mapInboundRouteToCallControlDecision,
  resolveDialNumbersFromRoute,
} from "@/lib/voice/call-control/inbound-call-control"
import {
  resolveEffectiveRecordingPolicy,
  shouldRecordCall,
} from "@/lib/voice/call-control/recording-policy"
import type { InboundCallControlDecision } from "@/lib/voice/call-control/types"
import { normalizePhoneNumber } from "@/lib/voice/phone-normalization"
import { createTwilioCallControlProvider, generateInboundCallResponse } from "@/lib/voice/providers/call-control/twilio-call-control"
import { resolveInboundVoiceRoute } from "@/lib/voice/routing/routing-resolver"
import {
  fetchVoiceCallControlSettings,
  fetchVoiceBusinessHoursById,
  fetchVoiceNumberByPhone,
  fetchVoiceRoutingProfileById,
  fetchVoiceRoutingProfileMembers,
  fetchVoiceVoicemailBoxes,
  mapNumber,
  pickRoundRobinMemberForwardNumber,
  upsertVoiceCallControlSettings,
} from "@/lib/voice/repository/voice-call-control-repository"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"
import { VOICE_CALL_CONTROL_QA_MARKER } from "@/lib/voice/call-control/types"
import type { InboundVoiceRouteResolution } from "@/lib/voice/routing/routing-resolver"

export type HandleTwilioInboundCallInput = {
  admin: SupabaseClient
  payload: Record<string, unknown>
  recordingCallbackUrl: string
  statusCallbackUrl?: string
}

export type HandleTwilioInboundCallResult =
  | {
      ok: true
      twiml: string
      decision: InboundCallControlDecision
      organizationId: string
      voiceNumberId: string
    }
  | {
      ok: false
      code: "number_not_found" | "org_not_found" | "configuration_error"
      message: string
      twiml: string
    }

function readToNumber(payload: Record<string, unknown>): string | null {
  const to = typeof payload.To === "string" ? payload.To : null
  return to ? normalizePhoneNumber(to) : null
}

function readFromNumber(payload: Record<string, unknown>): string {
  const from = typeof payload.From === "string" ? payload.From : ""
  return normalizePhoneNumber(from) || from
}

function readCallSid(payload: Record<string, unknown>): string | null {
  return typeof payload.CallSid === "string" ? payload.CallSid : null
}

async function resolveInboundCallControlBundle(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceNumberId: string
    fromNumber: string
    skipRoundRobinAdvance?: boolean
  },
): Promise<
  | {
      ok: true
      decision: InboundCallControlDecision
      route: InboundVoiceRouteResolution
      voiceNumberPhone: string
      browserTargetUserIds: string[]
    }
  | { ok: false; message: string }
> {
  const { data } = await admin
    .schema("voice")
    .from("voice_numbers")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("id", input.voiceNumberId)
    .maybeSingle()

  if (!data) return { ok: false, message: "Voice number not found." }

  const voiceNumber = mapNumber(data as Record<string, unknown>)
  const settings = await fetchVoiceCallControlSettings(admin, input.organizationId)
  const routingProfile = voiceNumber.routingProfileId
    ? await fetchVoiceRoutingProfileById(admin, input.organizationId, voiceNumber.routingProfileId)
    : null
  const members = routingProfile
    ? await fetchVoiceRoutingProfileMembers(admin, input.organizationId, routingProfile.id)
    : []
  const businessHours = routingProfile?.businessHoursId
    ? await fetchVoiceBusinessHoursById(admin, input.organizationId, routingProfile.businessHoursId)
    : null
  const businessHoursStatus = evaluateVoiceBusinessHours(businessHours)
  const memberForwardNumbers = members
    .filter((member) => member.isActive && member.forwardingPhoneNumber)
    .sort((a, b) => a.priority - b.priority)
    .map((member) => normalizePhoneNumber(member.forwardingPhoneNumber))
    .filter(Boolean)

  const roundRobinNumber =
    routingProfile && !input.skipRoundRobinAdvance
      ? await pickRoundRobinMemberForwardNumber(admin, input.organizationId, routingProfile.id, members)
      : memberForwardNumbers[0] ?? null

  const route = resolveInboundVoiceRoute({
    organizationId: input.organizationId,
    number: voiceNumber,
    fromNumber: input.fromNumber,
    routingProfile,
    routingMembers: members,
    businessHoursStatus,
  })

  const dialNumbers = resolveDialNumbersFromRoute({
    route,
    numberDefaultForward: normalizePhoneNumber(voiceNumber.defaultForwardingTarget),
    memberForwardNumbers,
    roundRobinNumber,
  })

  const roundRobinUserId = resolveRoundRobinMemberUserId({ members, roundRobinNumber })
  const browserTargets = await resolveInboundDialTargetsWithBrowser(admin, {
    organizationId: input.organizationId,
    route,
    pstnNumbers: dialNumbers,
    roundRobinUserId,
  })

  const recordingPolicy = resolveEffectiveRecordingPolicy({
    direction: "inbound",
    orgDefault: settings?.defaultRecordingPolicy ?? "disabled",
    numberOverride: voiceNumber.recordingPolicy ?? null,
  })

  let voicemailGreeting: string | null = null
  if (route.voicemailBoxId) {
    const boxes = await fetchVoiceVoicemailBoxes(admin, input.organizationId)
    const box = boxes.find((entry) => entry.id === route.voicemailBoxId)
    voicemailGreeting = box?.greetingText ?? null
  }

  const decision = mapInboundRouteToCallControlDecision({
    route,
    dialNumbers: browserTargets.pstnNumbers,
    dialClientIdentities: browserTargets.clientIdentities,
    recordingEnabled: shouldRecordCall({ policy: recordingPolicy, direction: "inbound" }),
    recordingDisclosureText: settings?.recordingDisclosureText ?? null,
    voicemailGreetingText: voicemailGreeting,
  })

  return {
    ok: true,
    decision,
    route,
    voiceNumberPhone: voiceNumber.phoneNumber,
    browserTargetUserIds: browserTargets.targetUserIds,
  }
}

export async function previewInboundCallControlDecision(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceNumberId: string
    fromNumber: string
    skipRoundRobinAdvance?: boolean
  },
): Promise<{ ok: true; decision: InboundCallControlDecision; route: InboundVoiceRouteResolution } | { ok: false; message: string }> {
  const bundle = await resolveInboundCallControlBundle(admin, input)
  if (!bundle.ok) return bundle
  return { ok: true, decision: bundle.decision, route: bundle.route }
}

export async function handleTwilioInboundCall(
  input: HandleTwilioInboundCallInput,
): Promise<HandleTwilioInboundCallResult> {
  const provider = createTwilioCallControlProvider()
  const toNumber = readToNumber(input.payload)
  if (!toNumber) {
    const twiml = provider.rejectCall().body
    return { ok: false, code: "number_not_found", message: "Missing To number.", twiml }
  }

  const voiceNumber = await fetchVoiceNumberByPhone(input.admin, toNumber)
  if (!voiceNumber) {
    const twiml = provider.rejectCall().body
    return { ok: false, code: "number_not_found", message: "Voice number not registered.", twiml }
  }

  const organizationId = voiceNumber.organizationId
  const bundle = await resolveInboundCallControlBundle(input.admin, {
    organizationId,
    voiceNumberId: voiceNumber.id,
    fromNumber: readFromNumber(input.payload),
  })
  if (!bundle.ok) {
    const twiml = provider.rejectCall().body
    return { ok: false, code: "configuration_error", message: bundle.message, twiml }
  }

  const { decision, browserTargetUserIds } = bundle
  const callSid = readCallSid(input.payload)
  const fromNumber = readFromNumber(input.payload)

  if (
    callSid &&
    decision.action === "dial" &&
    (decision.dialClientIdentities?.length ?? 0) > 0
  ) {
    const voiceCallId = await createInboundVoiceCallFromTwilio(input.admin, {
      organizationId,
      providerCallId: callSid,
      fromNumber,
      toNumber,
      assignedUserId: browserTargetUserIds[0] ?? voiceNumber.assignedUserId,
    })

    await provisionInboundBrowserWorkspaceOffers(input.admin, {
      organizationId,
      voiceCallId,
      targetUserIds: browserTargetUserIds,
      fromNumber,
      toNumber,
    })
  }

  if (callSid && decision.action === "ai_receptionist" && isVoiceAiReceptionistEnabled()) {
    try {
      const voiceCallId = await createInboundVoiceCallFromTwilio(input.admin, {
        organizationId,
        providerCallId: callSid,
        fromNumber,
        toNumber,
        assignedUserId: voiceNumber.assignedUserId,
      })

      await startAiReceptionistSessionForCall(input.admin, {
        organizationId,
        voiceCallId,
        afterHours: bundle.route.businessHoursStatus === "closed",
        callerNumber: fromNumber,
      })
    } catch (error) {
      logVoiceInfrastructure("voice_ai_receptionist_session_start_failed", {
        organizationId,
        callSid,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  logVoiceInfrastructure("voice_inbound_route_decision", {
    qaMarker: VOICE_CALL_CONTROL_QA_MARKER,
    organizationId,
    voiceNumberId: voiceNumber.id,
    routeStatus: decision.routeStatus,
    routingMode: decision.routingMode,
    action: decision.action,
    dialNumbers: decision.dialNumbers,
    dialClientIdentities: decision.dialClientIdentities ?? [],
    warnings: decision.warnings,
    businessHoursStatus: bundle.route.businessHoursStatus,
  })

  await upsertVoiceCallControlSettings(input.admin, organizationId, {
    inboundCallControlReady: true,
  })

  const response = generateInboundCallResponse(provider, {
    decision,
    callerId: voiceNumber.phoneNumber,
    recordingCallbackUrl: input.recordingCallbackUrl,
    statusCallbackUrl: input.statusCallbackUrl,
  })

  return {
    ok: true,
    twiml: response.body,
    decision,
    organizationId,
    voiceNumberId: voiceNumber.id,
  }
}
