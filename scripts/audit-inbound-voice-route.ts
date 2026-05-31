/**
 * Live inbound route audit — replays routing decision against production DB config.
 * Run: pnpm tsx scripts/audit-inbound-voice-route.ts [phoneNumber] [fromNumber]
 */
import { readFileSync } from "node:fs"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { evaluateVoiceBusinessHours } from "../lib/voice/business-hours/business-hours-evaluator"
import {
  mapInboundRouteToCallControlDecision,
  resolveDialNumbersFromRoute,
} from "../lib/voice/call-control/inbound-call-control"
import { generateInboundCallResponseTwiml } from "../lib/voice/call-control/twilio-twiml"
import {
  resolveInboundDialTargetsWithBrowser,
  resolveRoundRobinMemberUserId,
} from "../lib/voice/browser-calling/inbound-browser-routing"
import { normalizePhoneNumber } from "../lib/voice/phone-normalization"
import { resolveInboundVoiceRoute } from "../lib/voice/routing/routing-resolver"
import type { VoiceNumberRecord, VoiceRoutingProfileMemberRecord, VoiceRoutingProfileRecord } from "../lib/voice/types"

function loadEnvFile(path: string): void {
  try {
    const raw = readFileSync(path, "utf8")
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq)
      let value = trimmed.slice(eq + 1)
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // optional env file
  }
}

function mapNumber(row: Record<string, unknown>): VoiceNumberRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    provider: row.provider as VoiceNumberRecord["provider"],
    providerNumberId: String(row.provider_number_id ?? ""),
    phoneNumber: String(row.phone_number),
    displayName: String(row.display_name ?? ""),
    capabilitiesJson: (row.capabilities_json as Record<string, unknown>) ?? {},
    status: row.status as VoiceNumberRecord["status"],
    smsEnabled: Boolean(row.sms_enabled),
    voiceEnabled: Boolean(row.voice_enabled),
    assignedUserId: row.assigned_user_id ? String(row.assigned_user_id) : null,
    routingProfileId: row.routing_profile_id ? String(row.routing_profile_id) : null,
    routingMode: (row.routing_mode as VoiceNumberRecord["routingMode"]) ?? null,
    defaultForwardingTarget: String(row.default_forwarding_target ?? ""),
    recordingPolicy: null,
    metadataJson: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapRoutingProfile(row: Record<string, unknown>): VoiceRoutingProfileRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    description: String(row.description ?? ""),
    routingMode: row.routing_mode as VoiceRoutingProfileRecord["routingMode"],
    fallbackMode: row.fallback_mode as VoiceRoutingProfileRecord["fallbackMode"],
    fallbackPhoneNumber: String(row.fallback_phone_number ?? ""),
    voicemailBoxId: row.voicemail_box_id ? String(row.voicemail_box_id) : null,
    businessHoursId: row.business_hours_id ? String(row.business_hours_id) : null,
    metadataJson: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapRoutingMember(row: Record<string, unknown>): VoiceRoutingProfileMemberRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    routingProfileId: String(row.routing_profile_id),
    userId: String(row.user_id),
    priority: Number(row.priority ?? 0),
    isActive: Boolean(row.is_active),
    forwardingPhoneNumber: String(row.forwarding_phone_number ?? ""),
    browserClientIdentity: (row.browser_client_identity as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

async function pickRoundRobinMemberForwardNumber(
  admin: SupabaseClient,
  organizationId: string,
  members: VoiceRoutingProfileMemberRecord[],
): Promise<string | null> {
  const active = members
    .filter((m) => m.isActive && m.forwardingPhoneNumber)
    .sort((a, b) => a.priority - b.priority)
  return active[0] ? normalizePhoneNumber(active.forwardingPhoneNumber) || active[0].forwardingPhoneNumber : null
}

async function main() {
  for (const path of [".env.local", ".env.local.active", ".vercel/.env.production.local", ".env.vercel.production"]) {
    loadEnvFile(path)
  }

  const phoneArg = process.argv[2] ?? "+18333784743"
  const fromNumber = normalizePhoneNumber(process.argv[3] ?? "+14155550199") || "+14155550199"
  const phoneDigits = phoneArg.replace(/\D/g, "")

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }

  const admin = createClient(url, key, { auth: { persistSession: false } })

  const { data: numberRows, error: numberError } = await admin
    .schema("voice")
    .from("voice_numbers")
    .select("*")
    .or(`phone_number.eq.${phoneArg},phone_number.ilike.%${phoneDigits}`)
    .limit(5)

  if (numberError) throw new Error(numberError.message)
  if (!numberRows?.length) {
    console.error(`No voice_numbers row found for ${phoneArg}`)
    process.exit(1)
  }

  const voiceNumber = mapNumber(numberRows[0] as Record<string, unknown>)
  const organizationId = voiceNumber.organizationId

  const routingProfile = voiceNumber.routingProfileId
    ? await admin
        .schema("voice")
        .from("voice_routing_profiles")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("id", voiceNumber.routingProfileId)
        .maybeSingle()
        .then(({ data }) => (data ? mapRoutingProfile(data as Record<string, unknown>) : null))
    : null

  const members = routingProfile
    ? await admin
        .schema("voice")
        .from("voice_routing_profile_members")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("routing_profile_id", routingProfile.id)
        .then(({ data }) => (data ?? []).map((row) => mapRoutingMember(row as Record<string, unknown>)))
    : []

  const businessHours = routingProfile?.businessHoursId
    ? await admin
        .schema("voice")
        .from("voice_business_hours")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("id", routingProfile.businessHoursId)
        .maybeSingle()
        .then(({ data }) => data as Record<string, unknown> | null)
    : null

  const businessHoursStatus = businessHours
    ? evaluateVoiceBusinessHours({
        timezone: String(businessHours.timezone ?? "America/New_York"),
        weeklyScheduleJson: (businessHours.weekly_schedule_json as Record<string, unknown>) ?? {},
        holidayRulesJson: Array.isArray(businessHours.holiday_rules_json) ? businessHours.holiday_rules_json : [],
      })
    : "unknown"

  const route = resolveInboundVoiceRoute({
    organizationId,
    number: voiceNumber,
    fromNumber,
    routingProfile,
    routingMembers: members,
    businessHoursStatus,
  })

  const memberForwardNumbers = members
    .filter((member) => member.isActive && member.forwardingPhoneNumber)
    .sort((a, b) => a.priority - b.priority)
    .map((member) => normalizePhoneNumber(member.forwardingPhoneNumber))
    .filter(Boolean)

  const roundRobinNumber =
    routingProfile && route.routingMode === "round_robin"
      ? await pickRoundRobinMemberForwardNumber(admin, organizationId, members)
      : memberForwardNumbers[0] ?? null

  const dialNumbers = resolveDialNumbersFromRoute({
    route,
    numberDefaultForward: normalizePhoneNumber(voiceNumber.defaultForwardingTarget),
    memberForwardNumbers,
    roundRobinNumber,
  })

  const roundRobinUserId = resolveRoundRobinMemberUserId({ members, roundRobinNumber })
  const browserTargets = await resolveInboundDialTargetsWithBrowser(admin, {
    organizationId,
    route,
    pstnNumbers: dialNumbers,
    roundRobinUserId,
  })

  const decision = mapInboundRouteToCallControlDecision({
    route,
    dialNumbers: browserTargets.pstnNumbers,
    dialClientIdentities: browserTargets.clientIdentities,
    recordingEnabled: false,
    recordingDisclosureText: null,
  })

  const twiml = generateInboundCallResponseTwiml({
    decision,
    callerId: voiceNumber.phoneNumber,
    recordingCallbackUrl: null,
  })

  const { data: devices } = await admin
    .schema("voice")
    .from("voice_browser_devices")
    .select("user_id, client_identity, status, last_heartbeat_at")
    .eq("organization_id", organizationId)
    .in("status", ["available", "busy", "reconnecting"])

  console.log("\n=== Inbound route audit summary ===")
  console.log(
    JSON.stringify(
      {
        phoneNumber: voiceNumber.phoneNumber,
        organizationId,
        assignedUserId: voiceNumber.assignedUserId,
        routingProfileId: voiceNumber.routingProfileId,
        numberRoutingMode: voiceNumber.routingMode,
        profileRoutingMode: routingProfile?.routingMode ?? null,
        businessHoursStatus,
        route,
        dialNumbers: decision.dialNumbers,
        dialClientIdentities: decision.dialClientIdentities,
        finalAction: decision.action,
        onlineDevices: devices ?? [],
        twimlPreview: twiml.slice(0, 220),
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
