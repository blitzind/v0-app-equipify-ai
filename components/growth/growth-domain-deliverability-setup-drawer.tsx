"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Copy, Loader2, RefreshCw } from "lucide-react"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
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

const SCORE_BREAKDOWN_ITEMS = [
  { key: "spf", label: "SPF" },
  { key: "dkim", label: "DKIM" },
  { key: "dmarc", label: "DMARC" },
  { key: "mx", label: "MX" },
] as const

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
    <GrowthEngineCard title={section.title} className="p-5 sm:p-6">
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{section.purpose}</p>

        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-4">
          <GrowthBadge
            label={growthDomainDnsRecordStatusLabel(section.status)}
            tone={RECORD_STATUS_TONE[section.status] ?? "neutral"}
          />
          <GrowthBadge label={`${section.points}/25`} tone="neutral" />
          <span className="text-xs text-muted-foreground">
            Verified: {formatTimestamp(section.verified_at)}
          </span>
        </div>

        {section.operator_instructions ? (
          <p className="rounded-lg border border-border/70 bg-muted/30 px-4 py-3 text-sm leading-relaxed text-foreground/90">
            {section.operator_instructions}
          </p>
        ) : null}

        <ul className="space-y-3">
          {section.records.map((record, index) => (
            <li
              key={`${section.kind}-${index}`}
              className="rounded-lg border border-border/70 bg-background px-4 py-3"
            >
              <div className="flex flex-wrap items-start gap-x-4 gap-y-1 text-xs">
                <span className="shrink-0 font-medium text-muted-foreground">{record.record_type}</span>
                <span className="min-w-0 flex-1 break-all font-mono text-[11px] leading-relaxed">
                  {record.host}
                </span>
                {record.priority != null ? (
                  <span className="shrink-0 text-muted-foreground">Priority {record.priority}</span>
                ) : null}
              </div>
              <p className="mt-2 break-all font-mono text-[11px] leading-relaxed [overflow-wrap:anywhere]">
                {record.value}
              </p>
            </li>
          ))}
        </ul>

        <div className="flex justify-end pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`Copy ${section.title} DNS records`}
            onClick={() => onCopy(copyKey, recordCopyValue(section))}
          >
            {copiedKey === copyKey ? (
              <Check className="mr-1.5 size-3.5" aria-hidden="true" />
            ) : (
              <Copy className="mr-1.5 size-3.5" aria-hidden="true" />
            )}
            Copy {section.title}
          </Button>
        </div>
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
  const verifyDisabled = Boolean(actionLoading) || !domainId

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="flex h-full w-full max-w-[100vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[680px]"
        data-qa={GROWTH_DOMAIN_DELIVERABILITY_SETUP_QA_MARKER}
      >
        <SheetHeader className="shrink-0 space-y-2 border-b border-border/60 px-6 py-5 pr-14">
          <SheetTitle className="text-lg">DNS setup — {titleDomain}</SheetTitle>
          <SheetDescription className="leading-relaxed">
            Publish MX, SPF, DKIM, and DMARC without leaving Growth Engine. Each record contributes 25
            points toward deliverability.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading setup instructions…
            </div>
          ) : null}

          {error ? (
            <div
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          {instructions ? (
            <div className="space-y-8">
              <GrowthEngineCard title="Deliverability score" className="p-5 sm:p-6">
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-3xl font-semibold tabular-nums">
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

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {SCORE_BREAKDOWN_ITEMS.map(({ key, label }) => (
                      <div
                        key={key}
                        className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 text-center"
                      >
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {label}
                        </p>
                        <p className="mt-1 text-sm font-semibold tabular-nums">
                          {instructions.score_breakdown[key]}/25
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>Last verified: {formatTimestamp(instructions.last_verified_at)}</p>
                    <p>
                      {instructions.live_dns_enabled
                        ? "Live DNS enabled"
                        : "Stub / manual verification mode"}
                    </p>
                    {instructions.copied_from_domain ? (
                      <p>
                        DNS values mirrored from {instructions.copied_from_domain} (publish on this
                        domain&apos;s host).
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      disabled={verifyDisabled}
                      aria-label="Verify DNS records for this domain"
                      onClick={() => void runValidate("verify")}
                    >
                      {actionLoading === "verify" ? (
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
                      ) : null}
                      Verify DNS
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={Boolean(actionLoading)}
                      aria-label="Refresh DNS lookup for this domain"
                      onClick={() => void runValidate("refresh")}
                    >
                      {actionLoading === "refresh" ? (
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <RefreshCw className="mr-1.5 size-3.5" aria-hidden="true" />
                      )}
                      Refresh DNS
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={Boolean(actionLoading)}
                      aria-label="Recalculate deliverability score"
                      onClick={() => void runValidate("recalculate")}
                    >
                      {actionLoading === "recalculate" ? (
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
                      ) : null}
                      Recalculate score
                    </Button>
                  </div>
                </div>
              </GrowthEngineCard>

              <GrowthEngineCard title="Copy setup from another domain" className="p-5 sm:p-6">
                <div className="space-y-5">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Mirror observed DNS values from a verified outbound domain onto {instructions.domain}.
                  </p>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-medium text-foreground">Source domain</span>
                    <select
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={copySourceId}
                      aria-label="Select source domain to copy DNS setup from"
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
                  <div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!copySourceId || Boolean(actionLoading)}
                      aria-label="Copy DNS setup from selected source domain"
                      onClick={() => void copySetupFromDomain()}
                    >
                      {actionLoading === "copy-setup" ? (
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Copy className="mr-1.5 size-3.5" aria-hidden="true" />
                      )}
                      Copy setup
                    </Button>
                  </div>
                </div>
              </GrowthEngineCard>

              <div className="space-y-6">
                {instructions.sections.map((section) => (
                  <DnsRecordSectionCard
                    key={section.kind}
                    section={section}
                    onCopy={handleCopy}
                    copiedKey={copiedKey}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <SheetFooter className="sticky bottom-0 shrink-0 flex-row flex-wrap justify-end gap-3 border-t border-border/60 bg-background px-6 py-4">
          <SheetClose asChild>
            <Button type="button" variant="outline" aria-label="Close DNS setup drawer">
              Close
            </Button>
          </SheetClose>
          <Button
            type="button"
            disabled={verifyDisabled}
            aria-label="Verify DNS records for this domain"
            onClick={() => void runValidate("verify")}
          >
            {actionLoading === "verify" ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Verify DNS
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
