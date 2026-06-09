"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BadgeCheck,
  Filter,
  GitBranch,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import type {
  ApolloPrimaryContactEnrollmentApprovalQueueSnapshot,
  ApolloPrimaryContactEnrollmentQueueRow,
  ApolloPrimaryContactEnrollmentQueueStatus,
} from "@/lib/growth/apollo/apollo-primary-contact-enrollment-bridge-types"
import { APOLLO_PRIMARY_CONTACT_ENROLLMENT_BRIDGE_QA_MARKER } from "@/lib/growth/apollo/apollo-primary-contact-enrollment-bridge-types"
import { cn } from "@/lib/utils"

type QueueFilter = "all" | ApolloPrimaryContactEnrollmentQueueStatus | "sequence_ready" | "contactable"

function queueStatusTone(
  status: ApolloPrimaryContactEnrollmentQueueStatus,
): "healthy" | "attention" | "neutral" | "medium" {
  if (status === "enrollment_approved") return "healthy"
  if (status === "enrollment_rejected") return "attention"
  return "medium"
}

function queueStatusLabel(status: ApolloPrimaryContactEnrollmentQueueStatus): string {
  return status.replace(/_/g, " ")
}

function enrichmentLabel(status: ApolloPrimaryContactEnrollmentQueueRow["enrichment_status"]): string {
  return status.replace(/_/g, " ")
}

export function ApolloPrimaryContactEnrollmentApprovalQueuePanel({
  companyCandidateId,
  className,
}: {
  companyCandidateId?: string | null
  className?: string
}) {
  const [snapshot, setSnapshot] = useState<ApolloPrimaryContactEnrollmentApprovalQueueSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionKey, setActionKey] = useState<string | null>(null)
  const [filter, setFilter] = useState<QueueFilter>("pending_enrollment_approval")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (companyCandidateId) params.set("companyCandidateId", companyCandidateId)
      params.set("status", "all")
      const res = await fetch(
        `/api/platform/growth/apollo-primary-contact-acquisition/enrollment-approval-queue?${params.toString()}`,
        { cache: "no-store" },
      )
      const json = (await res.json()) as {
        ok?: boolean
        snapshot?: ApolloPrimaryContactEnrollmentApprovalQueueSnapshot
        message?: string
      }
      if (!res.ok || !json.ok || !json.snapshot) {
        throw new Error(json.message ?? "Could not load Apollo enrollment approval queue.")
      }
      setSnapshot(json.snapshot)
    } catch (e) {
      setSnapshot(null)
      setError(e instanceof Error ? e.message : "Could not load Apollo enrollment approval queue.")
    } finally {
      setLoading(false)
    }
  }, [companyCandidateId])

  useEffect(() => {
    void load()
  }, [load])

  const filteredItems = useMemo(() => {
    const items = snapshot?.items ?? []
    switch (filter) {
      case "pending_enrollment_approval":
      case "enrollment_approved":
      case "enrollment_rejected":
        return items.filter((row) => row.status === filter)
      case "sequence_ready":
        return items.filter((row) => row.sequence_ready)
      case "contactable":
        return items.filter((row) => row.contactable)
      default:
        return items
    }
  }, [snapshot?.items, filter])

  async function runAction(input: {
    action: "approve_enrollment" | "reject_enrollment"
    row: ApolloPrimaryContactEnrollmentQueueRow
  }) {
    setActionKey(input.row.queue_item_id)
    setMessage(null)
    setError(null)

    try {
      const res = await fetch(
        "/api/platform/growth/apollo-primary-contact-acquisition/enrollment-approval-queue/actions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: input.action,
            queueItemId: input.row.queue_item_id,
          }),
        },
      )
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string }
      if (!res.ok || !json.ok) {
        throw new Error(json.message ?? json.error ?? "Enrollment approval action failed.")
      }
      if (input.action === "approve_enrollment") {
        setMessage(
          "Enrollment eligibility approved. Use the existing guided enrollment workflow to create and confirm a draft — no auto-enrollment.",
        )
      } else {
        setMessage("Enrollment eligibility rejected. No enrollment or outreach was triggered.")
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enrollment approval action failed.")
    } finally {
      setActionKey(null)
    }
  }

  const summary = snapshot?.summary

  return (
    <GrowthEngineCard
      title="Apollo Enrollment Approval Queue"
      icon={<GitBranch className="size-4" />}
      className={cn(className)}
    >
      <section data-qa-marker={APOLLO_PRIMARY_CONTACT_ENROLLMENT_BRIDGE_QA_MARKER}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="size-4 text-indigo-700" />
            <p className="text-sm text-muted-foreground">
              Approved Apollo contacts awaiting explicit enrollment approval — no auto-enrollment, sequences, or
              outreach.
            </p>
            {summary ? (
              <GrowthBadge
                label={`${summary.total} item${summary.total === 1 ? "" : "s"}`}
                tone={summary.pending > 0 ? "attention" : "neutral"}
              />
            ) : null}
          </div>
          <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
            {loading ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <RefreshCw className="mr-1 size-3.5" />}
            Refresh
          </Button>
        </div>

        {summary ? (
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
            <GrowthBadge label={`Pending ${summary.pending}`} tone="attention" />
            <GrowthBadge label={`Approved ${summary.approved}`} tone="healthy" />
            <GrowthBadge label={`Rejected ${summary.rejected}`} tone="medium" />
            <GrowthBadge label={`Sequence-ready ${summary.sequence_ready}`} tone="healthy" />
            <GrowthBadge label={`Contactable ${summary.contactable}`} tone="neutral" />
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Filter className="size-3.5 text-muted-foreground" />
          {(
            [
              ["pending_enrollment_approval", "Pending"],
              ["enrollment_approved", "Approved"],
              ["enrollment_rejected", "Rejected"],
              ["sequence_ready", "Sequence-ready"],
              ["contactable", "Contactable"],
              ["all", "All"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "default" : "outline"}
              className="h-7 text-[10px]"
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>

        {message ? <p className="mt-2 text-xs text-emerald-800">{message}</p> : null}
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

        {loading && !snapshot ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Loading enrollment approval queue…
          </p>
        ) : null}

        {!loading && snapshot && filteredItems.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {snapshot.items.length === 0
              ? "No approved Apollo contacts in the enrollment approval queue yet. Operator review approvals hand off here automatically when sequence-ready."
              : "No items match the selected filter."}
          </p>
        ) : null}

        {filteredItems.length ? (
          <ul className="mt-3 space-y-2">
            {filteredItems.map((row) => (
              <li key={row.queue_item_id} className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 font-medium">
                      <UserRound className="size-3 text-muted-foreground" />
                      {row.full_name}
                    </p>
                    <p className="text-muted-foreground">
                      {row.title ?? "—"} · {row.company_name}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <GrowthBadge label={row.source} tone="neutral" />
                    <GrowthBadge label={queueStatusLabel(row.status)} tone={queueStatusTone(row.status)} />
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <GrowthBadge label={enrichmentLabel(row.enrichment_status)} tone="neutral" />
                  <GrowthBadge
                    label={row.contactable ? "Contactable" : "Not contactable"}
                    tone={row.contactable ? "healthy" : "attention"}
                  />
                  <GrowthBadge
                    label={row.sequence_ready ? "Sequence-ready" : "Not sequence-ready"}
                    tone={row.sequence_ready ? "healthy" : "medium"}
                  />
                </div>

                {row.blockers.length ? (
                  <p className="mt-1 text-[10px] text-amber-900">
                    Blockers: {row.blockers.join(", ").replace(/_/g, " ")}
                  </p>
                ) : null}

                {row.status === "pending_enrollment_approval" ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      disabled={actionKey === row.queue_item_id}
                      onClick={() => void runAction({ action: "approve_enrollment", row })}
                    >
                      {actionKey === row.queue_item_id ? (
                        <Loader2 className="mr-1 size-3 animate-spin" />
                      ) : (
                        <BadgeCheck className="mr-1 size-3" />
                      )}
                      Approve enrollment eligibility
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[10px]"
                      disabled={actionKey === row.queue_item_id}
                      onClick={() => void runAction({ action: "reject_enrollment", row })}
                    >
                      {actionKey === row.queue_item_id ? (
                        <Loader2 className="mr-1 size-3 animate-spin" />
                      ) : (
                        <ShieldAlert className="mr-1 size-3" />
                      )}
                      Reject enrollment
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </GrowthEngineCard>
  )
}
