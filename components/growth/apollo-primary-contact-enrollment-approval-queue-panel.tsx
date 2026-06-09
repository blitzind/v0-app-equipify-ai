"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BadgeCheck,
  ExternalLink,
  FilePlus2,
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
  ApolloPrimaryContactEnrollmentDraftQueueRow,
  ApolloPrimaryContactEnrollmentDraftSnapshot,
} from "@/lib/growth/apollo/apollo-primary-contact-enrollment-draft-types"
import { APOLLO_PRIMARY_CONTACT_ENROLLMENT_DRAFT_QA_MARKER } from "@/lib/growth/apollo/apollo-primary-contact-enrollment-draft-types"
import type { ApolloPrimaryContactEnrollmentQueueStatus } from "@/lib/growth/apollo/apollo-primary-contact-enrollment-bridge-types"
import { cn } from "@/lib/utils"

type QueueFilter =
  | "all"
  | ApolloPrimaryContactEnrollmentQueueStatus
  | "sequence_ready"
  | "contactable"
  | "draftable"
  | "draft_created"
  | "blocked"

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

function enrichmentLabel(status: ApolloPrimaryContactEnrollmentDraftQueueRow["enrichment_status"]): string {
  return status.replace(/_/g, " ")
}

export function ApolloPrimaryContactEnrollmentApprovalQueuePanel({
  companyCandidateId,
  className,
}: {
  companyCandidateId?: string | null
  className?: string
}) {
  const [snapshot, setSnapshot] = useState<ApolloPrimaryContactEnrollmentDraftSnapshot | null>(null)
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
      const res = await fetch(
        `/api/platform/growth/apollo-primary-contact-acquisition/enrollment-draft?${params.toString()}`,
        { cache: "no-store" },
      )
      const json = (await res.json()) as {
        ok?: boolean
        snapshot?: ApolloPrimaryContactEnrollmentDraftSnapshot
        message?: string
      }
      if (!res.ok || !json.ok || !json.snapshot) {
        throw new Error(json.message ?? "Could not load Apollo enrollment draft queue.")
      }
      setSnapshot(json.snapshot)
    } catch (e) {
      setSnapshot(null)
      setError(e instanceof Error ? e.message : "Could not load Apollo enrollment draft queue.")
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
      case "draftable":
        return items.filter((row) => row.draftable)
      case "draft_created":
        return items.filter((row) => Boolean(row.enrollment_draft_id))
      case "blocked":
        return items.filter(
          (row) =>
            row.status === "enrollment_approved" && !row.enrollment_draft_id && !row.draftable,
        )
      default:
        return items
    }
  }, [snapshot?.items, filter])

  async function runApprovalAction(input: {
    action: "approve_enrollment" | "reject_enrollment"
    row: ApolloPrimaryContactEnrollmentDraftQueueRow
  }) {
    setActionKey(`${input.action}:${input.row.queue_item_id}`)
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
          "Enrollment eligibility approved. Create an enrollment draft below — draft only, confirm separately in the lead workflow.",
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

  async function runCreateDraftAction(row: ApolloPrimaryContactEnrollmentDraftQueueRow) {
    setActionKey(`create_draft:${row.queue_item_id}`)
    setMessage(null)
    setError(null)

    try {
      const res = await fetch(
        "/api/platform/growth/apollo-primary-contact-acquisition/enrollment-draft/actions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_enrollment_draft",
            queueItemId: row.queue_item_id,
          }),
        },
      )
      const json = (await res.json()) as {
        ok?: boolean
        message?: string
        error?: string
        growth_lead_id?: string | null
        enrollment_draft_id?: string | null
        blockers?: string[]
      }
      if (!res.ok || !json.ok) {
        const blockers = json.blockers?.length ? ` (${json.blockers.join(", ")})` : ""
        throw new Error(json.message ?? json.error ?? `Draft creation blocked${blockers}.`)
      }
      setMessage(
        "Enrollment draft created. Open the lead sequence panel to review and confirm — no auto-enrollment or outreach.",
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft creation failed.")
    } finally {
      setActionKey(null)
    }
  }

  const summary = snapshot?.summary
  const evidence = snapshot?.evidence
  const attributionChain = snapshot?.source_attribution_chain ?? []

  return (
    <GrowthEngineCard
      title="Apollo Enrollment Approval Queue"
      icon={<GitBranch className="size-4" />}
      className={cn(className)}
    >
      <section data-qa-marker={APOLLO_PRIMARY_CONTACT_ENROLLMENT_DRAFT_QA_MARKER}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="size-4 text-indigo-700" />
            <p className="text-sm text-muted-foreground">
              Apollo → Operator Approved → Enrollment Queue → Draft. Explicit draft creation only — no
              auto-enrollment, sequences, or outreach.
            </p>
            {summary ? (
              <GrowthBadge
                label={`${summary.total} item${summary.total === 1 ? "" : "s"}`}
                tone={summary.approved > summary.drafts_created ? "attention" : "neutral"}
              />
            ) : null}
          </div>
          <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
            {loading ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <RefreshCw className="mr-1 size-3.5" />}
            Refresh
          </Button>
        </div>

        {attributionChain.length ? (
          <p className="mt-2 text-[10px] text-muted-foreground">
            Source: {attributionChain.join(" → ")}
          </p>
        ) : null}

        {summary ? (
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
            <GrowthBadge label={`Queued ${evidence?.queued_contacts ?? summary.total}`} tone="neutral" />
            <GrowthBadge label={`Draftable ${summary.draftable}`} tone="attention" />
            <GrowthBadge label={`Drafts ${summary.drafts_created}`} tone="healthy" />
            <GrowthBadge label={`Blocked ${summary.blocked}`} tone="medium" />
            <GrowthBadge label={`Pending approval ${summary.total - summary.approved}`} tone="attention" />
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Filter className="size-3.5 text-muted-foreground" />
          {(
            [
              ["pending_enrollment_approval", "Pending"],
              ["enrollment_approved", "Approved"],
              ["draftable", "Draftable"],
              ["draft_created", "Draft created"],
              ["blocked", "Blocked"],
              ["enrollment_rejected", "Rejected"],
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
                    {row.enrollment_draft_id ? (
                      <GrowthBadge label="Draft created" tone="healthy" />
                    ) : row.draftable ? (
                      <GrowthBadge label="Draftable" tone="attention" />
                    ) : row.status === "enrollment_approved" ? (
                      <GrowthBadge label="Blocked" tone="medium" />
                    ) : null}
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

                {row.blockers.length || row.draft_blockers.length ? (
                  <p className="mt-1 text-[10px] text-amber-900">
                    Blockers: {[...row.blockers, ...row.draft_blockers].join(", ").replace(/_/g, " ")}
                  </p>
                ) : null}

                {row.status === "pending_enrollment_approval" ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      disabled={actionKey === `approve_enrollment:${row.queue_item_id}`}
                      onClick={() => void runApprovalAction({ action: "approve_enrollment", row })}
                    >
                      {actionKey === `approve_enrollment:${row.queue_item_id}` ? (
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
                      disabled={actionKey === `reject_enrollment:${row.queue_item_id}`}
                      onClick={() => void runApprovalAction({ action: "reject_enrollment", row })}
                    >
                      {actionKey === `reject_enrollment:${row.queue_item_id}` ? (
                        <Loader2 className="mr-1 size-3 animate-spin" />
                      ) : (
                        <ShieldAlert className="mr-1 size-3" />
                      )}
                      Reject enrollment
                    </Button>
                  </div>
                ) : null}

                {row.status === "enrollment_approved" && row.draftable ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-[10px]"
                      disabled={actionKey === `create_draft:${row.queue_item_id}`}
                      onClick={() => void runCreateDraftAction(row)}
                    >
                      {actionKey === `create_draft:${row.queue_item_id}` ? (
                        <Loader2 className="mr-1 size-3 animate-spin" />
                      ) : (
                        <FilePlus2 className="mr-1 size-3" />
                      )}
                      Create enrollment draft
                    </Button>
                  </div>
                ) : null}

                {row.enrollment_draft_id && row.growth_lead_id ? (
                  <div className="mt-2">
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" asChild>
                      <Link href={`/admin/growth/leads/crm?open=${row.growth_lead_id}`}>
                        <ExternalLink className="mr-1 size-3" />
                        View draft in enrollment workflow
                      </Link>
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
