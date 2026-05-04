"use client"

import { Loader2, MapPin, User } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TechnicianAssignOption } from "@/lib/work-orders/load-technician-assign-options"
import { TechnicianAvatar } from "@/components/technician/technician-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

function initialsFromLabel(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function AssignTechnicianDialog({
  open,
  onOpenChange,
  options,
  currentTechnicianId,
  savingKey,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  options: TechnicianAssignOption[]
  /** Work order `technicianId` (or `"unassigned"`). */
  currentTechnicianId: string
  /** `"unassigned"` | user id | null when idle */
  savingKey: string | null
  onSelect: (userId: string | null) => void
}) {
  const busy = savingKey !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Assign technician</DialogTitle>
          <DialogDescription className="text-xs">
            Choose a team member for this work order. Changes save immediately.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] px-6">
          <div className="space-y-2 pb-2 pr-3">
            {options.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No technicians found in this organization.
              </p>
            ) : (
              options.map((opt) => {
                const selected = currentTechnicianId === opt.id
                const loadingThis = savingKey === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={busy}
                    onClick={() => onSelect(opt.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors cursor-pointer",
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border bg-card hover:bg-muted/40",
                      busy && !loadingThis && "opacity-50 pointer-events-none",
                    )}
                  >
                    <TechnicianAvatar
                      userId={opt.id}
                      name={opt.label}
                      initials={initialsFromLabel(opt.label)}
                      avatarUrl={opt.avatarUrl}
                      size="md"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">{opt.label}</span>
                        {loadingThis ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                        <User className="w-3 h-3 shrink-0" />
                        <span className="truncate">{opt.roleLabel}</span>
                        <span className="text-muted-foreground/50">·</span>
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span>{opt.region}</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        <Badge variant="secondary" className="text-[10px] font-medium">
                          {opt.fieldStatus}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-medium">
                          {opt.membershipLabel}
                        </Badge>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border shrink-0 flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto cursor-pointer"
            disabled={busy || currentTechnicianId === "unassigned"}
            onClick={() => onSelect(null)}
          >
            {savingKey === "unassigned" ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Unassign
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
