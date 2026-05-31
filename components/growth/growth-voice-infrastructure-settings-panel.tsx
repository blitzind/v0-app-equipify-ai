"use client"

import { useCallback, useEffect, useState } from "react"
import { Clock3, Loader2, Phone, PhoneCall, Radio, RefreshCw, Route, ShieldCheck, Voicemail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  GROWTH_SETTINGS_FORM_GAP,
  GROWTH_SETTINGS_SECTION_GAP,
  GrowthSettingsCard,
} from "@/components/growth/growth-settings-ui"
import { GrowthRelationshipMemoryReadinessSection } from "@/components/growth/growth-relationship-memory-readiness-section"
import { GrowthRevenueIntelligenceReadinessSection } from "@/components/growth/growth-revenue-intelligence-readiness-section"
import { GrowthRetentionIntelligenceReadinessSection } from "@/components/growth/growth-retention-intelligence-readiness-section"
import { GrowthAiCopilotReadinessSection } from "@/components/growth/growth-ai-copilot-readiness-section"
import { GrowthAiReceptionistReadinessSection } from "@/components/growth/growth-ai-receptionist-readiness-section"
import { GrowthMissedCallRecoveryReadinessSection } from "@/components/growth/growth-missed-call-recovery-readiness-section"
import { GrowthVoiceDropReadinessSection } from "@/components/growth/growth-voice-drop-readiness-section"
import { GrowthComplianceOrchestrationReadinessSection } from "@/components/growth/growth-compliance-orchestration-readiness-section"
import { GrowthAiOutboundReadinessSection } from "@/components/growth/growth-ai-outbound-readiness-section"
import { GrowthAiOutboundApprovalPanel } from "@/components/growth/growth-ai-outbound-approval-panel"
import { GrowthVoiceObservabilityDashboard } from "@/components/growth/growth-voice-observability-dashboard"
import { GrowthVoiceObservabilityReadinessSection } from "@/components/growth/growth-voice-observability-readiness-section"
import { GrowthWorkflowOrchestrationReadinessSection } from "@/components/growth/growth-workflow-orchestration-readiness-section"
import { GrowthWorkflowOrchestrationWorkspace } from "@/components/growth/growth-workflow-orchestration-workspace"
import { GrowthMultichannelIntelligenceReadinessSection } from "@/components/growth/growth-multichannel-intelligence-readiness-section"
import { GrowthMultichannelIntelligenceWorkspace } from "@/components/growth/growth-multichannel-intelligence-workspace"
import { GrowthComplianceManualReviewPanel } from "@/components/growth/growth-compliance-manual-review-panel"
import { VOICE_CONVERSATION_INTELLIGENCE_QA_MARKER } from "@/lib/voice/intelligence/types"
import {
  VOICE_CALL_CONTROL_QA_MARKER,
  VOICE_FOUNDATION_QA_MARKER,
  VOICE_OPERATIONS_QA_MARKER,
  VOICE_PROVIDER_LABELS,
  VOICE_RECORDING_POLICIES,
  VOICE_RECORDING_POLICY_LABELS,
  VOICE_ROUTING_MODE_LABELS,
  VOICE_TRANSFER_CONTROL_QA_MARKER,
  VOICE_MEDIA_STREAMING_QA_MARKER,
  type InboundCallControlDecision,
  type VoiceBusinessHoursRecord,
  type VoiceNumberListItem,
  type VoiceOperationsReadinessSnapshot,
  type VoiceProviderConfigurationRecord,
  type VoiceRoutingProfileRecord,
  type VoiceVoicemailBoxRecord,
} from "@/lib/voice/types"
import {
  VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER,
  type VoiceBrowserCallingReadinessSnapshot,
  type VoiceOperatorPresencePublicView,
} from "@/lib/voice/browser-calling/types"
import {
  buildRoutingTestRequestBody,
  initialRoutingTestVoiceNumberId,
  resolveRoutingTestVoiceNumberId,
} from "@/lib/voice/admin/routing-test-form"
import type { InboundVoiceRouteResolution } from "@/lib/voice/routing/routing-resolver"

type VoiceSettingsResponse = {
  ok?: boolean
  qaMarker?: string
  operationsQaMarker?: string
  schema?: { ready?: boolean; message?: string; probeUncertain?: boolean }
  readiness?: VoiceOperationsReadinessSnapshot
  twilioEnvPresence?: {
    twilioAccountSid: boolean
    twilioAuthToken: boolean
    growthEngineAiOrgId: boolean
    twilioCredentialsConfigured: boolean
  }
  message?: string
}

type RoutingTestPanelResult = {
  decision: InboundCallControlDecision
  route: InboundVoiceRouteResolution
  twimlPreview: string
}

function RoutingTestResultPanel({ result }: { result: RoutingTestPanelResult }) {
  const { decision, route, twimlPreview } = result
  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs">
      <p className="font-medium text-foreground">Routing test result</p>
      <dl className="grid gap-1 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">action</dt>
          <dd className="font-mono text-foreground">{decision.action}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">routingMode</dt>
          <dd className="font-mono text-foreground">{decision.routingMode ?? "none"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">routeStatus</dt>
          <dd className="font-mono text-foreground">{decision.routeStatus}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">businessHoursStatus</dt>
          <dd className="font-mono text-foreground">{route.businessHoursStatus}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">destinationUserIds</dt>
          <dd className="font-mono break-all text-foreground">
            {route.destinationUserIds.length ? route.destinationUserIds.join(", ") : "—"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">dialClientIdentities</dt>
          <dd className="font-mono break-all text-foreground">
            {(decision.dialClientIdentities?.length ?? 0) > 0
              ? decision.dialClientIdentities?.join(", ")
              : "—"}
          </dd>
        </div>
        {decision.dialNumbers.length > 0 ? (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">dialNumbers</dt>
            <dd className="font-mono break-all text-foreground">{decision.dialNumbers.join(", ")}</dd>
          </div>
        ) : null}
        {route.fallbackReason ? (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">fallbackReason</dt>
            <dd className="text-foreground">{route.fallbackReason}</dd>
          </div>
        ) : null}
      </dl>
      <div>
        <p className="mb-1 text-muted-foreground">twimlPreview</p>
        <pre className="max-h-40 overflow-auto rounded border border-border/60 bg-background p-2 font-mono text-[10px] leading-relaxed text-foreground">
          {twimlPreview}
        </pre>
      </div>
    </div>
  )
}

function ProviderRow({ provider }: { provider: VoiceProviderConfigurationRecord }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm">
      <div>
        <p className="font-medium">{VOICE_PROVIDER_LABELS[provider.provider] ?? provider.provider}</p>
        <p className="text-xs text-muted-foreground">
          Status: {provider.status} · Voice {provider.voiceEnabled ? "enabled" : "disabled"} · SMS{" "}
          {provider.smsEnabled ? "enabled" : "disabled"}
        </p>
      </div>
      <div className="text-xs text-muted-foreground">
        Webhook {provider.webhookValidated ? "validated" : "not validated"}
        {provider.lastValidationAt ? ` · ${new Date(provider.lastValidationAt).toLocaleString()}` : ""}
      </div>
    </div>
  )
}

function NumberRow({
  number,
  onSave,
}: {
  number: VoiceNumberListItem
  onSave: (id: string, patch: { displayName?: string; defaultForwardingTarget?: string; status?: string }) => Promise<void>
}) {
  const [displayName, setDisplayName] = useState(number.displayName)
  const [forwarding, setForwarding] = useState(number.defaultForwardingTarget)
  const [saving, setSaving] = useState(false)

  return (
    <div className="space-y-2 rounded-md border border-border/60 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{number.phoneNumber}</p>
          <p className="text-xs text-muted-foreground">
            {VOICE_PROVIDER_LABELS[number.provider]} · {number.status} · {number.routingModeLabel} · Hours:{" "}
            {number.businessHoursStatusLabel}
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          Voice {number.voiceEnabled ? "on" : "off"} · SMS {number.smsEnabled ? "on" : "off"}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <Label htmlFor={`display-${number.id}`}>Display name</Label>
          <Input id={`display-${number.id}`} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor={`forward-${number.id}`}>Default forwarding target</Label>
          <Input id={`forward-${number.id}`} value={forwarding} onChange={(e) => setForwarding(e.target.value)} />
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={saving}
        onClick={() => {
          setSaving(true)
          void onSave(number.id, { displayName, defaultForwardingTarget: forwarding }).finally(() => setSaving(false))
        }}
      >
        {saving ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
        Save number settings
      </Button>
    </div>
  )
}

export function GrowthVoiceInfrastructureSettingsPanel() {
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [readiness, setReadiness] = useState<VoiceOperationsReadinessSnapshot | null>(null)
  const [schemaMessage, setSchemaMessage] = useState<string | null>(null)
  const [schemaReady, setSchemaReady] = useState(false)
  const [numbers, setNumbers] = useState<VoiceNumberListItem[]>([])
  const [routingProfiles, setRoutingProfiles] = useState<VoiceRoutingProfileRecord[]>([])
  const [businessHours, setBusinessHours] = useState<VoiceBusinessHoursRecord[]>([])
  const [voicemailBoxes, setVoicemailBoxes] = useState<VoiceVoicemailBoxRecord[]>([])
  const [newProfileName, setNewProfileName] = useState("")
  const [newHoursName, setNewHoursName] = useState("")
  const [newVoicemailName, setNewVoicemailName] = useState("")
  const [recordingPolicy, setRecordingPolicy] = useState("disabled")
  const [disclosureText, setDisclosureText] = useState("")
  const [routingTestNumberId, setRoutingTestNumberId] = useState("")
  const [routingTestFrom, setRoutingTestFrom] = useState("+14155550199")
  const [routingTestLoading, setRoutingTestLoading] = useState(false)
  const [routingTestError, setRoutingTestError] = useState<string | null>(null)
  const [routingTestResult, setRoutingTestResult] = useState<RoutingTestPanelResult | null>(null)
  const [browserReadiness, setBrowserReadiness] = useState<VoiceBrowserCallingReadinessSnapshot | null>(null)
  const [operatorPresence, setOperatorPresence] = useState<VoiceOperatorPresencePublicView[]>([])
  const [twilioEnvPresence, setTwilioEnvPresence] = useState<VoiceSettingsResponse["twilioEnvPresence"]>(null)

  const callControl = readiness?.callControlReadiness
  const transferControl = readiness?.transferControlReadiness
  const mediaStreaming = readiness?.mediaStreamingReadiness
  const conversationIntelligence = readiness?.conversationIntelligenceReadiness

  const loadOperations = useCallback(async () => {
    const [numbersRes, profilesRes, hoursRes, boxesRes] = await Promise.all([
      fetch("/api/platform/growth/voice/numbers", { cache: "no-store" }),
      fetch("/api/platform/growth/voice/routing-profiles", { cache: "no-store" }),
      fetch("/api/platform/growth/voice/business-hours", { cache: "no-store" }),
      fetch("/api/platform/growth/voice/voicemail-boxes", { cache: "no-store" }),
    ])
    const numbersData = (await numbersRes.json().catch(() => ({}))) as { numbers?: VoiceNumberListItem[] }
    const profilesData = (await profilesRes.json().catch(() => ({}))) as { profiles?: VoiceRoutingProfileRecord[] }
    const hoursData = (await hoursRes.json().catch(() => ({}))) as { businessHours?: VoiceBusinessHoursRecord[] }
    const boxesData = (await boxesRes.json().catch(() => ({}))) as { voicemailBoxes?: VoiceVoicemailBoxRecord[] }
    if (numbersRes.ok) {
      const loaded = numbersData.numbers ?? []
      setNumbers(loaded)
      setRoutingTestNumberId((current) => current.trim() || initialRoutingTestVoiceNumberId(loaded))
    }
    if (profilesRes.ok) setRoutingProfiles(profilesData.profiles ?? [])
    if (hoursRes.ok) setBusinessHours(hoursData.businessHours ?? [])
    if (boxesRes.ok) setVoicemailBoxes(boxesData.voicemailBoxes ?? [])
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/voice/settings", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as VoiceSettingsResponse
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load voice infrastructure settings.")
      setReadiness(data.readiness ?? null)
      setTwilioEnvPresence(data.twilioEnvPresence ?? null)
      setSchemaReady(Boolean(data.schema?.ready))
      setSchemaMessage(data.schema?.message ?? null)
      setRecordingPolicy(data.readiness?.callControlReadiness?.defaultRecordingPolicy ?? "disabled")
      setDisclosureText(
        data.readiness?.callControlReadiness?.recordingDisclosureText ??
          "This call may be recorded for quality assurance.",
      )
      await loadOperations()
      const presenceRes = await fetch("/api/platform/growth/voice/browser/presence", { cache: "no-store" })
      const presenceData = (await presenceRes.json().catch(() => ({}))) as {
        readiness?: VoiceBrowserCallingReadinessSnapshot
        operators?: VoiceOperatorPresencePublicView[]
      }
      if (presenceRes.ok) {
        setBrowserReadiness(presenceData.readiness ?? null)
        setOperatorPresence(presenceData.operators ?? [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [loadOperations])

  useEffect(() => {
    void load()
  }, [load])

  async function initializeTwilioProvider() {
    setInitializing(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/platform/growth/voice/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "initialize_twilio" }),
      })
      const data = (await res.json().catch(() => ({}))) as VoiceSettingsResponse
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not initialize Twilio provider.")
      setReadiness(data.readiness ?? null)
      setTwilioEnvPresence(data.twilioEnvPresence ?? null)
      setSuccess(data.message ?? "Twilio provider configuration initialized.")
      await loadOperations()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Initialize failed.")
    } finally {
      setInitializing(false)
    }
  }

  async function initializeProviderScaffolding() {
    setInitializing(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/platform/growth/voice/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "initialize_scaffolding" }),
      })
      const data = (await res.json().catch(() => ({}))) as VoiceSettingsResponse
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not initialize voice providers.")
      setReadiness(data.readiness ?? null)
      setTwilioEnvPresence(data.twilioEnvPresence ?? null)
      setSuccess(data.message ?? "Voice provider rows initialized.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Initialize failed.")
    } finally {
      setInitializing(false)
    }
  }

  async function saveNumber(
    id: string,
    patch: { displayName?: string; defaultForwardingTarget?: string; status?: string },
  ) {
    const res = await fetch(`/api/platform/growth/voice/numbers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error("Could not update number.")
    await loadOperations()
    setSuccess("Number settings saved.")
  }

  async function createRoutingProfile() {
    if (!newProfileName.trim()) return
    const res = await fetch("/api/platform/growth/voice/routing-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newProfileName.trim(), routingMode: "assigned_user" }),
    })
    if (!res.ok) throw new Error("Could not create routing profile.")
    setNewProfileName("")
    await loadOperations()
    setSuccess("Routing profile created.")
  }

  async function createBusinessHours() {
    if (!newHoursName.trim()) return
    const res = await fetch("/api/platform/growth/voice/business-hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newHoursName.trim() }),
    })
    if (!res.ok) throw new Error("Could not create business hours profile.")
    setNewHoursName("")
    await loadOperations()
    setSuccess("Business hours profile created.")
  }

  async function createVoicemailBox() {
    if (!newVoicemailName.trim()) return
    const res = await fetch("/api/platform/growth/voice/voicemail-boxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newVoicemailName.trim() }),
    })
    if (!res.ok) throw new Error("Could not create voicemail box.")
    setNewVoicemailName("")
    await loadOperations()
    setSuccess("Voicemail box created.")
  }

  async function saveCallControlSettings() {
    const res = await fetch("/api/platform/growth/voice/call-control/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defaultRecordingPolicy: recordingPolicy,
        recordingDisclosureText: disclosureText,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
    if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not save call control settings.")
    setSuccess("Recording policy saved.")
    await load()
  }

  async function runRoutingTest() {
    setRoutingTestError(null)
    setRoutingTestResult(null)

    const voiceNumberId = resolveRoutingTestVoiceNumberId(routingTestNumberId, numbers)
    if (!voiceNumberId) {
      setRoutingTestError("Enter a voice number id.")
      return
    }

    if (voiceNumberId !== routingTestNumberId.trim()) {
      setRoutingTestNumberId(voiceNumberId)
    }

    setRoutingTestLoading(true)
    try {
      const res = await fetch("/api/platform/growth/voice/routing-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildRoutingTestRequestBody({
            voiceNumberId,
            fromNumber: routingTestFrom,
            skipRoundRobinAdvance: true,
          }),
        ),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        decision?: InboundCallControlDecision
        route?: InboundVoiceRouteResolution
        twimlPreview?: string
        message?: string
      }
      if (!res.ok || !data.ok || !data.decision || !data.route) {
        setRoutingTestError(data.message ?? "Routing test failed.")
        return
      }
      setRoutingTestResult({
        decision: data.decision,
        route: data.route,
        twimlPreview: data.twimlPreview ?? "",
      })
      setSuccess("Routing test completed (planning only).")
    } catch (e) {
      setRoutingTestError(e instanceof Error ? e.message : "Routing test failed.")
    } finally {
      setRoutingTestLoading(false)
    }
  }

  const compliance = readiness?.complianceReadinessExtended
  const twilioProvider = readiness?.configuredProviders.find((provider) => provider.provider === "twilio")
  const twilioProviderMissing = !twilioProvider
  const twilioEnvReady = Boolean(twilioEnvPresence?.twilioCredentialsConfigured)

  return (
    <GrowthSettingsCard title="Voice Infrastructure" icon={<PhoneCall className="size-4" />}>
      <div
        className={GROWTH_SETTINGS_SECTION_GAP}
        data-qa-marker={`${VOICE_FOUNDATION_QA_MARKER} ${VOICE_OPERATIONS_QA_MARKER} ${VOICE_CALL_CONTROL_QA_MARKER} ${VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER} ${VOICE_TRANSFER_CONTROL_QA_MARKER} ${VOICE_MEDIA_STREAMING_QA_MARKER} ${VOICE_CONVERSATION_INTELLIGENCE_QA_MARKER}`}
      >
        <p className="text-sm text-muted-foreground">
          Voice operations layer — number inventory, routing profiles, business hours, and voicemail scaffolding.
          Operator controlled only; no AI calling, voicemail drops, or autonomous outreach in this phase.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading voice operations…
          </div>
        ) : (
          <>
            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="text-sm font-medium">Provider readiness</p>
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                <p className="font-medium">Schema</p>
                <p className="text-muted-foreground">
                  {schemaReady ? "Voice schema probe passed." : schemaMessage ?? "Voice schema status unknown."}
                </p>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                <p className="font-medium">Twilio environment (presence only)</p>
                <p className="text-muted-foreground">
                  TWILIO_ACCOUNT_SID: {twilioEnvPresence?.twilioAccountSid ? "configured" : "missing"}
                </p>
                <p className="text-muted-foreground">
                  TWILIO_AUTH_TOKEN: {twilioEnvPresence?.twilioAuthToken ? "configured" : "missing"}
                </p>
                <p className="text-muted-foreground">
                  GROWTH_ENGINE_AI_ORG_ID: {twilioEnvPresence?.growthEngineAiOrgId ? "configured" : "missing"}
                </p>
              </div>
              {(readiness?.configuredProviders.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No provider configuration rows yet.</p>
              ) : (
                readiness?.configuredProviders.map((provider) => <ProviderRow key={provider.id} provider={provider} />)
              )}
              <div className={`flex flex-wrap items-center ${GROWTH_SETTINGS_FORM_GAP}`}>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void initializeTwilioProvider()}
                  disabled={initializing || !twilioEnvReady || !twilioProviderMissing}
                >
                  {initializing ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
                  Initialize Twilio Provider
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void initializeProviderScaffolding()}
                  disabled={initializing}
                >
                  Initialize provider scaffolding
                </Button>
              </div>
              {!twilioEnvReady ? (
                <p className="text-xs text-muted-foreground">
                  Twilio provider initialization requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in server
                  environment. Secret values are never displayed here.
                </p>
              ) : twilioProvider ? (
                <p className="text-xs text-muted-foreground">
                  Twilio provider row already exists for this organization.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Twilio credentials detected in environment. Initialize to create the org-scoped provider row.
                </p>
              )}
            </section>

            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Phone className="size-4" />
                Numbers
              </p>
              <p className="text-xs text-muted-foreground">
                Number provisioning will be connected after provider credentials are fully validated.
              </p>
              {numbers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No voice numbers in inventory yet.</p>
              ) : (
                numbers.map((number) => (
                  <NumberRow
                    key={number.id}
                    number={number}
                    onSave={async (id, patch) => {
                      try {
                        await saveNumber(id, patch)
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Save failed.")
                      }
                    }}
                  />
                ))
              )}
            </section>

            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Route className="size-4" />
                Routing profiles
              </p>
              {routingProfiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No routing profiles yet.</p>
              ) : (
                routingProfiles.map((profile) => (
                  <div key={profile.id} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                    <p className="font-medium">{profile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {VOICE_ROUTING_MODE_LABELS[profile.routingMode]} · Fallback:{" "}
                      {VOICE_ROUTING_MODE_LABELS[profile.fallbackMode]}
                    </p>
                  </div>
                ))
              )}
              <div className={`flex flex-wrap items-end ${GROWTH_SETTINGS_FORM_GAP}`}>
                <div className="min-w-[220px] flex-1">
                  <Label htmlFor="new-routing-profile">New profile name</Label>
                  <Input
                    id="new-routing-profile"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    placeholder="Main inbound routing"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    void createRoutingProfile().catch((e) =>
                      setError(e instanceof Error ? e.message : "Create failed."),
                    )
                  }}
                >
                  Create routing profile
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {VOICE_ROUTING_MODE_LABELS.ai_receptionist_future} — disabled in Phase 1B.
              </p>
            </section>

            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Clock3 className="size-4" />
                Business hours
              </p>
              {businessHours.length === 0 ? (
                <p className="text-sm text-muted-foreground">No business hours profiles yet.</p>
              ) : (
                businessHours.map((hours) => (
                  <div key={hours.id} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                    <p className="font-medium">{hours.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Timezone: {hours.timezone} · After hours:{" "}
                      {VOICE_ROUTING_MODE_LABELS[hours.afterHoursRoutingMode]}
                    </p>
                  </div>
                ))
              )}
              <div className={`flex flex-wrap items-end ${GROWTH_SETTINGS_FORM_GAP}`}>
                <div className="min-w-[220px] flex-1">
                  <Label htmlFor="new-business-hours">New schedule name</Label>
                  <Input
                    id="new-business-hours"
                    value={newHoursName}
                    onChange={(e) => setNewHoursName(e.target.value)}
                    placeholder="Standard business hours"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    void createBusinessHours().catch((e) =>
                      setError(e instanceof Error ? e.message : "Create failed."),
                    )
                  }}
                >
                  Create business hours
                </Button>
              </div>
            </section>

            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Voicemail className="size-4" />
                Voicemail boxes
              </p>
              {voicemailBoxes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No voicemail boxes yet.</p>
              ) : (
                voicemailBoxes.map((box) => (
                  <div key={box.id} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                    <p className="font-medium">{box.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Retention: {box.retentionDays} days · No AI greeting generation in Phase 1B.
                    </p>
                  </div>
                ))
              )}
              <div className={`flex flex-wrap items-end ${GROWTH_SETTINGS_FORM_GAP}`}>
                <div className="min-w-[220px] flex-1">
                  <Label htmlFor="new-voicemail-box">New voicemail box</Label>
                  <Input
                    id="new-voicemail-box"
                    value={newVoicemailName}
                    onChange={(e) => setNewVoicemailName(e.target.value)}
                    placeholder="Main inbox voicemail"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    void createVoicemailBox().catch((e) =>
                      setError(e instanceof Error ? e.message : "Create failed."),
                    )
                  }}
                >
                  Create voicemail box
                </Button>
              </div>
            </section>

            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Radio className="size-4" />
                Browser calling readiness
              </p>
              <div className="space-y-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                <p>Browser calling ready: {browserReadiness?.browserCallingReady ? "yes" : "not yet"}</p>
                <p>Token readiness: {browserReadiness?.tokenReadiness ?? "unknown"}</p>
                <p>Voice SDK readiness: {browserReadiness?.voiceSdkReadiness ?? "unknown"}</p>
                <p>Websocket readiness: {browserReadiness?.websocketReadiness ?? "unknown"}</p>
                <p>{browserReadiness?.microphoneGuidance}</p>
                <p>{browserReadiness?.browserCompatibilityNote}</p>
                {browserReadiness?.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </section>

            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="text-sm font-medium">Operator presence</p>
              <div className="space-y-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                <p>
                  Connected operators: {browserReadiness?.connectedOperatorCount ?? 0} · Active devices:{" "}
                  {browserReadiness?.activeDeviceCount ?? 0}
                </p>
                {operatorPresence.length === 0 ? (
                  <p>No connected browser devices in the last heartbeat window.</p>
                ) : (
                  operatorPresence.slice(0, 8).map((operator) => (
                    <p key={operator.userId}>
                      {operator.userId.slice(0, 8)}… · {operator.status} · devices {operator.activeDeviceCount}
                    </p>
                  ))
                )}
              </div>
            </section>

            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Route className="size-4" />
                Routing visibility
              </p>
              <p className="text-xs text-muted-foreground">
                Live routing preview uses the planning-only routing test tool below. Fallback voicemail and after-hours
                routing remain authoritative when browser operators are offline.
              </p>
            </section>

            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Radio className="size-4" />
                Call control readiness
              </p>
              <div className="space-y-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                <p>Inbound webhook: {callControl?.inboundWebhookUrl ?? "—"}</p>
                <p>Status webhook: {callControl?.statusWebhookUrl ?? "—"}</p>
                <p>Recording callback: {callControl?.recordingCallbackUrl ?? "—"}</p>
                <p>Inbound control ready: {callControl?.inboundCallControlReady ? "yes" : "not yet"}</p>
                <p>Voicemail callback ready: {callControl?.voicemailCallbackReady ? "yes" : "not yet"}</p>
                <p>{callControl?.callControlMessage}</p>
              </div>
            </section>

            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="flex items-center gap-2 text-sm font-medium">
                <PhoneCall className="size-4" />
                Multi-party call control readiness
              </p>
              <div className="space-y-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                <p>Multi-party control ready: {transferControl?.multiPartyCallControlReady ? "yes" : "not yet"}</p>
                <p>Transfer readiness: {transferControl?.transferReadiness ?? "unknown"}</p>
                <p>Supervisor join readiness: {transferControl?.supervisorJoinReadiness ?? "unknown"}</p>
                <p>Provider conference capability: {transferControl?.providerConferenceCapability ?? "unknown"}</p>
                <p>{transferControl?.message}</p>
                {transferControl?.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </section>

            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Radio className="size-4" />
                Media streaming readiness
              </p>
              <div className="space-y-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                <p>Media streaming ready: {mediaStreaming?.mediaStreamingReady ? "yes" : "not yet"}</p>
                <p>Twilio Media Streams: {mediaStreaming?.twilioMediaStreamsReadiness ?? "unknown"}</p>
                <p>Websocket readiness: {mediaStreaming?.websocketReadiness ?? "unknown"}</p>
                <p>Transcript provider readiness: {mediaStreaming?.transcriptProviderReadiness ?? "unknown"}</p>
                <p>Stream health: {mediaStreaming?.streamHealth ?? "unknown"}</p>
                <p>Reconnect health: {mediaStreaming?.reconnectHealth ?? "unknown"}</p>
                <p>Media stream URL: {mediaStreaming?.mediaStreamUrl ?? "—"}</p>
                <p>{mediaStreaming?.message}</p>
                {mediaStreaming?.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </section>

            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="text-sm font-medium">Transcript infrastructure</p>
              <div className="space-y-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                <p>Active transcript sessions: {mediaStreaming?.activeTranscriptSessions ?? 0}</p>
                <p>Transcript provider status: {mediaStreaming?.transcriptProviderStatus ?? "unknown"}</p>
                <p>
                  Transcript latency:{" "}
                  {mediaStreaming?.transcriptLatencyMs != null
                    ? `${mediaStreaming.transcriptLatencyMs}ms`
                    : "not measured yet"}
                </p>
              </div>
            </section>

            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="text-sm font-medium">Stream diagnostics</p>
              <div className="space-y-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                <p>Active streams: {mediaStreaming?.diagnostics.activeStreamCount ?? 0}</p>
                <p>Participant count: {mediaStreaming?.diagnostics.participantCount ?? 0}</p>
                <p>Reconnect count: {mediaStreaming?.diagnostics.reconnectCount ?? 0}</p>
                <p>Stale streams cleaned: {mediaStreaming?.diagnostics.staleStreamsCleaned ?? 0}</p>
              </div>
            </section>

            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="size-4" />
                Voice intelligence readiness
              </p>
              <div className="space-y-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                <p>Intelligence ready: {conversationIntelligence?.intelligenceReady ? "yes" : "not yet"}</p>
                <p>Transcript provider status: {conversationIntelligence?.transcriptProviderStatus ?? "unknown"}</p>
                <p>AI analysis provider: {conversationIntelligence?.analysisProviderStatus ?? "unknown"}</p>
                <p>Passive mode enabled: {conversationIntelligence?.passiveModeEnabled ? "yes" : "no"}</p>
                <p>Autonomous actions disabled: {conversationIntelligence?.autonomousActionsDisabled ? "yes" : "no"}</p>
                <p>Evidence requirement enabled: {conversationIntelligence?.evidenceRequirementEnabled ? "yes" : "no"}</p>
                <p>{conversationIntelligence?.message}</p>
                {conversationIntelligence?.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </section>

            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="text-sm font-medium">Recording policy</p>
              <p className="text-xs text-muted-foreground">{callControl?.recordingDisclosureMessage}</p>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <Label htmlFor="recording-policy">Default recording policy</Label>
                  <select
                    id="recording-policy"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={recordingPolicy}
                    onChange={(e) => setRecordingPolicy(e.target.value)}
                  >
                    {VOICE_RECORDING_POLICIES.map((policy) => (
                      <option key={policy} value={policy}>
                        {VOICE_RECORDING_POLICY_LABELS[policy]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="disclosure-text">Disclosure placeholder</Label>
                  <Input
                    id="disclosure-text"
                    value={disclosureText}
                    onChange={(e) => setDisclosureText(e.target.value)}
                  />
                </div>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => void saveCallControlSettings().catch((e) => setError(e instanceof Error ? e.message : "Save failed."))}>
                Save recording policy
              </Button>
            </section>

            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="text-sm font-medium">Routing test tool</p>
              <p className="text-xs text-muted-foreground">Planning-only — returns deterministic route decision without placing a call.</p>
              <div className={`grid gap-2 md:grid-cols-2 ${GROWTH_SETTINGS_FORM_GAP}`}>
                <div>
                  <Label htmlFor="routing-test-number">Voice number id</Label>
                  <Input
                    id="routing-test-number"
                    value={routingTestNumberId}
                    onChange={(e) => setRoutingTestNumberId(e.target.value)}
                    placeholder={numbers[0]?.id ?? "uuid"}
                  />
                </div>
                <div>
                  <Label htmlFor="routing-test-from">Simulated caller</Label>
                  <Input id="routing-test-from" value={routingTestFrom} onChange={(e) => setRoutingTestFrom(e.target.value)} />
                </div>
              </div>
              <Button type="button" size="sm" onClick={() => void runRoutingTest().catch((e) => setError(e instanceof Error ? e.message : "Test failed."))}>
                Run routing test
              </Button>
              {routingTestResult ? (
                <div className="rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground">
                  Action: {routingTestResult.action} · Mode: {routingTestResult.routingMode ?? "none"} · Status:{" "}
                  {routingTestResult.routeStatus}
                  {routingTestResult.dialNumbers.length > 0 ? ` · Dial: ${routingTestResult.dialNumbers.join(", ")}` : ""}
                  {(routingTestResult.dialClientIdentities?.length ?? 0) > 0
                    ? ` · Browser clients: ${routingTestResult.dialClientIdentities?.join(", ")}`
                    : ""}
                </div>
              ) : null}
            </section>

            <GrowthRelationshipMemoryReadinessSection />
            <GrowthRevenueIntelligenceReadinessSection />
            <GrowthRetentionIntelligenceReadinessSection />
            <GrowthAiCopilotReadinessSection />
            <GrowthAiReceptionistReadinessSection />
            <GrowthMissedCallRecoveryReadinessSection />
            <GrowthVoiceDropReadinessSection />
            <GrowthComplianceOrchestrationReadinessSection />
            <GrowthAiOutboundReadinessSection />
            <GrowthAiOutboundApprovalPanel />
            <GrowthVoiceObservabilityReadinessSection />
            <GrowthWorkflowOrchestrationReadinessSection />
            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <GrowthWorkflowOrchestrationWorkspace />
            </section>
            <GrowthMultichannelIntelligenceReadinessSection />
            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <GrowthMultichannelIntelligenceWorkspace />
            </section>
            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <GrowthVoiceObservabilityDashboard />
            </section>
            <GrowthComplianceManualReviewPanel />

            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="size-4" />
                Compliance readiness
              </p>
              <div className="space-y-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                <p>Opt-out registry: {readiness?.complianceReadinessExtended?.optOutTableReady ? "table ready" : "pending"} ({readiness?.complianceReadinessExtended?.optOutCount ?? 0} records)</p>
                <p>{readiness?.complianceReadinessExtended?.dncEnforcementMessage}</p>
                <p>{readiness?.complianceReadinessExtended?.callRecordingDisclosureMessage}</p>
                <p>{readiness?.complianceReadinessExtended?.aiDisclosureMessage}</p>
              </div>
            </section>

            <p className="text-xs text-muted-foreground">{readiness?.infrastructureMessage}</p>

            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className="mr-1 size-3.5" />
              Refresh all
            </Button>
          </>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p> : null}
      </div>
    </GrowthSettingsCard>
  )
}
