/**
 * Offline inbound route audit — shows audit log output for common voicemail paths.
 * Run: pnpm tsx scripts/simulate-inbound-voice-route-audit.ts
 */
import {
  mapInboundRouteToCallControlDecision,
  resolveDialNumbersFromRoute,
} from "../lib/voice/call-control/inbound-call-control"
import { buildVoiceBrowserClientIdentity } from "../lib/voice/browser-calling/status-mapping"
import { resolveInboundVoiceRoute } from "../lib/voice/routing/routing-resolver"

function mergeBrowserAndPstnDialTargets(input: {
  browserClientIdentities: string[]
  pstnNumbers: string[]
  preferBrowser: boolean
}) {
  if (input.preferBrowser && input.browserClientIdentities.length > 0) {
    return { clientIdentities: input.browserClientIdentities, pstnNumbers: input.pstnNumbers }
  }
  return { clientIdentities: [], pstnNumbers: input.pstnNumbers }
}

const organizationId = "11111111-1111-4111-8111-111111111111"
const operatorUserId = "22222222-2222-4222-8222-222222222222"
const clientIdentity = buildVoiceBrowserClientIdentity({ organizationId, userId: operatorUserId })

function simulate(label: string, input: Parameters<typeof resolveInboundVoiceRoute>[0], browserOnline: boolean) {
  console.log(`\n========== ${label} ==========`)
  const route = resolveInboundVoiceRoute(input)
  const dialNumbers = resolveDialNumbersFromRoute({
    route,
    numberDefaultForward: input.number.defaultForwardingTarget ?? "",
    memberForwardNumbers: [],
    roundRobinNumber: null,
  })
  const merged = mergeBrowserAndPstnDialTargets({
    browserClientIdentities: browserOnline ? [clientIdentity] : [],
    pstnNumbers: dialNumbers,
    preferBrowser: browserOnline,
  })
  mapInboundRouteToCallControlDecision({
    route,
    dialNumbers: merged.pstnNumbers,
    dialClientIdentities: merged.clientIdentities,
    recordingEnabled: false,
    recordingDisclosureText: null,
  })
}

const baseNumber = {
  id: "vn-8333",
  phoneNumber: "+18333784743",
  status: "active" as const,
  voiceEnabled: true,
  defaultForwardingTarget: "",
  routingProfileId: "profile-1",
}

const baseProfile = {
  id: "profile-1",
  organizationId,
  name: "Main",
  description: "",
  routingMode: "assigned_user" as const,
  fallbackMode: "voicemail_only" as const,
  fallbackPhoneNumber: "",
  voicemailBoxId: "vb-1",
  businessHoursId: "bh-1",
  metadataJson: {},
  createdAt: "",
  updatedAt: "",
}

simulate("A — after-hours closed (assigned_user overridden to voicemail)", {
  organizationId,
  fromNumber: "+14155550199",
  number: { ...baseNumber, routingMode: null, assignedUserId: operatorUserId },
  routingProfile: baseProfile,
  businessHoursStatus: "closed",
}, true)

simulate("B — explicit voicemail_only on profile", {
  organizationId,
  fromNumber: "+14155550199",
  number: { ...baseNumber, routingMode: null, assignedUserId: operatorUserId },
  routingProfile: { ...baseProfile, routingMode: "voicemail_only" },
  businessHoursStatus: "open",
}, true)

simulate("C — assigned_user resolved but operator offline (no browser client)", {
  organizationId,
  fromNumber: "+14155550199",
  number: { ...baseNumber, routingMode: null, assignedUserId: operatorUserId },
  routingProfile: baseProfile,
  businessHoursStatus: "open",
}, false)

simulate("D — assigned_user missing (degraded → voicemail when box exists)", {
  organizationId,
  fromNumber: "+14155550199",
  number: { ...baseNumber, routingMode: null, assignedUserId: null },
  routingProfile: baseProfile,
  businessHoursStatus: "open",
}, true)

simulate("E — happy path: assigned_user + open hours + online browser", {
  organizationId,
  fromNumber: "+14155550199",
  number: { ...baseNumber, routingMode: null, assignedUserId: operatorUserId },
  routingProfile: baseProfile,
  businessHoursStatus: "open",
}, true)

console.log("\nDone. Search logs for [Voice:inbound-route-audit]")
