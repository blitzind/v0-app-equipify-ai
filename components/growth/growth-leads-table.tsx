"use client"

import { useMemo, useState } from "react"
import {
  Archive,
  Loader2,
  Mail,
  MoreHorizontal,
  PanelRightOpen,
  Phone,
} from "lucide-react"
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
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { GrowthCallActionSheet } from "@/components/growth/growth-call-action-sheet"
import { GROWTH_NEXT_BEST_ACTION_LABELS } from "@/lib/growth/nba-types"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthLeadsTableProps = {
  leads: GrowthLead[]
  onOpenLead?: (lead: GrowthLead) => void
  onArchiveLead?: (lead: GrowthLead) => Promise<void>
  onBulkArchive?: (leadIds: string[]) => Promise<void>
  archivingLeadId?: string | null
  bulkArchiving?: boolean
}

export function GrowthLeadsTable({
  leads,
  onOpenLead,
  onArchiveLead,
  onBulkArchive,
  archivingLeadId = null,
  bulkArchiving = false,
}: GrowthLeadsTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [archiveTarget, setArchiveTarget] = useState<GrowthLead | "bulk" | null>(null)
  const [callTarget, setCallTarget] = useState<GrowthLead | null>(null)

  const visibleIds = useMemo(() => leads.map((lead) => lead.id), [leads])
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id))

  function toggleAllVisible(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        for (const id of visibleIds) next.add(id)
      } else {
        for (const id of visibleIds) next.delete(id)
      }
      return next
    })
  }

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function confirmArchive() {
    if (!archiveTarget) return
    if (archiveTarget === "bulk") {
      const ids = [...selectedIds]
      setArchiveTarget(null)
      await onBulkArchive?.(ids)
      setSelectedIds(new Set())
      return
    }
    const lead = archiveTarget
    setArchiveTarget(null)
    await onArchiveLead?.(lead)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(lead.id)
      return next
    })
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background px-6 py-12 text-center text-sm text-muted-foreground">
        No active growth leads. Add the first internal lead to start the inbox.
      </div>
    )
  }

  const selectedCount = selectedIds.size

  return (
    <TooltipProvider delayDuration={200}>
      <>
        {selectedCount > 0 ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
            <p className="text-sm font-medium">{selectedCount} selected</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={bulkArchiving}
                onClick={() => setArchiveTarget("bulk")}
              >
                {bulkArchiving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Archive className="mr-2 size-4" />}
                Archive Selected
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} disabled={bulkArchiving}>
                Clear Selection
              </Button>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="w-10 px-3 py-3">
                  <Checkbox
                    checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                    onCheckedChange={(value) => toggleAllVisible(value === true)}
                    aria-label="Select all visible leads"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Company</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Contact</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Priority</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Next Best Action</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {leads.map((lead) => {
                const email = lead.contactEmail?.trim() || null
                const phone = lead.contactPhone?.trim() || null
                const nbaLabel = lead.nextBestAction
                  ? GROWTH_NEXT_BEST_ACTION_LABELS[lead.nextBestAction] ?? lead.nextBestAction.replace(/_/g, " ")
                  : "—"

                return (
                  <tr key={lead.id} className="hover:bg-muted/30">
                    <td className="px-3 py-3 align-top">
                      <Checkbox
                        checked={selectedIds.has(lead.id)}
                        onCheckedChange={(value) => toggleRow(lead.id, value === true)}
                        aria-label={`Select ${lead.companyName}`}
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <button type="button" className="text-left" onClick={() => onOpenLead?.(lead)}>
                        <div className="font-medium text-foreground underline-offset-2 hover:underline">{lead.companyName}</div>
                        {lead.website ? <div className="text-xs text-muted-foreground">{lead.website}</div> : null}
                      </button>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div>{lead.contactName ?? "—"}</div>
                      {email ? <div className="text-xs text-muted-foreground">{email}</div> : null}
                      {phone ? <div className="text-xs text-muted-foreground">{phone}</div> : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="capitalize">{lead.sourceChannel ?? lead.sourceKind.replace(/_/g, " ")}</div>
                      {lead.sourceCampaign ? <div className="text-xs text-muted-foreground">{lead.sourceCampaign}</div> : null}
                    </td>
                    <td className="px-4 py-3 align-top capitalize text-muted-foreground">{lead.researchPriority}</td>
                    <td className="px-4 py-3 align-top text-muted-foreground">{nbaLabel}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap items-center gap-1">
                        {phone ? (
                          <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => setCallTarget(lead)}>
                            <Phone className="size-3.5" />
                            <span className="sr-only">Call</span>
                          </Button>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button size="sm" variant="outline" className="h-8 px-2" disabled>
                                  <Phone className="size-3.5" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>No phone on lead</TooltipContent>
                          </Tooltip>
                        )}

                        {email ? (
                          <Button size="sm" variant="outline" className="h-8 px-2" asChild>
                            <a href={`mailto:${email}`}>
                              <Mail className="size-3.5" />
                              <span className="sr-only">Email</span>
                            </a>
                          </Button>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button size="sm" variant="outline" className="h-8 px-2" disabled>
                                  <Mail className="size-3.5" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>No email on lead</TooltipContent>
                          </Tooltip>
                        )}

                        <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => onOpenLead?.(lead)}>
                          <PanelRightOpen className="size-3.5" />
                          <span className="sr-only">Open</span>
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-8 px-2">
                              <MoreHorizontal className="size-3.5" />
                              <span className="sr-only">More</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onOpenLead?.(lead)}>Open Lead</DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setArchiveTarget(lead)}
                            >
                              Archive Lead
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <AlertDialog open={archiveTarget != null} onOpenChange={(open) => !open && setArchiveTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {archiveTarget === "bulk"
                  ? `Archive ${selectedCount} selected leads?`
                  : `Archive ${archiveTarget?.companyName ?? "lead"}?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                Archived leads are removed from active Growth queues but preserved for audit/history. Timeline,
                outbound, call, and copilot records are not deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => void confirmArchive()}
              >
                Archive {archiveTarget === "bulk" ? "Selected" : "Lead"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {callTarget?.contactPhone ? (
          <GrowthCallActionSheet
            open={Boolean(callTarget)}
            onOpenChange={(open) => !open && setCallTarget(null)}
            leadId={callTarget.id}
            phone={callTarget.contactPhone}
            contactLabel={callTarget.contactName ?? callTarget.companyName}
          />
        ) : null}
      </>
    </TooltipProvider>
  )
}
