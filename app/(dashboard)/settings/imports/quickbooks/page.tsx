"use client"

import Link from "next/link"
import { useCallback, useState } from "react"
import { ArrowLeft, Loader2, Plug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield } from "lucide-react"

export default function QuickBooksMigrationPage() {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { has, status: permStatus } = useOrgPermissions()
  const { toast } = useToast()
  const allowed = has("canManageHistoricalImports")
  const [busy, setBusy] = useState(false)
  const [source, setSource] = useState("")

  const recordIntent = useCallback(async () => {
    if (!organizationId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/migration-imports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "quickbooks_snapshot", sourceSystem: source.trim() || null }),
      })
      const json = (await res.json()) as { message?: string }
      if (!res.ok) {
        toast({ title: "Could not record", description: json.message ?? "Request failed", variant: "destructive" })
        return
      }
      toast({ title: "Recorded", description: "Migration intent saved for your audit trail." })
    } catch {
      toast({ title: "Request failed", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }, [organizationId, source, toast])

  if (permStatus === "loading" || orgStatus !== "ready") {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="max-w-lg rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Shield className="h-5 w-5 text-primary" />
          Restricted
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          <Link href="/settings/imports" className="text-primary underline">
            Back to Migration center
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <Button variant="ghost" size="sm" asChild className="gap-1 -ml-2 self-start">
        <Link href="/settings/imports">
          <ArrowLeft className="h-4 w-4" />
          Migration center
        </Link>
      </Button>
      <div>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Plug className="h-6 w-6 text-primary" />
          QuickBooks continuity
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live sync runs from Integrations — no rewrite of the QuickBooks architecture. Record migration intent here for
          onboarding visibility; historical invoice backfill extends this flow in a future phase.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="qb-source">Source label (optional)</Label>
          <Input
            id="qb-source"
            placeholder="e.g. QuickBooks Desktop export Q2 2025"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </div>
        <Button type="button" onClick={() => void recordIntent()} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Record migration intent
        </Button>
      </div>
      <Button asChild variant="outline">
        <Link href="/settings/integrations/quickbooks">Open QuickBooks integration</Link>
      </Button>
    </div>
  )
}
