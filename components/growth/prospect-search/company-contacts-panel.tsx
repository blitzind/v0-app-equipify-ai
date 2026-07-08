"use client"

import { useCallback, useEffect, useState } from "react"
import { BadgeCheck, Loader2, RefreshCw, ShieldAlert, Target, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type {
  GrowthCompanyContact,
  GrowthCompanyContactsSnapshot,
} from "@/lib/growth/contact-discovery/company-contact-types"

function freshnessLabel(lastVerifiedAt: string | null): string {
  if (!lastVerifiedAt) return "Never verified"
  const days = Math.floor((Date.now() - Date.parse(lastVerifiedAt)) / (24 * 60 * 60 * 1000))
  if (days <= 0) return "Verified today"
  if (days < 90) return `Verified ${days}d ago`
  return "Stale — refresh recommended"
}

function statusTone(status: string): "healthy" | "attention" | "medium" | "neutral" {
  if (status === "verified" || status === "discovered" || status === "business" || status === "mobile") return "healthy"
  if (status === "risky" || status === "invalid") return "attention"
  if (status === "candidate") return "medium"
  return "neutral"
}

export function CompanyContactsPanel({
  companyId,
  companyName,
  website,
  growthLeadId,
  onPushToInbox,
}: {
  companyId: string
  companyName: string
  website?: string | null
  growthLeadId?: string | null
  onPushToInbox?: (contact: GrowthCompanyContact) => void
}) {
  const [snapshot, setSnapshot] = useState<GrowthCompanyContactsSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)

  const load = useCallback(
    async (run = false) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ company_id: companyId })
        if (growthLeadId) params.set("growth_lead_id", growthLeadId)
        if (website) params.set("website", website)
        if (run) params.set("run", "1")
        const res = await fetch(`/api/platform/growth/company-contacts?${params.toString()}`, { cache: "no-store" })
        const json = (await res.json()) as { ok?: boolean; snapshot?: GrowthCompanyContactsSnapshot }
        if (res.ok && json.ok && json.snapshot) setSnapshot(json.snapshot)
      } finally {
        setLoading(false)
      }
    },
    [companyId, growthLeadId, website],
  )

  useEffect(() => {
    void load(false)
  }, [load])

  const patchContact = useCallback(async (contactId: string, body: Record<string, unknown>) => {
    setActionId(contactId)
    try {
      const res = await fetch(`/api/platform/growth/company-contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) await load(false)
    } finally {
      setActionId(null)
    }
  }, [load])

  return (
    <section className="rounded-xl border border-violet-100 bg-violet-50/40 p-4" data-qa-marker="growth-company-contacts-v1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <UserRound className="size-4 text-violet-700" />
          <h4 className="text-sm font-semibold text-violet-950">Decision makers — {companyName}</h4>
          {snapshot?.coverage ? (
            <GrowthBadge label={`Coverage ${snapshot.coverage.coverage_label}`} tone="healthy" />
          ) : null}
        </div>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load(true)}>
          {loading ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <RefreshCw className="mr-1 size-3.5" />}
          Research contacts
        </Button>
      </div>

      {snapshot?.schema_ready ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Confidence {snapshot.coverage.contact_confidence_score}% · {snapshot.privacy_note}
        </p>
      ) : null}

      {snapshot?.contacts.length ? (
        <ul className="mt-3 space-y-2">
          {snapshot.contacts.slice(0, 8).map((contact) => (
            <li key={contact.id} className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{contact.full_name}</p>
                  <p className="text-muted-foreground">{contact.title ?? "—"}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <GrowthBadge label={`DM ${contact.decision_maker_score}`} tone="healthy" />
                  <GrowthBadge label={`Conf ${contact.confidence_score}%`} tone="neutral" />
                  {contact.contact_status === "verified" ? (
                    <GrowthBadge label="Verified" tone="healthy" />
                  ) : null}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                {contact.email ? <span>{contact.email} · {contact.email_status}</span> : <span>No email</span>}
                {contact.phone ? <span>{contact.phone} · {contact.phone_status}</span> : null}
                {contact.linkedin_url ? <span>{contact.linkedin_url}</span> : null}
              </div>

              <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                <Target className="size-3" />
                {freshnessLabel(contact.last_verified_at)} · {contact.source_type.replace(/_/g, " ")}
              </p>

              {contact.source_evidence[0] ? (
                <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">
                  Evidence: {contact.source_evidence[0].evidence}
                </p>
              ) : null}

              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px]"
                  disabled={actionId === contact.id}
                  onClick={() => void patchContact(contact.id, { action: "refresh" })}
                >
                  {actionId === contact.id ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                  Refresh contact
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px]"
                  disabled={actionId === contact.id}
                  onClick={() => void patchContact(contact.id, { contact_status: "verified" })}
                >
                  <BadgeCheck className="mr-1 size-3" />
                  Approve contact
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[10px]"
                  disabled={actionId === contact.id}
                  onClick={() => void patchContact(contact.id, { contact_status: "suppressed" })}
                >
                  <ShieldAlert className="mr-1 size-3" />
                  Suppress
                </Button>
                {onPushToInbox ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[10px]"
                    onClick={() => onPushToInbox(contact)}
                  >
                    Push to Revenue Queue
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          No evidence-backed contacts yet. Run research contacts to crawl team and contact pages.
        </p>
      )}
    </section>
  )
}
