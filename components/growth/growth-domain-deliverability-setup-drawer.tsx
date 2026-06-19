"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Copy, Loader2, RefreshCw } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_DOMAIN_DELIVERABILITY_SETUP_QA_MARKER,
  growthDomainDnsRecordStatusLabel,
  type GrowthDomainDeliverabilitySetupInstructions,
  type GrowthDomainDnsRecordSection,
} from "@/lib/growth/deliverability/domain-deliverability-setup-types"

type GrowthDomainDeliverabilitySetupDrawerProps = {
  domainId: string | null
  domainLabel: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDomainUpdated?: () => void
}

const HEALTH_TONE: Record<string, "healthy" | "attention" | "critical"> = {
  Healthy: "healthy",
  Warning: "attention",
  "At Risk": "critical",
}

const RECORD_STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "neutral"> = {
  valid: "healthy",
  missing: "critical",
  invalid: "attention",
  pending: "neutral",
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "Not verified yet"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not verified yet"
  return date.toLocaleString()
}

function recordCopyValue(section: GrowthDomainDnsRecordSection): string {
  return section.records
    .map((record) => {
      const priority = record.priority != null ? ` priority=${record.priority}` : ""
      return `${record.record_type} ${record.host} → ${record.value}${priority}`
    })
    .join("\n")
}

function DnsRecordSectionCard({
  section,
  onCopy,
  copiedKey,
}: {
  section: GrowthDomainDnsRecordSection
  onCopy: (key: string, value: string) => void
  copiedKey: string | null
}) {
  const copyKey = section.kind

  return (
    <GrowthEngineCard title={section.title}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <GrowthBadge
            label={growthDomainDnsRecordStatusLabel(section.status)}
            tone={RECORD_STATUS_TONE[section.status] ?? "neutral"}
          />
          <GrowthBadge label={`${section.points}/25`} tone="neutral" />
          <span className="text-xs text-muted-foreground">
            Verified: {formatTimestamp(section.verified_at)}
          </span>
        </div>

        <p className="text-sm text-muted-foreground">{section.purpose}</p>

        {section.operator_instructions ? (
          <p className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-foreground/90">
            {section.operator_instructions}
          </p>
        ) : null}

        <ul className="space-y-2">
          {section.records.map((record, index) => (
            <li
              key={`${section.kind}-${index}`}
              className="rounded-lg border border-border/70 bg-background px-3 py-2 text-xs"
            >
              <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px]">
                <span className="text-muted-foreground">{record.record_type}</span>
                <span className="break-all">{record.host}</span>
                {record.priority != null ? <span>prio {record.priority}</span> : null}
              </div>
              <p className="mt-1 break-all font-mono text-[11px]">{record.value}</p>
            </li>
          ))}
        </ul>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onCopy(copyKey, recordCopyValue(section))}
        >
          {copiedKey === copyKey ? (
            <Check className="mr-1.5 size-3.5" />
          ) : (
            <Copy className="mr-1.5 size-3.5" />
          )}
          Copy {section.title}
        </Button>
      </div>
    </GrowthEngineCard>
  )
}

export function GrowthDomainDeliverabilitySetupDrawer({
  domainId,
  domainLabel,
  open,
  onOpenChange,
  onDomainUpdated,
}: GrowthDomainDeliverabilitySetupDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [instructions, setInstructions] = useState<GrowthDomainDeliverabilitySetupInstructions | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [copySourceId, setCopySourceId] = useState("")

  const loadInstructions = useCallback(async () => {
    if (!domainId) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/platform/growth/deliverability/domain/${domainId}/setup-instructions`,
      )
      const payload = (await response.json()) as {
        instructions?: GrowthDomainDeliverabilitySetupInstructions
        message?: string
      }
      if (!response.ok) {
        throw new Error(payload.message ?? "Could not load setup instructions.")
      }
      setInstructions(payload.instructions ?? null)
      setCopySourceId("")
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load setup instructions.")
      setInstructions(null)
    } finally {
      setLoading(false)
    }
  }, [domainId])

  useEffect(() => {
    if (!open || !domainId) return
    void loadInstructions()
  }, [open, domainId, loadInstructions])

  async function runValidate(action: "verify" | "refresh" | "recalculate") {
    if (!domainId) return
    setActionLoading(action)
    setError(null)
    try {
      const response = await fetch(`/api/platform/growth/deliverability/domain/${domainId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) {
        throw new Error(payload.message ?? "DNS validation failed.")
      }
      await loadInstructions()
      onDomainUpdated?.()
    } catch (validateError) {
      setError(validateError instanceof Error ? validateError.message : "DNS validation failed.")
    } finally {
      setActionLoading(null)
    }
  }

  async function copySetupFromDomain() {
    if (!domainId || !copySourceId) return
    setActionLoading("copy-setup")
    setError(null)
    try {
      const response = await fetch(`/api/platform/growth/deliverability/domain/${domainId}/copy-setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_domain_id: copySourceId }),
      })
      const payload = (await response.json()) as {
        instructions?: GrowthDomainDeliverabilitySetupInstructions
        message?: string
      }
      if (!response.ok) {
        throw new Error(payload.message ?? "Could not copy setup.")
      }
      setInstructions(payload.instructions ?? null)
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "Could not copy setup.")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCopy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      setError("Clipboard copy failed — copy the value manually.")
    }
  }

  const titleDomain = instructions?.domain ?? domainLabel ?? "Domain"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-xl"
        data-qa={GROWTH_DOMAIN_DELIVERABILITY_SETUP_QA_MARKER}
      >
        <SheetHeader>
          <SheetTitle>DNS setup — {titleDomain}</SheetTitle>
          <SheetDescription>
            Publish MX, SPF, DKIM, and DMARC without leaving Growth Engine. Each record contributes 25
            points toward deliverability.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading setup instructions…
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {error}
          </div>
        ) : null}

        {instructions ? (
          <div className="mt-6 space-y-4">
            <GrowthEngineCard title="Deliverability score">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-2xl font-semibold tabular-nums">
                  {instructions.deliverability_score}/100
                </span>
                <GrowthBadge
                  label={instructions.health_label}
                  tone={HEALTH_TONE[instructions.health_label] ?? "neutral"}
                />
                {instructions.is_google_workspace ? (
                  <GrowthBadge label="Google Workspace" tone="healthy" />
                ) : null}
                {instructions.mx_provider ? (
                  <GrowthBadge label={`MX: ${instructions.mx_provider}`} tone="neutral" />
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div>SPF {instructions.score_breakdown.spf}/25</div>
                <div>DKIM {instructions.score_breakdown.dkim}/25</div>
                <div>DMARC {instructions.score_breakdown.dmarc}/25</div>
                <div>MX {instructions.score_breakdown.mx}/25</div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Last verified: {formatTimestamp(instructions.last_verified_at)}
                {instructions.live_dns_enabled ? " · Live DNS enabled" : " · Stub / manual verification mode"}
              </p>
              {instructions.copied_from_domain ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  DNS values mirrored from {instructions.copied_from_domain} (publish on this domain&apos;s host).
                </p>
              ) : null}
            </GrowthEngineCard>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={Boolean(actionLoading)}
                onClick={() => void runValidate("verify")}
              >
                {actionLoading === "verify" ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : null}
                Verify DNS
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={Boolean(actionLoading)}
                onClick={() => void runValidate("refresh")}
              >
                {actionLoading === "refresh" ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 size-3.5" />
                )}
                Refresh DNS
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={Boolean(actionLoading)}
                onClick={() => void runValidate("recalculate")}
              >
                {actionLoading === "recalculate" ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : null}
                Recalculate score
              </Button>
            </div>

            <GrowthEngineCard title="Copy setup from another domain">
              <p className="text-sm text-muted-foreground">
                Mirror observed DNS values from a verified outbound domain onto {instructions.domain}.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">Source domain</span>
                  <select
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    value={copySourceId}
                    onChange={(event) => setCopySourceId(event.target.value)}
                  >
                    <option value="">Select domain…</option>
                    {instructions.copy_setup_candidates.map((candidate) => (
                      <option key={candidate.domain_id} value={candidate.domain_id}>
                        {candidate.domain} ({candidate.deliverability_score}/100
                        {candidate.is_google_workspace ? ", Google" : ""})
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!copySourceId || Boolean(actionLoading)}
                  onClick={() => void copySetupFromDomain()}
                >
                  {actionLoading === "copy-setup" ? (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <Copy className="mr-1.5 size-3.5" />
                  )}
                  Copy setup
                </Button>
              </div>
            </GrowthEngineCard>

            {instructions.sections.map((section) => (
              <DnsRecordSectionCard
                key={section.kind}
                section={section}
                onCopy={handleCopy}
                copiedKey={copiedKey}
              />
            ))}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
