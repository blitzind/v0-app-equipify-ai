import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendVoiceCallEvent } from "@/lib/voice/repository/voice-repository"
import {
  ensurePrimaryOperatorParticipant,
  fetchActiveConferenceForCall,
  fetchActiveTransferForCall,
  fetchConferenceById,
  fetchParticipantById,
  insertConference,
  insertParticipant,
  insertTransfer,
  listActiveParticipantsForCall,
  markVoiceCallTransferred,
  syncWorkspaceSessionFlags,
  toParticipantPublicView,
  toTransferPublicView,
  updateParticipantFlags,
  updateTransferStatus,
} from "@/lib/voice/repository/voice-transfer-control-repository"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"
import type { VoiceProviderId } from "@/lib/voice/types"
import { authorizeVoiceCallControlAction, hasSupervisorRole } from "@/lib/voice/transfer-control/call-control-authorization"
import {
  assertNoDuplicateActiveTransfer,
  initialTransferStatus,
  isActiveTransferStatus,
  mapCancelActionToTransition,
  transferKindRequiresConsult,
  transitionTransferStatus,
} from "@/lib/voice/transfer-control/transfer-state-machine"
import type {
  VoiceCallControlActionResult,
  VoiceTransferCancelAction,
  VoiceTransferKind,
  VoiceTransferTimelineEventType,
} from "@/lib/voice/transfer-control/types"
import { VOICE_TRANSFER_CONTROL_QA_MARKER } from "@/lib/voice/transfer-control/types"
import {
  createMultiPartyCallControlProvider,
  providerAddParticipant,
  providerCancelTransfer,
  providerCompleteTransfer,
  providerCreateConference,
  providerHoldParticipant,
  providerMuteParticipant,
  providerRemoveParticipant,
  providerTransferCall,
} from "@/lib/voice/providers/call-control/multi-party-call-control"

async function appendTransferTimelineEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    provider: VoiceProviderId
    eventType: VoiceTransferTimelineEventType
    payload: Record<string, unknown>
    idempotencySuffix: string
  },
): Promise<void> {
  const now = new Date().toISOString()
  await appendVoiceCallEvent(admin, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    provider: input.provider,
    eventType: input.eventType,
    eventTimestamp: now,
    payloadJson: input.payload,
    idempotencyKey: `call:${input.voiceCallId}:${input.eventType}:${input.idempotencySuffix}`,
  })
}

function failure(message: string, voiceCallId: string): VoiceCallControlActionResult {
  return { ok: false, qaMarker: VOICE_TRANSFER_CONTROL_QA_MARKER, message, voiceCallId }
}

function success(
  message: string,
  voiceCallId: string,
  extra?: Partial<VoiceCallControlActionResult>,
): VoiceCallControlActionResult {
  return {
    ok: true,
    qaMarker: VOICE_TRANSFER_CONTROL_QA_MARKER,
    message,
    voiceCallId,
    ...extra,
  }
}

async function loadActionContext(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    voiceCallId: string
    requireOwnership?: boolean
    allowSupervisor?: boolean
  },
) {
  const auth = await authorizeVoiceCallControlAction(admin, input)
  if (!auth.ok) return auth
  return auth
}

export async function startVoiceCallTransfer(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    voiceCallId: string
    transferKind: VoiceTransferKind
    targetPhoneNumber?: string
    targetUserId?: string | null
    targetClientIdentity?: string
  },
): Promise<VoiceCallControlActionResult> {
  const auth = await loadActionContext(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
    voiceCallId: input.voiceCallId,
    requireOwnership: true,
    allowSupervisor: false,
  })
  if (!auth.ok) return failure(auth.message, input.voiceCallId)

  const targetPhone = input.targetPhoneNumber?.trim() ?? ""
  const targetClient = input.targetClientIdentity?.trim() ?? ""
  if (!targetPhone && !targetClient) {
    return failure("Transfer target phone number or client identity is required.", input.voiceCallId)
  }

  const activeTransfer = await fetchActiveTransferForCall(admin, input.organizationId, input.voiceCallId)
  const duplicateCheck = assertNoDuplicateActiveTransfer({
    activeTransferStatus: activeTransfer?.status ?? null,
  })
  if (!duplicateCheck.ok) return failure(duplicateCheck.reason, input.voiceCallId)

  const provider = createMultiPartyCallControlProvider(auth.call.provider)
  let consultConferenceId: string | null = null
  let conferenceSid = ""

  if (transferKindRequiresConsult(input.transferKind)) {
    const conferenceResult = await providerCreateConference(provider, {
      friendlyName: `consult-${input.voiceCallId.slice(0, 8)}`,
      voiceCallId: input.voiceCallId,
    })
    if (!conferenceResult.ok) return failure(conferenceResult.message, input.voiceCallId)

    const conference = await insertConference(admin, {
      organizationId: input.organizationId,
      voiceCallId: input.voiceCallId,
      provider: auth.call.provider,
      friendlyName: `consult-${input.voiceCallId.slice(0, 8)}`,
      providerConferenceSid: conferenceResult.providerReference,
    })
    if (!conference) return failure("Could not persist consult conference.", input.voiceCallId)
    consultConferenceId = conference.id
    conferenceSid = conference.providerConferenceSid
  }

  const transferResult = await providerTransferCall(provider, {
    callReference: auth.call.providerCallId,
    targetPhoneNumber: targetPhone || undefined,
    targetClientIdentity: targetClient || undefined,
    kind: input.transferKind,
  })
  if (!transferResult.ok) return failure(transferResult.message, input.voiceCallId)

  const transfer = await insertTransfer(admin, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    initiatedByUserId: input.userId,
    transferKind: input.transferKind,
    targetPhoneNumber: targetPhone,
    targetUserId: input.targetUserId ?? null,
    targetClientIdentity: targetClient,
    consultConferenceId,
    status: initialTransferStatus(input.transferKind),
  })
  if (!transfer) return failure("Could not create transfer record.", input.voiceCallId)

  await ensurePrimaryOperatorParticipant(admin, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    userId: input.userId,
    provider: auth.call.provider,
    providerCallSid: auth.call.providerCallId,
    phoneNumber: auth.call.fromNumber || auth.call.toNumber,
    clientIdentity: targetClient ? "" : "",
  })

  if (consultConferenceId && conferenceSid) {
    const targetParticipantResult = await providerAddParticipant(provider, {
      conferenceReference: conferenceSid,
      phoneNumber: targetPhone || undefined,
      clientIdentity: targetClient || undefined,
    })
    if (targetParticipantResult.ok) {
      await insertParticipant(admin, {
        organizationId: input.organizationId,
        conferenceId: consultConferenceId,
        voiceCallId: input.voiceCallId,
        participantRole: input.transferKind === "consult" ? "consult" : "transfer_target",
        phoneNumber: targetPhone,
        clientIdentity: targetClient,
        providerParticipantSid: targetParticipantResult.providerReference,
        status: "connecting",
        joinedAt: new Date().toISOString(),
      })
    }

    const consultTransition = transitionTransferStatus({
      currentStatus: transfer.status,
      action: "enter_consult",
      transferKind: input.transferKind,
    })
    if (consultTransition.ok) {
      await updateTransferStatus(admin, {
        transferId: transfer.id,
        organizationId: input.organizationId,
        status: consultTransition.nextStatus,
      })
      transfer.status = consultTransition.nextStatus
    }
  }

  await syncWorkspaceSessionFlags(admin, {
    voiceCallId: input.voiceCallId,
    transferTarget: targetPhone || targetClient,
  })

  await appendTransferTimelineEvent(admin, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    provider: auth.call.provider,
    eventType: "transfer_started",
    payload: {
      transferKind: input.transferKind,
      targetPhoneNumber: targetPhone,
      targetClientIdentity: targetClient,
    },
    idempotencySuffix: transfer.id,
  })

  logVoiceInfrastructure("voice_transfer_started", {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    transferKind: input.transferKind,
  })

  const participants = (await listActiveParticipantsForCall(admin, input.organizationId, input.voiceCallId)).map(
    toParticipantPublicView,
  )

  return success(`${input.transferKind} transfer started.`, input.voiceCallId, {
    transfer: toTransferPublicView(transfer),
    participants,
    timelineEventType: "transfer_started",
  })
}

export async function cancelVoiceCallTransfer(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    voiceCallId: string
    action?: VoiceTransferCancelAction
  },
): Promise<VoiceCallControlActionResult> {
  const auth = await loadActionContext(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
    voiceCallId: input.voiceCallId,
    requireOwnership: true,
    allowSupervisor: true,
  })
  if (!auth.ok) return failure(auth.message, input.voiceCallId)

  const transfer = await fetchActiveTransferForCall(admin, input.organizationId, input.voiceCallId)
  if (!transfer || !isActiveTransferStatus(transfer.status)) {
    return failure("No active transfer to cancel.", input.voiceCallId)
  }

  const transitionAction = mapCancelActionToTransition(input.action ?? "cancel")
  const transition = transitionTransferStatus({
    currentStatus: transfer.status,
    action: transitionAction,
    transferKind: transfer.transferKind,
  })
  if (!transition.ok) return failure(transition.reason, input.voiceCallId)

  const provider = createMultiPartyCallControlProvider(auth.call.provider)
  await providerCancelTransfer(provider, { transferReference: transfer.id })

  const now = new Date().toISOString()
  const updated = await updateTransferStatus(admin, {
    transferId: transfer.id,
    organizationId: input.organizationId,
    status: transition.nextStatus,
    canceledAt: transition.nextStatus === "canceled" || transition.nextStatus === "returned" ? now : null,
    completedAt: transition.nextStatus === "completed" ? now : null,
  })

  await syncWorkspaceSessionFlags(admin, {
    voiceCallId: input.voiceCallId,
    transferTarget: null,
    onHold: transition.nextStatus === "returned" ? false : undefined,
  })

  const eventType: VoiceTransferTimelineEventType =
    transition.nextStatus === "returned"
      ? "transfer_canceled"
      : transition.nextStatus === "completed" && input.action === "send_to_voicemail"
        ? "transfer_completed"
        : "transfer_canceled"

  await appendTransferTimelineEvent(admin, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    provider: auth.call.provider,
    eventType,
    payload: { action: input.action ?? "cancel", transferId: transfer.id },
    idempotencySuffix: `${transfer.id}:${input.action ?? "cancel"}`,
  })

  return success(
    transition.nextStatus === "returned"
      ? "Returned to original operator."
      : input.action === "send_to_voicemail"
        ? "Transfer routed to voicemail."
        : "Transfer canceled.",
    input.voiceCallId,
    {
      transfer: updated ? toTransferPublicView(updated) : toTransferPublicView(transfer),
      timelineEventType: eventType,
    },
  )
}

export async function completeVoiceCallTransfer(
  admin: SupabaseClient,
  input: { organizationId: string; userId: string; voiceCallId: string },
): Promise<VoiceCallControlActionResult> {
  const auth = await loadActionContext(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
    voiceCallId: input.voiceCallId,
    requireOwnership: true,
    allowSupervisor: false,
  })
  if (!auth.ok) return failure(auth.message, input.voiceCallId)

  const transfer = await fetchActiveTransferForCall(admin, input.organizationId, input.voiceCallId)
  if (!transfer || !isActiveTransferStatus(transfer.status)) {
    return failure("No active transfer to complete.", input.voiceCallId)
  }

  const transition = transitionTransferStatus({
    currentStatus: transfer.status,
    action: "complete",
    transferKind: transfer.transferKind,
  })
  if (!transition.ok) return failure(transition.reason, input.voiceCallId)

  const provider = createMultiPartyCallControlProvider(auth.call.provider)
  let conferenceSid: string | undefined
  if (transfer.consultConferenceId) {
    const conference = await fetchConferenceById(admin, input.organizationId, transfer.consultConferenceId)
    conferenceSid = conference?.providerConferenceSid
  }

  const completeResult = await providerCompleteTransfer(provider, {
    transferReference: transfer.id,
    conferenceReference: conferenceSid,
  })
  if (!completeResult.ok) return failure(completeResult.message, input.voiceCallId)

  const now = new Date().toISOString()
  const updated = await updateTransferStatus(admin, {
    transferId: transfer.id,
    organizationId: input.organizationId,
    status: "completed",
    completedAt: now,
  })

  await markVoiceCallTransferred(admin, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    transferredTo: transfer.targetPhoneNumber || transfer.targetClientIdentity,
  })

  await syncWorkspaceSessionFlags(admin, {
    voiceCallId: input.voiceCallId,
    transferTarget: null,
  })

  await appendTransferTimelineEvent(admin, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    provider: auth.call.provider,
    eventType: "transfer_completed",
    payload: { transferId: transfer.id, transferKind: transfer.transferKind },
    idempotencySuffix: transfer.id,
  })

  logVoiceInfrastructure("voice_transfer_completed", {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    transferKind: transfer.transferKind,
  })

  return success("Transfer completed.", input.voiceCallId, {
    transfer: updated ? toTransferPublicView(updated) : toTransferPublicView({ ...transfer, status: "completed" }),
    timelineEventType: "transfer_completed",
  })
}

export async function setVoiceParticipantHold(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    voiceCallId: string
    participantId?: string
    hold: boolean
  },
): Promise<VoiceCallControlActionResult> {
  const auth = await loadActionContext(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
    voiceCallId: input.voiceCallId,
    requireOwnership: true,
    allowSupervisor: true,
  })
  if (!auth.ok) return failure(auth.message, input.voiceCallId)

  const participant = input.participantId
    ? await fetchParticipantById(admin, input.organizationId, input.participantId)
    : null
  let resolvedParticipant = participant
  if (!resolvedParticipant || resolvedParticipant.voiceCallId !== input.voiceCallId) {
    resolvedParticipant = await ensurePrimaryOperatorParticipant(admin, {
      organizationId: input.organizationId,
      voiceCallId: input.voiceCallId,
      userId: input.userId,
      provider: auth.call.provider,
      providerCallSid: auth.call.providerCallId,
      phoneNumber: auth.call.fromNumber || auth.call.toNumber,
    })
  }
  if (!resolvedParticipant || resolvedParticipant.voiceCallId !== input.voiceCallId) {
    return failure("Participant not found on this call.", input.voiceCallId)
  }

  const conference = await fetchConferenceById(admin, input.organizationId, resolvedParticipant.conferenceId)
  const provider = createMultiPartyCallControlProvider(auth.call.provider)
  if (conference?.providerConferenceSid && resolvedParticipant.providerParticipantSid) {
    const holdResult = await providerHoldParticipant(provider, {
      conferenceReference: conference.providerConferenceSid,
      participantReference: resolvedParticipant.providerParticipantSid,
      hold: input.hold,
    })
    if (!holdResult.ok) return failure(holdResult.message, input.voiceCallId)
  }

  await updateParticipantFlags(admin, {
    participantId: resolvedParticipant.id,
    organizationId: input.organizationId,
    isOnHold: input.hold,
    status: input.hold ? "held" : "connected",
  })

  if (resolvedParticipant.participantRole === "operator") {
    await syncWorkspaceSessionFlags(admin, {
      voiceCallId: input.voiceCallId,
      onHold: input.hold,
    })
  }

  const eventType: VoiceTransferTimelineEventType = input.hold ? "participant_held" : "participant_resumed"
  await appendTransferTimelineEvent(admin, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    provider: auth.call.provider,
    eventType,
    payload: {
      participantId: resolvedParticipant.id,
      participantRole: resolvedParticipant.participantRole,
    },
    idempotencySuffix: `${resolvedParticipant.id}:${eventType}`,
  })

  const participants = (await listActiveParticipantsForCall(admin, input.organizationId, input.voiceCallId)).map(
    toParticipantPublicView,
  )

  return success(input.hold ? "Participant placed on hold." : "Participant resumed.", input.voiceCallId, {
    participants,
    timelineEventType: eventType,
  })
}

export async function setVoiceParticipantMute(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    voiceCallId: string
    participantId?: string
    muted: boolean
  },
): Promise<VoiceCallControlActionResult> {
  const auth = await loadActionContext(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
    voiceCallId: input.voiceCallId,
    requireOwnership: true,
    allowSupervisor: true,
  })
  if (!auth.ok) return failure(auth.message, input.voiceCallId)

  const participant = input.participantId
    ? await fetchParticipantById(admin, input.organizationId, input.participantId)
    : null
  let resolvedParticipant = participant
  if (!resolvedParticipant || resolvedParticipant.voiceCallId !== input.voiceCallId) {
    resolvedParticipant = await ensurePrimaryOperatorParticipant(admin, {
      organizationId: input.organizationId,
      voiceCallId: input.voiceCallId,
      userId: input.userId,
      provider: auth.call.provider,
      providerCallSid: auth.call.providerCallId,
      phoneNumber: auth.call.fromNumber || auth.call.toNumber,
    })
  }
  if (!resolvedParticipant || resolvedParticipant.voiceCallId !== input.voiceCallId) {
    return failure("Participant not found on this call.", input.voiceCallId)
  }

  const conference = await fetchConferenceById(admin, input.organizationId, resolvedParticipant.conferenceId)
  const provider = createMultiPartyCallControlProvider(auth.call.provider)
  if (conference?.providerConferenceSid && resolvedParticipant.providerParticipantSid) {
    const muteResult = await providerMuteParticipant(provider, {
      conferenceReference: conference.providerConferenceSid,
      participantReference: resolvedParticipant.providerParticipantSid,
      muted: input.muted,
    })
    if (!muteResult.ok) return failure(muteResult.message, input.voiceCallId)
  }

  await updateParticipantFlags(admin, {
    participantId: resolvedParticipant.id,
    organizationId: input.organizationId,
    isMuted: input.muted,
    status: input.muted ? "muted" : "connected",
  })

  if (resolvedParticipant.participantRole === "operator") {
    await syncWorkspaceSessionFlags(admin, {
      voiceCallId: input.voiceCallId,
      muted: input.muted,
    })
  }

  const eventType: VoiceTransferTimelineEventType = input.muted ? "participant_muted" : "participant_unmuted"
  await appendTransferTimelineEvent(admin, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    provider: auth.call.provider,
    eventType,
    payload: {
      participantId: resolvedParticipant.id,
      participantRole: resolvedParticipant.participantRole,
    },
    idempotencySuffix: `${resolvedParticipant.id}:${eventType}`,
  })

  const participants = (await listActiveParticipantsForCall(admin, input.organizationId, input.voiceCallId)).map(
    toParticipantPublicView,
  )

  return success(input.muted ? "Participant muted." : "Participant unmuted.", input.voiceCallId, {
    participants,
    timelineEventType: eventType,
  })
}

export async function removeVoiceParticipant(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    voiceCallId: string
    participantId: string
  },
): Promise<VoiceCallControlActionResult> {
  const auth = await loadActionContext(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
    voiceCallId: input.voiceCallId,
    requireOwnership: true,
    allowSupervisor: true,
  })
  if (!auth.ok) return failure(auth.message, input.voiceCallId)

  const participant = await fetchParticipantById(admin, input.organizationId, input.participantId)
  if (!participant || participant.voiceCallId !== input.voiceCallId) {
    return failure("Participant not found on this call.", input.voiceCallId)
  }

  const conference = await fetchConferenceById(admin, input.organizationId, participant.conferenceId)
  const provider = createMultiPartyCallControlProvider(auth.call.provider)
  if (conference?.providerConferenceSid && participant.providerParticipantSid) {
    const removeResult = await providerRemoveParticipant(provider, {
      conferenceReference: conference.providerConferenceSid,
      participantReference: participant.providerParticipantSid,
    })
    if (!removeResult.ok) return failure(removeResult.message, input.voiceCallId)
  }

  await updateParticipantFlags(admin, {
    participantId: participant.id,
    organizationId: input.organizationId,
    status: "disconnected",
    leftAt: new Date().toISOString(),
  })

  await appendTransferTimelineEvent(admin, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    provider: auth.call.provider,
    eventType: "participant_left",
    payload: { participantId: participant.id, participantRole: participant.participantRole },
    idempotencySuffix: `${participant.id}:left`,
  })

  const participants = (await listActiveParticipantsForCall(admin, input.organizationId, input.voiceCallId)).map(
    toParticipantPublicView,
  )

  return success("Participant removed from call.", input.voiceCallId, {
    participants,
    timelineEventType: "participant_left",
  })
}

export async function joinVoiceCallAsSupervisor(
  admin: SupabaseClient,
  input: { organizationId: string; userId: string; voiceCallId: string; clientIdentity?: string },
): Promise<VoiceCallControlActionResult> {
  const auth = await loadActionContext(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
    voiceCallId: input.voiceCallId,
    requireOwnership: false,
    allowSupervisor: true,
  })
  if (!auth.ok) return failure(auth.message, input.voiceCallId)

  const isSupervisor = await hasSupervisorRole(admin, input.organizationId, input.userId)
  if (!isSupervisor) {
    return failure("Supervisor join requires owner, admin, or manager role.", input.voiceCallId)
  }

  let conference = await fetchActiveConferenceForCall(admin, input.organizationId, input.voiceCallId)
  const provider = createMultiPartyCallControlProvider(auth.call.provider)

  if (!conference) {
    const conferenceResult = await providerCreateConference(provider, {
      friendlyName: `supervisor-${input.voiceCallId.slice(0, 8)}`,
      voiceCallId: input.voiceCallId,
    })
    if (!conferenceResult.ok) return failure(conferenceResult.message, input.voiceCallId)
    conference = await insertConference(admin, {
      organizationId: input.organizationId,
      voiceCallId: input.voiceCallId,
      provider: auth.call.provider,
      friendlyName: `supervisor-${input.voiceCallId.slice(0, 8)}`,
      providerConferenceSid: conferenceResult.providerReference,
    })
    if (!conference) return failure("Could not create supervisor conference.", input.voiceCallId)
  }

  const clientIdentity = input.clientIdentity?.trim() ?? ""
  const addResult = await providerAddParticipant(provider, {
    conferenceReference: conference.providerConferenceSid,
    clientIdentity: clientIdentity || undefined,
    muted: true,
  })
  if (!addResult.ok) return failure(addResult.message, input.voiceCallId)

  const participant = await insertParticipant(admin, {
    organizationId: input.organizationId,
    conferenceId: conference.id,
    voiceCallId: input.voiceCallId,
    participantUserId: input.userId,
    participantRole: "supervisor",
    clientIdentity,
    providerParticipantSid: addResult.providerReference,
    status: "connected",
    joinedAt: new Date().toISOString(),
    isMuted: true,
  })
  if (!participant) return failure("Could not record supervisor participant.", input.voiceCallId)

  await appendTransferTimelineEvent(admin, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    provider: auth.call.provider,
    eventType: "supervisor_joined",
    payload: { participantId: participant.id, userId: input.userId },
    idempotencySuffix: participant.id,
  })

  logVoiceInfrastructure("voice_supervisor_joined", {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    userId: input.userId,
  })

  const participants = (await listActiveParticipantsForCall(admin, input.organizationId, input.voiceCallId)).map(
    toParticipantPublicView,
  )

  return success("Supervisor joined call (listen-only scaffold).", input.voiceCallId, {
    participants,
    timelineEventType: "supervisor_joined",
  })
}

export async function fetchVoiceCallControlSnapshot(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
) {
  const [participants, transfer] = await Promise.all([
    listActiveParticipantsForCall(admin, organizationId, voiceCallId),
    fetchActiveTransferForCall(admin, organizationId, voiceCallId),
  ])

  return {
    participants: participants.map(toParticipantPublicView),
    activeTransfer: transfer ? toTransferPublicView(transfer) : null,
  }
}
