import type { SupabaseClient } from "@supabase/supabase-js"
import { logInboundRouteAudit } from "@/lib/voice/call-control/inbound-route-audit"
import type { InboundVoiceRouteResolution } from "@/lib/voice/routing/routing-resolver"
import type { VoiceRoutingProfileMemberRecord } from "@/lib/voice/types"
import { normalizePhoneNumber } from "@/lib/voice/phone-normalization"
import { buildVoiceBrowserClientIdentity } from "@/lib/voice/browser-calling/status-mapping"

const BROWSER_ROUTING_MODES = new Set(["assigned_user", "round_robin", "simultaneous_ring"])

export function resolveBrowserRoutingTargets(input: {
  route: InboundVoiceRouteResolution
  organizationId: string
  memberUserIds: string[]
  onlineClientIdentities: string[]
}): {
  browserClientIdentities: string[]
  pstnNumbers: string[]
  preferBrowser: boolean
} {
  const preferBrowser = BROWSER_ROUTING_MODES.has(input.route.routingMode ?? "")
  const identityByUser = new Map(
    input.memberUserIds.map((userId) => [
      userId,
      buildVoiceBrowserClientIdentity({ organizationId: input.organizationId, userId }),
    ]),
  )

  const browserClientIdentities = input.onlineClientIdentities.filter((identity) =>
    [...identityByUser.values()].includes(identity),
  )

  return {
    browserClientIdentities,
    pstnNumbers: input.route.forwardingNumbers,
    preferBrowser: preferBrowser && browserClientIdentities.length > 0,
  }
}

export function mergeBrowserAndPstnDialTargets(input: {
  browserClientIdentities: string[]
  pstnNumbers: string[]
  preferBrowser: boolean
}): { clientIdentities: string[]; pstnNumbers: string[] } {
  if (input.preferBrowser && input.browserClientIdentities.length > 0) {
    return {
      clientIdentities: input.browserClientIdentities,
      pstnNumbers: input.pstnNumbers,
    }
  }
  return { clientIdentities: [], pstnNumbers: input.pstnNumbers }
}

export function resolveRoundRobinMemberUserId(input: {
  members: VoiceRoutingProfileMemberRecord[]
  roundRobinNumber: string | null
}): string | null {
  const active = input.members.filter((member) => member.isActive).sort((a, b) => a.priority - b.priority)
  if (active.length === 0) return null
  if (!input.roundRobinNumber) return active[0]?.userId ?? null
  const normalizedTarget = normalizePhoneNumber(input.roundRobinNumber)
  const matched = active.find(
    (member) => normalizePhoneNumber(member.forwardingPhoneNumber) === normalizedTarget,
  )
  return matched?.userId ?? active[0]?.userId ?? null
}

export async function resolveInboundDialTargetsWithBrowser(
  admin: SupabaseClient,
  input: {
    organizationId: string
    route: InboundVoiceRouteResolution
    pstnNumbers: string[]
    roundRobinUserId?: string | null
  },
): Promise<{ clientIdentities: string[]; pstnNumbers: string[]; targetUserIds: string[] }> {
  if (!input.route.routingMode || !BROWSER_ROUTING_MODES.has(input.route.routingMode)) {
    logInboundRouteAudit("inbound-browser-routing", {
      branch: "resolveInboundDialTargetsWithBrowser_skipped",
      routingMode: input.route.routingMode,
      routeStatus: input.route.routeStatus,
      businessHoursStatus: input.route.businessHoursStatus,
      destinationUserIds: input.route.destinationUserIds,
      dialNumbers: input.pstnNumbers,
      dialClientIdentities: [],
      reason: "routing_mode_not_browser_capable",
    })
    return { clientIdentities: [], pstnNumbers: input.pstnNumbers, targetUserIds: [] }
  }

  let targetUserIds = [...input.route.destinationUserIds]
  if (input.route.routingMode === "round_robin") {
    targetUserIds = input.roundRobinUserId ? [input.roundRobinUserId] : targetUserIds.slice(0, 1)
  } else if (input.route.routingMode === "assigned_user") {
    targetUserIds = targetUserIds.slice(0, 1)
  }

  const { listOnlineVoiceBrowserDevices } = await import(
    "@/lib/voice/repository/voice-browser-calling-repository"
  )
  const onlineDevices = await listOnlineVoiceBrowserDevices(admin, input.organizationId, {
    userIds: targetUserIds,
  })
  const clientIdentities = onlineDevices.map((device) => device.clientIdentity)
  const merged = mergeBrowserAndPstnDialTargets({
    browserClientIdentities: clientIdentities,
    pstnNumbers: input.pstnNumbers,
    preferBrowser: clientIdentities.length > 0,
  })

  const usersWithDevices = targetUserIds.filter((userId) =>
    merged.clientIdentities.includes(
      buildVoiceBrowserClientIdentity({ organizationId: input.organizationId, userId }),
    ),
  )

  logInboundRouteAudit("inbound-browser-routing", {
    branch: "resolveInboundDialTargetsWithBrowser",
    routingMode: input.route.routingMode,
    routeStatus: input.route.routeStatus,
    businessHoursStatus: input.route.businessHoursStatus,
    destinationUserIds: input.route.destinationUserIds,
    targetUserIds,
    roundRobinUserId: input.roundRobinUserId ?? null,
    onlineDeviceCount: onlineDevices.length,
    onlineClientIdentities: clientIdentities,
    dialNumbers: merged.pstnNumbers,
    dialClientIdentities: merged.clientIdentities,
    preferBrowser: clientIdentities.length > 0,
  })

  return {
    clientIdentities: merged.clientIdentities,
    pstnNumbers: merged.pstnNumbers,
    targetUserIds: usersWithDevices,
  }
}
