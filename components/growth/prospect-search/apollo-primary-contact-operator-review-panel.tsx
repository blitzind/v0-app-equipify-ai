"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BadgeCheck,
  CheckCheck,
  Filter,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type {
  ApolloPrimaryContactOperatorReviewRow,
  ApolloPrimaryContactOperatorReviewSnapshot,
  ApolloPrimaryContactOperatorReviewStatus,
} from "@/lib/growth/apollo/apollo-primary-contact-operator-review-types"
import { APOLLO_PRIMARY_CONTACT_OPERATOR_REVIEW_QA_MARKER } from "@/lib/growth/apollo/apollo-primary-contact-operator-review-types"
import { cn } from "@/lib/utils"

type ReviewFilter = "all" | ApolloPrimaryContactOperatorReviewStatus | "sequence_ready" | "contactable"

function reviewStatusTone(status: ApolloPrimaryContactOperatorReviewStatus): "healthy" | "attention" | "neutral" | "medium" {
  if (status === "approved") return "healthy"
  if (status === "rejected") return "attention"
  return "medium"
}

function enrichmentLabel(status: ApolloPrimaryContactOperatorReviewRow["enrichment_status"]): string {
  return status.replace(/_/g, " ")
}

function channelSummary(row: ApolloPrimaryContactOperatorReviewRow): string {
  const parts: string[] = []
  if (row.channel_availability.email) parts.push("Email")
  if (row.channel_availability.linkedin) parts.push("LinkedIn")
  if (row.channel_availability.phone) parts.push("Phone")
  return parts.length ? parts.join(" · ") : "No channels"
}

export function ApolloPrimaryContactOperatorReviewPanel({
  companyCandidateId,
  companyName,
  className,
}: {
  companyCandidateId: string
  companyName: string
  className?: string
}) {
  const [snapshot, setSnapshot] = useState<ApolloPrimaryContactOperatorReviewSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionKey, setActionKey] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [filter, setFilter] = useState<ReviewFilter>("all")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ companyCandidateId })
      const res = await fetch(
        `/api/platform/growth/apollo-primary-contact-acquisition/operator-review?${params.toString()}`,
        { cache: "no-store" },
      )
      const json = (await res.json()) as {
        ok?: boolean
        snapshot?: ApolloPrimaryContactOperatorReviewSnapshot
        message?: string
      }
      if (!res.ok || !json.ok || !json.snapshot) {
        throw new Error(json.message ?? "Could not load contact acquisition review.")
      }
      setSnapshot(json.snapshot)
    } catch (e) {
      setSnapshot(null)
      setError(e instanceof Error ? e.message : "Could not load contact acquisition review.")
    } finally {
      setLoading(false)
    }
  }, [companyCandidateId])

  useEffect(() => {
    void load()
  }, [load])

  const filteredContacts = useMemo(() => {
    const contacts = snapshot?.contacts ?? []
    switch (filter) {
      case "pending":
      case "approved":
      case "rejected":
        return contacts.filter((row) => row.operator_review_status === filter)
      case "sequence_ready":
        return contacts.filter((row) => row.sequence_ready)
      case "contactable":
        return contacts.filter((row) => row.contactable)
      default:
        return contacts
    }
  }, [snapshot?.contacts, filter])

  async function runAction(input: {
    action: "approve" | "reject" | "bulk_approve"
    row?: ApolloPrimaryContactOperatorReviewRow
  }) {
    const actionKeyValue =
      input.action === "bulk_approve" ? "bulk" : input.row?.row_id ?? input.action
    if (input.action === "bulk_approve") setBulkLoading(true)
    else setActionKey(actionKeyValue)
    setMessage(null)
    setError(null)

    try {
      const res = await fetch(
        "/api/platform/growth/apollo-primary-contact-acquisition/operator-review/actions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: input.action,
            companyCandidateId,
            companyContactId: input.row?.company_contact_id ?? null,
            contactCandidateId: input.row?.contact_candidate_id ?? null,
          }),
        },
      )
      const json = (await res.json()) as {
        ok?: boolean
        message?: string
        error?: string
        contact_ids?: string[]
      }
      if (!res.ok || !json.ok) {
        throw new Error(json.message ?? json.error ?? "Review action failed.")
      }
      if (input.action === "bulk_approve") {
        setMessage(`Approved ${json.contact_ids?.length ?? 0} sequence-ready contact(s) for outreach readiness and enrollment approval queue.`)
      } else       if (input.action === "approve") {
        setMessage("Contact approved for outreach readiness and queued for enrollment approval. No enrollment or outreach was triggered.")
      } else {
        setMessage("Contact rejected and suppressed. No enrollment or outreach was triggered.")
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review action failed.")
    } finally {
      setActionKey(null)
      setBulkLoading(false)
    }
  }

  const summary = snapshot?.summary

  return (
    <section
      className={cn("rounded-xl border border-indigo-100 bg-indigo-50/40 p-4", className)}
      data-qa-marker={APOLLO_PRIMARY_CONTACT_OPERATOR_REVIEW_QA_MARKER}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="size-4 text-indigo-700" />
          <h4 className="text-sm font-semibold text-indigo-950">
            Contact acquisition review — {companyName}
          </h4>
          {summary ? (
            <GrowthBadge
              label={`${summary.total} contact${summary.total === 1 ? "" : "s"}`}
              tone={summary.total > 0 ? "healthy" : "neutral"}
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
            {loading ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <RefreshCw className="mr-1 size-3.5" />}
            Refresh
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={bulkLoading || !summary?.sequence_ready_pending_approval}
            onClick={() => void runAction({ action: "bulk_approve" })}
          >
            {bulkLoading ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <CheckCheck className="mr-1 size-3.5" />
            )}
            Bulk approve sequence-ready ({summary?.sequence_ready_pending_approval ?? 0})
          </Button>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Review discovered contacts before outreach. Approvals mark readiness only — no auto-enrollment,
        sequences, email, SMS, voice, or calls.
      </p>

      {summary ? (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
          <GrowthBadge label={`Pending ${summary.pending}`} tone="medium" />
          <GrowthBadge label={`Approved ${summary.approved}`} tone="healthy" />
          <GrowthBadge label={`Rejected ${summary.rejected}`} tone="attention" />
          <GrowthBadge label={`Contactable ${summary.contactable}`} tone="neutral" />
          <GrowthBadge label={`Sequence-ready ${summary.sequence_ready}`} tone="healthy" />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Filter className="size-3.5 text-muted-foreground" />
        {(
          [
            ["all", "All"],
            ["pending", "Pending"],
            ["approved", "Approved"],
            ["rejected", "Rejected"],
            ["sequence_ready", "Sequence-ready"],
            ["contactable", "Contactable"],
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
          Loading contacts…
        </p>
      ) : null}

      {!loading && snapshot && filteredContacts.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {snapshot.contacts.length === 0
            ? "No discovered contacts found for this company yet. Run contact discovery first."
            : "No contacts match the selected filter."}
        </p>
      ) : null}

      {filteredContacts.length ? (
        <ul className="mt-3 space-y-2">
          {filteredContacts.map((row) => (
            <li key={row.row_id} className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1 font-medium">
                    <UserRound className="size-3 text-muted-foreground" />
                    {row.full_name}
                  </p>
                  <p className="text-muted-foreground">{row.title ?? "—"} · {row.company_name}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <GrowthBadge label={row.source} tone="neutral" />
                  <GrowthBadge
                    label={row.operator_review_status.replace(/_/g, " ")}
                    tone={reviewStatusTone(row.operator_review_status)}
                  />
                  {row.outreach_ready ? <GrowthBadge label="Outreach ready" tone="healthy" /> : null}
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

              <p className="mt-2 text-[10px] text-muted-foreground">{channelSummary(row)}</p>

              {row.blockers.length ? (
                <p className="mt-1 text-[10px] text-amber-900">
                  Blockers: {row.blockers.join(", ").replace(/_/g, " ")}
                </p>
              ) : null}

              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px]"
                  disabled={actionKey === row.row_id || row.operator_review_status === "approved"}
                  onClick={() => void runAction({ action: "approve", row })}
                >
                  {actionKey === row.row_id ? (
                    <Loader2 className="mr-1 size-3 animate-spin" />
                  ) : (
                    <BadgeCheck className="mr-1 size-3" />
                  )}
                  Approve for outreach
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[10px]"
                  disabled={actionKey === row.row_id || row.operator_review_status === "rejected"}
                  onClick={() => void runAction({ action: "reject", row })}
                >
                  {actionKey === row.row_id ? (
                    <Loader2 className="mr-1 size-3 animate-spin" />
                  ) : (
                    <ShieldAlert className="mr-1 size-3" />
                  )}
                  Reject / suppress
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
