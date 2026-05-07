"use client"

/**
 * Leads + Follow-Up Phase 1 — prospect drawer.
 *
 * Shows pipeline + contact info, recent follow-up timeline (read from
 * `communication_events`), and primary actions: Edit, Log follow-up,
 * Convert to customer, Archive. Uses the shared <DetailDrawer> shell so
 * the look matches the rest of the app.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArchiveRestore,
  Building2,
  Loader2,
  Mail,
  MessageSquarePlus,
  Pencil,
  Phone,
  Sparkles,
  Trash2,
  UserPlus2,
} from "lucide-react"
import { DetailDrawer, DrawerSection } from "@/components/detail-drawer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { ProspectListItem } from "@/lib/prospects/types"
import {
  followUpBucketFor,
  formatEstimatedValue,
  formatFollowUpStamp,
  formatProspectStatus,
  prospectStatusBadgeClasses,
  formatDateOnly,
} from "@/lib/prospects/format"
import { ProspectFormDialog } from "@/components/prospects/prospect-form-dialog"
import { LogFollowUpDialog } from "@/components/prospects/log-follow-up-dialog"
import { ConvertProspectDialog } from "@/components/prospects/convert-prospect-dialog"
import { AiDraftFollowUpDialog } from "@/components/prospects/ai-draft-followup-dialog"
import { useBillingAccessOptional } from "@/lib/billing-access-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { RecentCommunicationsCard } from "@/components/communications/recent-communications-card"

type TimelineEvent = {
  id: string
  channel: string
  event_type: string
  title: string
  summary: string | null
  body: string | null
  recipient_address: string | null
  related_entity_type: string | null
  metadata: Record<string, unknown> | null
  sent_at: string | null
  created_at: string
}

export type ProspectDrawerProps = {
  open: boolean
  onClose: () => void
  organizationId: string
  prospect: ProspectListItem | null
  canManage: boolean
  onChanged: () => void
}

export function ProspectDrawer({
  open,
  onClose,
  organizationId,
  prospect,
  canManage,
  onChanged,
}: ProspectDrawerProps) {
  const { toast } = useToast()
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [loadingTimeline, setLoadingTimeline] = useState(false)

  const billingAccess = useBillingAccessOptional()
  const orgPerms = useOrgPermissions()
  const aiDraftAvailable = Boolean(
    billingAccess?.insightsAllowed && orgPerms?.permissions?.canViewInsights,
  )

  const [editOpen, setEditOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

  useEffect(() => {
    if (!open || !prospect) return
    let cancelled = false
    async function load() {
      if (!prospect) return
      setLoadingTimeline(true)
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/prospects/${encodeURIComponent(prospect.id)}/timeline`,
          { cache: "no-store" },
        )
        const j = (await res.json().catch(() => ({}))) as { events?: TimelineEvent[] }
        if (!cancelled) setTimeline(j.events ?? [])
      } catch {
        if (!cancelled) setTimeline([])
      } finally {
        if (!cancelled) setLoadingTimeline(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [open, organizationId, prospect])

  if (!prospect) {
    return (
      <DetailDrawer open={open} onClose={onClose} title="Prospect" subtitle="">
        <p className="text-sm text-muted-foreground">No prospect selected.</p>
      </DetailDrawer>
    )
  }

  const bucket = followUpBucketFor(prospect.next_follow_up_at)
  const followUpTone =
    bucket === "overdue"
      ? "text-rose-700 dark:text-rose-300"
      : bucket === "today"
        ? "text-amber-700 dark:text-amber-300"
        : "text-muted-foreground"

  async function refreshTimeline() {
    if (!prospect) return
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/prospects/${encodeURIComponent(prospect.id)}/timeline`,
        { cache: "no-store" },
      )
      const j = (await res.json().catch(() => ({}))) as { events?: TimelineEvent[] }
      setTimeline(j.events ?? [])
    } catch {
      // ignore
    }
  }

  async function handleArchive() {
    if (!prospect) return
    setArchiving(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/prospects/${encodeURIComponent(prospect.id)}`,
        { method: "DELETE" },
      )
      const j = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) throw new Error(j.message ?? "Could not archive prospect.")
      toast({ title: "Prospect archived" })
      setArchiveOpen(false)
      onChanged()
      onClose()
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Failed",
        variant: "destructive",
      })
    } finally {
      setArchiving(false)
    }
  }

  return (
    <>
      <DetailDrawer
        open={open}
        onClose={onClose}
        title={prospect.company_name}
        subtitle={prospect.contact_name ?? prospect.contact_email ?? prospect.contact_phone ?? "Prospect"}
        badge={
          <Badge variant="outline" className={cn("text-xs", prospectStatusBadgeClasses(prospect.status))}>
            {formatProspectStatus(prospect.status)}
          </Badge>
        }
        actions={
          canManage ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={() => setLogOpen(true)}
                disabled={Boolean(prospect.archived_at)}
              >
                <MessageSquarePlus className="w-3.5 h-3.5" /> Log follow-up
              </Button>
              {aiDraftAvailable ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 text-primary"
                  onClick={() => setAiOpen(true)}
                  disabled={Boolean(prospect.archived_at)}
                  title="Draft a follow-up email with AI"
                >
                  <Sparkles className="w-3.5 h-3.5" /> AI draft
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={() => setEditOpen(true)}
                disabled={Boolean(prospect.archived_at)}
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
              {!prospect.converted_customer_id ? (
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => setConvertOpen(true)}
                  disabled={Boolean(prospect.archived_at)}
                >
                  <UserPlus2 className="w-3.5 h-3.5" /> Convert to customer
                </Button>
              ) : null}
              {!prospect.archived_at ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs gap-1.5 text-muted-foreground"
                  onClick={() => setArchiveOpen(true)}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Archive
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {prospect.archived_at ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100 flex items-center gap-1.5">
            <ArchiveRestore className="w-3.5 h-3.5" />
            Archived on {formatDateOnly(prospect.archived_at)} — read-only.
          </div>
        ) : null}

        <DrawerSection title="Pipeline">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Status" value={formatProspectStatus(prospect.status)} />
            <Stat
              label="Next follow-up"
              value={prospect.next_follow_up_at ? formatFollowUpStamp(prospect.next_follow_up_at) : "—"}
              valueClassName={followUpTone}
            />
            <Stat
              label="Last contacted"
              value={prospect.last_contacted_at ? formatFollowUpStamp(prospect.last_contacted_at) : "—"}
            />
            <Stat label="Estimated value" value={formatEstimatedValue(prospect.estimated_value_cents)} />
            <Stat label="Lead source" value={prospect.lead_source ?? "—"} />
            <Stat label="Created" value={formatDateOnly(prospect.created_at)} />
          </div>
        </DrawerSection>

        <DrawerSection title="Contact">
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{prospect.company_name}</span>
            </li>
            {prospect.contact_name ? (
              <li className="text-muted-foreground">{prospect.contact_name}</li>
            ) : null}
            {prospect.contact_email ? (
              <li className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <a className="text-primary hover:underline" href={`mailto:${prospect.contact_email}`}>
                  {prospect.contact_email}
                </a>
              </li>
            ) : null}
            {prospect.contact_phone ? (
              <li className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                <a className="text-primary hover:underline" href={`tel:${prospect.contact_phone}`}>
                  {prospect.contact_phone}
                </a>
              </li>
            ) : null}
          </ul>
        </DrawerSection>

        {prospect.notes ? (
          <DrawerSection title="Notes">
            <p className="text-sm whitespace-pre-wrap text-foreground/80">{prospect.notes}</p>
          </DrawerSection>
        ) : null}

        {prospect.converted_customer_id ? (
          <DrawerSection title="Converted">
            <p className="text-sm text-muted-foreground">
              Converted on {formatDateOnly(prospect.converted_at)}.
            </p>
            <Link
              href={`/customers/${prospect.converted_customer_id}`}
              className="text-sm text-primary hover:underline inline-flex items-center gap-1.5 mt-1"
            >
              <Building2 className="w-3.5 h-3.5" />
              {prospect.converted_customer_name ?? "Open customer"}
            </Link>
          </DrawerSection>
        ) : null}

        <DrawerSection title="Follow-up timeline">
          {loadingTimeline ? (
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading timeline…
            </p>
          ) : timeline.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No follow-ups logged yet. Use <strong>Log follow-up</strong> to add the first touch.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {timeline.map((ev) => (
                <li key={ev.id} className="py-2.5 space-y-0.5">
                  <p className="text-sm font-medium">{ev.title}</p>
                  {ev.summary ? <p className="text-xs text-muted-foreground">{ev.summary}</p> : null}
                  {ev.body ? (
                    <p className="text-xs text-foreground/70 whitespace-pre-wrap">{ev.body}</p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground/80">
                    {formatFollowUpStamp(ev.sent_at ?? ev.created_at)}
                    {ev.channel ? <span> · {ev.channel}</span> : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </DrawerSection>

        <DrawerSection title="All communications">
          <RecentCommunicationsCard
            entityType="prospect"
            entityId={prospect.id}
            limit={4}
            title="Recent communications"
            description="Cross-channel timeline including AI drafts and workflow automation runs."
          />
        </DrawerSection>

        <DrawerSection title="Growth roadmap">
          <p className="text-xs text-muted-foreground inline-flex items-start gap-1.5">
            <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
            <span>
              {aiDraftAvailable
                ? "AI follow-up drafting is live. Coming next: campaigns, review & referral asks, and automated nurture sequences keyed to status changes."
                : "Coming next: AI follow-up suggestions, campaigns, review & referral asks, and automated nurture sequences keyed to status changes."}
            </span>
          </p>
        </DrawerSection>
      </DetailDrawer>

      <AiDraftFollowUpDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        organizationId={organizationId}
        prospect={prospect}
        onSavedAsNote={() => {
          onChanged()
          void refreshTimeline()
        }}
      />

      <ProspectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        organizationId={organizationId}
        prospect={prospect}
        onSaved={() => {
          onChanged()
        }}
      />

      <LogFollowUpDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        organizationId={organizationId}
        prospect={prospect}
        onLogged={() => {
          onChanged()
          void refreshTimeline()
        }}
      />

      <ConvertProspectDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        organizationId={organizationId}
        prospect={prospect}
        onConverted={() => {
          onChanged()
        }}
      />

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive prospect?</AlertDialogTitle>
            <AlertDialogDescription>
              The prospect will be hidden from the active list but its history is preserved. You can
              restore it later by switching the list filter to "Archived".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleArchive()} disabled={archiving}>
              {archiving ? "Archiving…" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function Stat({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </p>
      <p className={cn("text-sm font-medium", valueClassName)}>{value}</p>
    </div>
  )
}
