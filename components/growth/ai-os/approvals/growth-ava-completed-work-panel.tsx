"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { MoreHorizontal, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  type GrowthAvaCompletedWorkItem,
} from "@/lib/growth/aios/approvals/ava-completed-work-projection"
import {
  GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER,
  filterActiveCompletedWorkItems,
  groupSupportingCompletedWork,
  isSupportingCompletedWorkBucket,
  persistDismissedCompletedWorkItemId,
  readDismissedCompletedWorkItemIds,
  resolveCompletedWorkContextualCta,
  resolveCompletedWorkOperatorBucket,
  resolveCompletedWorkOverflowActions,
  sortCompletedWorkForOperatorPriority,
  summarizeActionableCompletedWork,
} from "@/lib/growth/aios/approvals/completed-work-operator-ux"
import { humanizeCompletedWorkSupportingSummary } from "@/lib/growth/aios/approvals/approvals-operator-review-packet"
import {
  formatGrowthCustomerApprovalActionLabel,
  formatGrowthCustomerApprovalChannelLabel,
  formatGrowthCustomerApprovalStatusLabel,
  GROWTH_CUSTOMER_APPROVALS_EMPTY_ACTION_HREF,
  GROWTH_CUSTOMER_APPROVALS_EMPTY_ACTION_LABEL,
  GROWTH_ZERO_ASSISTANCE_ADOPTION_19C_4A_QA_MARKER,
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

const LIFECYCLE_API = "/api/platform/growth/ai-os/completed-work/lifecycle"

async function postLifecycle(body: Record<string, unknown>) {
  const response = await fetch(LIFECYCLE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const payload = (await response.json()) as {
    ok?: boolean
    error?: string
    message?: string
    expectedConfirmation?: string
    preview?: { companyName?: string }
  }
  if (!response.ok || !payload.ok) {
    throw new Error(payload.message ?? payload.error ?? "Lifecycle action failed")
  }
  return payload
}

function GenericCompletedWorkCard({
  item,
  boundedAutonomousOutbound,
  onActivated,
  onDismiss,
  organizationId,
  teammateName,
}: {
  item: GrowthHumanApprovalCenterReadModel["items"][number]
  boundedAutonomousOutbound: GrowthBoundedAutonomousOutboundReadModel | null
  onActivated: () => void
  onDismiss: (itemId: string) => void
  organizationId: string
  teammateName: string
}) {
  const channelLabel = formatGrowthCustomerApprovalChannelLabel(item.channel)
  const typeLabel = formatGrowthCustomerApprovalActionLabel(item.actionType)
  const cta = resolveCompletedWorkContextualCta(item)
  const overflow = resolveCompletedWorkOverflowActions({ item })
  const humanSummary = humanizeCompletedWorkSupportingSummary(item, teammateName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runLifecycle = async (action: string) => {
    if (!item.subjectId) return
    if (action === "dismiss") {
      persistDismissedCompletedWorkItemId(organizationId, item.id)
      onDismiss(item.id)
      return
    }
    if (action === "archive_account") {
      const ok = window.confirm(
        "Archive this account?\n\nIt leaves active workflows. Pending AI work stops. Historical data remains and the account may be restorable.",
      )
      if (!ok) return
    }
    if (action === "cancel_work") {
      const ok = window.confirm(
        "Cancel this work?\n\nActive package/workflow will stop. Nothing will send. History remains. The account stays active unless you archive it separately.",
      )
      if (!ok) return
    }
    if (action === "delete_permanently") {
      const company = item.title
      const typed = window.prompt(
        `Delete permanently (archives + stops AI work; hard delete disabled).\nType: DELETE ${company}`,
      )
      if (!typed) return
      setBusy(true)
      setError(null)
      try {
        await postLifecycle({
          action: "delete_permanently",
          leadId: item.subjectId,
          confirmation: typed,
        })
        onActivated()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed")
      } finally {
        setBusy(false)
      }
      return
    }
    setBusy(true)
    setError(null)
    try {
      await postLifecycle({ action, leadId: item.subjectId })
      onActivated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-xl border border-border/70 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium text-foreground">{item.title}</p>
          <p className="text-sm text-muted-foreground">{humanSummary}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary">{typeLabel}</Badge>
            {channelLabel ? <Badge variant="outline">{channelLabel}</Badge> : null}
            <Badge variant="outline">{formatGrowthCustomerApprovalStatusLabel(item.status)}</Badge>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon" variant="ghost" className="size-8" disabled={busy}>
              <MoreHorizontal className="size-4" />
              <span className="sr-only">More actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {overflow.includes("open_account") && item.subjectId ? (
              <DropdownMenuItem asChild>
                <Link href={`/growth/leads/${item.subjectId}`}>Open account</Link>
              </DropdownMenuItem>
            ) : null}
            {overflow.includes("dismiss") ? (
              <DropdownMenuItem onClick={() => void runLifecycle("dismiss")}>Dismiss</DropdownMenuItem>
            ) : null}
            {overflow.includes("cancel_work") ? (
              <DropdownMenuItem onClick={() => void runLifecycle("cancel_work")}>
                Cancel work
              </DropdownMenuItem>
            ) : null}
            {overflow.includes("archive_account") ? (
              <DropdownMenuItem onClick={() => void runLifecycle("archive_account")}>
                Archive account
              </DropdownMenuItem>
            ) : null}
            {overflow.includes("delete_permanently") ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => void runLifecycle("delete_permanently")}
                >
                  Delete permanently
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {item.route ? (
          <Button asChild size="sm">
            <Link href={item.route}>{cta}</Link>
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline">
            <Link href={GROWTH_CUSTOMER_APPROVALS_EMPTY_ACTION_HREF}>
              {GROWTH_CUSTOMER_APPROVALS_EMPTY_ACTION_LABEL}
            </Link>
          </Button>
        )}
        {overflow.includes("dismiss") ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void runLifecycle("dismiss")}
          >
            Dismiss
          </Button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

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

function SupportingGroup({
  label,
  count,
  items,
  boundedAutonomousOutbound,
  onActivated,
  onDismiss,
  organizationId,
  teammateName,
}: {
  label: string
  count: number
  items: GrowthHumanApprovalCenterReadModel["items"]
  boundedAutonomousOutbound: GrowthBoundedAutonomousOutboundReadModel | null
  onActivated: () => void
  onDismiss: (itemId: string) => void
  organizationId: string
  teammateName: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <li className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {count} {label}
        </p>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
          {open ? "Collapse" : "Expand"}
        </Button>
      </div>
      {open ? (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <GenericCompletedWorkCard
              key={item.id}
              item={item}
              boundedAutonomousOutbound={boundedAutonomousOutbound}
              onActivated={onActivated}
              onDismiss={onDismiss}
              organizationId={organizationId}
              teammateName={teammateName}
            />
          ))}
        </ul>
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
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [supportingOpen, setSupportingOpen] = useState(false)

  const organizationId = model?.items[0]?.organizationId ?? "local"

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
    const orgId = body.humanApprovalCenter.items[0]?.organizationId ?? "local"
    setDismissedIds(readDismissedCompletedWorkItemIds(orgId))

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

  const activeItems = useMemo(() => {
    if (!model) return []
    return filterActiveCompletedWorkItems({
      items: model.items,
      dismissedItemIds: dismissedIds,
    })
  }, [model, dismissedIds])

  const projection = useMemo(() => {
    if (!model) return null
    const projected = projectAvaCompletedWork({
      items: activeItems,
      packagesById,
      teammateName: teammate.name,
    })
    return {
      ...projected,
      items: sortCompletedWorkForOperatorPriority(projected.items),
    }
  }, [model, activeItems, packagesById, teammate.name])

  const summary = useMemo(() => summarizeActionableCompletedWork(activeItems), [activeItems])

  const primaryItems = useMemo(() => {
    if (!projection) return [] as GrowthAvaCompletedWorkItem[]
    return projection.items.filter(
      (row) => !isSupportingCompletedWorkBucket(resolveCompletedWorkOperatorBucket(row.item)),
    )
  }, [projection])

  const supportingGroups = useMemo(() => {
    const supporting = activeItems.filter((item) =>
      isSupportingCompletedWorkBucket(resolveCompletedWorkOperatorBucket(item)),
    )
    return groupSupportingCompletedWork(supporting)
  }, [activeItems])

  if (loading && !model) {
    return <p className="text-sm text-muted-foreground">Loading {teammate.name}&apos;s completed work…</p>
  }

  if (error && !model) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!model || model.qaMarker !== GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER || !projection) {
    return null
  }

  const showGlobalEmpty = summary.totalActionable === 0

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
        data-qa-marker-operator-ux={GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER}
      >
        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="text-xl font-semibold tracking-tight text-foreground">
            {showGlobalEmpty ? resolveCompletedWorkHeroEmpty(teammate) : "Ready for your review"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {showGlobalEmpty
              ? `When ${teammate.name} finishes research and drafts, they will appear here for your authorization.`
              : resolveCompletedWorkHeroWaiting(teammate)}
          </p>
          {!showGlobalEmpty ? (
            <ul className="mt-4 space-y-1 text-sm text-foreground">
              <li>
                {summary.outreachPackages} outreach package
                {summary.outreachPackages === 1 ? "" : "s"}
              </li>
              <li>
                {summary.followUpDecisions} follow-up decision
                {summary.followUpDecisions === 1 ? "" : "s"}
              </li>
              <li>
                {summary.supportingRecommendations} supporting recommendation
                {summary.supportingRecommendations === 1 ? "" : "s"}
              </li>
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
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Ready for your review
              </h2>
              {primaryItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No primary outreach or follow-up items right now.
                </p>
              ) : (
                <ul className="space-y-3">
                  {primaryItems.map((row) =>
                    row.outreachCard ? (
                      <GrowthAvaCompletedOutreachPackageCard
                        key={row.item.id}
                        card={row.outreachCard}
                        packageBody={packagesById.get(row.outreachCard.packageId) ?? null}
                        onDecided={() => void load()}
                        onDismiss={() => {
                          persistDismissedCompletedWorkItemId(organizationId, row.item.id)
                          setDismissedIds((prev) => {
                            const next = new Set(prev)
                            next.add(row.item.id)
                            return next
                          })
                        }}
                      />
                    ) : (
                      <GenericCompletedWorkCard
                        key={row.item.id}
                        item={row.item}
                        boundedAutonomousOutbound={boundedAutonomousOutbound}
                        onActivated={() => void load()}
                        onDismiss={(id) =>
                          setDismissedIds((prev) => {
                            const next = new Set(prev)
                            next.add(id)
                            return next
                          })
                        }
                        organizationId={organizationId}
                        teammateName={teammate.name}
                      />
                    ),
                  )}
                </ul>
              )}
            </div>

            {supportingGroups.length > 0 ? (
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Supporting activity
                  </h2>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setSupportingOpen((v) => !v)}
                  >
                    {supportingOpen ? "Collapse" : "Show supporting"}
                  </Button>
                </div>
                {supportingOpen ? (
                  <ul className="space-y-3">
                    {supportingGroups.map((group) => (
                      <SupportingGroup
                        key={group.bucket}
                        label={group.label}
                        count={group.count}
                        items={group.items}
                        boundedAutonomousOutbound={boundedAutonomousOutbound}
                        onActivated={() => void load()}
                        onDismiss={(id) =>
                          setDismissedIds((prev) => {
                            const next = new Set(prev)
                            next.add(id)
                            return next
                          })
                        }
                        organizationId={organizationId}
                        teammateName={teammate.name}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {supportingGroups.map((g) => `${g.count} ${g.label}`).join(" · ")}
                  </p>
                )}
              </div>
            ) : null}
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
