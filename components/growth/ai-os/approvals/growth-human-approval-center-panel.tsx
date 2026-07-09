"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import type {
  GrowthHumanApprovalCenterReadModel,
  GrowthHumanApprovalChannel,
  GrowthHumanApprovalItem,
} from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import { GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import type { GrowthBoundedAutonomousOutboundReadModel } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import {
  GrowthAutonomousOutboundScopeActivationControl,
  scopeIdFromApprovalEvidence,
} from "@/components/growth/ai-os/approvals/growth-autonomous-outbound-scope-activation-control"
import {
  formatGrowthCustomerApprovalActionLabel,
  formatGrowthCustomerApprovalChannelLabel,
  formatGrowthCustomerApprovalStatusLabel,
  GROWTH_CUSTOMER_APPROVALS_AFTER_APPROVE,
  GROWTH_CUSTOMER_APPROVALS_EMPTY_ACTION_HREF,
  GROWTH_CUSTOMER_APPROVALS_EMPTY_ACTION_LABEL,
  GROWTH_CUSTOMER_APPROVALS_EMPTY_BODY,
  GROWTH_CUSTOMER_APPROVALS_EMPTY_HEADLINE,
  GROWTH_CUSTOMER_APPROVALS_FILTER_EMPTY,
  GROWTH_CUSTOMER_APPROVALS_PAGE_DESCRIPTION,
  GROWTH_CUSTOMER_APPROVALS_TITLE,
  GROWTH_CUSTOMER_APPROVALS_TRUST_BODY,
  GROWTH_CUSTOMER_APPROVALS_TRUST_HEADLINE,
  GROWTH_CUSTOMER_APPROVALS_WHEN_TO_VISIT,
  GROWTH_ZERO_ASSISTANCE_ADOPTION_19C_4A_QA_MARKER,
  resolveGrowthCustomerApprovalPrimaryAction,
} from "@/lib/growth/customer-experience/growth-zero-assistance-adoption-19c-4a"

type ApiResponse = {
  ok?: boolean
  humanApprovalCenter?: GrowthHumanApprovalCenterReadModel
  message?: string
  error?: string
}

type OutboundApiResponse = {
  ok?: boolean
  boundedAutonomousOutbound?: GrowthBoundedAutonomousOutboundReadModel
}

const CHANNEL_FILTERS: Array<{ id: "all" | GrowthHumanApprovalChannel; label: string }> = [
  { id: "all", label: "All" },
  { id: "sms", label: "Text" },
  { id: "email", label: "Email" },
  { id: "voice", label: "Voice" },
  { id: "call", label: "Call" },
  { id: "none", label: "Planning" },
]

function ApprovalItemCard({
  item,
  boundedAutonomousOutbound,
  onActivated,
}: {
  item: GrowthHumanApprovalItem
  boundedAutonomousOutbound: GrowthBoundedAutonomousOutboundReadModel | null
  onActivated: () => void
}) {
  const action = resolveGrowthCustomerApprovalPrimaryAction(item)
  const channelLabel = formatGrowthCustomerApprovalChannelLabel(item.channel)
  const typeLabel = formatGrowthCustomerApprovalActionLabel(item.actionType)

  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-foreground">{item.title}</p>
          <p className="text-sm text-muted-foreground">{item.summary}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary">{typeLabel}</Badge>
            {channelLabel ? <Badge variant="outline">{channelLabel}</Badge> : null}
            <Badge variant="outline">{formatGrowthCustomerApprovalStatusLabel(item.status)}</Badge>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{action.helperText}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {action.approveHref ? (
          <>
            <Button asChild size="sm">
              <Link href={action.approveHref}>{action.approveLabel}</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={action.rejectHref!}>{action.rejectLabel}</Link>
            </Button>
          </>
        ) : (
          <Button asChild size="sm" variant="outline">
            <Link href={GROWTH_CUSTOMER_APPROVALS_EMPTY_ACTION_HREF}>{GROWTH_CUSTOMER_APPROVALS_EMPTY_ACTION_LABEL}</Link>
          </Button>
        )}
      </div>

      {item.source === "autonomous_outbound_scope" && item.status === "approved_elsewhere" ? (
        (() => {
          const scopeId = scopeIdFromApprovalEvidence(item.evidence)
          if (!scopeId) return null
          return (
            <div className="mt-3 border-t border-border/60 pt-3">
              <GrowthAutonomousOutboundScopeActivationControl
                scopeId={scopeId}
                title={item.title}
                evidence={item.evidence}
                expiresAt={item.expiresAt}
                readModel={boundedAutonomousOutbound}
                onActivated={onActivated}
              />
            </div>
          )
        })()
      ) : null}

      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
          Technical details
        </summary>
        <p className="mt-2">
          Source: {item.source.replaceAll("_", " ")} · Action: {item.actionType.replaceAll("_", " ")}
          {item.channel ? ` · Channel: ${item.channel}` : ""}
        </p>
        <p>Policy: {item.policy.enforcementSource}</p>
        <p>
          Priority score: {item.priorityScore} · Risk: {item.riskLevel}
        </p>
        <p>{item.evidence.length} evidence item(s)</p>
      </details>
    </li>
  )
}

export function GrowthHumanApprovalCenterPanel() {
  const [model, setModel] = useState<GrowthHumanApprovalCenterReadModel | null>(null)
  const [boundedAutonomousOutbound, setBoundedAutonomousOutbound] =
    useState<GrowthBoundedAutonomousOutboundReadModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [channelFilter, setChannelFilter] = useState<"all" | GrowthHumanApprovalChannel>("all")

  const load = useCallback(async () => {
    const [approvalResponse, outboundResponse] = await Promise.all([
      fetch("/api/platform/growth/ai-os/approvals", { cache: "no-store" }),
      fetch("/api/platform/growth/ai-os/bounded-autonomous-outbound", { cache: "no-store" }),
    ])
    const body = (await approvalResponse.json()) as ApiResponse
    if (!approvalResponse.ok || !body.ok || !body.humanApprovalCenter) {
      throw new Error(body.message ?? body.error ?? "Could not load approvals.")
    }
    setModel(body.humanApprovalCenter)

    const outboundBody = (await outboundResponse.json()) as OutboundApiResponse
    if (outboundResponse.ok && outboundBody.ok && outboundBody.boundedAutonomousOutbound) {
      setBoundedAutonomousOutbound(outboundBody.boundedAutonomousOutbound)
    } else {
      setBoundedAutonomousOutbound(null)
    }
  }, [])

  useEffect(() => {
    void load()
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Could not load approvals.")
      })
      .finally(() => setLoading(false))
  }, [load])

  const filteredItems = useMemo(() => {
    if (!model) return []
    if (channelFilter === "all") return model.items
    return model.items.filter((item) => item.channel === channelFilter)
  }, [model, channelFilter])

  if (loading && !model) {
    return <p className="text-sm text-muted-foreground">Loading approvals…</p>
  }

  if (error && !model) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!model || model.qaMarker !== GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER) return null

  const showGlobalEmpty = model.items.length === 0

  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title={GROWTH_CUSTOMER_APPROVALS_TITLE}
        description={GROWTH_CUSTOMER_APPROVALS_PAGE_DESCRIPTION}
        icon={ShieldCheck}
        iconClassName="bg-amber-50 text-amber-700"
      />

      <div className="space-y-4" data-qa-marker={GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER}>
        <div
          data-qa-marker-19c-4a={GROWTH_ZERO_ASSISTANCE_ADOPTION_19C_4A_QA_MARKER}
          className="rounded-xl border border-amber-200/70 bg-amber-50/40 p-4 dark:border-amber-900/40 dark:bg-amber-950/20"
        >
          <p className="text-sm font-medium text-foreground">{GROWTH_CUSTOMER_APPROVALS_TRUST_HEADLINE}</p>
          <p className="mt-1 text-sm text-muted-foreground">{GROWTH_CUSTOMER_APPROVALS_TRUST_BODY}</p>
          <p className="mt-2 text-xs text-muted-foreground">{GROWTH_CUSTOMER_APPROVALS_WHEN_TO_VISIT}</p>
          <p className="mt-1 text-xs text-muted-foreground">{GROWTH_CUSTOMER_APPROVALS_AFTER_APPROVE}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Waiting for you" value={String(model.summary.totalPending)} />
          <Stat label="Text drafts" value={String(model.summary.smsPending)} />
          <Stat label="Email drafts" value={String(model.summary.emailPending)} />
          <Stat label="Voice drafts" value={String(model.summary.voicePending)} />
        </div>

        {showGlobalEmpty ? (
          <div className="rounded-xl border border-border/70 bg-card p-5">
            <p className="text-sm font-medium text-foreground">{GROWTH_CUSTOMER_APPROVALS_EMPTY_HEADLINE}</p>
            <p className="mt-2 text-sm text-muted-foreground">{GROWTH_CUSTOMER_APPROVALS_EMPTY_BODY}</p>
            <Button asChild size="sm" className="mt-4">
              <Link href={GROWTH_CUSTOMER_APPROVALS_EMPTY_ACTION_HREF}>
                {GROWTH_CUSTOMER_APPROVALS_EMPTY_ACTION_LABEL}
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {CHANNEL_FILTERS.map((filter) => (
                <Button
                  key={filter.id}
                  type="button"
                  size="sm"
                  variant={channelFilter === filter.id ? "default" : "outline"}
                  onClick={() => setChannelFilter(filter.id)}
                >
                  {filter.label}
                  {filter.id !== "all" ? ` (${model.filterCounts.byChannel[filter.id] ?? 0})` : ""}
                </Button>
              ))}
            </div>

            {filteredItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">{GROWTH_CUSTOMER_APPROVALS_FILTER_EMPTY}</p>
            ) : (
              <ul className="space-y-3">
                {filteredItems.map((item) => (
                  <ApprovalItemCard
                    key={item.id}
                    item={item}
                    boundedAutonomousOutbound={boundedAutonomousOutbound}
                    onActivated={() => void load()}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </GrowthWorkspacePageContent>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}
