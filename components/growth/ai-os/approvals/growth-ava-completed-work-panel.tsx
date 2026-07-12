"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthAvaCompletedOutreachPackageCard } from "@/components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card"
import {
  GrowthAutonomousOutboundScopeActivationControl,
  scopeIdFromApprovalEvidence,
} from "@/components/growth/ai-os/approvals/growth-autonomous-outbound-scope-activation-control"
import type { GrowthHumanApprovalCenterReadModel } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import { GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import type { GrowthBoundedAutonomousOutboundReadModel } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import {
  GROWTH_AVA_COMPLETED_WORK_QA_MARKER,
  resolveCompletedWorkDescription,
  resolveCompletedWorkHeroEmpty,
  resolveCompletedWorkHeroWaiting,
  resolveCompletedWorkTitle,
} from "@/lib/growth/aios/approvals/ava-completed-work-contract"
import {
  indexOutreachPackagesById,
  projectAvaCompletedWork,
  type GrowthAvaCompletedWorkCategoryId,
} from "@/lib/growth/aios/approvals/ava-completed-work-projection"
import {
  formatGrowthCustomerApprovalActionLabel,
  formatGrowthCustomerApprovalChannelLabel,
  formatGrowthCustomerApprovalStatusLabel,
  GROWTH_CUSTOMER_APPROVALS_EMPTY_ACTION_HREF,
  GROWTH_CUSTOMER_APPROVALS_EMPTY_ACTION_LABEL,
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

type CommandCenterResponse = {
  ok?: boolean
  commandCenter?: {
    autonomousOutreachPreparationPilot?: {
      recentRuns?: Array<{
        approvalPackage?: GrowthAutonomousOutreachApprovalPackage | null
      }>
    }
  }
}

function GenericCompletedWorkCard({
  item,
  boundedAutonomousOutbound,
  onActivated,
  teammateName,
}: {
  item: GrowthHumanApprovalCenterReadModel["items"][number]
  boundedAutonomousOutbound: GrowthBoundedAutonomousOutboundReadModel | null
  onActivated: () => void
  teammateName: string
}) {
  const action = resolveGrowthCustomerApprovalPrimaryAction(item)
  const channelLabel = formatGrowthCustomerApprovalChannelLabel(item.channel)
  const typeLabel = formatGrowthCustomerApprovalActionLabel(item.actionType)

  return (
    <li className="rounded-xl border border-border/70 bg-card p-4">
      <div className="space-y-1">
        <p className="font-medium text-foreground">{item.title}</p>
        <p className="text-sm text-muted-foreground">
          {teammateName} completed this and recommends your review.
        </p>
        <p className="text-sm text-muted-foreground">{item.summary}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="secondary">{typeLabel}</Badge>
          {channelLabel ? <Badge variant="outline">{channelLabel}</Badge> : null}
          <Badge variant="outline">{formatGrowthCustomerApprovalStatusLabel(item.status)}</Badge>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{action.helperText}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {action.approveHref ? (
          <Button asChild size="sm">
            <Link href={action.approveHref}>Review {teammateName}&apos;s work</Link>
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline">
            <Link href={GROWTH_CUSTOMER_APPROVALS_EMPTY_ACTION_HREF}>
              {GROWTH_CUSTOMER_APPROVALS_EMPTY_ACTION_LABEL}
            </Link>
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
    </li>
  )
}

export function GrowthAvaCompletedWorkPanel() {
  const { teammate } = useAiTeammateIdentity()
  const [model, setModel] = useState<GrowthHumanApprovalCenterReadModel | null>(null)
  const [packagesById, setPackagesById] = useState<
    Map<string, GrowthAutonomousOutreachApprovalPackage>
  >(new Map())
  const [boundedAutonomousOutbound, setBoundedAutonomousOutbound] =
    useState<GrowthBoundedAutonomousOutboundReadModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<"all" | GrowthAvaCompletedWorkCategoryId>(
    "all",
  )

  const load = useCallback(async () => {
    const [approvalResponse, outboundResponse, commandCenterResponse] = await Promise.all([
      fetch("/api/platform/growth/ai-os/approvals", { cache: "no-store" }),
      fetch("/api/platform/growth/ai-os/bounded-autonomous-outbound", { cache: "no-store" }),
      fetch("/api/platform/growth/ai-os/command-center", { cache: "no-store" }),
    ])

    const body = (await approvalResponse.json()) as ApiResponse
    if (!approvalResponse.ok || !body.ok || !body.humanApprovalCenter) {
      throw new Error(body.message ?? body.error ?? `Could not load ${teammate.name}'s completed work.`)
    }
    setModel(body.humanApprovalCenter)

    const outboundBody = (await outboundResponse.json()) as OutboundApiResponse
    if (outboundResponse.ok && outboundBody.ok && outboundBody.boundedAutonomousOutbound) {
      setBoundedAutonomousOutbound(outboundBody.boundedAutonomousOutbound)
    } else {
      setBoundedAutonomousOutbound(null)
    }

    if (commandCenterResponse.ok) {
      const commandBody = (await commandCenterResponse.json()) as CommandCenterResponse
      const packages =
        commandBody.commandCenter?.autonomousOutreachPreparationPilot?.recentRuns
          ?.map((run) => run.approvalPackage)
          .filter((pkg): pkg is GrowthAutonomousOutreachApprovalPackage => Boolean(pkg)) ?? []
      setPackagesById(indexOutreachPackagesById(packages))
    } else {
      setPackagesById(new Map())
    }
  }, [teammate.name])

  useEffect(() => {
    void load()
      .catch((loadError) => {
        setError(
          loadError instanceof Error ? loadError.message : `Could not load ${teammate.name}'s completed work.`,
        )
      })
      .finally(() => setLoading(false))
  }, [load, teammate.name])

  const projection = useMemo(() => {
    if (!model) return null
    return projectAvaCompletedWork({ items: model.items, packagesById, teammateName: teammate.name })
  }, [model, packagesById, teammate.name])

  const filteredItems = useMemo(() => {
    if (!projection) return []
    if (categoryFilter === "all") return projection.items
    return projection.items.filter((row) => row.category === categoryFilter)
  }, [projection, categoryFilter])

  if (loading && !model) {
    return <p className="text-sm text-muted-foreground">Loading {teammate.name}&apos;s completed work…</p>
  }

  if (error && !model) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!model || model.qaMarker !== GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER || !projection) {
    return null
  }

  const showGlobalEmpty = projection.totalCompleted === 0

  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title={resolveCompletedWorkTitle(teammate)}
        description={resolveCompletedWorkDescription(teammate)}
        icon={Sparkles}
        iconClassName="bg-emerald-50 text-emerald-700"
      />

      <div
        className="space-y-4"
        data-qa-marker={GROWTH_AVA_COMPLETED_WORK_QA_MARKER}
        data-qa-marker-hac={GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER}
        data-qa-marker-19c-4a={GROWTH_ZERO_ASSISTANCE_ADOPTION_19C_4A_QA_MARKER}
      >
        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="text-xl font-semibold tracking-tight text-foreground">
            {showGlobalEmpty
              ? resolveCompletedWorkHeroEmpty(teammate)
              : `${teammate.name} completed ${projection.totalCompleted} task${projection.totalCompleted === 1 ? "" : "s"}.`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {showGlobalEmpty
              ? `When ${teammate.name} finishes research and drafts, they will appear here for your authorization.`
              : resolveCompletedWorkHeroWaiting(teammate)}
          </p>
          {!showGlobalEmpty ? (
            <ul className="mt-4 space-y-1 text-sm text-foreground">
              {projection.categories
                .filter((category) => category.count > 0)
                .map((category) => (
                  <li key={category.id}>
                    {category.count} {category.label}
                  </li>
                ))}
            </ul>
          ) : null}
        </div>

        {showGlobalEmpty ? (
          <div className="rounded-xl border border-border/70 bg-card p-5">
            <p className="text-sm text-muted-foreground">
              That&apos;s normal between outreach cycles. Teach {teammate.name} in Training, then check Home —
              completed work will land here when drafts are ready.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href={GROWTH_CUSTOMER_APPROVALS_EMPTY_ACTION_HREF}>
                {GROWTH_CUSTOMER_APPROVALS_EMPTY_ACTION_LABEL}
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={categoryFilter === "all" ? "default" : "outline"}
                onClick={() => setCategoryFilter("all")}
              >
                All ({projection.totalCompleted})
              </Button>
              {projection.categories
                .filter((category) => category.count > 0)
                .map((category) => (
                  <Button
                    key={category.id}
                    type="button"
                    size="sm"
                    variant={categoryFilter === category.id ? "default" : "outline"}
                    onClick={() => setCategoryFilter(category.id)}
                  >
                    {category.label} ({category.count})
                  </Button>
                ))}
            </div>

            {filteredItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No items in this category. Try All, or check back after {teammate.name} prepares new work.
              </p>
            ) : (
              <ul className="space-y-3">
                {filteredItems.map((row) =>
                  row.outreachCard ? (
                    <GrowthAvaCompletedOutreachPackageCard
                      key={row.item.id}
                      card={row.outreachCard}
                      onDecided={() => void load()}
                    />
                  ) : (
                    <GenericCompletedWorkCard
                      key={row.item.id}
                      item={row.item}
                      boundedAutonomousOutbound={boundedAutonomousOutbound}
                      onActivated={() => void load()}
                      teammateName={teammate.name}
                    />
                  ),
                )}
              </ul>
            )}
          </>
        )}
      </div>
    </GrowthWorkspacePageContent>
  )
}

/** @deprecated Prefer GrowthAvaCompletedWorkPanel — kept for import compatibility. */
export function GrowthHumanApprovalCenterPanel() {
  return <GrowthAvaCompletedWorkPanel />
}
