"use client"

import { useAdmin } from "@/lib/admin-store"
import { useFirstRun } from "@/hooks/use-first-run"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const FALLBACK_WELCOME = {
  title: "Welcome to your workspace",
  paragraphs: [
    "We have already added example customers, jobs, and billing so you can explore a realistic workflow — not an empty shell.",
    "Your workspace is tuned for your sector. Add your own records whenever you like; they stay separate from the examples.",
    "Removing example data later clears only those labeled items — nothing you create is touched. You can bring examples back anytime under Settings → Sample data.",
  ],
}

/**
 * One-time welcome for workspaces that ship with illustrative sample content.
 * Acknowledgment is stored per user + org in Supabase Auth `user_metadata` (see first-run API).
 */
export function FirstRunWelcomeGate() {
  const { impersonation } = useAdmin()
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { permissions, status: permStatus } = useOrgPermissions()
  const technicianFocused =
    permissions.canUseTechnicianWorkspace &&
    permissions.canViewAssignedWorkOrdersOnly &&
    !permissions.canViewFinancials

  const enabled =
    orgStatus === "ready" &&
    Boolean(organizationId) &&
    permStatus === "ready" &&
    !technicianFocused &&
    !impersonation.active

  const { data, patch } = useFirstRun(organizationId, enabled)

  const open = Boolean(
    data?.hasSampleWorkspace && !data.welcomeAckedForOrg && enabled,
  )

  const welcome = data?.welcomeCopy ?? FALLBACK_WELCOME

  async function onContinue() {
    if (!organizationId) return
    await patch("ack_welcome")
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && void onContinue()}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-tight">{welcome.title}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pt-1">
              {welcome.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-end gap-2">
          <Button type="button" onClick={() => void onContinue()}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
