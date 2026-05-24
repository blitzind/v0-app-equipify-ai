"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  Activity,
  Clock,
  ExternalLink,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Search,
  UserPlus,
} from "lucide-react"
import { GrowthLeadEditContactDialog } from "@/components/growth/growth-lead-edit-contact-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { GrowthNextBestActionBanner } from "@/components/growth/growth-next-best-action-banner"
import { GrowthCallActionSheet } from "@/components/growth/growth-call-action-sheet"
import {
  GrowthBadge,
  GrowthEngineCard,
  formatRelativeTime,
  momentumTierTone,
  priorityTierTone,
  workflowHealthTone,
} from "@/components/growth/growth-ui-utils"
import { GROWTH_NEXT_BEST_ACTION_LABELS } from "@/lib/growth/nba-types"
import type { GrowthLeadCallDisposition } from "@/lib/growth/call-types"
import type { GrowthLead } from "@/lib/growth/types"
import { cn } from "@/lib/utils"

type GrowthLeadCommandCenterProps = {
  lead: GrowthLead
  onLeadUpdated?: (patch: Partial<GrowthLead>) => void
  onLeadSaved?: (lead: GrowthLead) => void
  onAddDecisionMaker?: () => void
  onTimelineRefresh?: () => void
}

function formatSource(lead: GrowthLead): string {
  const channel = lead.sourceChannel ?? lead.sourceKind.replace(/_/g, " ")
  const parts = [channel, lead.sourceCampaign, lead.sourceVendor].filter(Boolean)
  return parts.join(" · ")
}

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(9, 0, 0, 0)
  return d.toISOString()
}

function toDateInputValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function GrowthLeadCommandCenter({
  lead,
  onLeadUpdated,
  onAddDecisionMaker,
  onTimelineRefresh,
}: GrowthLeadCommandCenterProps) {
  const [primaryDmName, setPrimaryDmName] = useState<string | null>(null)
  const [touchSaving, setTouchSaving] = useState(false)
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [followUpAt, setFollowUpAt] = useState("")
  const [followUpNote, setFollowUpNote] = useState("")
  const [followUpSaving, setFollowUpSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [callSheetOpen, setCallSheetOpen] = useState(false)
  const [editContactOpen, setEditContactOpen] = useState(false)

  const phone = lead.contactPhone?.trim() || null
  const email = lead.contactEmail?.trim() || null
  const website = lead.website?.trim() || null

  useEffect(() => {
    let cancelled = false
    async function loadPrimaryDm() {
      if (!lead.primaryDecisionMakerId) {
        setPrimaryDmName(null)
        return
      }
      try {
        const res = await fetch(`/api/platform/growth/leads/${lead.id}/decision-makers`, { cache: "no-store" })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          decisionMakers?: { id: string; fullName: string; isPrimary: boolean }[]
        }
        if (cancelled || !data.ok) return
        const primary =
          data.decisionMakers?.find((dm) => dm.id === lead.primaryDecisionMakerId) ??
          data.decisionMakers?.find((dm) => dm.isPrimary)
        setPrimaryDmName(primary?.fullName ?? null)
      } catch {
        if (!cancelled) setPrimaryDmName(null)
      }
    }
    void loadPrimaryDm()
    return () => {
      cancelled = true
    }
  }, [lead.id, lead.primaryDecisionMakerId])

  const quickFollowUpOptions = useMemo(
    () => [
      { label: "1 day", value: addDays(1) },
      { label: "3 days", value: addDays(3) },
      { label: "7 days", value: addDays(7) },
    ],
    [],
  )

  useEffect(() => {
    if (!actionSuccess) return
    const timer = window.setTimeout(() => setActionSuccess(null), 4000)
    return () => window.clearTimeout(timer)
  }, [actionSuccess])

  async function recordManualTouch() {
    setTouchSaving(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/timeline/manual-touch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        lead?: GrowthLead
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.lead) {
        throw new Error(data.message ?? data.error ?? "Could not record Manual Touch.")
      }
      onLeadUpdated?.(data.lead)
      onTimelineRefresh?.()
      setActionSuccess("Manual Touch recorded.")
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not record Manual Touch.")
    } finally {
      setTouchSaving(false)
    }
  }

  function openFollowUpDialog() {
    setFollowUpAt(toDateInputValue(addDays(3)))
    setFollowUpNote("")
    setFollowUpOpen(true)
  }

  async function submitFollowUp() {
    if (!followUpAt) return
    const parsed = new Date(followUpAt)
    if (Number.isNaN(parsed.getTime())) return

    setFollowUpSaving(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      const input: {
        disposition: GrowthLeadCallDisposition
        note?: string | null
        followUpAt?: string | null
      } = {
        disposition: "follow_up_later",
        followUpAt: parsed.toISOString(),
        note: followUpNote.trim() || null,
      }
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/call-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        lead?: GrowthLead
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Could not schedule Follow Up.")
      }
      if (data.lead) onLeadUpdated?.(data.lead)
      onTimelineRefresh?.()
      setFollowUpOpen(false)
      setActionSuccess("Follow Up scheduled.")
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not schedule Follow Up.")
    } finally {
      setFollowUpSaving(false)
    }
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <>
      <GrowthEngineCard>
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">{lead.companyName}</h2>
              {[lead.city, lead.state].filter(Boolean).length ? (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {[lead.city, lead.state].filter(Boolean).join(", ")}
                </p>
              ) : null}
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditContactOpen(true)}>
              <Pencil className="mr-2 size-3.5" />
              Edit Contact Info
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <GrowthBadge label={lead.status.replace(/_/g, " ")} tone="status" />
            {lead.workflowHealth ? (
              <GrowthBadge
                label={lead.workflowHealth.replace(/_/g, " ")}
                tone={workflowHealthTone(lead.workflowHealth)}
              />
            ) : null}
            {lead.momentumTier ? (
              <GrowthBadge label={`Momentum ${lead.momentumTier}`} tone={momentumTierTone(lead.momentumTier)} />
            ) : null}
            {lead.callPriorityTier ? (
              <GrowthBadge
                label={`${lead.callPriorityTier} priority`}
                tone={priorityTierTone(lead.callPriorityTier)}
              />
            ) : null}
            {lead.score != null ? <GrowthBadge label={`Fit ${lead.score}`} tone="medium" /> : null}
            <GrowthBadge label={formatSource(lead)} tone="neutral" className="normal-case" />
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <ContactRow icon={<Phone className="size-3.5" />} label="Primary contact" value={lead.contactName} />
            <ContactRow icon={<Phone className="size-3.5" />} label="Phone" value={phone} />
            <ContactRow icon={<Mail className="size-3.5" />} label="Email" value={email} href={email ? `mailto:${email}` : undefined} />
            <ContactRow
              icon={<ExternalLink className="size-3.5" />}
              label="Website"
              value={website}
              href={website ? (website.startsWith("http") ? website : `https://${website}`) : undefined}
              external
            />
            {primaryDmName ? (
              <ContactRow icon={<UserPlus className="size-3.5" />} label="Primary decision maker" value={primaryDmName} className="sm:col-span-2" />
            ) : null}
          </dl>

          {lead.lastHumanTouchAt ? (
            <p className="text-xs text-muted-foreground">Last touch {formatRelativeTime(lead.lastHumanTouchAt)}</p>
          ) : null}

          {lead.callAttemptCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              Calls: {lead.callAttemptCount} attempts · {lead.voicemailCount} voicemail · {lead.connectedCallCount} connected
            </p>
          ) : null}

          <GrowthNextBestActionBanner lead={lead} />

          {actionError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {actionError}
            </div>
          ) : null}

          {actionSuccess ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {actionSuccess}
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {phone ? (
                <Button size="lg" className="h-11 justify-start gap-2" onClick={() => setCallSheetOpen(true)}>
                  <Phone className="size-4" />
                  Call
                </Button>
              ) : (
                <Button size="lg" variant="outline" className="h-11 justify-start gap-2" disabled>
                  <Phone className="size-4" />
                  Call
                </Button>
              )}
              <Button size="lg" variant="outline" className="h-11 justify-start gap-2" onClick={() => scrollTo("growth-research")}>
                <Search className="size-4" />
                Research
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button size="lg" variant="outline" className="h-11 justify-start gap-2" onClick={openFollowUpDialog}>
                <Clock className="size-4" />
                Follow Up
              </Button>
              <Button size="lg" variant="outline" className="h-11 justify-start gap-2" onClick={onAddDecisionMaker}>
                <UserPlus className="size-4" />
                Add Decision Maker
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="h-11 justify-start gap-2 text-muted-foreground hover:text-foreground"
                disabled={touchSaving}
                onClick={() => void recordManualTouch()}
              >
                {touchSaving ? <Loader2 className="size-4 animate-spin" /> : <Activity className="size-4" />}
                Manual Touch
              </Button>
            </div>
          </div>

          {lead.nextBestAction ? (
            <p className="text-xs text-muted-foreground">
              Suggested: {GROWTH_NEXT_BEST_ACTION_LABELS[lead.nextBestAction] ?? lead.nextBestAction.replace(/_/g, " ")}
            </p>
          ) : null}
        </div>
      </GrowthEngineCard>

      <Dialog open={followUpOpen} onOpenChange={(open) => !followUpSaving && setFollowUpOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Follow Up Later</DialogTitle>
            <DialogDescription>Schedule a follow-up for {lead.companyName}.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {quickFollowUpOptions.map((option) => (
                <Button
                  key={option.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFollowUpAt(toDateInputValue(option.value))}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="drawer-follow-up-at">Custom date</Label>
              <Input
                id="drawer-follow-up-at"
                type="datetime-local"
                value={followUpAt}
                onChange={(event) => setFollowUpAt(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="drawer-follow-up-note">Note (optional)</Label>
              <Textarea
                id="drawer-follow-up-note"
                value={followUpNote}
                onChange={(event) => setFollowUpNote(event.target.value)}
                placeholder="Why follow up later?"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFollowUpOpen(false)} disabled={followUpSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitFollowUp()} disabled={followUpSaving || !followUpAt}>
              {followUpSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Save Follow Up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {phone ? (
        <GrowthCallActionSheet
          open={callSheetOpen}
          onOpenChange={setCallSheetOpen}
          leadId={lead.id}
          phone={phone}
          contactLabel={lead.contactName ?? lead.companyName}
          onLeadUpdated={(updated) => {
            onLeadUpdated?.(updated)
            onTimelineRefresh?.()
          }}
        />
      ) : null}

      <GrowthLeadEditContactDialog
        lead={lead}
        open={editContactOpen}
        onOpenChange={setEditContactOpen}
        onSaved={(updated) => {
          onLeadUpdated?.(updated)
          onLeadSaved?.(updated)
          onTimelineRefresh?.()
        }}
      />
    </>
  )
}

function ContactRow({
  icon,
  label,
  value,
  href,
  external,
  className,
}: {
  icon: ReactNode
  label: string
  value: string | null | undefined
  href?: string
  external?: boolean
  className?: string
}) {
  const display = value?.trim() ? value : "—"
  return (
    <div className={className}>
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-foreground">
        {href && value ? (
          <a
            href={href}
            className={cn("text-sm hover:underline", external && "inline-flex items-center gap-1")}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
          >
            {display}
            {external ? <ExternalLink className="size-3 opacity-60" /> : null}
          </a>
        ) : (
          <span className="text-sm">{display}</span>
        )}
      </dd>
    </div>
  )
}
