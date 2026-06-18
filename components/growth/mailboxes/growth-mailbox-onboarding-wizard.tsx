"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, ChevronLeft, ChevronRight, Loader2, Plug, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_MAILBOX_ONBOARDING_QA_MARKER,
  GROWTH_MAILBOX_ONBOARDING_STEPS,
  type GrowthMailboxOnboardingStatusPayload,
  type GrowthMailboxOnboardingStep,
} from "@/lib/growth/mailboxes/mailbox-onboarding-types"
import { interpolateWarmupVolume } from "@/lib/growth/warmup/warmup-scheduler"
import { GROWTH_SENDER_PROVIDER_FAMILIES, type GrowthSenderProviderFamily } from "@/lib/growth/sender/sender-types"
import type { GrowthSenderPool } from "@/lib/growth/sender-pools/sender-pool-types"

const ONBOARD_RETURN_PATH = "/admin/growth/infrastructure/mailboxes/onboard"
const SESSION_KEY = "growth-mailbox-onboard-draft-v1"

const PROVIDER_LABELS: Record<GrowthSenderProviderFamily, string> = {
  google: "Google (Gmail)",
  microsoft: "Microsoft 365",
  smtp: "SMTP",
  custom: "Custom",
}

const STEP_LABELS: Record<GrowthMailboxOnboardingStep, string> = {
  create_sender: "Create sender",
  connect_gmail: "Connect Gmail",
  validate: "Validate",
  warmup: "Warmup",
  pool: "Pool",
  activation: "Activation",
}

type WizardDraft = {
  displayName: string
  email: string
  providerFamily: GrowthSenderProviderFamily
  dailyCap: string
  notes: string
  warmupEnabled: boolean
  warmupDays: string
  poolMode: "skip" | "existing" | "create"
  poolId: string
  newPoolName: string
}

const DEFAULT_DRAFT: WizardDraft = {
  displayName: "",
  email: "",
  providerFamily: "google",
  dailyCap: "50",
  notes: "",
  warmupEnabled: false,
  warmupDays: "30",
  poolMode: "skip",
  poolId: "",
  newPoolName: "",
}

function stepIndex(step: GrowthMailboxOnboardingStep): number {
  return GROWTH_MAILBOX_ONBOARDING_STEPS.indexOf(step)
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

function readDraft(): WizardDraft {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return DEFAULT_DRAFT
    return { ...DEFAULT_DRAFT, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_DRAFT
  }
}

function writeDraft(draft: WizardDraft) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(draft))
}

function clearDraft() {
  sessionStorage.removeItem(SESSION_KEY)
}

export function GrowthMailboxOnboardingWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [draft, setDraft] = useState<WizardDraft>(DEFAULT_DRAFT)
  const [step, setStep] = useState<GrowthMailboxOnboardingStep>("create_sender")
  const [senderId, setSenderId] = useState<string | null>(null)
  const [status, setStatus] = useState<GrowthMailboxOnboardingStatusPayload | null>(null)
  const [pools, setPools] = useState<GrowthSenderPool[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [oauthNotice, setOauthNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null)
  const [testSendOpen, setTestSendOpen] = useState(false)
  const [testSendTo, setTestSendTo] = useState("")
  const [testSendApproval, setTestSendApproval] = useState(false)

  const currentStepIndex = stepIndex(step)
  const projectedStartingCap = interpolateWarmupVolume(1)

  const loadStatus = useCallback(async (id: string) => {
    const res = await fetch(`/api/platform/growth/mailboxes/onboard/status?senderId=${id}`, { cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      status?: GrowthMailboxOnboardingStatusPayload
      message?: string
    }
    if (!res.ok || !data.ok || !data.status) {
      throw new Error(data.message ?? "Could not load onboarding status.")
    }
    setStatus(data.status)
    return data.status
  }, [])

  const loadPools = useCallback(async () => {
    const res = await fetch("/api/platform/growth/sender-pools", { cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; pools?: GrowthSenderPool[] }
    if (res.ok && data.pools) setPools(data.pools)
  }, [])

  useEffect(() => {
    setDraft(readDraft())
    void loadPools()
  }, [loadPools])

  useEffect(() => {
    const urlSenderId = searchParams.get("senderId")?.trim() || null
    const urlStep = searchParams.get("step")?.trim() as GrowthMailboxOnboardingStep | null
    const providerConnected = searchParams.get("provider_connected")
    const providerError = searchParams.get("provider_error")

    if (providerConnected === "google") {
      setOauthNotice({
        tone: "success",
        message: "Gmail connected successfully. Live validation passed.",
      })
    } else if (providerError) {
      setOauthNotice({
        tone: "error",
        message: `Gmail connection failed: ${providerError.replace(/_/g, " ")}.`,
      })
    }

    if (urlSenderId) {
      setSenderId(urlSenderId)
      setLoading(true)
      void loadStatus(urlSenderId)
        .then((loaded) => {
          if (urlStep && GROWTH_MAILBOX_ONBOARDING_STEPS.includes(urlStep)) {
            setStep(urlStep)
          } else if (providerConnected === "google") {
            setStep("validate")
          } else {
            setStep(loaded.suggestedStep)
          }
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Load failed."))
        .finally(() => setLoading(false))
    }
  }, [searchParams, loadStatus])

  function updateDraft(patch: Partial<WizardDraft>) {
    setDraft((current) => {
      const next = { ...current, ...patch }
      writeDraft(next)
      return next
    })
  }

  function goToStep(next: GrowthMailboxOnboardingStep, id?: string) {
    setStep(next)
    const params = new URLSearchParams()
    const resolvedId = id ?? senderId
    if (resolvedId) params.set("senderId", resolvedId)
    params.set("step", next)
    router.replace(`${ONBOARD_RETURN_PATH}?${params.toString()}`)
  }

  async function createSender() {
    if (!draft.displayName.trim() || !draft.email.trim()) {
      throw new Error("Display name and email are required.")
    }
    const res = await fetch("/api/platform/growth/senders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerFamily: draft.providerFamily,
        displayName: draft.displayName.trim(),
        emailAddress: draft.email.trim(),
        dailySendLimit: Number.parseInt(draft.dailyCap, 10) || 50,
        notes: draft.notes.trim() || null,
        status: "pending",
      }),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; sender?: { id?: string }; message?: string }
    if (!res.ok || !data.sender?.id) throw new Error(data.message ?? "Could not create sender.")
    setSenderId(data.sender.id)
    await loadStatus(data.sender.id)
    goToStep(draft.providerFamily === "google" ? "connect_gmail" : "validate", data.sender.id)
  }

  async function prepareAndConnectGmail() {
    if (!senderId) throw new Error("Create a sender first.")
    const prepareRes = await fetch("/api/platform/growth/mailboxes/onboard/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senderId }),
    })
    const prepareData = (await prepareRes.json().catch(() => ({}))) as {
      ok?: boolean
      mailboxId?: string
      message?: string
    }
    if (!prepareRes.ok || !prepareData.ok) {
      throw new Error(prepareData.message ?? "Could not prepare mailbox connection.")
    }

    const returnTo = `${ONBOARD_RETURN_PATH}?senderId=${senderId}&step=validate`
    const oauthRes = await fetch("/api/platform/growth/provider-setup/google/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender_account_id: senderId,
        mailbox_connection_id: prepareData.mailboxId,
        return_to: returnTo,
      }),
    })
    const oauthData = (await oauthRes.json().catch(() => ({}))) as {
      authorize_url?: string
      message?: string
    }
    if (!oauthRes.ok || !oauthData.authorize_url) {
      throw new Error(oauthData.message ?? "Google OAuth could not start.")
    }
    window.location.href = oauthData.authorize_url
  }

  async function validateMailbox() {
    if (!status?.mailbox?.id) throw new Error("No mailbox to validate.")
    const res = await fetch(`/api/platform/growth/mailboxes/${status.mailbox.id}/validate`, { method: "POST" })
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    if (!res.ok) throw new Error(data.message ?? "Validation failed.")
    if (senderId) await loadStatus(senderId)
  }

  async function finalizeOnboarding(options?: { activateSender?: boolean; activatePool?: boolean }) {
    if (!senderId) throw new Error("Sender is missing.")
    const res = await fetch("/api/platform/growth/mailboxes/onboard/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderId,
        warmupEnabled: draft.warmupEnabled,
        warmupDays: Number.parseInt(draft.warmupDays, 10) || 30,
        poolId: draft.poolMode === "existing" ? draft.poolId || null : null,
        newPoolName: draft.poolMode === "create" ? draft.newPoolName.trim() || null : null,
        activatePool: options?.activatePool ?? true,
        activateSender: options?.activateSender ?? true,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      status?: GrowthMailboxOnboardingStatusPayload
      message?: string
    }
    if (!res.ok || !data.status) throw new Error(data.message ?? "Finalize failed.")
    setStatus(data.status)
    return data.status
  }

  async function runTestSend() {
    if (!senderId || !testSendTo.trim()) throw new Error("Recipient email is required.")
    if (!testSendApproval) throw new Error("Human approval is required.")
    const res = await fetch("/api/platform/growth/provider-setup/google/test-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender_account_id: senderId,
        to: testSendTo.trim(),
        humanApprovalConfirmed: true,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
    if (!res.ok || !data.ok) throw new Error(data.message ?? "Test send failed.")
    setTestSendOpen(false)
    setTestSendTo("")
    setTestSendApproval(false)
  }

  async function runStepAction(fn: () => Promise<void>) {
    setLoading(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.")
    } finally {
      setLoading(false)
    }
  }

  function resetWizard() {
    clearDraft()
    setDraft(DEFAULT_DRAFT)
    setSenderId(null)
    setStatus(null)
    setStep("create_sender")
    setOauthNotice(null)
    router.replace(ONBOARD_RETURN_PATH)
  }

  const review = useMemo(() => status, [status])

  if (loading && !status && senderId) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading mailbox onboarding…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {GROWTH_MAILBOX_ONBOARDING_QA_MARKER} · Guided onboarding for sender, Gmail OAuth, validation, warmup, and pool
          assignment.
        </p>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/admin/growth/infrastructure/mailboxes">Connected mailboxes</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {GROWTH_MAILBOX_ONBOARDING_STEPS.map((stepId, index) => {
          const done = index < currentStepIndex
          const active = stepId === step
          return (
            <div
              key={stepId}
              className={
                active
                  ? "rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-900"
                  : done
                    ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900"
                    : "rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground"
              }
            >
              <span className="mr-1.5 inline-flex size-5 items-center justify-center rounded-full border text-[10px]">
                {done ? <Check className="size-3" /> : index + 1}
              </span>
              {STEP_LABELS[stepId]}
            </div>
          )
        })}
      </div>

      {oauthNotice ? (
        <div
          className={
            oauthNotice.tone === "success"
              ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
              : "rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
          }
        >
          {oauthNotice.message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}

      {step === "create_sender" ? (
        <GrowthEngineCard title="Step 1 — Create sender">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="onboard-display-name">Display name</Label>
              <Input
                id="onboard-display-name"
                value={draft.displayName}
                onChange={(e) => updateDraft({ displayName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="onboard-email">Email</Label>
              <Input
                id="onboard-email"
                type="email"
                value={draft.email}
                onChange={(e) => updateDraft({ email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="onboard-provider">Provider</Label>
              <Select
                value={draft.providerFamily}
                onValueChange={(value) => updateDraft({ providerFamily: value as GrowthSenderProviderFamily })}
              >
                <SelectTrigger id="onboard-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROWTH_SENDER_PROVIDER_FAMILIES.map((family) => (
                    <SelectItem key={family} value={family}>
                      {PROVIDER_LABELS[family]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="onboard-daily-cap">Daily cap</Label>
              <Input
                id="onboard-daily-cap"
                type="number"
                min={1}
                value={draft.dailyCap}
                onChange={(e) => updateDraft({ dailyCap: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="onboard-notes">Notes</Label>
              <Textarea
                id="onboard-notes"
                value={draft.notes}
                onChange={(e) => updateDraft({ notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="button" disabled={loading} onClick={() => void runStepAction(createSender)}>
              Continue
              <ChevronRight className="ml-1.5 size-4" />
            </Button>
          </div>
        </GrowthEngineCard>
      ) : null}

      {step === "connect_gmail" ? (
        <GrowthEngineCard title="Step 2 — Connect Gmail">
          {status ? (
            <p className="mb-4 text-sm text-muted-foreground">
              Sender <strong>{status.sender.email}</strong> · domain auto-created on sender registration.
            </p>
          ) : null}
          {draft.providerFamily !== "google" ? (
            <p className="text-sm text-muted-foreground">
              OAuth connect is for Google mailboxes. Continue to validation for other providers.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect Google to store encrypted send + inbox-read tokens. Mailbox connection is created automatically if
                missing.
              </p>
              <Button type="button" disabled={loading || !senderId} onClick={() => void runStepAction(prepareAndConnectGmail)}>
                {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plug className="mr-2 size-4" />}
                Connect Google
              </Button>
            </div>
          )}
          <div className="mt-4 flex justify-between">
            <Button type="button" variant="outline" disabled={loading} onClick={() => goToStep("create_sender")}>
              <ChevronLeft className="mr-1.5 size-4" />
              Back
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => goToStep("validate")}
            >
              Skip to validate
              <ChevronRight className="ml-1.5 size-4" />
            </Button>
          </div>
        </GrowthEngineCard>
      ) : null}

      {step === "validate" ? (
        <GrowthEngineCard title="Step 3 — Validate mailbox">
          {status?.mailbox ? (
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile label="Connected" value={status.mailbox.status} />
              <StatTile label="Token status" value={status.mailbox.tokenConfigured ? "Stored" : "Missing"} />
              <StatTile label="Health" value={`${status.mailbox.connectionHealth}%`} />
              <StatTile label="Last validation" value={formatDate(status.mailbox.lastValidationAt)} />
            </div>
          ) : (
            <p className="mb-4 text-sm text-muted-foreground">No mailbox connection yet. Connect Gmail first.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading || !status?.mailbox?.id}
              onClick={() => void runStepAction(validateMailbox)}
            >
              Retry validation
            </Button>
          </div>
          <div className="mt-4 flex justify-between">
            <Button type="button" variant="outline" onClick={() => goToStep("connect_gmail")}>
              <ChevronLeft className="mr-1.5 size-4" />
              Back
            </Button>
            <Button
              type="button"
              disabled={loading || status?.mailbox?.status !== "connected"}
              onClick={() => goToStep("warmup")}
            >
              Continue
              <ChevronRight className="ml-1.5 size-4" />
            </Button>
          </div>
        </GrowthEngineCard>
      ) : null}

      {step === "warmup" ? (
        <GrowthEngineCard title="Step 4 — Warmup (optional)">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="onboard-warmup-enabled"
                checked={draft.warmupEnabled}
                onCheckedChange={(v) => updateDraft({ warmupEnabled: v === true })}
              />
              <Label htmlFor="onboard-warmup-enabled">Enable warmup</Label>
            </div>
            {draft.warmupEnabled ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="onboard-starting-cap">Starting cap (day 1)</Label>
                  <Input id="onboard-starting-cap" value={String(projectedStartingCap)} readOnly />
                  <p className="text-xs text-muted-foreground">Uses native ramp schedule (day 1 volume).</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="onboard-ramp-days">Ramp days</Label>
                  <Input
                    id="onboard-ramp-days"
                    type="number"
                    min={1}
                    max={120}
                    value={draft.warmupDays}
                    onChange={(e) => updateDraft({ warmupDays: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Warmup can be enabled later from Infrastructure → Warmup.</p>
            )}
          </div>
          <div className="mt-4 flex justify-between">
            <Button type="button" variant="outline" onClick={() => goToStep("validate")}>
              <ChevronLeft className="mr-1.5 size-4" />
              Back
            </Button>
            <Button type="button" disabled={loading} onClick={() => goToStep("pool")}>
              Continue
              <ChevronRight className="ml-1.5 size-4" />
            </Button>
          </div>
        </GrowthEngineCard>
      ) : null}

      {step === "pool" ? (
        <GrowthEngineCard title="Step 5 — Pool assignment">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Assignment mode</Label>
              <Select
                value={draft.poolMode}
                onValueChange={(value) => updateDraft({ poolMode: value as WizardDraft["poolMode"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip pool assignment</SelectItem>
                  <SelectItem value="existing">Select existing pool</SelectItem>
                  <SelectItem value="create">Create new pool</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {draft.poolMode === "existing" ? (
              <div className="space-y-1.5">
                <Label htmlFor="onboard-pool">Pool</Label>
                <Select value={draft.poolId} onValueChange={(value) => updateDraft({ poolId: value })}>
                  <SelectTrigger id="onboard-pool">
                    <SelectValue placeholder="Select pool" />
                  </SelectTrigger>
                  <SelectContent>
                    {pools.map((pool) => (
                      <SelectItem key={pool.id} value={pool.id}>
                        {pool.name} ({pool.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {draft.poolMode === "create" ? (
              <div className="space-y-1.5">
                <Label htmlFor="onboard-new-pool">New pool name</Label>
                <Input
                  id="onboard-new-pool"
                  value={draft.newPoolName}
                  onChange={(e) => updateDraft({ newPoolName: e.target.value })}
                  placeholder="Primary outbound pool"
                />
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex justify-between">
            <Button type="button" variant="outline" onClick={() => goToStep("warmup")}>
              <ChevronLeft className="mr-1.5 size-4" />
              Back
            </Button>
            <Button type="button" disabled={loading} onClick={() => goToStep("activation")}>
              Continue
              <ChevronRight className="ml-1.5 size-4" />
            </Button>
          </div>
        </GrowthEngineCard>
      ) : null}

      {step === "activation" ? (
        <GrowthEngineCard title="Step 6 — Activation">
          {review ? (
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">Sender</p>
                <p>{review.sender.displayName}</p>
                <p className="text-muted-foreground">{review.sender.email}</p>
                <GrowthBadge label={review.sender.status} tone="neutral" />
              </div>
              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">Mailbox</p>
                <p>{review.mailbox?.status ?? "Not connected"}</p>
                <p className="text-muted-foreground">
                  Route: {review.deliveryRouteEnabled ? "Enabled" : "Missing"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">Domain</p>
                <p>{review.sender.domain}</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">Warmup</p>
                <p>{draft.warmupEnabled ? `Enabled · ${draft.warmupDays} days` : "Skipped"}</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">Pool</p>
                <p>
                  {draft.poolMode === "skip"
                    ? "None"
                    : draft.poolMode === "create"
                      ? draft.newPoolName || "New pool"
                      : pools.find((p) => p.id === draft.poolId)?.name ?? "Selected pool"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">Health</p>
                <p>{review.mailbox?.healthTier ?? review.sender.healthStatus}</p>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={loading}
              onClick={() =>
                void runStepAction(async () => {
                  await finalizeOnboarding({ activateSender: true, activatePool: true })
                })
              }
            >
              Activate sender & pool
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading || !review?.deliveryRouteEnabled}
              onClick={() => setTestSendOpen(true)}
            >
              <Send className="mr-1.5 size-3.5" />
              Test send
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin/growth/infrastructure/mailboxes">Finish</Link>
            </Button>
            <Button type="button" variant="ghost" onClick={resetWizard}>
              Add another mailbox
            </Button>
          </div>
          <div className="mt-4">
            <Button type="button" variant="outline" onClick={() => goToStep("pool")}>
              <ChevronLeft className="mr-1.5 size-4" />
              Back
            </Button>
          </div>
        </GrowthEngineCard>
      ) : null}

      <Dialog open={testSendOpen} onOpenChange={setTestSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test send</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="onboard-test-to">Recipient</Label>
              <Input
                id="onboard-test-to"
                type="email"
                value={testSendTo}
                onChange={(e) => setTestSendTo(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="onboard-test-approval"
                checked={testSendApproval}
                onCheckedChange={(v) => setTestSendApproval(v === true)}
              />
              <Label htmlFor="onboard-test-approval" className="font-normal">
                I confirm this live test send is authorized
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTestSendOpen(false)}>Cancel</Button>
            <Button
              type="button"
              disabled={loading || !testSendTo.trim() || !testSendApproval}
              onClick={() => void runStepAction(runTestSend)}
            >
              Send test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
