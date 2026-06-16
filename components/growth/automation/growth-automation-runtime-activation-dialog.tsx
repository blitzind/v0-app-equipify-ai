"use client"

import { Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { GrowthAutomationRuntimeStatusResult } from "@/lib/growth/automation/growth-automation-runtime-publisher-types"

type Props = {
  readiness: GrowthAutomationRuntimeStatusResult["activationReadiness"] | null
  loading?: boolean
  onConfirm: () => void
}

export function GrowthAutomationRuntimeActivationDialog({ readiness, loading, onConfirm }: Props) {
  const canActivate = readiness?.canActivate ?? false

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" disabled={!canActivate || loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          Activate runtime
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Activate SR-3 runtime pattern</DialogTitle>
          <DialogDescription>
            Marks the compiled pattern active for future enrollment wiring. Sequence execution, sends,
            notifications, and provider calls remain disabled.
          </DialogDescription>
        </DialogHeader>
        {readiness?.blockedReasons.length ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">
            {readiness.blockedReasons.map((reason) => (
              <p key={reason}>{reason}</p>
            ))}
          </div>
        ) : null}
        <DialogFooter>
          <Button disabled={!canActivate || loading} onClick={onConfirm}>
            Confirm activation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
