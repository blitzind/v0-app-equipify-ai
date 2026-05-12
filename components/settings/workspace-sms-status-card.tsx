"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Loader2, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import type { WorkspaceSmsWorkspaceDto } from "@/lib/sms/workspace-sms-types"
import { DEFAULT_WORKSPACE_SMS_DTO } from "@/lib/sms/workspace-sms-types"
import { cn } from "@/lib/utils"

type SmsApiResponse = {
  smsWorkspace?: WorkspaceSmsWorkspaceDto
  meta?: { smsPersistenceReady?: boolean }
  message?: string
  error?: string
}

export function WorkspaceSmsStatusCard({
  organizationId,
  canEdit,
}: {
  organizationId: string
  canEdit: boolean
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dto, setDto] = useState<WorkspaceSmsWorkspaceDto>({ ...DEFAULT_WORKSPACE_SMS_DTO })
  const [persistenceReady, setPersistenceReady] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/sms-workspace`, {
        cache: "no-store",
      })
      const json = (await res.json().catch(() => null)) as SmsApiResponse | null
      if (!res.ok || !json?.smsWorkspace) {
        throw new Error(typeof json?.message === "string" ? json.message : "Could not load SMS settings.")
      }
      setDto(json.smsWorkspace)
      setPersistenceReady(json.meta?.smsPersistenceReady !== false)
    } catch (e) {
      toast({
        variant: "destructive",
        title: "SMS workspace",
        description: e instanceof Error ? e.message : "Could not load SMS settings.",
      })
    } finally {
      setLoading(false)
    }
  }, [organizationId, toast])

  useEffect(() => {
    void load()
  }, [load])

  const patch = useCallback(
    async (partial: Record<string, unknown>) => {
      if (!canEdit) return
      setSaving(true)
      try {
        const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/sms-workspace`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(partial),
          cache: "no-store",
        })
        const json = (await res.json().catch(() => null)) as SmsApiResponse | null
        if (!res.ok || !json?.smsWorkspace) {
          throw new Error(typeof json?.message === "string" ? json.message : "Could not save SMS settings.")
        }
        setDto(json.smsWorkspace)
        toast({ title: "SMS workspace settings saved." })
      } catch (e) {
        toast({
          variant: "destructive",
          title: "Save failed",
          description: e instanceof Error ? e.message : "Could not save SMS settings.",
        })
      } finally {
        setSaving(false)
      }
    },
    [canEdit, organizationId, toast],
  )

  const busy = loading || saving

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-4 sm:px-6 border-b border-border flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary">
          <MessageSquare className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">SMS notifications (workspace)</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Transactional SMS only in this phase. Per-alert toggles live under{" "}
            <Link href="/settings/notifications#workspace-sms" className="font-medium text-primary hover:underline">
              Settings → Notifications
            </Link>
            . Provider credentials stay server-side.
          </p>
        </div>
      </div>
      <div className="px-4 py-4 sm:px-6 space-y-4">
        {!persistenceReady ?
          <p className="text-xs text-amber-900 dark:text-amber-100 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
            SMS workspace tables are not available on this server yet. Apply the latest database migrations.
          </p>
        : null}
        {loading ?
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading…
          </div>
        : (
          <>
            <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5",
                  dto.smsChannelConfigurable ? "ds-badge-success border" : "border-border text-muted-foreground",
                )}
              >
                {dto.smsChannelConfigurable ? "Per-alert SMS unlocked" : "Per-alert SMS locked"}
              </span>
              <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground capitalize">
                Compliance: {dto.complianceStatus.replaceAll("_", " ")}
              </span>
              <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground uppercase">
                Provider: {dto.providerKind}
              </span>
            </div>
            <div className="flex flex-col gap-3 max-w-lg">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">SMS master</p>
                  <p className="text-xs text-muted-foreground">Intent to use SMS for this workspace.</p>
                </div>
                <Switch
                  checked={dto.smsMasterEnabled}
                  disabled={!canEdit || busy || !persistenceReady}
                  onCheckedChange={(v) => void patch({ smsMasterEnabled: v })}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Require opt-in</p>
                  <p className="text-xs text-muted-foreground">Send pipeline requires recorded consent per number.</p>
                </div>
                <Switch
                  checked={dto.optInRequired}
                  disabled={!canEdit || busy || !persistenceReady}
                  onCheckedChange={(v) => void patch({ optInRequired: v })}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Provider configured</p>
                  <p className="text-xs text-muted-foreground">Confirm credentials are set in hosting (not shown here).</p>
                </div>
                <Switch
                  checked={dto.providerConfigured}
                  disabled={!canEdit || busy || !persistenceReady}
                  onCheckedChange={(v) => void patch({ providerConfigured: v })}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs h-8"
                  disabled={
                    !canEdit || busy || !persistenceReady || dto.complianceStatus === "pending_review" || dto.complianceStatus === "approved"
                  }
                  onClick={() => void patch({ complianceStatus: "pending_review" })}
                >
                  Submit compliance for review
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
