"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthReviewPackageDrawer } from "@/components/growth/workspace/ux-1a/review/growth-review-package-drawer"
import { GrowthReviewSendDrawer } from "@/components/growth/workspace/ux-1a/review/growth-review-send-drawer"
import { useGrowthReviewDecisionQueue } from "@/components/growth/workspace/ux-1a/review/use-growth-review-decision-queue"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { GROWTH_WORKSPACE_FIRST_UX_1A_NAV_LABELS } from "@/lib/growth/navigation/growth-workspace-first-ux-1a-labels"
import { findReviewDecisionItem } from "@/lib/growth/workspace/ux-1a/review/growth-review-decision-queue-synthesizer"
import type { ReviewDecisionItem } from "@/lib/growth/workspace/ux-1a/review/growth-review-decision-queue-types"
import {
  buildGrowthReviewHref,
  GROWTH_REVIEW_QA_MARKER,
  parseGrowthReviewSearchParams,
  type GrowthReviewTabId,
} from "@/lib/growth/workspace/ux-1a/review/growth-review-routes"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function ReviewDecisionRow({
  item,
  onOpen,
}: {
  item: ReviewDecisionItem
  onOpen: (item: ReviewDecisionItem) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        "flex w-full items-start justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 text-left transition-colors",
        "hover:border-primary/30 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      )}
      aria-label={`${item.primaryAction.label}: ${item.title}. ${item.summary}`}
      data-review-decision-kind={item.kind}
      data-review-decision-id={item.id}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">{item.title}</p>
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {item.statusLabel}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.summary}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {item.channelLabel ? `${item.channelLabel} · ` : ""}
          {item.createdAt}
          {typeof item.confidencePercent === "number" ? ` · ${item.confidencePercent}% confidence` : ""}
        </p>
      </div>
      <span className="shrink-0 text-sm font-medium text-primary">{item.primaryAction.label}</span>
    </button>
  )
}

function ReviewEmptyState({ tab }: { tab: GrowthReviewTabId }) {
  if (tab === "packages") {
    return (
      <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">No packages need review.</p>
        <p className="mt-1">New work will appear here when it is ready.</p>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">No sends need approval.</p>
      <p className="mt-1">Nothing will be sent without your decision.</p>
    </div>
  )
}

export function GrowthReviewHumanDecisionQueuePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { teammate } = useAiTeammateIdentity()
  const { queue, packageRows, sendJobs, packagesById, soloApprovalEnabled, loading, error, reload } =
    useGrowthReviewDecisionQueue(teammate.name)

  const { tab, itemId } = useMemo(
    () => parseGrowthReviewSearchParams(searchParams),
    [searchParams],
  )

  const [drawerOpen, setDrawerOpen] = useState(false)

  const activeItems = tab === "sends" ? queue?.sends ?? [] : queue?.packages ?? []
  const selectedItem = useMemo(
    () => (queue ? findReviewDecisionItem(queue, { tab, itemId }) : null),
    [queue, tab, itemId],
  )

  const selectedPackageCard = useMemo(() => {
    if (!selectedItem || selectedItem.drawerTarget.kind !== "package") return null
    return packageRows.find((row) => row.outreachCard?.packageId === selectedItem.drawerTarget.packageId)
      ?.outreachCard ?? null
  }, [packageRows, selectedItem])

  const selectedSendJob = useMemo(() => {
    if (!selectedItem || selectedItem.drawerTarget.kind !== "send") return null
    return sendJobs.find((job) => job.id === selectedItem.drawerTarget.jobId) ?? null
  }, [sendJobs, selectedItem])

  const setReviewUrl = useCallback(
    (next: { tab: GrowthReviewTabId; item?: string | null }) => {
      router.replace(
        buildGrowthReviewHref({ tab: next.tab, item: next.item ?? undefined }),
        { scroll: false },
      )
    },
    [router],
  )

  const openItem = useCallback(
    (item: ReviewDecisionItem) => {
      const nextTab = item.kind === "send" ? "sends" : "packages"
      const nextItem =
        item.drawerTarget.kind === "send" ? item.drawerTarget.jobId : item.drawerTarget.packageId
      setReviewUrl({ tab: nextTab, item: nextItem })
      setDrawerOpen(true)
    },
    [setReviewUrl],
  )

  useEffect(() => {
    setDrawerOpen(Boolean(itemId && selectedItem))
  }, [itemId, selectedItem])

  const closeDrawer = useCallback(
    (open: boolean) => {
      setDrawerOpen(open)
      if (!open) setReviewUrl({ tab, item: null })
    },
    [setReviewUrl, tab],
  )

  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title={GROWTH_WORKSPACE_FIRST_UX_1A_NAV_LABELS.review}
        description="Items waiting for your decision."
        icon={ShieldCheck}
        iconClassName="bg-emerald-50 text-emerald-700"
      />

      <div
        className="space-y-4"
        data-qa-marker={GROWTH_REVIEW_QA_MARKER}
        data-section="review-human-decision-queue"
        data-growth-workspace-first-ux-1a="true"
      >
        <div
          role="tablist"
          aria-label="Review sections"
          className="flex flex-wrap gap-2"
          data-section="review-tabs"
        >
          {(["packages", "sends"] as const).map((tabId) => {
            const count = tabId === "packages" ? queue?.packageCount ?? 0 : queue?.sendCount ?? 0
            const active = tab === tabId
            return (
              <Button
                key={tabId}
                type="button"
                role="tab"
                aria-selected={active}
                variant={active ? "default" : "outline"}
                onClick={() => setReviewUrl({ tab: tabId, item: null })}
              >
                {tabId === "packages" ? "Packages" : "Sends"} {count}
              </Button>
            )
          })}
        </div>

        {loading && !queue ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading review queue…
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {queue?.isCaughtUp ? (
          <div
            className="flex items-start gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-4 dark:border-emerald-900/40 dark:bg-emerald-950/20"
            data-section="review-caught-up"
          >
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
            <div>
              <p className="font-medium text-foreground">You&apos;re caught up.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                There are no decisions waiting right now.
              </p>
            </div>
          </div>
        ) : null}

        {!queue?.isCaughtUp ? (
          <div role="tabpanel" className="space-y-2" data-section={`review-tab-${tab}`}>
            {activeItems.length === 0 ? (
              <ReviewEmptyState tab={tab} />
            ) : (
              activeItems.map((item) => <ReviewDecisionRow key={item.id} item={item} onOpen={openItem} />)
            )}
          </div>
        ) : null}
      </div>

      <GrowthReviewPackageDrawer
        open={drawerOpen && selectedItem?.drawerTarget.kind === "package"}
        onOpenChange={closeDrawer}
        card={selectedPackageCard}
        packageBody={
          selectedPackageCard ? packagesById.get(selectedPackageCard.packageId) ?? null : null
        }
        onDecided={() => void reload()}
      />

      <GrowthReviewSendDrawer
        open={drawerOpen && selectedItem?.drawerTarget.kind === "send"}
        onOpenChange={closeDrawer}
        job={selectedSendJob}
        soloApprovalEnabled={soloApprovalEnabled}
        onCompleted={() => void reload()}
      />
    </GrowthWorkspacePageContent>
  )
}
