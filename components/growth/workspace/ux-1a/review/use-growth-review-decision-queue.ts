"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { GrowthHumanApprovalCenterReadModel } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import {
  indexOutreachPackagesById,
  projectAvaCompletedWork,
  type GrowthAvaCompletedWorkItem,
} from "@/lib/growth/aios/approvals/ava-completed-work-projection"
import {
  filterActiveCompletedWorkItems,
  readDismissedCompletedWorkItemIds,
  sortCompletedWorkForOperatorPriority,
} from "@/lib/growth/aios/approvals/completed-work-operator-ux"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import type {
  GrowthSequenceExecutionJobView,
  GrowthSequenceSafeExecutionDashboard,
} from "@/lib/growth/sequences/execution/sequence-execution-types"
import { synthesizeGrowthReviewDecisionQueue } from "@/lib/growth/workspace/ux-1a/review/growth-review-decision-queue-synthesizer"
import type { GrowthReviewDecisionQueueViewModel } from "@/lib/growth/workspace/ux-1a/review/growth-review-decision-queue-types"

type UseGrowthReviewDecisionQueueResult = {
  queue: GrowthReviewDecisionQueueViewModel | null
  packageRows: GrowthAvaCompletedWorkItem[]
  sendJobs: GrowthSequenceExecutionJobView[]
  packagesById: Map<string, GrowthAutonomousOutreachApprovalPackage>
  soloApprovalEnabled: boolean
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function useGrowthReviewDecisionQueue(teammateName: string): UseGrowthReviewDecisionQueueResult {
  const [queue, setQueue] = useState<GrowthReviewDecisionQueueViewModel | null>(null)
  const [packageRows, setPackageRows] = useState<GrowthAvaCompletedWorkItem[]>([])
  const [sendJobs, setSendJobs] = useState<GrowthSequenceExecutionJobView[]>([])
  const [packagesById, setPackagesById] = useState<Map<string, GrowthAutonomousOutreachApprovalPackage>>(
    new Map(),
  )
  const [soloApprovalEnabled, setSoloApprovalEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [approvalResponse, commandCenterResponse, sequenceResponse] = await Promise.all([
        fetch("/api/platform/growth/ai-os/approvals", { cache: "no-store" }),
        fetch("/api/platform/growth/ai-os/command-center", { cache: "no-store" }),
        fetch("/api/platform/growth/sequences/execution/dashboard", { cache: "no-store" }),
      ])

      const approvalBody = (await approvalResponse.json()) as {
        ok?: boolean
        humanApprovalCenter?: GrowthHumanApprovalCenterReadModel
        message?: string
        error?: string
      }
      if (!approvalResponse.ok || !approvalBody.ok || !approvalBody.humanApprovalCenter) {
        throw new Error(approvalBody.message ?? approvalBody.error ?? "Could not load review queue.")
      }

      const orgId = approvalBody.humanApprovalCenter.items[0]?.organizationId ?? "local"
      const dismissedIds = readDismissedCompletedWorkItemIds(orgId)
      const activeItems = filterActiveCompletedWorkItems({
        items: approvalBody.humanApprovalCenter.items,
        dismissedItemIds: dismissedIds,
      })

      let packageMap = new Map<string, GrowthAutonomousOutreachApprovalPackage>()
      if (commandCenterResponse.ok) {
        const commandBody = (await commandCenterResponse.json()) as {
          commandCenter?: {
            autonomousOutreachPreparationPilot?: {
              recentRuns?: Array<{ approvalPackage?: GrowthAutonomousOutreachApprovalPackage | null }>
            }
          }
        }
        const packages =
          commandBody.commandCenter?.autonomousOutreachPreparationPilot?.recentRuns
            ?.map((run) => run.approvalPackage)
            .filter((pkg): pkg is GrowthAutonomousOutreachApprovalPackage => Boolean(pkg)) ?? []
        packageMap = indexOutreachPackagesById(packages)
      }

      const projected = sortCompletedWorkForOperatorPriority(
        projectAvaCompletedWork({
          items: activeItems,
          packagesById: packageMap,
          teammateName,
        }).items,
      )

      let pendingSendJobs: GrowthSequenceExecutionJobView[] = []
      let solo = false
      if (sequenceResponse.ok) {
        const sequenceBody = (await sequenceResponse.json()) as {
          ok?: boolean
          dashboard?: GrowthSequenceSafeExecutionDashboard
        }
        pendingSendJobs =
          sequenceBody.dashboard?.jobs.filter((job) => job.status === "pending_approval") ?? []
        solo = sequenceBody.dashboard?.soloApprovalEnabled === true
      }

      const synthesized = synthesizeGrowthReviewDecisionQueue({
        packageItems: projected,
        sendJobs: pendingSendJobs,
      })

      setPackageRows(projected)
      setSendJobs(pendingSendJobs)
      setPackagesById(packageMap)
      setSoloApprovalEnabled(solo)
      setQueue(synthesized)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load review queue.")
      setQueue(null)
    } finally {
      setLoading(false)
    }
  }, [teammateName])

  useEffect(() => {
    void reload()
  }, [reload])

  return useMemo(
    () => ({
      queue,
      packageRows,
      sendJobs,
      packagesById,
      soloApprovalEnabled,
      loading,
      error,
      reload,
    }),
    [queue, packageRows, sendJobs, packagesById, soloApprovalEnabled, loading, error, reload],
  )
}
